import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

import { createDatabase, type DrizzleDB } from "@esse-beauty/db";
import { inventoryDocuments, platformAdmins, platformAuditLog, salons } from "@esse-beauty/db/schema";

import { createApp } from "../../app.js";
import { testDatabaseUrl } from "../../test/postgres.js";
import { hashPassword } from "../auth/local-auth.js";

const databaseUrl = testDatabaseUrl();
const postgresSuite = databaseUrl ? describe : describe.skip;

postgresSuite("platform salon deletion with PostgreSQL", () => {
  let db: DrizzleDB;

  beforeAll(() => {
    db = createDatabase(databaseUrl!);
  });

  afterAll(async () => {
    await db.$client.end();
  });

  it("deletes a salon when confirmation travels in the URL", async () => {
    const adminId = randomUUID();
    const salonId = randomUUID();
    const slug = `delete-${salonId}`;
    const password = "platform-password";
    const passwordData = await hashPassword(password);

    await db.insert(platformAdmins).values({
      email: `${adminId}@example.invalid`,
      fullName: "Delete Test",
      id: adminId,
      passwordHash: passwordData.hash,
      passwordSalt: passwordData.salt,
    });
    await db.insert(salons).values({
      id: salonId,
      locale: "it-IT",
      name: "Tenant da eliminare",
      slug,
      timezone: "Europe/Rome",
    });
    await db.insert(inventoryDocuments).values({
      internalNumber: `OPENING-${salonId}`,
      kind: "opening",
      postedAt: new Date(),
      salonId,
      status: "posted",
    });

    const app = createApp({ db, env: { API_CORS_ORIGIN: "http://localhost:3004" } });

    try {
      await expect(
        db.delete(inventoryDocuments).where(eq(inventoryDocuments.salonId, salonId)),
      ).rejects.toThrow('delete from "inventory_documents"');

      const login = await app.inject({
        method: "POST",
        payload: { email: `${adminId}@example.invalid`, password },
        url: "/api/platform/auth/login",
      });
      const setCookie = login.headers["set-cookie"];
      const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.split(";", 1)[0];

      const response = await app.inject({
        headers: { cookie: cookie! },
        method: "DELETE",
        url: `/api/platform/salons/${salonId}?confirmation=${encodeURIComponent(slug)}`,
      });

      expect(response.statusCode, response.body).toBe(200);
      expect(response.json()).toEqual({ deleted: true });
      expect(await db.select().from(salons).where(eq(salons.id, salonId))).toEqual([]);
    } finally {
      await app.close();
      await db.delete(platformAuditLog).where(eq(platformAuditLog.targetId, salonId));
      await db.transaction(async (tx) => {
        await tx.execute(sql`set local session_replication_role = replica`);
        await tx.delete(inventoryDocuments).where(eq(inventoryDocuments.salonId, salonId));
        await tx.delete(salons).where(eq(salons.id, salonId));
      });
      await db.delete(platformAdmins).where(eq(platformAdmins.id, adminId));
    }
  });
});
