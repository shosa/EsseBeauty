import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyReply } from "fastify";
import Redis from "ioredis";
import { and, asc, count, desc, eq, gt, ilike, isNotNull, isNull, lt, or } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import {
  communicationConversations,
  communicationMessages,
  communicationProviderAccounts,
  communicationUserState,
  customers,
} from "@esse-beauty/db/schema";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import {
  enqueueCommunication,
  type CommunicationQueue,
  type EnqueueCommunicationInput,
} from "../../jobs/communications.js";
import { redisConnection } from "../../jobs/queues.js";
import { authenticate, requirePermission } from "../../middleware/auth.js";

type Enqueue = (
  db: DrizzleDB,
  input: EnqueueCommunicationInput,
  queue?: CommunicationQueue,
) => Promise<{ messageId: string; outboxId: string }>;

type WorkspaceEvent = {
  conversation_id?: string;
  message_id?: string;
  type: "message.queued" | "conversation.read" | "workspace.updated";
};

interface CommunicationRouteOptions {
  enqueue?: Enqueue;
  publish?: (salonId: string, event: WorkspaceEvent) => Promise<void>;
}

const SERVICE_WINDOW_MS = 24 * 60 * 60_000;
const channelForSalon = (salonId: string) => `communications:${salonId}`;
let publisher: Redis | undefined;

async function publishCommunicationEvent(salonId: string, event: WorkspaceEvent): Promise<void> {
  try {
    publisher ??= new Redis(redisConnection());
    await publisher.publish(channelForSalon(salonId), JSON.stringify(event));
  } catch {
    // REST remains authoritative; connected clients also poll after stream failures.
  }
}

function parseLimit(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, 100);
}

