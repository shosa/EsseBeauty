import { randomUUID } from "node:crypto";

import { Worker, type Job, type JobsOptions } from "bullmq";
import { and, eq, gt, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import {
  appointments,
  customers,
  reviewInvitationDeliveries,
  reviewInvitations,
  salons,
  services,
} from "@esse-beauty/db/schema";

import { issueStablePublicToken } from "../lib/public-tokens.js";
import { sendEmail } from "./notifications.js";
import { enqueueCommunication } from "./communications.js";
import { getQueue, QUEUE_NAMES, redisConnection } from "./queues.js";

export interface ReviewRequestJob {
  deliveryId?: string;
  invitationId: string;
}

export interface ReviewQueue {
  add(name: string, data: ReviewRequestJob, options?: JobsOptions): Promise<unknown>;
  upsertJobScheduler(
    schedulerId: string,
    repeatOptions: { every: number },
    jobTemplate: { name: string },
  ): Promise<unknown>;
}

export const REVIEW_JOB_OPTIONS = {
  attempts: 5,
  backoff: { delay: 30_000, type: "exponential" as const },
  removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
  removeOnFail: { age: 7 * 24 * 60 * 60 },
} satisfies JobsOptions;

const REVIEW_INVITATION_TTL_MS = 30 * 24 * 60 * 60_000;
const REVIEW_DELIVERY_LEASE_MS = 5 * 60_000;
const REVIEW_DELIVERY_DELAY_MS = 30 * 60_000;
export const REVIEW_MAX_DELIVERY_ATTEMPTS = 5;

function reviewTokenSecret(): string {
  const secret = process.env.REVIEW_TOKEN_SECRET;
  if (!secret) throw new Error("REVIEW_TOKEN_SECRET is required");
  return secret;
}

export function buildReviewInviteUrl(pwaBaseUrl: string, rawToken: string): string {
  const base = pwaBaseUrl.replace(/\/$/, "");
  return `${base}/review#token=${encodeURIComponent(rawToken)}`;
}

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
        channel: appointment.email ? "email" : "whatsapp",
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

async function enqueueInvitation(
  queue: ReviewQueue,
  invitation: Pick<
    typeof reviewInvitations.$inferSelect,
    "createdAt" | "deliveryAttempts" | "deliveryGeneration" | "id"
  >,
): Promise<void> {
  await queue.add(
    "send-request",
    { invitationId: invitation.id },
    {
      ...REVIEW_JOB_OPTIONS,
      delay: Math.max(
        0,
        invitation.createdAt.getTime() + REVIEW_DELIVERY_DELAY_MS - Date.now(),
      ),
      jobId: `review-${invitation.id}-${invitation.deliveryGeneration}-${invitation.deliveryAttempts}`,
    },
  );
}

export async function scheduleReviewInvitation(
  db: DrizzleDB,
  appointmentId: string,
  queue: ReviewQueue = getQueue(QUEUE_NAMES.REVIEWS),
): Promise<typeof reviewInvitations.$inferSelect> {
  const invitation = await ensureReviewInvitation(db, appointmentId);
  if (
    ["pending", "failed"].includes(invitation.deliveryStatus) &&
    invitation.deliveryAttempts < REVIEW_MAX_DELIVERY_ATTEMPTS
  ) {
    await enqueueInvitation(queue, invitation);
  }
  return invitation;
}

export async function scheduleReviewRequest(
  db: DrizzleDB,
  appointmentId: string,
  input: { channels: Array<"email" | "whatsapp">; scheduledAt: Date; resend?: boolean },
  queue: ReviewQueue = getQueue(QUEUE_NAMES.REVIEWS),
) {
  const invitation = await ensureReviewInvitation(db, appointmentId);
  if (invitation.consumedAt || invitation.revokedAt) throw new Error("REVIEW_INVITATION_NOT_SENDABLE");
  const generation = input.resend ? invitation.deliveryGeneration + 1 : invitation.deliveryGeneration;
  if (input.resend) await db.update(reviewInvitations).set({ deliveryGeneration: generation, updatedAt: new Date() }).where(eq(reviewInvitations.id, invitation.id));
  const deliveries = [];
  for (const channel of [...new Set(input.channels)]) {
    const inserted = await db.insert(reviewInvitationDeliveries).values({ channel, generation, invitationId: invitation.id, salonId: invitation.salonId, scheduledAt: input.scheduledAt, status: "scheduled" }).onConflictDoNothing().returning();
    const delivery = inserted[0] ?? (await db.select().from(reviewInvitationDeliveries).where(and(eq(reviewInvitationDeliveries.invitationId, invitation.id), eq(reviewInvitationDeliveries.channel, channel), eq(reviewInvitationDeliveries.generation, generation))))[0];
    if (!delivery) continue;
    await queue.add("send-channel-request", { deliveryId: delivery.id, invitationId: invitation.id }, { ...REVIEW_JOB_OPTIONS, delay: Math.max(0, delivery.scheduledAt.getTime() - Date.now()), jobId: `review-${invitation.id}-${channel}-${generation}-${delivery.attempts}` });
    deliveries.push(delivery);
  }
  return { deliveries, invitation };
}

export async function recoverReviewInvitations(
  db: DrizzleDB,
  queue: ReviewQueue = getQueue(QUEUE_NAMES.REVIEWS),
): Promise<number> {
  const now = new Date();
  const candidates = await db
    .select({
      deliveryAttempts: reviewInvitations.deliveryAttempts,
      deliveryGeneration: reviewInvitations.deliveryGeneration,
      createdAt: reviewInvitations.createdAt,
      id: reviewInvitations.id,
    })
    .from(reviewInvitations)
    .where(and(
      isNull(reviewInvitations.consumedAt),
      isNull(reviewInvitations.deliveredAt),
      isNull(reviewInvitations.revokedAt),
      gt(reviewInvitations.expiresAt, now),
      lt(reviewInvitations.deliveryAttempts, REVIEW_MAX_DELIVERY_ATTEMPTS),
      or(
        inArray(reviewInvitations.deliveryStatus, ["pending", "failed"]),
        and(
          eq(reviewInvitations.deliveryStatus, "processing"),
          or(
            isNull(reviewInvitations.deliveryLeaseExpiresAt),
            lte(reviewInvitations.deliveryLeaseExpiresAt, now),
          ),
        ),
      ),
    ))
    .limit(100);
  let enqueued = 0;
  for (const invitation of candidates) {
    try {
      await enqueueInvitation(queue, invitation);
      enqueued += 1;
    } catch {
      // Invitation state remains durable for the next scheduled scan.
    }
  }
  return enqueued;
}

export async function retryReviewInvitation(
  db: DrizzleDB,
  salonId: string,
  invitationId: string,
  queue: ReviewQueue = getQueue(QUEUE_NAMES.REVIEWS),
): Promise<typeof reviewInvitations.$inferSelect | undefined> {
  const retried = await db
    .update(reviewInvitations)
    .set({
      deliveredAt: null,
      deliveryAttempts: 0,
      deliveryGeneration: sql`${reviewInvitations.deliveryGeneration} + 1`,
      deliveryClaimId: null,
      deliveryFailure: null,
      deliveryLeaseExpiresAt: null,
      deliveryStatus: "pending",
      lastDeliveryAttemptAt: null,
      tokenHash: null,
      updatedAt: new Date(),
    })
    .where(and(
      eq(reviewInvitations.id, invitationId),
      eq(reviewInvitations.salonId, salonId),
      eq(reviewInvitations.deliveryStatus, "exhausted"),
      gt(reviewInvitations.expiresAt, new Date()),
      isNull(reviewInvitations.consumedAt),
      isNull(reviewInvitations.revokedAt),
    ))
    .returning();
  const invitation = retried[0];
  if (!invitation) return undefined;
  await enqueueInvitation(queue, invitation);
  return invitation;
}

export async function registerReviewRecoverySchedule(
  queue: ReviewQueue = getQueue(QUEUE_NAMES.REVIEWS),
): Promise<void> {
  await queue.upsertJobScheduler(
    "recover-review-invitations",
    { every: 5 * 60_000 },
    { name: "recover" },
  );
}

async function prepareDelivery(db: DrizzleDB, invitationId: string) {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        channel: reviewInvitations.channel,
        consumedAt: reviewInvitations.consumedAt,
        customerName: customers.fullName,
        deliveredAt: reviewInvitations.deliveredAt,
        deliveryAttempts: reviewInvitations.deliveryAttempts,
        deliveryLeaseExpiresAt: reviewInvitations.deliveryLeaseExpiresAt,
        deliveryStatus: reviewInvitations.deliveryStatus,
        email: customers.email,
        expiresAt: reviewInvitations.expiresAt,
        invitationId: reviewInvitations.id,
        phone: customers.phone,
        revokedAt: reviewInvitations.revokedAt,
        salonId: reviewInvitations.salonId,
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
    if (invitation.deliveryAttempts >= REVIEW_MAX_DELIVERY_ATTEMPTS) {
      await tx.update(reviewInvitations).set({
        deliveryClaimId: null,
        deliveryFailure: "DELIVERY_ATTEMPTS_EXHAUSTED",
        deliveryLeaseExpiresAt: null,
        deliveryStatus: "exhausted",
        updatedAt: new Date(),
      }).where(eq(reviewInvitations.id, invitationId));
      return undefined;
    }
    const hasDestination =
      (invitation.channel === "email" && Boolean(invitation.email)) ||
      (invitation.channel === "whatsapp" && Boolean(invitation.phone));
    if (!hasDestination) {
      await tx.update(reviewInvitations).set({
        deliveryClaimId: null,
        deliveryFailure: "RECIPIENT_UNAVAILABLE",
        deliveryLeaseExpiresAt: null,
        deliveryStatus: "skipped",
        updatedAt: new Date(),
      }).where(eq(reviewInvitations.id, invitationId));
      return undefined;
    }
    if (invitation.expiresAt <= new Date()) {
      await tx.update(reviewInvitations).set({
        deliveryFailure: "INVITATION_EXPIRED",
        deliveryStatus: "failed",
        updatedAt: new Date(),
      }).where(eq(reviewInvitations.id, invitationId));
      return undefined;
    }

    const now = new Date();
    if (
      invitation.deliveryStatus === "processing" &&
      invitation.deliveryLeaseExpiresAt &&
      invitation.deliveryLeaseExpiresAt > now
    ) return undefined;

    const claimId = randomUUID();
    const token = invitation.channel === "email"
      ? issueStablePublicToken(
          "review",
          invitation.invitationId,
          invitation.expiresAt,
          reviewTokenSecret(),
        )
      : undefined;
    await tx.update(reviewInvitations).set({
      deliveryClaimId: claimId,
      deliveryAttempts: sql`${reviewInvitations.deliveryAttempts} + 1`,
      deliveryFailure: null,
      deliveryLeaseExpiresAt: new Date(now.getTime() + REVIEW_DELIVERY_LEASE_MS),
      deliveryStatus: "processing",
      lastDeliveryAttemptAt: now,
      tokenHash: token?.tokenHash ?? null,
      updatedAt: new Date(),
    }).where(eq(reviewInvitations.id, invitationId));
    return {
      ...invitation,
      attemptNumber: invitation.deliveryAttempts + 1,
      claimId,
      rawToken: token?.raw,
    };
  });
}

