import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import Fastify from "fastify";
import cookie from "@fastify/cookie";

import { createDatabase, type DrizzleDB } from "@esse-beauty/db";
import { authSessions, salons, users } from "@esse-beauty/db/schema";

import { testDatabaseUrl } from "../../test/postgres.js";
import { hashSessionToken } from "../auth/local-auth.js";
import { registerCommunicationSettingsRoutes } from "./settings.js";

const databaseUrl = testDatabaseUrl();
const postgresSuite = databaseUrl ? describe : describe.skip;

postgresSuite("WhatsApp provider settings with PostgreSQL", () => {
  let db: DrizzleDB;
  beforeAll(() => {
    db = createDatabase(databaseUrl!);
    process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 11).toString("base64");
    process.env.PROVIDER_CREDENTIAL_KEY_VERSION = "v1";
  });
  afterAll(async () => { await db.$client.end(); });

  function communicationApp() {
    const app = Fastify();
    app.decorate("db", db);
    app.decorateRequest("salonId", "");
    app.decorateRequest("user");
    void app.register(cookie);
    void registerCommunicationSettingsRoutes(app);
    return app;
  }

  async function fixture() {
    const salonId = randomUUID();
    const ownerId = randomUUID();
    const receptionistId = randomUUID();
    const ownerToken = randomUUID();
    const receptionistToken = randomUUID();
    await db.insert(salons).values({ id: salonId, locale: "it-IT", name: "WhatsApp Test", slug: `wa-${salonId}`, timezone: "Europe/Rome" });
    await db.insert(users).values([
      { email: `${ownerId}@example.invalid`, fullName: "Owner", id: ownerId, role: "owner", salonId },
      { email: `${receptionistId}@example.invalid`, fullName: "Receptionist", id: receptionistId, role: "receptionist", salonId },
    ]);
    await db.insert(authSessions).values([
      { expiresAt: new Date(Date.now() + 60_000), tokenHash: hashSessionToken(ownerToken), userId: ownerId },
      { expiresAt: new Date(Date.now() + 60_000), tokenHash: hashSessionToken(receptionistToken), userId: receptionistId },
    ]);
    return { ownerToken, receptionistToken, salonId };
  }

  it("stores credentials but returns only masked tenant-safe settings", async () => {
    const data = await fixture();
    const app = communicationApp();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      display_phone_number: "+39 333 123 4567",
      id: `phone-${data.salonId}`,
      verified_name: "WhatsApp Test",
    }), { headers: { "content-type": "application/json" }, status: 200 })));
    try {
      const saved = await app.inject({
        headers: { cookie: `esse-session=${data.ownerToken}` },
        method: "PUT",
        payload: {
          access_token: "meta-secret-token",
          business_portfolio_id: "portfolio-1",
          display_phone_number: "+39 333 123 4567",
          enabled: true,
          graph_api_version: "v23.0",
          phone_number_id: `phone-${data.salonId}`,
          waba_id: `waba-${data.salonId}`,
          webhook_verify_token: "webhook-secret-token",
        },
        url: `/api/salons/${data.salonId}/communications/provider`,
      });
      expect(saved.statusCode, saved.body).toBe(200);
      expect(saved.json()).toMatchObject({
        credential_present: true,
        display_phone_number_masked: "+39 ••• ••• 4567",
        last_health_check_at: expect.any(String),
        provider: "meta_cloud_api",
        ready: true,
        status: "ready",
        webhook_credential_present: true,
      });
      expect(saved.body).not.toContain("meta-secret-token");
      expect(saved.body).not.toContain("webhook-secret-token");
      expect(saved.body).not.toContain("ciphertext");

      const loaded = await app.inject({
        headers: { cookie: `esse-session=${data.ownerToken}` },
        method: "GET",
        url: `/api/salons/${data.salonId}/communications/provider`,
      });
      expect(loaded.statusCode, loaded.body).toBe(200);
      expect(loaded.body).not.toContain("meta-secret-token");
      expect(loaded.body).not.toContain("webhook-secret-token");
      expect(loaded.body).not.toContain("ciphertext");
    } finally {
      vi.unstubAllGlobals();
      await app.close();
      await db.delete(salons).where(eq(salons.id, data.salonId));
    }
  });

  it("denies provider changes to a receptionist while allowing masked status reads", async () => {
    const data = await fixture();
    const app = communicationApp();
    try {
      const read = await app.inject({
        headers: { cookie: `esse-session=${data.receptionistToken}` },
        method: "GET",
        url: `/api/salons/${data.salonId}/communications/provider`,
      });
      expect(read.statusCode, read.body).toBe(200);

      const update = await app.inject({
        headers: { cookie: `esse-session=${data.receptionistToken}` },
        method: "PUT",
        payload: { access_token: "must-not-be-stored", phone_number_id: "foreign", waba_id: "foreign" },
        url: `/api/salons/${data.salonId}/communications/provider`,
      });
      expect(update.statusCode, update.body).toBe(403);
      expect(update.json()).toMatchObject({ required: "communications.manage_provider" });
    } finally {
      await app.close();
      await db.delete(salons).where(eq(salons.id, data.salonId));
    }
  });

  it("rejects another salon id before reading provider state", async () => {
    const data = await fixture();
    const app = communicationApp();
    try {
      const response = await app.inject({
        headers: { cookie: `esse-session=${data.ownerToken}` },
        method: "GET",
        url: `/api/salons/${randomUUID()}/communications/provider`,
      });
      expect(response.statusCode).toBe(403);
    } finally {
      await app.close();
      await db.delete(salons).where(eq(salons.id, data.salonId));
    }
  });
});
