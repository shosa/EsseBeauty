import { randomUUID } from "node:crypto";

import { Worker, type Job } from "bullmq";
import { and, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import {
  communicationConversations,
  communicationMessages,
  communicationOutbox,
  campaignRecipients,
  reminders,
  reviewInvitations,
} from "@esse-beauty/db/schema";
import { issueStablePublicToken } from "@esse-beauty/server-shared";
import {
  getQueue,
  QUEUE_NAMES,
  redisConnection,
  scheduleCampaignStatusRefresh,
  type CommunicationOutboxJob,
  type CommunicationQueue,
} from "@esse-beauty/comms-contracts";

import {
  sendWhatsApp,
  type TenantWhatsAppSendRequest,
  type WhatsAppDeliveryReceipt,
} from "../providers/whatsapp-cloud-provider.js";

const LEASE_MS = 5 * 60_000;
const RETRY_DELAY_MS = 30_000;

async function claimOutbox(db: DrizzleDB, outboxId: string) {
  return db.transaction(async (tx) => {
    const row = (await tx
      .select({
        conversation: communicationConversations,
        message: communicationMessages,
        outbox: communicationOutbox,
      })
      .from(communicationOutbox)
      .innerJoin(communicationMessages, eq(communicationMessages.id, communicationOutbox.messageId))
      .innerJoin(communicationConversations, eq(communicationConversations.id, communicationMessages.conversationId))
      .where(eq(communicationOutbox.id, outboxId))
      .for("update"))[0];
    if (!row || row.outbox.status === "delivered" || row.outbox.status === "exhausted") return undefined;
    const now = new Date();
    if (row.outbox.attempts >= row.outbox.maxAttempts) {
      await tx.update(communicationOutbox).set({ status: "exhausted", updatedAt: now }).where(eq(communicationOutbox.id, outboxId));
      return undefined;
    }
    if (row.outbox.status === "processing" && row.outbox.leaseExpiresAt && row.outbox.leaseExpiresAt > now) return undefined;
    const leaseOwner = randomUUID();
    await tx.update(communicationOutbox).set({
      attempts: sql`${communicationOutbox.attempts} + 1`,
      lastErrorCode: null,
      leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
      leaseOwner,
      status: "processing",
      updatedAt: now,
    }).where(eq(communicationOutbox.id, outboxId));
    return { ...row, attemptNumber: row.outbox.attempts + 1, leaseOwner };
  });
}

type Sender = (db: DrizzleDB, request: TenantWhatsAppSendRequest) => Promise<WhatsAppDeliveryReceipt>;

function reviewTokenSecret(): string {
  const secret = process.env.REVIEW_TOKEN_SECRET;
  if (!secret) throw new Error("REVIEW_TOKEN_SECRET is required");
  return secret;
}

function buildReviewInviteUrl(pwaBaseUrl: string, rawToken: string): string {
  return `${pwaBaseUrl}/review#token=${encodeURIComponent(rawToken)}`;
}

async function resolveTemplateParameters(db: DrizzleDB, claimed: Awaited<ReturnType<typeof claimOutbox>>) {
  if (!claimed) return [];
  const parameters = claimed.message.templateParameters
    .map((parameter) => typeof parameter.text === "string" ? parameter.text : "");
  if (claimed.message.sourceType !== "review_invitation" || !parameters.includes("__review_url__")) return parameters;
  const invitation = (await db.select({ expiresAt: reviewInvitations.expiresAt, id: reviewInvitations.id })
    .from(reviewInvitations)
    .where(and(eq(reviewInvitations.id, claimed.message.sourceId!), eq(reviewInvitations.salonId, claimed.message.salonId))))[0];
  if (!invitation) throw new Error("REVIEW_INVITATION_NOT_FOUND");
  const token = issueStablePublicToken("review", invitation.id, invitation.expiresAt, reviewTokenSecret());
  await db.update(reviewInvitations).set({ tokenHash: token.tokenHash, updatedAt: new Date() })
    .where(eq(reviewInvitations.id, invitation.id));
  const pwaUrl = (process.env.PWA_URL ?? "http://localhost:3002").replace(/\/$/, "");
  return parameters.map((parameter) => parameter === "__review_url__" ? buildReviewInviteUrl(pwaUrl, token.raw) : parameter);
}

async function updateProductState(
  db: DrizzleDB,
  source: { sourceId: string | null; sourceType: string | null },
  state: "accepted" | "failed",
  receipt: WhatsAppDeliveryReceipt | undefined,
  dependencies: { scheduleCampaignStatusRefresh?: typeof scheduleCampaignStatusRefresh },
) {
  if (!source.sourceId) return;
  if (source.sourceType === "reminder") {
    await db.update(reminders).set({ status: state === "accepted" ? "sent" : "failed", sentAt: state === "accepted" ? new Date() : null }).where(eq(reminders.id, source.sourceId));
  } else if (source.sourceType === "review_invitation") {
    await db.update(reviewInvitations).set({
      deliveredAt: state === "accepted" ? new Date() : null,
      deliveryStatus: state === "accepted" ? "sent" : "failed",
      updatedAt: new Date(),
    }).where(eq(reviewInvitations.id, source.sourceId));
  } else if (source.sourceType === "campaign_recipient") {
    const recipient = (await db.update(campaignRecipients).set({
      error: state === "accepted" ? null : "PROVIDER_DELIVERY_FAILED",
      providerMessageId: receipt?.providerMessageId ?? null,
      providerName: receipt?.provider ?? null,
      sentAt: state === "accepted" ? receipt?.acceptedAt ?? new Date() : null,
      status: state === "accepted" ? "sent" : "failed",
      updatedAt: new Date(),
    }).where(eq(campaignRecipients.id, source.sourceId)).returning({ campaignId: campaignRecipients.campaignId }))[0];
    if (recipient) await (dependencies.scheduleCampaignStatusRefresh ?? scheduleCampaignStatusRefresh)(recipient.campaignId);
  }
}

export async function processCommunicationOutbox(
  db: DrizzleDB,
  job: Job<CommunicationOutboxJob>,
  dependencies: { scheduleCampaignStatusRefresh?: typeof scheduleCampaignStatusRefresh; sender?: Sender } = {},
): Promise<void> {
  const claimed = await claimOutbox(db, job.data.outboxId);
  if (!claimed) return;
  const parameters = await resolveTemplateParameters(db, claimed);
  const request: TenantWhatsAppSendRequest = claimed.message.kind === "template"
    ? {
        idempotencyKey: claimed.message.clientIdempotencyKey!,
        kind: "template",
        salonId: claimed.message.salonId,
        template: {
          locale: claimed.message.templateLocale!,
          name: claimed.message.templateName!,
          parameters,
        },
        to: claimed.conversation.participantPhone,
      }
    : {
        idempotencyKey: claimed.message.clientIdempotencyKey!,
        kind: "session",
        salonId: claimed.message.salonId,
        session: { lastInboundAt: claimed.conversation.lastInboundAt ?? new Date(0), text: claimed.message.body ?? "" },
        to: claimed.conversation.participantPhone,
      };

  try {
    const receipt = await (dependencies.sender ?? sendWhatsApp)(db, request);
    await updateProductState(db, claimed.message, "accepted", receipt, dependencies);
    await db.transaction(async (tx) => {
      const owned = and(eq(communicationOutbox.id, claimed.outbox.id), eq(communicationOutbox.leaseOwner, claimed.leaseOwner));
      await tx.update(communicationMessages).set({
        providerMessageId: receipt.providerMessageId,
        providerTimestamp: receipt.acceptedAt,
        status: "accepted",
        updatedAt: new Date(),
      }).where(eq(communicationMessages.id, claimed.message.id));
      await tx.update(communicationOutbox).set({
        deliveredAt: new Date(),
        leaseExpiresAt: null,
        leaseOwner: null,
        status: "delivered",
        updatedAt: new Date(),
      }).where(owned);
    });
  } catch (error) {
    const retryable = typeof error === "object" && error !== null && "retryable" in error && error.retryable === true;
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "PROVIDER_DELIVERY_FAILED";
    const exhausted = !retryable || claimed.attemptNumber >= claimed.outbox.maxAttempts;
    await db.transaction(async (tx) => {
      await tx.update(communicationOutbox).set({
        availableAt: new Date(Date.now() + RETRY_DELAY_MS * Math.max(1, claimed.attemptNumber)),
        lastErrorCode: code.slice(0, 80),
        leaseExpiresAt: null,
        leaseOwner: null,
        status: exhausted ? "exhausted" : "failed",
        updatedAt: new Date(),
      }).where(and(eq(communicationOutbox.id, claimed.outbox.id), eq(communicationOutbox.leaseOwner, claimed.leaseOwner)));
      if (exhausted) {
        await tx.update(communicationMessages).set({ failedAt: new Date(), failureCode: code.slice(0, 80), status: "failed", updatedAt: new Date() }).where(eq(communicationMessages.id, claimed.message.id));
      }
    });
    if (exhausted) await updateProductState(db, claimed.message, "failed", undefined, dependencies);
    throw new Error("COMMUNICATION_DELIVERY_FAILED");
  }
}

export async function recoverCommunicationOutbox(
  db: DrizzleDB,
  queue: CommunicationQueue = getQueue(QUEUE_NAMES.COMMUNICATIONS),
): Promise<number> {
  const now = new Date();
  const candidates = await db
    .select({ id: communicationOutbox.id })
    .from(communicationOutbox)
    .where(and(
      lt(communicationOutbox.attempts, communicationOutbox.maxAttempts),
      or(
        and(inArray(communicationOutbox.status, ["pending", "failed"]), lte(communicationOutbox.availableAt, now)),
        and(eq(communicationOutbox.status, "processing"), or(isNull(communicationOutbox.leaseExpiresAt), lte(communicationOutbox.leaseExpiresAt, now))),
      ),
    ))
    .limit(100);
  for (const candidate of candidates) {
    try {
      await queue.add("deliver", { outboxId: candidate.id }, {
        jobId: `communication-${candidate.id}-${randomUUID()}`,
        removeOnComplete: { age: 24 * 60 * 60, count: 5_000 },
        removeOnFail: { age: 7 * 24 * 60 * 60 },
      });
    } catch {
      // The row is durable. The recovery schedule will wake it again.
    }
  }
  return candidates.length;
}

export async function registerCommunicationRecoverySchedule(
  queue: CommunicationQueue = getQueue(QUEUE_NAMES.COMMUNICATIONS),
): Promise<void> {
  await queue.upsertJobScheduler?.("recover-communication-outbox", { every: 60_000 }, { name: "recover" });
}

export function startCommunicationWorker(db: DrizzleDB): Worker<CommunicationOutboxJob> {
  return new Worker(
    QUEUE_NAMES.COMMUNICATIONS,
    async (job) => {
      if (job.name === "recover") return void await recoverCommunicationOutbox(db);
      await processCommunicationOutbox(db, job);
    },
    { connection: redisConnection(), concurrency: 10 },
  );
}