interface ReviewDeliveryDependencies {
  emailSender?: typeof sendEmail;
  enqueue?: typeof enqueueCommunication;
}

export async function processReviewRequest(
  db: DrizzleDB,
  job: Job<ReviewRequestJob>,
  dependencies: ReviewDeliveryDependencies = {},
): Promise<void> {
  const delivery = await prepareDelivery(db, job.data.invitationId);
  if (!delivery) return;
  try {
    const emailSender = dependencies.emailSender ?? sendEmail;
    const pwaUrl = (process.env.PWA_URL ?? "http://localhost:3002").replace(/\/$/, "");
    const reviewUrl = delivery.rawToken
      ? buildReviewInviteUrl(pwaUrl, delivery.rawToken)
      : undefined;
    if (delivery.channel === "email" && delivery.email) {
      await emailSender(
        delivery.email,
        `Come è andato il tuo appuntamento da ${delivery.salonName}?`,
        `<p>Ciao ${delivery.customerName},</p><p>raccontaci come è andato ${delivery.serviceName}.</p><p><a href="${reviewUrl}">Lascia una recensione</a></p>`,
        { idempotencyKey: `review-invitation-${delivery.invitationId}` },
      );
    } else if (delivery.channel === "whatsapp" && delivery.phone) {
      await (dependencies.enqueue ?? enqueueCommunication)(db, {
        idempotencyKey: `review-invitation-${delivery.invitationId}`,
        kind: "template",
        salonId: delivery.salonId,
        sourceId: delivery.invitationId,
        sourceType: "review_invitation",
        template: {
          locale: "it",
          name: "review_invitation",
          parameters: [delivery.customerName, delivery.serviceName, "__review_url__"],
        },
        to: delivery.phone,
      });
    }
    await db.update(reviewInvitations).set({
      deliveredAt: delivery.channel === "email" ? new Date() : null,
      deliveryClaimId: null,
      deliveryFailure: null,
      deliveryLeaseExpiresAt: null,
      deliveryStatus: delivery.channel === "email" ? "sent" : "queued",
      updatedAt: new Date(),
    }).where(and(
      eq(reviewInvitations.id, delivery.invitationId),
      eq(reviewInvitations.deliveryClaimId, delivery.claimId),
    ));
  } catch {
    const exhausted = delivery.attemptNumber >= REVIEW_MAX_DELIVERY_ATTEMPTS;
    await db.update(reviewInvitations).set({
      deliveryClaimId: null,
      deliveryFailure: exhausted
        ? "DELIVERY_ATTEMPTS_EXHAUSTED"
        : "PROVIDER_DELIVERY_FAILED",
      deliveryLeaseExpiresAt: null,
      deliveryStatus: exhausted ? "exhausted" : "failed",
      updatedAt: new Date(),
    }).where(and(
      eq(reviewInvitations.id, delivery.invitationId),
      eq(reviewInvitations.deliveryClaimId, delivery.claimId),
      eq(reviewInvitations.deliveryStatus, "processing"),
    ));
    throw new Error("REVIEW_DELIVERY_FAILED");
  }
}

