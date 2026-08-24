import { randomUUID } from "node:crypto";

import { Worker, type Job, type JobsOptions } from "bullmq";
import { and, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import {
  communicationConversations,
  communicationMessages,
  communicationOutbox,
  communicationProviderAccounts,
} from "@esse-beauty/db/schema";

import {
  sendWhatsApp,
  type TenantWhatsAppSendRequest,
  type WhatsAppDeliveryReceipt,
} from "../providers/whatsapp-cloud-provider.js";
import { getQueue, QUEUE_NAMES, redisConnection } from "./queues.js";

const LEASE_MS = 5 * 60_000;
const RETRY_DELAY_MS = 30_000;

export interface CommunicationOutboxJob {
  outboxId: string;
}

export interface CommunicationQueue {
  add(name: string, data: CommunicationOutboxJob, options?: JobsOptions): Promise<unknown>;
  upsertJobScheduler?(schedulerId: string, repeatOptions: { every: number }, jobTemplate: { name: string }): Promise<unknown>;
}

export type EnqueueCommunicationInput = {
  actorUserId?: string;
  idempotencyKey: string;
  kind: "template";
  salonId: string;
  sourceId?: string;
  sourceType?: string;
  template: { locale: string; name: string; parameters: string[] };
  to: string;
} | {
  actorUserId?: string;
  idempotencyKey: string;
  kind: "session";
  salonId: string;
  session: { text: string };
  sourceId?: string;
  sourceType?: string;
  to: string;
};

interface EnqueueResult {
  messageId: string;
  outboxId: string;
}

async function wakeOutbox(queue: CommunicationQueue, outboxId: string): Promise<void> {
  try {
    await queue.add("deliver", { outboxId }, {
      jobId: `communication-${outboxId}-${randomUUID()}`,
      removeOnComplete: { age: 24 * 60 * 60, count: 5_000 },
      removeOnFail: { age: 7 * 24 * 60 * 60 },
    });
  } catch {
    // The row is durable. The recovery schedule will wake it again.
  }
}

export async function enqueueCommunication(
  db: DrizzleDB,
  input: EnqueueCommunicationInput,
  queue: CommunicationQueue = getQueue(QUEUE_NAMES.COMMUNICATIONS),
): Promise<EnqueueResult> {
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${input.salonId}:${input.idempotencyKey}`}))`);
    const account = (await tx
      .select()
      .from(communicationProviderAccounts)
      .where(and(
        eq(communicationProviderAccounts.salonId, input.salonId),
        eq(communicationProviderAccounts.provider, "meta_cloud_api"),
      ))
      .for("update"))[0];
    if (!account || !account.enabled || account.status !== "ready") throw new Error("PROVIDER_NOT_CONFIGURED");

    const existing = (await tx
      .select({ messageId: communicationMessages.id, outboxId: communicationOutbox.id })
      .from(communicationMessages)
      .innerJoin(communicationOutbox, eq(communicationOutbox.messageId, communicationMessages.id))
      .where(and(
        eq(communicationMessages.accountId, account.id),
        eq(communicationMessages.clientIdempotencyKey, input.idempotencyKey),
      )))[0];
    if (existing) return existing;

    const normalizedPhone = input.to.replace(/\D/g, "");
    if (normalizedPhone.length < 8 || normalizedPhone.length > 15) throw new Error("INVALID_DESTINATION");
    let conversation = (await tx
      .insert(communicationConversations)
      .values({ accountId: account.id, participantPhone: normalizedPhone, salonId: input.salonId })
      .onConflictDoNothing({ target: [communicationConversations.accountId, communicationConversations.participantPhone] })
      .returning())[0];
    conversation ??= (await tx
      .select()
      .from(communicationConversations)
      .where(and(
        eq(communicationConversations.accountId, account.id),
        eq(communicationConversations.participantPhone, normalizedPhone),
      )))[0];
    if (!conversation) throw new Error("CONVERSATION_CREATE_FAILED");

    const message = (await tx
      .insert(communicationMessages)
      .values({
        accountId: account.id,
        actorUserId: input.actorUserId,
        body: input.kind === "session" ? input.session.text : null,
        clientIdempotencyKey: input.idempotencyKey,
        conversationId: conversation.id,
        direction: "outbound",
        kind: input.kind === "template" ? "template" : "text",
        salonId: input.salonId,
        sourceId: input.sourceId,
        sourceType: input.sourceType,
        status: "queued",
        templateLocale: input.kind === "template" ? input.template.locale : null,
        templateName: input.kind === "template" ? input.template.name : null,
        templateParameters: input.kind === "template" ? input.template.parameters.map((text) => ({ text })) : [],
      })
      .returning())[0]!;
    const outbox = (await tx
      .insert(communicationOutbox)
      .values({ messageId: message.id, salonId: input.salonId })
      .returning())[0]!;
    return { messageId: message.id, outboxId: outbox.id };
  });

  await wakeOutbox(queue, result.outboxId);
  return result;
}

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

export async function processCommunicationOutbox(
  db: DrizzleDB,
  job: Job<CommunicationOutboxJob>,
  dependencies: { sender?: Sender } = {},
): Promise<void> {
  const claimed = await claimOutbox(db, job.data.outboxId);
  if (!claimed) return;
  const parameters = claimed.message.templateParameters
    .map((parameter) => typeof parameter.text === "string" ? parameter.text : "");
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
  for (const candidate of candidates) await wakeOutbox(queue, candidate.id);
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
