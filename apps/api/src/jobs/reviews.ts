import { Worker, type Job } from "bullmq";
import { and, eq, sql } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import {
  appointments,
  customers,
  reviewInvitations,
  salons,
  services,
} from "@esse-beauty/db/schema";

import { issuePublicToken } from "../lib/public-tokens.js";
import { sendEmail, sendSms } from "./notifications.js";
import { QUEUE_NAMES, redisConnection } from "./queues.js";

export interface ReviewRequestJob {
  invitationId: string;
}

const REVIEW_INVITATION_TTL_MS = 30 * 24 * 60 * 60_000;

export async function ensureReviewInvitation(
  db: DrizzleDB,
  appointmentId: string,
  options: { expiresAt?: Date } = {},
): Promise<typeof reviewInvitations.$inferSelect> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        appointmentId: appointments.id,
        email: customers.email,
        phone: customers.phone,
        salonId: appointments.salonId,
        status: appointments.status,
      })
      .from(appointments)
      .innerJoin(customers, eq(customers.id, appointments.customerId))
      .where(eq(appointments.id, appointmentId));
    const appointment = rows[0];
    if (!appointment || appointment.status !== "completed") {
      throw new Error("REVIEW_APPOINTMENT_NOT_COMPLETED");
    }

    const inserted = await tx
      .insert(reviewInvitations)
      .values({
        appointmentId: appointment.appointmentId,
        channel: appointment.email ? "email" : "sms",
        deliveryStatus: appointment.email || appointment.phone ? "pending" : "skipped",
        expiresAt: options.expiresAt ?? new Date(Date.now() + REVIEW_INVITATION_TTL_MS),
        salonId: appointment.salonId,
      })
      .onConflictDoNothing({ target: reviewInvitations.appointmentId })
      .returning();
    if (inserted[0]) return inserted[0];

    const existing = await tx
      .select()
      .from(reviewInvitations)
      .where(eq(reviewInvitations.appointmentId, appointmentId));
    if (!existing[0]) throw new Error("REVIEW_INVITATION_CREATE_FAILED");
    return existing[0];
  });
}

async function prepareDelivery(db: DrizzleDB, invitationId: string) {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        channel: reviewInvitations.channel,
        consumedAt: reviewInvitations.consumedAt,
        customerName: customers.fullName,
        deliveredAt: reviewInvitations.deliveredAt,
        email: customers.email,
        expiresAt: reviewInvitations.expiresAt,
        invitationId: reviewInvitations.id,
        phone: customers.phone,
        revokedAt: reviewInvitations.revokedAt,
        salonName: salons.name,
        serviceName: services.name,
      })
      .from(reviewInvitations)
      .innerJoin(appointments, eq(appointments.id, reviewInvitations.appointmentId))
      .innerJoin(customers, eq(customers.id, appointments.customerId))
      .innerJoin(salons, eq(salons.id, reviewInvitations.salonId))
      .innerJoin(services, eq(services.id, appointments.serviceId))
      .where(eq(reviewInvitations.id, invitationId))
      .for("update");
    const invitation = rows[0];
    if (
      !invitation ||
      invitation.consumedAt ||
      invitation.deliveredAt ||
      invitation.revokedAt
    ) return undefined;
    if (invitation.expiresAt <= new Date()) {
      await tx.update(reviewInvitations).set({
        deliveryFailure: "INVITATION_EXPIRED",
        deliveryStatus: "failed",
        updatedAt: new Date(),
      }).where(eq(reviewInvitations.id, invitationId));
      return undefined;
    }

    const token = issuePublicToken("review", invitation.invitationId, invitation.expiresAt);
    await tx.update(reviewInvitations).set({
      deliveryAttempts: sql`${reviewInvitations.deliveryAttempts} + 1`,
      deliveryFailure: null,
      deliveryStatus: "processing",
      lastDeliveryAttemptAt: new Date(),
      tokenHash: token.tokenHash,
      updatedAt: new Date(),
    }).where(eq(reviewInvitations.id, invitationId));
    return { ...invitation, rawToken: token.raw };
  });
}

export async function processReviewRequest(
  db: DrizzleDB,
  job: Job<ReviewRequestJob>,
): Promise<void> {
  const delivery = await prepareDelivery(db, job.data.invitationId);
  if (!delivery) return;
  try {
    const pwaUrl = (process.env.PWA_URL ?? "http://localhost:3002").replace(/\/$/, "");
    const reviewUrl = `${pwaUrl}/review/${encodeURIComponent(delivery.rawToken)}`;
    if (delivery.channel === "email" && delivery.email) {
      await sendEmail(
        delivery.email,
        `Come è andato il tuo appuntamento da ${delivery.salonName}?`,
        `<p>Ciao ${delivery.customerName},</p><p>raccontaci come è andato ${delivery.serviceName}.</p><p><a href="${reviewUrl}">Lascia una recensione</a></p>`,
      );
    } else if (delivery.channel === "sms" && delivery.phone) {
      await sendSms(delivery.phone, `Raccontaci come è andato ${delivery.serviceName}: ${reviewUrl}`);
    } else {
      await db.update(reviewInvitations).set({ deliveryFailure: "RECIPIENT_UNAVAILABLE", deliveryStatus: "skipped", updatedAt: new Date() })
        .where(eq(reviewInvitations.id, delivery.invitationId));
      return;
    }
    await db.update(reviewInvitations).set({ deliveredAt: new Date(), deliveryFailure: null, deliveryStatus: "sent", updatedAt: new Date() })
      .where(eq(reviewInvitations.id, delivery.invitationId));
  } catch {
    await db.update(reviewInvitations).set({ deliveryFailure: "PROVIDER_DELIVERY_FAILED", deliveryStatus: "failed", updatedAt: new Date() })
      .where(and(eq(reviewInvitations.id, delivery.invitationId), eq(reviewInvitations.deliveryStatus, "processing")));
    throw new Error("REVIEW_DELIVERY_FAILED");
  }
}

export function startReviewWorker(db: DrizzleDB): Worker<ReviewRequestJob> {
  return new Worker(
    QUEUE_NAMES.REVIEWS,
    (job) => processReviewRequest(db, job),
    {
      connection: redisConnection(),
    },
  );
}