function parseCursor(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function ensureSalon(requestSalonId: string, routeSalonId: string, reply: FastifyReply): boolean {
  if (requestSalonId === routeSalonId) return true;
  void reply.code(403).send({ error: "FORBIDDEN" });
  return false;
}

async function tenantConversation(db: DrizzleDB, salonId: string, conversationId: string) {
  return (await db
    .select()
    .from(communicationConversations)
    .where(and(
      eq(communicationConversations.id, conversationId),
      eq(communicationConversations.salonId, salonId),
    )))[0];
}

async function unreadForUser(
  db: DrizzleDB,
  salonId: string,
  userId: string,
  conversationId: string,
): Promise<number> {
  const state = (await db
    .select({ lastReadMessageId: communicationUserState.lastReadMessageId })
    .from(communicationUserState)
    .where(and(
      eq(communicationUserState.salonId, salonId),
      eq(communicationUserState.userId, userId),
      eq(communicationUserState.conversationId, conversationId),
    )))[0];
  let readAt: Date | undefined;
  if (state?.lastReadMessageId) {
    readAt = (await db
      .select({ createdAt: communicationMessages.createdAt })
      .from(communicationMessages)
      .where(and(
        eq(communicationMessages.id, state.lastReadMessageId),
        eq(communicationMessages.conversationId, conversationId),
        eq(communicationMessages.salonId, salonId),
      )))[0]?.createdAt;
  }
  const conditions = [
    eq(communicationMessages.salonId, salonId),
    eq(communicationMessages.conversationId, conversationId),
    eq(communicationMessages.direction, "inbound" as const),
  ];
  if (readAt) conditions.push(gt(communicationMessages.createdAt, readAt));
  return Number((await db
    .select({ value: count() })
    .from(communicationMessages)
    .where(and(...conditions)))[0]?.value ?? 0);
}

export function registerCommunicationRoutes(
  app: FastifyInstance,
  options: CommunicationRouteOptions = {},
): void {
  const enqueue = options.enqueue ?? enqueueCommunication;
  const publish = options.publish ?? publishCommunicationEvent;
  const view = [authenticate, requirePermission(PERMISSION_KEYS.COMMUNICATIONS_VIEW)];
  const reply = [authenticate, requirePermission(PERMISSION_KEYS.COMMUNICATIONS_REPLY)];

  app.get<{
    Params: { id: string };
    Querystring: { q?: string };
  }>("/api/salons/:id/communications/contacts", { preHandler: view }, async (request, response) => {
    if (!ensureSalon(request.salonId, request.params.id, response)) return;
    const query = request.query.q?.trim();
    const filters = [
      eq(customers.salonId, request.salonId),
      eq(customers.blocked, false),
      isNull(customers.archivedAt),
      isNotNull(customers.phoneNormalized),
    ];
    if (query) {
      const pattern = `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
      filters.push(or(
        ilike(customers.fullName, pattern),
        ilike(customers.phone, pattern),
        ilike(customers.phoneNormalized, pattern),
      )!);
    }
    const rows = await app.db.select({
      customerId: customers.id,
      fullName: customers.fullName,
      phone: customers.phoneNormalized,
    }).from(customers).where(and(...filters)).orderBy(asc(customers.fullName)).limit(30);
    return {
      items: rows.map((row) => ({ customer_id: row.customerId, full_name: row.fullName, phone: row.phone })),
    };
  });

  app.post<{
    Body: { customer_id?: string };
    Params: { id: string };
  }>("/api/salons/:id/communications/conversations", { preHandler: reply }, async (request, response) => {
    if (!ensureSalon(request.salonId, request.params.id, response)) return;
    if (!request.body.customer_id) return response.code(400).send({ error: "CUSTOMER_REQUIRED" });
    const customer = (await app.db.select({
      fullName: customers.fullName,
      id: customers.id,
      phone: customers.phoneNormalized,
    }).from(customers).where(and(
      eq(customers.id, request.body.customer_id),
      eq(customers.salonId, request.salonId),
    )).limit(1))[0];
    if (!customer) return response.code(404).send({ error: "CUSTOMER_NOT_FOUND" });
    if (!customer.phone) return response.code(422).send({ error: "CUSTOMER_PHONE_REQUIRED" });
    const participantPhone = customer.phone.replace(/\D/g, "");
    if (participantPhone.length < 8 || participantPhone.length > 15) {
      return response.code(422).send({ error: "CUSTOMER_PHONE_REQUIRED" });
    }
    const account = (await app.db.select({ id: communicationProviderAccounts.id })
      .from(communicationProviderAccounts)
      .where(and(
        eq(communicationProviderAccounts.salonId, request.salonId),
        eq(communicationProviderAccounts.enabled, true),
      )).limit(1))[0];
    if (!account) return response.code(503).send({ error: "PROVIDER_NOT_CONFIGURED" });
    const conversation = (await app.db.insert(communicationConversations).values({
      accountId: account.id,
      customerId: customer.id,
      participantPhone,
      salonId: request.salonId,
    }).onConflictDoUpdate({
      target: [communicationConversations.accountId, communicationConversations.participantPhone],
      set: { customerId: customer.id, updatedAt: new Date() },
    }).returning())[0]!;
    await publish(request.salonId, { conversation_id: conversation.id, type: "workspace.updated" });
    return {
      customer_id: customer.id,
      customer_name: customer.fullName,
      id: conversation.id,
      participant_phone: conversation.participantPhone,
    };
  });

  app.get<{
    Params: { id: string };
    Querystring: { cursor?: string; limit?: string; q?: string };
  }>("/api/salons/:id/communications/conversations", { preHandler: view }, async (request, response) => {
    if (!ensureSalon(request.salonId, request.params.id, response)) return;
    const limit = parseLimit(request.query.limit, 30);
    const cursor = parseCursor(request.query.cursor);
    const query = request.query.q?.trim();
    const filters = [eq(communicationConversations.salonId, request.salonId)];
    if (cursor) filters.push(lt(communicationConversations.lastMessageAt, cursor));
    if (query) {
      const pattern = `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
      filters.push(or(
        ilike(communicationConversations.participantPhone, pattern),
        ilike(customers.fullName, pattern),
        ilike(customers.phone, pattern),
      )!);
    }
    const rows = await app.db
      .select({
        customerId: customers.id,
        customerName: customers.fullName,
        id: communicationConversations.id,
        lastInboundAt: communicationConversations.lastInboundAt,
        lastMessageAt: communicationConversations.lastMessageAt,
        lastMessagePreview: communicationConversations.lastMessagePreview,
        participantPhone: communicationConversations.participantPhone,
        status: communicationConversations.status,
      })
      .from(communicationConversations)
      .leftJoin(customers, and(
        eq(customers.id, communicationConversations.customerId),
        eq(customers.salonId, request.salonId),
      ))
      .where(and(...filters))
      .orderBy(desc(communicationConversations.lastMessageAt), desc(communicationConversations.createdAt))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    const items = await Promise.all(page.map(async (row) => ({
      customer_name: row.customerName,
      customer_id: row.customerId,
      id: row.id,
      last_inbound_at: row.lastInboundAt?.toISOString() ?? null,
      last_message_at: row.lastMessageAt?.toISOString() ?? null,
      last_message_preview: row.lastMessagePreview,
      participant_phone: row.participantPhone,
      status: row.status,
      unread_count: await unreadForUser(app.db, request.salonId, request.user.id, row.id),
    })));
    return {
      items,
      next_cursor: rows.length > limit ? page.at(-1)?.lastMessageAt?.toISOString() ?? null : null,
      unread_count: items.reduce((total, item) => total + item.unread_count, 0),
    };
  });

  app.get<{
    Params: { conversationId: string; id: string };
    Querystring: { cursor?: string; limit?: string };
  }>("/api/salons/:id/communications/conversations/:conversationId/messages", { preHandler: view }, async (request, response) => {
    if (!ensureSalon(request.salonId, request.params.id, response)) return;
    const conversation = await tenantConversation(app.db, request.salonId, request.params.conversationId);
    if (!conversation) return response.code(404).send({ error: "NOT_FOUND" });
    const limit = parseLimit(request.query.limit, 50);
    const cursor = parseCursor(request.query.cursor);
    const filters = [
      eq(communicationMessages.salonId, request.salonId),
      eq(communicationMessages.conversationId, conversation.id),
    ];
    if (cursor) filters.push(lt(communicationMessages.createdAt, cursor));
    const rows = await app.db
      .select()
      .from(communicationMessages)
      .where(and(...filters))
      .orderBy(desc(communicationMessages.createdAt))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    return {
      conversation: {
        customer_id: conversation.customerId,
        id: conversation.id,
        last_inbound_at: conversation.lastInboundAt?.toISOString() ?? null,
        participant_phone: conversation.participantPhone,
        service_window_open: Boolean(conversation.lastInboundAt && Date.now() - conversation.lastInboundAt.getTime() < SERVICE_WINDOW_MS),
      },
      items: [...page].reverse().map((message) => ({
        body: message.body,
        created_at: message.createdAt.toISOString(),
        direction: message.direction,
        failure_code: message.failureCode,
        id: message.id,
        kind: message.kind,
        status: message.status,
        template_name: message.templateName,
      })),
      next_cursor: rows.length > limit ? page.at(-1)?.createdAt.toISOString() ?? null : null,
    };
  });

  app.post<{
    Body: {
      client_idempotency_key?: string;
      template?: { locale?: string; name?: string; parameters?: string[] };
      text?: string;
    };
    Params: { conversationId: string; id: string };
  }>("/api/salons/:id/communications/conversations/:conversationId/messages", { preHandler: reply }, async (request, response) => {
    if (!ensureSalon(request.salonId, request.params.id, response)) return;
    const conversation = await tenantConversation(app.db, request.salonId, request.params.conversationId);
    if (!conversation) return response.code(404).send({ error: "NOT_FOUND" });
    const text = request.body.text?.trim();
    const idempotencyKey = request.body.client_idempotency_key?.trim() || randomUUID();
    const templateName = request.body.template?.name?.trim();
    const templateLocale = request.body.template?.locale?.trim();
    const serviceWindowOpen = Boolean(
      conversation.lastInboundAt && Date.now() - conversation.lastInboundAt.getTime() < SERVICE_WINDOW_MS,
    );
    if (!serviceWindowOpen && (!templateName || !templateLocale)) {
      return response.code(422).send({ error: "TEMPLATE_REQUIRED" });
    }
    if (serviceWindowOpen && (!text || text.length > 4_096) && !templateName) {
      return response.code(400).send({ error: "INVALID_MESSAGE" });
    }
    const common = {
      actorUserId: request.user.id,
      idempotencyKey: idempotencyKey.slice(0, 160),
      salonId: request.salonId,
      sourceId: conversation.id,
      sourceType: "chat_workspace",
      to: conversation.participantPhone,
    };
    try {
      const queued = templateName && templateLocale
        ? await enqueue(app.db, {
            ...common,
            kind: "template",
            template: {
              locale: templateLocale.slice(0, 32),
              name: templateName.slice(0, 160),
              parameters: (request.body.template?.parameters ?? []).slice(0, 20).map((value) => String(value).slice(0, 1_024)),
            },
          })
        : await enqueue(app.db, { ...common, kind: "session", session: { text: text! } });
      await publish(request.salonId, { conversation_id: conversation.id, message_id: queued.messageId, type: "message.queued" });
      return response.code(202).send({ message_id: queued.messageId, status: "queued" });
    } catch (error) {
      const code = error instanceof Error ? error.message : "COMMUNICATION_QUEUE_FAILED";
      const safeCode = ["PROVIDER_NOT_CONFIGURED", "INVALID_DESTINATION", "TEMPLATE_REQUIRED"].includes(code)
        ? code
        : "COMMUNICATION_QUEUE_FAILED";
      return response.code(safeCode === "TEMPLATE_REQUIRED" ? 422 : 503).send({ error: safeCode });
    }
  });

  app.patch<{
    Body: { message_id?: string };
    Params: { conversationId: string; id: string };
  }>("/api/salons/:id/communications/conversations/:conversationId/read", { preHandler: view }, async (request, response) => {
    if (!ensureSalon(request.salonId, request.params.id, response)) return;
    const conversation = await tenantConversation(app.db, request.salonId, request.params.conversationId);
    if (!conversation) return response.code(404).send({ error: "NOT_FOUND" });
    const message = request.body.message_id
      ? (await app.db.select().from(communicationMessages).where(and(
          eq(communicationMessages.id, request.body.message_id),
          eq(communicationMessages.salonId, request.salonId),
          eq(communicationMessages.conversationId, conversation.id),
        )))[0]
      : (await app.db.select().from(communicationMessages).where(and(
          eq(communicationMessages.salonId, request.salonId),
          eq(communicationMessages.conversationId, conversation.id),
        )).orderBy(desc(communicationMessages.createdAt)).limit(1))[0];
    if (request.body.message_id && !message) return response.code(404).send({ error: "MESSAGE_NOT_FOUND" });
    await app.db.insert(communicationUserState).values({
      conversationId: conversation.id,
      lastOpenedAt: new Date(),
      lastReadMessageId: message?.id,
      salonId: request.salonId,
      userId: request.user.id,
    }).onConflictDoUpdate({
      target: [communicationUserState.salonId, communicationUserState.userId, communicationUserState.conversationId],
      set: { lastOpenedAt: new Date(), lastReadMessageId: message?.id, updatedAt: new Date() },
    });
    await publish(request.salonId, { conversation_id: conversation.id, message_id: message?.id, type: "conversation.read" });
    return { last_read_message_id: message?.id ?? null, unread_count: 0 };
  });

  app.get<{ Params: { id: string } }>("/api/salons/:id/communications/workspace-state", { preHandler: view }, async (request, response) => {
    if (!ensureSalon(request.salonId, request.params.id, response)) return;
    const row = (await app.db
      .select({
        conversationId: communicationUserState.conversationId,
        draft: communicationUserState.draft,
        lastReadMessageId: communicationUserState.lastReadMessageId,
      })
      .from(communicationUserState)
      .innerJoin(communicationConversations, and(
        eq(communicationConversations.id, communicationUserState.conversationId),
        eq(communicationConversations.salonId, request.salonId),
      ))
      .where(and(
        eq(communicationUserState.salonId, request.salonId),
        eq(communicationUserState.userId, request.user.id),
        eq(communicationUserState.selected, true),
      ))
      .orderBy(desc(communicationUserState.updatedAt))
      .limit(1))[0];
    return {
      draft: row?.draft ?? "",
      last_read_message_id: row?.lastReadMessageId ?? null,
      selected_conversation_id: row?.conversationId ?? null,
    };
  });

  app.patch<{
    Body: { conversation_id?: string; draft?: string; selected?: boolean };
    Params: { id: string };
  }>("/api/salons/:id/communications/workspace-state", { preHandler: view }, async (request, response) => {
    if (!ensureSalon(request.salonId, request.params.id, response)) return;
    if (!request.body.conversation_id) return response.code(400).send({ error: "CONVERSATION_REQUIRED" });
    const conversation = await tenantConversation(app.db, request.salonId, request.body.conversation_id);
    if (!conversation) return response.code(404).send({ error: "NOT_FOUND" });
    const draftProvided = typeof request.body.draft === "string";
    const draft = (request.body.draft ?? "").slice(0, 4_096);
    const selected = request.body.selected !== false;
    await app.db.transaction(async (tx) => {
      if (selected) {
        await tx.update(communicationUserState).set({ selected: false, updatedAt: new Date() }).where(and(
          eq(communicationUserState.salonId, request.salonId),
          eq(communicationUserState.userId, request.user.id),
        ));
      }
      await tx.insert(communicationUserState).values({
        conversationId: conversation.id,
        draft,
        lastOpenedAt: new Date(),
        salonId: request.salonId,
        selected,
        userId: request.user.id,
      }).onConflictDoUpdate({
        target: [communicationUserState.salonId, communicationUserState.userId, communicationUserState.conversationId],
        set: {
          ...(draftProvided ? { draft } : {}),
          lastOpenedAt: new Date(),
          selected,
          updatedAt: new Date(),
        },
      });
    });
    await publish(request.salonId, { conversation_id: conversation.id, type: "workspace.updated" });
    const saved = (await app.db.select({ draft: communicationUserState.draft }).from(communicationUserState).where(and(
      eq(communicationUserState.salonId, request.salonId),
      eq(communicationUserState.userId, request.user.id),
      eq(communicationUserState.conversationId, conversation.id),
    )))[0];
    return { draft: saved?.draft ?? "", selected_conversation_id: selected ? conversation.id : null };
  });

  app.get<{ Params: { id: string } }>("/api/salons/:id/communications/events", { preHandler: view }, async (request, response) => {
    if (!ensureSalon(request.salonId, request.params.id, response)) return;
    response.hijack();
    response.raw.writeHead(200, {
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
      "x-accel-buffering": "no",
    });
    response.raw.write(`retry: 5000\nevent: connected\ndata: ${JSON.stringify({ salon_id: request.salonId })}\n\n`);
    const subscriber = new Redis(redisConnection());
    const channel = channelForSalon(request.salonId);
    const heartbeat = setInterval(() => response.raw.write(": heartbeat\n\n"), 20_000);
    const close = () => {
      clearInterval(heartbeat);
      void subscriber.unsubscribe(channel).finally(() => subscriber.quit().catch(() => undefined));
    };
    subscriber.on("message", (receivedChannel, payload) => {
      if (receivedChannel === channel && !response.raw.destroyed) response.raw.write(`event: update\ndata: ${payload}\n\n`);
    });
    subscriber.on("error", () => {
      if (!response.raw.destroyed) response.raw.write("event: degraded\ndata: {}\n\n");
    });
    request.raw.on("close", close);
    void subscriber.subscribe(channel).catch(() => undefined);
  });
}

export async function closeCommunicationRealtime(): Promise<void> {
  const active = publisher;
  publisher = undefined;
  if (active) await active.quit().catch(() => undefined);
}
