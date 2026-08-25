import { Buffer } from "node:buffer";
import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import Fastify from "fastify";

import { createDatabase, type DrizzleDB } from "@esse-beauty/db";
import { communicationProviderAccounts, communicationProviderSecrets, salons } from "@esse-beauty/db/schema";

import { encryptProviderSecret } from "../../lib/provider-credentials.js";
import { testDatabaseUrl } from "../../test/postgres.js";
import { registerWhatsAppWebhookRoutes } from "./whatsapp.js";

const databaseUrl = testDatabaseUrl();
const postgresSuite = databaseUrl ? describe : describe.skip;

postgresSuite("signed WhatsApp webhook with PostgreSQL", () => {
  let db: DrizzleDB;
  beforeAll(() => {
    process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 31).toString("base64");
    process.env.PROVIDER_CREDENTIAL_KEY_VERSION = "v1";
    db = createDatabase(databaseUrl!);
  });
  afterAll(async () => { await db.$client.end(); });

  async function fixture() {
    const salonId = randomUUID();
    const accountId = randomUUID();
    const webhookKey = randomUUID();
    await db.insert(salons).values({ id: salonId, locale: "it-IT", name: "Webhook Test", slug: `webhook-${salonId}`, timezone: "Europe/Rome" });
    await db.insert(communicationProviderAccounts).values({ enabled: true, id: accountId, phoneNumberId: `phone-${salonId}`, salonId, status: "ready", wabaId: `waba-${salonId}`, webhookKey });
    await db.insert(communicationProviderSecrets).values({
      accountId,
      kind: "webhook_verify_token",
      salonId,
      ...encryptProviderSecret("verify-me", { accountId, provider: "meta_cloud_api", salonId }),
    });
    return { accountId, phoneNumberId: `phone-${salonId}`, salonId, wabaId: `waba-${salonId}`, webhookKey };
  }

  function app() {
    const server = Fastify();
    server.decorate("db", db);
    registerWhatsAppWebhookRoutes(server, { appSecret: "meta-app-secret" });
    return server;
  }

  it("answers Meta's challenge only for the tenant verification token", async () => {
    const data = await fixture();
    const server = app();
    try {
      const ok = await server.inject({ method: "GET", url: `/api/webhooks/whatsapp/${data.webhookKey}?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345` });
      expect(ok.statusCode).toBe(200);
      expect(ok.body).toBe("12345");
      const denied = await server.inject({ method: "GET", url: `/api/webhooks/whatsapp/${data.webhookKey}?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345` });
      expect(denied.statusCode).toBe(403);
    } finally {
      await server.close();
      await db.delete(salons).where(eq(salons.id, data.salonId));
    }
  });

  it("rejects unsigned bodies before persistence and deduplicates a signed inbound event", async () => {
    const data = await fixture();
    const server = app();
    const payload = {
      entry: [{
        changes: [{
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { phone_number_id: data.phoneNumberId },
            messages: [{ from: "393331234567", id: "wamid.inbound-1", text: { body: "Buongiorno" }, timestamp: "1787568000", type: "text" }],
          },
        }],
        id: data.wabaId,
      }],
      object: "whatsapp_business_account",
    };
    const raw = JSON.stringify(payload);
    try {
      const unsigned = await server.inject({ method: "POST", payload: raw, headers: { "content-type": "application/json" }, url: `/api/webhooks/whatsapp/${data.webhookKey}` });
      expect(unsigned.statusCode).toBe(401);
      const before = await db.execute(sql<{ count: number }>`select count(*)::int count from communication_webhook_events where salon_id = ${data.salonId}::uuid`);
      expect(before).toEqual([{ count: 0 }]);

      const signature = `sha256=${createHmac("sha256", "meta-app-secret").update(raw).digest("hex")}`;
      const signed = await server.inject({ method: "POST", payload: raw, headers: { "content-type": "application/json", "x-hub-signature-256": signature }, url: `/api/webhooks/whatsapp/${data.webhookKey}` });
      const duplicate = await server.inject({ method: "POST", payload: raw, headers: { "content-type": "application/json", "x-hub-signature-256": signature }, url: `/api/webhooks/whatsapp/${data.webhookKey}` });
      expect(signed.statusCode, signed.body).toBe(200);
      expect(duplicate.statusCode, duplicate.body).toBe(200);
      const rows = await db.execute(sql<{ events: number; messages: number; unread: number }>`
        select
          (select count(*)::int from communication_webhook_events where salon_id = ${data.salonId}::uuid) events,
          (select count(*)::int from communication_messages where salon_id = ${data.salonId}::uuid) messages,
          (select coalesce(sum(unread_count), 0)::int from communication_conversations where salon_id = ${data.salonId}::uuid) unread
      `);
      expect(rows).toEqual([{ events: 1, messages: 1, unread: 1 }]);
    } finally {
      await server.close();
      await db.delete(salons).where(eq(salons.id, data.salonId));
    }
  });

  it("accepts a signed delivery status even when the referenced message is not stored locally", async () => {
    const data = await fixture();
    const server = app();
    const payload = {
      entry: [{
        changes: [{
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { phone_number_id: data.phoneNumberId },
            statuses: [{ id: "wamid.external-status", status: "sent", timestamp: "1787568000" }],
          },
        }],
        id: data.wabaId,
      }],
      object: "whatsapp_business_account",
    };
    const raw = JSON.stringify(payload);
    const signature = `sha256=${createHmac("sha256", "meta-app-secret").update(raw).digest("hex")}`;
    try {
      const response = await server.inject({
        headers: { "content-type": "application/json", "x-hub-signature-256": signature },
        method: "POST",
        payload: raw,
        url: `/api/webhooks/whatsapp/${data.webhookKey}`,
      });
      expect(response.statusCode, response.body).toBe(200);
      const events = await db.execute(sql<{ count: number }>`
        select count(*)::int count
        from communication_webhook_events
        where salon_id = ${data.salonId}::uuid and external_event_id like 'wamid.external-status:%'
      `);
      expect(events).toEqual([{ count: 1 }]);
    } finally {
      await server.close();
      await db.delete(salons).where(eq(salons.id, data.salonId));
    }
  });
});
