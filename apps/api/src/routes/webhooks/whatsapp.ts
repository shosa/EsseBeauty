import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, eq, sql } from "drizzle-orm";

import {
  communicationConversations,
  communicationMessages,
  communicationProviderAccounts,
  communicationProviderSecrets,
  communicationWebhookEvents,
  customers,
} from "@esse-beauty/db/schema";

import { decryptProviderSecret } from "../../lib/provider-credentials.js";
import { publishCommunicationEvent, type WorkspaceEvent } from "../communications/index.js";

interface WebhookOptions {
  appSecret?: string;
  publish?: (salonId: string, event: WorkspaceEvent) => Promise<void>;
}

interface MetaStatus {
  errors?: Array<{ code?: number }>;
  id?: string;
  status?: "delivered" | "failed" | "read" | "sent";
  timestamp?: string;
}

interface MetaMessage {
  from?: string;
  id?: string;
  text?: { body?: string };
  timestamp?: string;
  type?: string;
}

interface MetaPayload {
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        messages?: MetaMessage[];
        metadata?: { phone_number_id?: string };
        statuses?: MetaStatus[];
      };
    }>;
    id?: string;
  }>;
  object?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    whatsappRawBody?: Buffer;
  }
}

function signatureValid(raw: Buffer, signature: string | undefined, appSecret: string): boolean {
  if (!signature?.startsWith("sha256=")) return false;
  const received = signature.slice(7);
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;
  const expected = createHmac("sha256", appSecret).update(raw).digest("hex");
  return timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}

function providerDate(timestamp: string | undefined): Date {
  const milliseconds = Number(timestamp) * 1_000;
  return Number.isFinite(milliseconds) && milliseconds > 0 ? new Date(milliseconds) : new Date();
}

function messageBody(message: MetaMessage): string | null {
  if (message.type === "text") return message.text?.body?.slice(0, 4_096) ?? "";
  return message.type ? `[${message.type}]` : null;
}

async function processInbound(
  app: FastifyInstance,
  account: typeof communicationProviderAccounts.$inferSelect,
  message: MetaMessage,
): Promise<{ conversationId: string; messageId?: string } | undefined> {
  if (!message.id || !message.from) return;
  const participantPhone = message.from.replace(/\D/g, "");
  if (!participantPhone) return;
  return app.db.transaction(async (tx) => {
    const event = (await tx.insert(communicationWebhookEvents).values({
      accountId: account.id,
      eventType: "message.inbound",
      externalEventId: message.id!,
      processedAt: new Date(),
      redactedPayload: { message_id: message.id, type: message.type ?? "unknown" },
      salonId: account.salonId,
      status: "processed",
    }).onConflictDoNothing({ target: [communicationWebhookEvents.accountId, communicationWebhookEvents.externalEventId] }).returning({ id: communicationWebhookEvents.id }))[0];
    if (!event) return;

    const normalizedPhone = `+${participantPhone}`;
    const customer = (await tx.select({ id: customers.id }).from(customers).where(and(
      eq(customers.salonId, account.salonId),
      eq(customers.phoneNormalized, normalizedPhone),
    )).limit(1))[0];

    let conversation = (await tx.insert(communicationConversations).values({
      accountId: account.id,
      customerId: customer?.id,
      participantPhone,
      salonId: account.salonId,
    }).onConflictDoNothing({ target: [communicationConversations.accountId, communicationConversations.participantPhone] }).returning())[0];
    conversation ??= (await tx.select().from(communicationConversations).where(and(
      eq(communicationConversations.accountId, account.id),
      eq(communicationConversations.participantPhone, participantPhone),
    )))[0];
    if (!conversation) throw new Error("CONVERSATION_CREATE_FAILED");
    const timestamp = providerDate(message.timestamp);
    const insertedMessage = (await tx.insert(communicationMessages).values({
      accountId: account.id,
      body: messageBody(message),
      conversationId: conversation.id,
      direction: "inbound",
      kind: message.type === "text" ? "text" : message.type === "image" || message.type === "document" ? "media" : "system",
      providerMessageId: message.id,
      providerTimestamp: timestamp,
      salonId: account.salonId,
      sentAt: timestamp,
      status: "delivered",
    }).onConflictDoNothing({ target: [communicationMessages.accountId, communicationMessages.providerMessageId] }).returning({ id: communicationMessages.id }))[0];
    await tx.update(communicationConversations).set({
      ...(customer && { customerId: customer.id }),
      lastInboundAt: timestamp,
      lastMessageAt: timestamp,
      lastMessagePreview: messageBody(message)?.slice(0, 160) ?? null,
      unreadCount: sql`${communicationConversations.unreadCount} + 1`,
      updatedAt: new Date(),
    }).where(eq(communicationConversations.id, conversation.id));
    return { conversationId: conversation.id, messageId: insertedMessage?.id };
  });
}

const statusRank = { failed: 1, sent: 2, delivered: 3, read: 4 } as const;

