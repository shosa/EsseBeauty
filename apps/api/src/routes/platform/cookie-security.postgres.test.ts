import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { createDatabase, type DrizzleDB } from "@esse-beauty/db";
import { platformAdmins } from "@esse-beauty/db/schema";

import { createApp } from "../../app.js";
import { testDatabaseUrl } from "../../test/postgres.js";
import { hashPassword } from "../auth/local-auth.js";

const databaseUrl = testDatabaseUrl();
const postgresSuite = databaseUrl ? describe : describe.skip;

postgresSuite("platform cookie security with PostgreSQL", () => {
  let db: DrizzleDB;
  beforeAll(() => { db = createDatabase(databaseUrl!); });
  afterAll(async () => { await db.$client.end(); });

  it("allows the platform session cookie over HTTP when COOKIE_SECURE is false in production", async () => {
    const adminId = randomUUID();
    const email = `${adminId}@example.invalid`;
    const password = "platform-password";
    const passwordData = await hashPassword(password);
    const previousNodeEnv = process.env.NODE_ENV;
    const previousCookieSecure = process.env.COOKIE_SECURE;
    process.env.NODE_ENV = "production";
    process.env.COOKIE_SECURE = "false";
    await db.insert(platformAdmins).values({
      email,
      fullName: "Platform Test",
      id: adminId,
      passwordHash: passwordData.hash,
      passwordSalt: passwordData.salt,
    });
    const app = createApp({ db, env: { API_CORS_ORIGIN: "http://localhost:3000" } });

    try {
      const response = await app.inject({
        method: "POST",
        payload: { email, password },
        url: "/api/platform/auth/login",
      });

      expect(response.statusCode, response.body).toBe(200);
      expect(response.headers["set-cookie"]).not.toMatch(/;\s*Secure(?:;|$)/i);
    } finally {
      await app.close();
      await db.delete(platformAdmins).where(eq(platformAdmins.id, adminId));
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousCookieSecure === undefined) delete process.env.COOKIE_SECURE;
      else process.env.COOKIE_SECURE = previousCookieSecure;
    }
  });
});
