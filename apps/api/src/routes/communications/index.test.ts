import { randomUUID } from "node:crypto";

import cookie from "@fastify/cookie";
import { eq } from "drizzle-orm";
import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createDatabase, type DrizzleDB } from "@esse-beauty/db";
import {
  authSessions,
  communicationConversations,
  communicationMessages,
  communicationProviderAccounts,
  customers,
  salons,
  users,
} from "@esse-beauty/db/schema";

import { testDatabaseUrl } from "../../test/postgres.js";
import { hashSessionToken } from "../auth/local-auth.js";
import { registerCommunicationRoutes } from "./index.js";

const databaseUrl = testDatabaseUrl();
const postgresSuite = databaseUrl ? describe : describe.skip;

postgresSuite("WhatsApp conversation workspace with PostgreSQL", () => {
  let db: DrizzleDB;

  beforeAll(() => { db = createDatabase(databaseUrl!); });
  afterAll(async () => { await db.$client.end(); });

  function app(enqueue = vi.fn(async () => ({ messageId: randomUUID(), outboxId: randomUUID() }))) {
    const server = Fastify();
    server.decorate("db", db);
    server.decorateRequest("salonId", "");
    server.decorateRequest("user");
    void server.register(cookie);
    void registerCommunicationRoutes(server, { enqueue, publish: vi.fn(async () => undefined) });
    return { enqueue, server };
  }

  async function fixture() {
    const salonId = randomUUID();
    const otherSalonId = randomUUID();
    const ownerId = randomUUID();
    const employeeId = randomUUID();
    const customerId = randomUUID();
    const noPhoneCustomerId = randomUUID();
    const foreignCustomerId = randomUUID();
    const ownerToken = randomUUID();
    const employeeToken = randomUUID();
    await db.insert(salons).values([
      { id: salonId, locale: "it-IT", name: "Chat Test", slug: `chat-${salonId}`, timezone: "Europe/Rome" },
      { id: otherSalonId, locale: "it-IT", name: "Other Chat", slug: `chat-${otherSalonId}`, timezone: "Europe/Rome" },
    ]);
    await db.insert(users).values([
      { email: `${ownerId}@example.invalid`, fullName: "Owner", id: ownerId, role: "owner", salonId },
      { email: `${employeeId}@example.invalid`, fullName: "Employee", id: employeeId, role: "employee", salonId },
    ]);
    await db.insert(authSessions).values([
      { expiresAt: new Date(Date.now() + 60_000), tokenHash: hashSessionToken(ownerToken), userId: ownerId },
      { expiresAt: new Date(Date.now() + 60_000), tokenHash: hashSessionToken(employeeToken), userId: employeeId },
    ]);
    await db.insert(customers).values([
      { fullName: "Maria Rossi", id: customerId, phone: "3331234567", phoneNormalized: "+393331234567", salonId },
      { fullName: "Senza Telefono", id: noPhoneCustomerId, salonId },
      { fullName: "Cliente Altro Salone", id: foreignCustomerId, phone: "+447700900123", phoneNormalized: "+447700900123", salonId: otherSalonId },
    ]);
    const [account, foreignAccount] = await db.insert(communicationProviderAccounts).values([
      { enabled: true, phoneNumberId: `phone-${salonId}`, salonId, status: "ready", wabaId: `waba-${salonId}` },
      { enabled: true, phoneNumberId: `phone-${otherSalonId}`, salonId: otherSalonId, status: "ready", wabaId: `waba-${otherSalonId}` },
    ]).returning();
    const [conversation, foreignConversation] = await db.insert(communicationConversations).values([
      { accountId: account!.id, customerId, lastInboundAt: new Date(), lastMessageAt: new Date(), lastMessagePreview: "Buongiorno", participantPhone: "393331234567", salonId, unreadCount: 1 },
      { accountId: foreignAccount!.id, participantPhone: "393339999999", salonId: otherSalonId },
    ]).returning();
    const [message] = await db.insert(communicationMessages).values({
      accountId: account!.id,
      body: "Buongiorno",
      conversationId: conversation!.id,
      direction: "inbound",
      kind: "text",
      salonId,
      status: "delivered",
    }).returning();
    return { conversationId: conversation!.id, customerId, employeeToken, foreignConversationId: foreignConversation!.id, foreignCustomerId, messageId: message!.id, noPhoneCustomerId, otherSalonId, ownerId, ownerToken, salonId };
  }

  async function cleanup(salonId: string, otherSalonId: string) {
    await db.delete(salons).where(eq(salons.id, salonId));
    await db.delete(salons).where(eq(salons.id, otherSalonId));
  }

  it("returns 404 instead of leaking a conversation owned by another salon", async () => {
    const data = await fixture();
    const { server } = app();
    try {
      const response = await server.inject({
        headers: { cookie: `esse-session=${data.ownerToken}` },
        method: "GET",
        url: `/api/salons/${data.salonId}/communications/conversations/${data.foreignConversationId}/messages`,
      });
      expect(response.statusCode).toBe(404);
    } finally {
      await server.close();
      await cleanup(data.salonId, data.otherSalonId);
    }
  });

  it("enforces view/reply permissions and queues an authorized session reply", async () => {
    const data = await fixture();
    const instance = app();
    try {
      const deniedList = await instance.server.inject({ headers: { cookie: `esse-session=${data.employeeToken}` }, method: "GET", url: `/api/salons/${data.salonId}/communications/conversations` });
      expect(deniedList.statusCode).toBe(403);

      const deniedSend = await instance.server.inject({
        headers: { cookie: `esse-session=${data.employeeToken}` },
        method: "POST",
        payload: { client_idempotency_key: "employee-send", text: "Non autorizzato" },
        url: `/api/salons/${data.salonId}/communications/conversations/${data.conversationId}/messages`,
      });
      expect(deniedSend.statusCode).toBe(403);

      const sent = await instance.server.inject({
        headers: { cookie: `esse-session=${data.ownerToken}` },
        method: "POST",
        payload: { client_idempotency_key: "owner-send", text: "A presto" },
        url: `/api/salons/${data.salonId}/communications/conversations/${data.conversationId}/messages`,
      });
      expect(sent.statusCode, sent.body).toBe(202);
      expect(instance.enqueue).toHaveBeenCalledWith(db, expect.objectContaining({ actorUserId: data.ownerId, idempotencyKey: "owner-send", kind: "session", salonId: data.salonId, to: "393331234567" }));
    } finally {
      await instance.server.close();
      await cleanup(data.salonId, data.otherSalonId);
    }
  });

  it("requires an approved template outside the 24-hour service window", async () => {
    const data = await fixture();
    await db.update(communicationConversations).set({ lastInboundAt: new Date(Date.now() - 25 * 60 * 60_000) }).where(eq(communicationConversations.id, data.conversationId));
    const instance = app();
    try {
      const response = await instance.server.inject({
        headers: { cookie: `esse-session=${data.ownerToken}` },
        method: "POST",
        payload: { client_idempotency_key: "late-session", text: "Fuori finestra" },
        url: `/api/salons/${data.salonId}/communications/conversations/${data.conversationId}/messages`,
      });
      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({ error: "TEMPLATE_REQUIRED" });
      expect(instance.enqueue).not.toHaveBeenCalled();
    } finally {
      await instance.server.close();
      await cleanup(data.salonId, data.otherSalonId);
    }
  });

  it("persists the selected conversation, draft and per-user read cursor", async () => {
    const data = await fixture();
    const { server } = app();
    try {
      const saved = await server.inject({
        headers: { cookie: `esse-session=${data.ownerToken}` },
        method: "PATCH",
        payload: { conversation_id: data.conversationId, draft: "Bozza stabile", selected: true },
        url: `/api/salons/${data.salonId}/communications/workspace-state`,
      });
      expect(saved.statusCode, saved.body).toBe(200);

      const read = await server.inject({
        headers: { cookie: `esse-session=${data.ownerToken}` },
        method: "PATCH",
        payload: { message_id: data.messageId },
        url: `/api/salons/${data.salonId}/communications/conversations/${data.conversationId}/read`,
      });
      expect(read.statusCode, read.body).toBe(200);

      const restored = await server.inject({ headers: { cookie: `esse-session=${data.ownerToken}` }, method: "GET", url: `/api/salons/${data.salonId}/communications/workspace-state` });
      expect(restored.json()).toMatchObject({ draft: "Bozza stabile", last_read_message_id: data.messageId, selected_conversation_id: data.conversationId });
    } finally {
      await server.close();
      await cleanup(data.salonId, data.otherSalonId);
    }
  });

  it("lists tenant contacts and creates or reuses their normalized conversation", async () => {
    const data = await fixture();
    const { server } = app();
    try {
      const contacts = await server.inject({
        headers: { cookie: `esse-session=${data.ownerToken}` },
        method: "GET",
        url: `/api/salons/${data.salonId}/communications/contacts?q=Maria`,
      });
      expect(contacts.statusCode, contacts.body).toBe(200);
      expect(contacts.json()).toEqual({ items: [{ customer_id: data.customerId, full_name: "Maria Rossi", phone: "+393331234567" }] });

      const first = await server.inject({
        headers: { cookie: `esse-session=${data.ownerToken}` },
        method: "POST",
        payload: { customer_id: data.customerId },
        url: `/api/salons/${data.salonId}/communications/conversations`,
      });
      const second = await server.inject({
        headers: { cookie: `esse-session=${data.ownerToken}` },
        method: "POST",
        payload: { customer_id: data.customerId },
        url: `/api/salons/${data.salonId}/communications/conversations`,
      });
      expect(first.statusCode, first.body).toBe(200);
      expect(second.statusCode, second.body).toBe(200);
      expect(first.json()).toMatchObject({ customer_id: data.customerId, id: data.conversationId, participant_phone: "393331234567" });
      expect(second.json()).toEqual(first.json());
    } finally {
      await server.close();
      await cleanup(data.salonId, data.otherSalonId);
    }
  });

  it("rejects contacts without a valid phone and customers from another salon", async () => {
    const data = await fixture();
    const { server } = app();
    try {
      const missingPhone = await server.inject({
        headers: { cookie: `esse-session=${data.ownerToken}` },
        method: "POST",
        payload: { customer_id: data.noPhoneCustomerId },
        url: `/api/salons/${data.salonId}/communications/conversations`,
      });
      const foreign = await server.inject({
        headers: { cookie: `esse-session=${data.ownerToken}` },
        method: "POST",
        payload: { customer_id: data.foreignCustomerId },
        url: `/api/salons/${data.salonId}/communications/conversations`,
      });
      expect(missingPhone.statusCode).toBe(422);
      expect(missingPhone.json()).toEqual({ error: "CUSTOMER_PHONE_REQUIRED" });
      expect(foreign.statusCode).toBe(404);
    } finally {
      await server.close();
      await cleanup(data.salonId, data.otherSalonId);
    }
  });
});