async function processStatus(
  app: FastifyInstance,
  account: typeof communicationProviderAccounts.$inferSelect,
  status: MetaStatus,
): Promise<void> {
  if (!status.id || !status.status) return;
  const nextStatus = status.status;
  const externalEventId = `${status.id}:${nextStatus}:${status.timestamp ?? ""}`;
  await app.db.transaction(async (tx) => {
    const event = (await tx.insert(communicationWebhookEvents).values({
      accountId: account.id,
      eventType: `message.${nextStatus}`,
      externalEventId,
      processedAt: new Date(),
      redactedPayload: { message_id: status.id, status: nextStatus },
      salonId: account.salonId,
      status: "processed",
    }).onConflictDoNothing({ target: [communicationWebhookEvents.accountId, communicationWebhookEvents.externalEventId] }).returning({ id: communicationWebhookEvents.id }))[0];
    if (!event) return;
    const timestamp = providerDate(status.timestamp).toISOString();
    const rank = statusRank[nextStatus];
    await tx.execute(sql`
      update communication_messages
      set
        status = ${nextStatus}::communication_message_status,
        provider_timestamp = ${timestamp}::timestamptz,
        sent_at = case when ${nextStatus} = 'sent' then coalesce(sent_at, ${timestamp}::timestamptz) else sent_at end,
        delivered_at = case when ${nextStatus} = 'delivered' then coalesce(delivered_at, ${timestamp}::timestamptz) else delivered_at end,
        read_at = case when ${nextStatus} = 'read' then coalesce(read_at, ${timestamp}::timestamptz) else read_at end,
        failed_at = case when ${nextStatus} = 'failed' then coalesce(failed_at, ${timestamp}::timestamptz) else failed_at end,
        failure_code = case when ${nextStatus} = 'failed' then ${String(status.errors?.[0]?.code ?? "META_FAILED")} else failure_code end,
        updated_at = now()
      where account_id = ${account.id}::uuid
        and provider_message_id = ${status.id}
        and (case status
          when 'queued' then 0 when 'accepted' then 1 when 'failed' then 1
          when 'sent' then 2 when 'delivered' then 3 when 'read' then 4 else 0 end) <= ${rank}
    `);
  });
}

async function accountForKey(app: FastifyInstance, webhookKey: string) {
  return (await app.db.select().from(communicationProviderAccounts).where(eq(communicationProviderAccounts.webhookKey, webhookKey)))[0];
}

export function registerWhatsAppWebhookRoutes(app: FastifyInstance, options: WebhookOptions = {}): void {
  const publish = options.publish ?? publishCommunicationEvent;
  void app.register(async (scope) => {
    scope.addContentTypeParser("application/json", { parseAs: "buffer" }, (request, body, done) => {
      const raw = body as Buffer;
      request.whatsappRawBody = raw;
      done(null, raw);
    });

    scope.get<{ Params: { webhookKey: string }; Querystring: Record<string, string> }>(
      "/api/webhooks/whatsapp/:webhookKey",
      async (request, reply) => {
        const account = await accountForKey(scope, request.params.webhookKey);
        if (!account) return reply.code(404).send({ error: "NOT_FOUND" });
        const secret = (await scope.db.select().from(communicationProviderSecrets).where(and(
          eq(communicationProviderSecrets.accountId, account.id),
          eq(communicationProviderSecrets.salonId, account.salonId),
          eq(communicationProviderSecrets.kind, "webhook_verify_token"),
        )))[0];
        if (!secret) return reply.code(403).send({ error: "VERIFICATION_FAILED" });
        const expected = decryptProviderSecret(secret, { accountId: account.id, provider: account.provider, salonId: account.salonId });
        if (request.query["hub.mode"] !== "subscribe" || request.query["hub.verify_token"] !== expected) {
          return reply.code(403).send({ error: "VERIFICATION_FAILED" });
        }
        return reply.type("text/plain").send(request.query["hub.challenge"] ?? "");
      },
    );

    scope.post<{ Body: Buffer; Params: { webhookKey: string } }>(
      "/api/webhooks/whatsapp/:webhookKey",
      async (request, reply) => {
        const account = await accountForKey(scope, request.params.webhookKey);
        if (!account) return reply.code(404).send({ error: "NOT_FOUND" });
        const appSecret = options.appSecret ?? process.env.META_APP_SECRET;
        const raw = request.whatsappRawBody;
        const signature = request.headers["x-hub-signature-256"] as string | undefined;
        if (!appSecret || !raw || !signatureValid(raw, signature, appSecret)) {
          return reply.code(401).send({ error: "INVALID_SIGNATURE" });
        }
        let payload: MetaPayload;
        try {
          payload = JSON.parse(raw.toString("utf8")) as MetaPayload;
        } catch {
          return reply.code(400).send({ error: "INVALID_PAYLOAD" });
        }
        if (payload.object !== "whatsapp_business_account") return reply.code(400).send({ error: "INVALID_PAYLOAD" });
        for (const entry of payload.entry ?? []) {
          if (entry.id !== account.wabaId) return reply.code(403).send({ error: "ACCOUNT_MISMATCH" });
          for (const change of entry.changes ?? []) {
            if (change.field !== "messages") continue;
            if (change.value?.metadata?.phone_number_id !== account.phoneNumberId) {
              return reply.code(403).send({ error: "PHONE_NUMBER_MISMATCH" });
            }
            for (const message of change.value.messages ?? []) {
              const received = await processInbound(scope, account, message);
              if (received) await publish(account.salonId, { conversation_id: received.conversationId, message_id: received.messageId, type: "message.received" });
            }
            for (const status of change.value.statuses ?? []) await processStatus(scope, account, status);
          }
        }
        await scope.db.update(communicationProviderAccounts).set({ lastWebhookAt: new Date(), updatedAt: new Date() }).where(eq(communicationProviderAccounts.id, account.id));
        return { received: true };
      },
    );
  });
}
