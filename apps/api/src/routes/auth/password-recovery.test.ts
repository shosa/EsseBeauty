import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import { createDatabase, type DrizzleDB } from "@esse-beauty/db";
import {
  authSessions,
  loginActivity,
  passwordResetTokens,
  salons,
  users,
  userCredentials,
} from "@esse-beauty/db/schema";

import { createApp } from "../../app.js";
import type { CommunicationMessage, CommunicationProviderRegistry } from "../../providers/communications.js";
import { testDatabaseUrl } from "../../test/postgres.js";
import { hashPassword, hashSessionToken, verifyPassword } from "./local-auth.js";

const databaseUrl = testDatabaseUrl();
const postgresSuite = databaseUrl ? describe : describe.skip;

postgresSuite("password recovery with PostgreSQL", () => {
  let db: DrizzleDB;
  beforeAll(() => { db = createDatabase(databaseUrl!); });
  afterAll(async () => { await db.$client.end(); });

  async function fixture() {
    const salonId = randomUUID();
    const userId = randomUUID();
    const email = `${userId}@example.invalid`;
    const password = await hashPassword("vecchia-password");
    await db.insert(salons).values({ id: salonId, locale: "it-IT", name: "Auth Test", slug: `auth-${salonId}`, timezone: "Europe/Rome" });
    await db.insert(users).values({ email, fullName: "Mario Rossi", id: userId, role: "owner", salonId });
    await db.insert(userCredentials).values({ userId, passwordHash: password.hash, passwordSalt: password.salt });
    return { email, salonId, userId };
  }

  it("uses an enumeration-safe response and sends a purpose-scoped 30 minute token", async () => {
    const data = await fixture();
    const send = vi.fn(async (_message: CommunicationMessage) => ({ acceptedAt: new Date(), provider: "resend" as const, providerMessageId: "mail-1" }));
    const providers: CommunicationProviderRegistry = {
      require: () => ({ send }),
      send,
      status: () => ({ email: "ready" }),
    };
    const app = createApp({ authProviders: providers, db, env: { API_CORS_ORIGIN: "http://localhost:3000" } });
    try {
      const known = await app.inject({ method: "POST", payload: { email: data.email }, url: "/api/auth/password-reset/request" });
      const missing = await app.inject({ method: "POST", payload: { email: `${randomUUID()}@example.invalid` }, url: "/api/auth/password-reset/request" });
      expect([known.statusCode, known.json()]).toEqual([missing.statusCode, missing.json()]);
      expect(known.statusCode).toBe(202);
      expect(send).toHaveBeenCalledTimes(1);
      const sentMessage = send.mock.calls[0]?.[0];
      expect(sentMessage?.channel).toBe("email");
      const html = sentMessage?.channel === "email" ? sentMessage.html : "";
      expect(html).toContain("/reset-password/v1.password_reset.");
      const stored = await db.query.passwordResetTokens.findMany({ where: (row, { eq: equals }) => equals(row.userId, data.userId) });
      expect(stored).toHaveLength(1);
      expect(stored[0]!.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 60_000);
      expect(stored[0]!.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(30 * 60_000);
      expect(JSON.stringify(stored)).not.toContain("v1.password_reset");
    } finally {
      await app.close();
      await db.delete(salons).where(eq(salons.id, data.salonId));
    }
  });

  it("consumes a token once, changes the password and revokes every session transactionally", async () => {
    const data = await fixture();
    let rawToken = "";
    const providers: CommunicationProviderRegistry = {
      require: () => ({ send: async (message) => {
        rawToken = /\/reset-password\/([^\s<"]+)/.exec(message.channel === "email" ? message.html : "")?.[1] ?? "";
        return { acceptedAt: new Date(), provider: "resend", providerMessageId: "mail-2" };
      } }),
      async send(message) { return this.require(message.channel).send(message); },
      status: () => ({ email: "ready" }),
    };
    await db.insert(authSessions).values({ expiresAt: new Date(Date.now() + 60_000), tokenHash: hashSessionToken(randomUUID()), userId: data.userId });
    const app = createApp({ authProviders: providers, db, env: { API_CORS_ORIGIN: "http://localhost:3000" } });
    try {
      await app.inject({ method: "POST", payload: { email: data.email }, url: "/api/auth/password-reset/request" });
      expect(rawToken).toMatch(/^v1\.password_reset\./);
      const completed = await app.inject({ method: "POST", payload: { new_password: "nuova-password-sicura", token: rawToken }, url: "/api/auth/password-reset/complete" });
      expect(completed.statusCode, completed.body).toBe(200);
      const reused = await app.inject({ method: "POST", payload: { new_password: "altra-password-sicura", token: rawToken }, url: "/api/auth/password-reset/complete" });
      expect(reused.statusCode).toBe(410);
      expect(await db.query.authSessions.findMany({ where: (row, { eq: equals }) => equals(row.userId, data.userId) })).toHaveLength(0);
      const credential = await db.query.userCredentials.findFirst({ where: (row, { eq: equals }) => equals(row.userId, data.userId) });
      expect(await verifyPassword("nuova-password-sicura", credential!.passwordSalt, credential!.passwordHash)).toBe(true);

      await app.inject({ method: "POST", payload: { email: data.email }, url: "/api/auth/password-reset/request" });
      await db.update(passwordResetTokens).set({ expiresAt: new Date(Date.now() - 1) }).where(eq(passwordResetTokens.userId, data.userId));
      const expired = await app.inject({ method: "POST", payload: { new_password: "password-che-non-passa", token: rawToken }, url: "/api/auth/password-reset/complete" });
      expect(expired.statusCode).toBe(410);
    } finally {
      await app.close();
      await db.delete(salons).where(eq(salons.id, data.salonId));
    }
  });

  it("records successful and failed login metadata without passwords", async () => {
    const data = await fixture();
    const app = createApp({ db, env: { API_CORS_ORIGIN: "http://localhost:3000" } });
    try {
      await app.inject({ headers: { "user-agent": "vitest-browser" }, method: "POST", payload: { email: data.email, password: "password-errata" }, url: "/api/auth/login" });
      await app.inject({ headers: { "user-agent": "vitest-browser" }, method: "POST", payload: { email: data.email, password: "vecchia-password" }, url: "/api/auth/login" });
      const rows = await db.select().from(loginActivity).where(eq(loginActivity.userId, data.userId));
      expect(rows.map((row) => row.success).sort()).toEqual([false, true]);
      expect(rows.every((row) => row.userAgent === "vitest-browser" && Boolean(row.ipAddress))).toBe(true);
      expect(JSON.stringify(rows)).not.toContain("password-errata");
    } finally {
      await app.close();
      await db.delete(salons).where(eq(salons.id, data.salonId));
    }
  });
});
