import { randomUUID } from "node:crypto";

import type { JobsOptions } from "bullmq";
import { and, eq, sql } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import {
  communicationConversations,
  communicationMessages,
  communicationOutbox,
  communicationProviderAccounts,
} from "@esse-beauty/db/schema";

import { getQueue, QUEUE_NAMES } from "@esse-beauty/queue-client";

// This is the producer half of the WhatsApp outbox: it durably records the
// message and wakes the delivery queue. The consumer (claiming a lease,
// calling the WhatsApp Cloud API, retrying) lives only in the
// apps/communications worker — this function has no knowledge of how or
// when the message actually gets sent.
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
      .select({
        messageId: communicationMessages.id,
        messageStatus: communicationMessages.status,
        outboxId: communicationOutbox.id,
        outboxStatus: communicationOutbox.status,
      })
      .from(communicationMessages)
      .innerJoin(communicationOutbox, eq(communicationOutbox.messageId, communicationMessages.id))
      .where(and(
        eq(communicationMessages.accountId, account.id),
        eq(communicationMessages.clientIdempotencyKey, input.idempotencyKey),
      )))[0];
    if (existing) {
      if (existing.messageStatus === "failed" && existing.outboxStatus === "exhausted") {
        const now = new Date();
        await tx.update(communicationMessages).set({
          failedAt: null,
          failureCode: null,
          status: "queued",
          updatedAt: now,
        }).where(eq(communicationMessages.id, existing.messageId));
        await tx.update(communicationOutbox).set({
          attempts: 0,
          availableAt: now,
          lastErrorCode: null,
          leaseExpiresAt: null,
          leaseOwner: null,
          status: "pending",
          updatedAt: now,
        }).where(eq(communicationOutbox.id, existing.outboxId));
      }
      return { messageId: existing.messageId, outboxId: existing.outboxId };
    }

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
