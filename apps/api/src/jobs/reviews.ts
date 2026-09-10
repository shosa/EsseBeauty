import { randomUUID } from "node:crypto";

import { Worker, type Job, type JobsOptions } from "bullmq";
import { and, eq, gt, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import {
  appointments,
  customerPushSubscriptions,
  customers,
  reviewInvitationDeliveries,
  reviewInvitations,
  salons,
  services,
} from "@esse-beauty/db/schema";
import { isModuleEnabled, MODULE_KEYS } from "@esse-beauty/feature-flags";

import { BRAND_MARK_SVG } from "@esse-beauty/shared";

import { sendCustomerAppMessage } from "../lib/customer-messages.js";
import { issueStablePublicToken } from "../lib/public-tokens.js";
import { sendEmail, sendEmailFromDb } from "./notifications.js";
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

export function buildReviewInvitePath(slug: string, rawToken: string): string {
  return `/${slug}/review#token=${encodeURIComponent(rawToken)}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

export function reviewInvitationEmailHtml(input: {
  customerName: string;
  reviewUrl: string;
  salonName: string;
  serviceName: string;
}): string {
  const customerName = escapeHtml(input.customerName);
  const reviewUrl = escapeAttribute(input.reviewUrl);
  const salonName = escapeHtml(input.salonName);
  const serviceName = escapeHtml(input.serviceName);

  return `<!doctype html>
<html lang="it">
  <body style="margin:0;background:#fbf7f2;color:#24161d;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fbf7f2;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;">
            <tr>
              <td style="padding:34px 28px 18px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="font-family:Manrope,Georgia,serif;font-size:22px;font-weight:650;letter-spacing:-.03em;color:#24161d;">
                      <span style="display:inline-block;margin-right:10px;border-radius:11px;background:#6d244c;padding:8px 9px;line-height:0;">${BRAND_MARK_SVG}</span>EsseBeauty
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:42px 28px 54px;">
                <p style="margin:0 0 23px;color:#6d244c;font-size:12px;font-weight:850;letter-spacing:.1em;text-transform:uppercase;">
                  <span style="display:inline-block;width:25px;height:25px;margin-right:9px;border-radius:50%;background:#f8eaf0;color:#6d244c;text-align:center;line-height:25px;">✓</span>${salonName}
                </p>
                <h1 style="max-width:610px;margin:0;font-family:Manrope,Georgia,serif;font-size:56px;line-height:.98;font-weight:570;letter-spacing:-.06em;color:#24161d;">Com'è andato <span style="color:#6d244c;font-weight:500;">il tuo momento</span> in salone?</h1>
                <p style="max-width:570px;margin:28px 0 0;color:#6f6268;font-size:18px;line-height:1.7;">Ciao ${customerName}, ci piacerebbe sapere com'è stato il trattamento <strong style="color:#24161d;">${serviceName}</strong>. La tua opinione aiuta ${salonName} a curare ogni dettaglio dell'esperienza.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:34px 0 0;">
                  <tr>
                    <td>
                      <a href="${reviewUrl}" style="display:inline-block;min-height:44px;border-radius:999px;background:#6d244c;padding:15px 25px;color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;box-shadow:0 10px 24px rgba(109,36,76,.20);">Lascia una recensione</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#24161d;padding:44px 28px;color:#ffffff;">
                <p style="margin:0;color:#e3b7c7;font-size:12px;font-weight:850;letter-spacing:.1em;text-transform:uppercase;">Richiede meno di un minuto</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;">
                  <tr>
                    <td style="padding-right:16px;vertical-align:top;">
                      <p style="margin:0;color:#d99ab2;font-size:13px;font-weight:900;">01</p>
                      <h2 style="margin:10px 0 0;font-family:Manrope,Georgia,serif;font-size:22px;line-height:1.15;font-weight:560;">Racconta com'è andata</h2>
                      <p style="margin:10px 0 0;color:#cbbfc4;font-size:13px;line-height:1.65;">Puoi lasciare un voto e una nota libera.</p>
                    </td>
                    <td style="padding-left:16px;vertical-align:top;">
                      <p style="margin:0;color:#d99ab2;font-size:13px;font-weight:900;">02</p>
                      <h2 style="margin:10px 0 0;font-family:Manrope,Georgia,serif;font-size:22px;line-height:1.15;font-weight:560;">Aiuta il salone</h2>
                      <p style="margin:10px 0 0;color:#cbbfc4;font-size:13px;line-height:1.65;">Il feedback arriva al team giusto.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 38px;">
                <p style="margin:0;color:#8b7d83;font-size:12px;line-height:1.6;">Se il pulsante non funziona, copia questo link nel browser:<br><a href="${reviewUrl}" style="color:#6d244c;word-break:break-all;">${reviewUrl}</a></p>
                <p style="margin:18px 0 0;color:#91858a;font-size:12px;line-height:1.5;">Messaggio inviato tramite EsseBeauty per conto di ${salonName}.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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
      salonId: reviewInvitations.salonId,
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
    if (!(await isModuleEnabled(invitation.salonId, MODULE_KEYS.REVIEWS, db))) continue;
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
    if (!(await isModuleEnabled(invitation.salonId, MODULE_KEYS.REVIEWS, db))) {
      await tx.update(reviewInvitations).set({
        deliveryClaimId: null,
        deliveryFailure: "MODULE_DISABLED",
        deliveryLeaseExpiresAt: null,
        deliveryStatus: "failed",
        updatedAt: new Date(),
      }).where(eq(reviewInvitations.id, invitationId));
      return undefined;
    }
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

function deliveryFailureReason(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const code = (error as Error & { code?: string }).code;
  return (code || error.message || fallback).slice(0, 120);
}

export async function processReviewRequest(
  db: DrizzleDB,
  job: Job<ReviewRequestJob>,
  dependencies: ReviewDeliveryDependencies = {},
): Promise<void> {
  const delivery = await prepareDelivery(db, job.data.invitationId);
  if (!delivery) return;
  try {
    const emailSender = dependencies.emailSender ?? ((to, subject, html, options) => sendEmailFromDb(db, to, subject, html, options));
    const pwaUrl = (process.env.PWA_URL ?? "http://localhost:3002").replace(/\/$/, "");
    const reviewUrl = delivery.rawToken
      ? buildReviewInviteUrl(pwaUrl, delivery.rawToken)
      : undefined;
    if (delivery.channel === "email" && delivery.email) {
      await emailSender(
        delivery.email,
        `Come è andato il tuo appuntamento da ${delivery.salonName}?`,
        reviewInvitationEmailHtml({
          customerName: delivery.customerName,
          reviewUrl: reviewUrl ?? "",
          salonName: delivery.salonName,
          serviceName: delivery.serviceName,
        }),
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
  } catch (error) {
    const exhausted = delivery.attemptNumber >= REVIEW_MAX_DELIVERY_ATTEMPTS;
    await db.update(reviewInvitations).set({
      deliveryClaimId: null,
      deliveryFailure: exhausted
        ? "DELIVERY_ATTEMPTS_EXHAUSTED"
        : deliveryFailureReason(error, "PROVIDER_DELIVERY_FAILED"),
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
      customerId: customers.id,
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
      salonSlug: salons.slug,
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
    if (!(await isModuleEnabled(delivery.salonId, MODULE_KEYS.REVIEWS, db))) {
      await tx.update(reviewInvitationDeliveries).set({ failureReason: "MODULE_DISABLED", status: "failed" }).where(eq(reviewInvitationDeliveries.id, deliveryId));
      return undefined;
    }
    const hasPushSubscription = delivery.channel === "app"
      ? Boolean((await tx.select({ id: customerPushSubscriptions.id }).from(customerPushSubscriptions).where(eq(customerPushSubscriptions.customerId, delivery.customerId)))[0])
      : false;
    const destination = delivery.channel === "email" ? delivery.email
      : delivery.channel === "whatsapp" ? delivery.phone
        : delivery.channel === "app" ? (hasPushSubscription ? delivery.customerId : null)
          : null;
    if (!destination) {
      await tx.update(reviewInvitationDeliveries).set({ failureReason: "missing_contact", status: "skipped" }).where(eq(reviewInvitationDeliveries.id, deliveryId));
      return undefined;
    }
    if (delivery.expiresAt <= new Date()) {
      await tx.update(reviewInvitationDeliveries).set({ failureReason: "invitation_expired", status: "failed" }).where(eq(reviewInvitationDeliveries.id, deliveryId));
      return undefined;
    }
    const token = (delivery.channel === "email" || delivery.channel === "app") ? issueStablePublicToken("review", delivery.invitationId, delivery.expiresAt, reviewTokenSecret()) : undefined;
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
      await (dependencies.emailSender ?? ((to, subject, html, options) => sendEmailFromDb(db, to, subject, html, options)))(delivery.email, `Come è andato il tuo appuntamento da ${delivery.salonName}?`, reviewInvitationEmailHtml({ customerName: delivery.customerName, reviewUrl: buildReviewInviteUrl(pwaUrl, delivery.rawToken), salonName: delivery.salonName, serviceName: delivery.serviceName }), { idempotencyKey: `review-invitation-${delivery.invitationId}-email-${delivery.generation}` });
    } else if (delivery.channel === "whatsapp" && delivery.phone) {
      await (dependencies.enqueue ?? enqueueCommunication)(db, { idempotencyKey: `review-invitation-${delivery.invitationId}-whatsapp-${delivery.generation}`, kind: "template", salonId: delivery.salonId, sourceId: delivery.invitationId, sourceType: "review_invitation", template: { locale: "it", name: "review_invitation", parameters: [delivery.customerName, delivery.serviceName, "__review_url__"] }, to: delivery.phone });
    } else if (delivery.channel === "app" && delivery.rawToken) {
      await sendCustomerAppMessage(db, delivery.salonId, delivery.customerId, {
        body: `Ciao ${delivery.customerName}, raccontaci com'è andato il trattamento ${delivery.serviceName} da ${delivery.salonName}: bastano pochi secondi.`,
        href: buildReviewInvitePath(delivery.salonSlug, delivery.rawToken),
        kind: "review_request",
        slug: delivery.salonSlug,
        title: "Com'è andato il tuo appuntamento?",
      });
    }
    await db.update(reviewInvitationDeliveries).set({ deliveredAt: delivery.channel === "whatsapp" ? null : new Date(), failureReason: null, status: delivery.channel === "whatsapp" ? "queued" : "delivered" }).where(eq(reviewInvitationDeliveries.id, delivery.deliveryId));
  } catch (error) {
    const exhausted = delivery.attemptNumber >= REVIEW_MAX_DELIVERY_ATTEMPTS;
    await db.update(reviewInvitationDeliveries).set({ failureReason: exhausted ? "attempts_exhausted" : deliveryFailureReason(error, "provider_failure"), status: exhausted ? "exhausted" : "failed" }).where(eq(reviewInvitationDeliveries.id, delivery.deliveryId));
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