async function prepareChannelDelivery(db: DrizzleDB, deliveryId: string) {
  return db.transaction(async (tx) => {
    const rows = await tx.select({
      attempts: reviewInvitationDeliveries.attempts,
      channel: reviewInvitationDeliveries.channel,
      consumedAt: reviewInvitations.consumedAt,
      customerName: customers.fullName,
      deliveryId: reviewInvitationDeliveries.id,
      email: customers.email,
      expiresAt: reviewInvitations.expiresAt,
      generation: reviewInvitationDeliveries.generation,
      invitationId: reviewInvitations.id,
      phone: customers.phone,
      revokedAt: reviewInvitations.revokedAt,
      salonId: reviewInvitations.salonId,
      salonName: salons.name,
      serviceName: services.name,
      status: reviewInvitationDeliveries.status,
    }).from(reviewInvitationDeliveries)
      .innerJoin(reviewInvitations, eq(reviewInvitations.id, reviewInvitationDeliveries.invitationId))
      .innerJoin(appointments, eq(appointments.id, reviewInvitations.appointmentId))
      .innerJoin(customers, eq(customers.id, appointments.customerId))
      .innerJoin(salons, eq(salons.id, reviewInvitations.salonId))
      .innerJoin(services, eq(services.id, appointments.serviceId))
      .where(eq(reviewInvitationDeliveries.id, deliveryId)).for("update");
    const delivery = rows[0];
    if (!delivery || delivery.consumedAt || delivery.revokedAt || ["delivered", "sent", "queued", "skipped", "exhausted", "processing"].includes(delivery.status)) return undefined;
    const destination = delivery.channel === "email" ? delivery.email : delivery.channel === "whatsapp" ? delivery.phone : null;
    if (!destination) {
      await tx.update(reviewInvitationDeliveries).set({ failureReason: "missing_contact", status: "skipped" }).where(eq(reviewInvitationDeliveries.id, deliveryId));
      return undefined;
    }
    if (delivery.expiresAt <= new Date()) {
      await tx.update(reviewInvitationDeliveries).set({ failureReason: "invitation_expired", status: "failed" }).where(eq(reviewInvitationDeliveries.id, deliveryId));
      return undefined;
    }
    const token = delivery.channel === "email" ? issueStablePublicToken("review", delivery.invitationId, delivery.expiresAt, reviewTokenSecret()) : undefined;
    await tx.update(reviewInvitationDeliveries).set({ attempts: sql`${reviewInvitationDeliveries.attempts} + 1`, failureReason: null, lastAttemptAt: new Date(), status: "processing" }).where(eq(reviewInvitationDeliveries.id, deliveryId));
    if (token) await tx.update(reviewInvitations).set({ tokenHash: token.tokenHash, updatedAt: new Date() }).where(eq(reviewInvitations.id, delivery.invitationId));
    return { ...delivery, attemptNumber: delivery.attempts + 1, rawToken: token?.raw };
  });
}

