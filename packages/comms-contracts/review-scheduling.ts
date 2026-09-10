import type { JobsOptions } from "bullmq";
import { and, eq } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import {
  appointments,
  customers,
  reviewInvitationDeliveries,
  reviewInvitations,
} from "@esse-beauty/db/schema";

import { getQueue, QUEUE_NAMES } from "./queues.js";

// The producer half of review scheduling: durably records that an
// appointment is (or should be) getting a review invitation and wakes the
// delivery queue. Actually rendering and sending the invitation — email,
// WhatsApp, in-app — is owned entirely by the apps/communications worker.
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
const REVIEW_DELIVERY_DELAY_MS = 30 * 60_000;
export const REVIEW_MAX_DELIVERY_ATTEMPTS = 5;

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
  input: { channels: Array<"app" | "email" | "whatsapp">; scheduledAt: Date; resend?: boolean },
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