export async function processChannelReviewRequest(db: DrizzleDB, job: Job<ReviewRequestJob>, dependencies: ReviewDeliveryDependencies = {}) {
  if (!job.data.deliveryId) return;
  const delivery = await prepareChannelDelivery(db, job.data.deliveryId);
  if (!delivery) return;
  try {
    const pwaUrl = (process.env.PWA_URL ?? "http://localhost:3002").replace(/\/$/, "");
    if (delivery.channel === "email" && delivery.email && delivery.rawToken) {
      await (dependencies.emailSender ?? sendEmail)(delivery.email, `Come è andato il tuo appuntamento da ${delivery.salonName}?`, `<p>Ciao ${delivery.customerName},</p><p>raccontaci come è andato ${delivery.serviceName}.</p><p><a href="${buildReviewInviteUrl(pwaUrl, delivery.rawToken)}">Lascia una recensione</a></p>`, { idempotencyKey: `review-invitation-${delivery.invitationId}-email-${delivery.generation}` });
    } else if (delivery.channel === "whatsapp" && delivery.phone) {
      await (dependencies.enqueue ?? enqueueCommunication)(db, { idempotencyKey: `review-invitation-${delivery.invitationId}-whatsapp-${delivery.generation}`, kind: "template", salonId: delivery.salonId, sourceId: delivery.invitationId, sourceType: "review_invitation", template: { locale: "it", name: "review_invitation", parameters: [delivery.customerName, delivery.serviceName, "__review_url__"] }, to: delivery.phone });
    }
    await db.update(reviewInvitationDeliveries).set({ deliveredAt: delivery.channel === "email" ? new Date() : null, failureReason: null, status: delivery.channel === "email" ? "delivered" : "queued" }).where(eq(reviewInvitationDeliveries.id, delivery.deliveryId));
  } catch {
    const exhausted = delivery.attemptNumber >= REVIEW_MAX_DELIVERY_ATTEMPTS;
    await db.update(reviewInvitationDeliveries).set({ failureReason: exhausted ? "attempts_exhausted" : "provider_failure", status: exhausted ? "exhausted" : "failed" }).where(eq(reviewInvitationDeliveries.id, delivery.deliveryId));
    throw new Error("REVIEW_DELIVERY_FAILED");
  }
}

export function startReviewWorker(db: DrizzleDB): Worker<ReviewRequestJob> {
  return new Worker(
    QUEUE_NAMES.REVIEWS,
    async (job) => {
      if (job.name === "recover") {
        await recoverReviewInvitations(db);
        return;
      }
      if (job.data.deliveryId) await processChannelReviewRequest(db, job);
      else await processReviewRequest(db, job);
    },
    {
      connection: redisConnection(),
    },
  );
}
