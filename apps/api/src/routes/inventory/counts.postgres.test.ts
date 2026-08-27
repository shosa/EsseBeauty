import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

import { createDatabase, type DrizzleDB } from "@esse-beauty/db";
import {
  authSessions,
  inventoryCountLines,
  inventoryCounts,
  inventoryProducts,
  salonModules,
  salons,
  users,
} from "@esse-beauty/db/schema";
import { MODULE_KEYS } from "@esse-beauty/feature-flags";
import { clearPermissionCache } from "@esse-beauty/shared";

import { createApp } from "../../app.js";
import { testDatabaseUrl } from "../../test/postgres.js";
import {
  createSessionToken,
  hashSessionToken,
  WEB_SESSION_COOKIE,
} from "../auth/local-auth.js";

const databaseUrl = testDatabaseUrl();
const postgresSuite = databaseUrl ? describe : describe.skip;

postgresSuite("inventory count persistence with PostgreSQL", () => {
  let db: DrizzleDB;

  beforeAll(() => {
    db = createDatabase(databaseUrl!);
  });

  afterAll(async () => {
    await db.$client.end();
  });

  it("saves counted quantities when the count notes are omitted", async () => {
    const salonId = randomUUID();
    const userId = randomUUID();
    const productId = randomUUID();
    const countId = randomUUID();
    const countLineId = randomUUID();
    const token = createSessionToken();

    await db.insert(salons).values({ id: salonId, locale: "it-IT", name: "Count Test", slug: `count-${salonId}`, timezone: "Europe/Rome" });
    await db.insert(users).values({ active: true, email: `${userId}@example.invalid`, fullName: "Count Owner", id: userId, role: "owner", salonId });
    await db.insert(authSessions).values({ expiresAt: new Date(Date.now() + 60_000), tokenHash: hashSessionToken(token), userId });
    await db.insert(salonModules).values({ enabled: true, moduleKey: MODULE_KEYS.INVENTORY, salonId });
    await db.insert(inventoryProducts).values({ id: productId, name: "Crema test", salonId, stockQuantity: 2, unitPriceCents: 1_000 });
    await db.insert(inventoryCounts).values({ createdByUserId: userId, id: countId, salonId, status: "counting" });
    await db.insert(inventoryCountLines).values({ countId, id: countLineId, productId, salonId, theoreticalQuantity: 2 });

    const app = createApp({ db, env: { API_CORS_ORIGIN: "http://localhost:3000" } });

    try {
      const response = await app.inject({
        headers: { cookie: `${WEB_SESSION_COOKIE}=${token}` },
        method: "PUT",
        payload: { lines: [{ counted_quantity: 10, note: null, product_id: productId }] },
        url: `/api/salons/${salonId}/inventory/counts/${countId}`,
      });

      expect(response.statusCode, response.body).toBe(200);
      const rows = await db
        .select({ countedQuantity: inventoryCountLines.countedQuantity })
        .from(inventoryCountLines)
        .where(and(eq(inventoryCountLines.id, countLineId), eq(inventoryCountLines.salonId, salonId)));
      expect(rows).toEqual([{ countedQuantity: 10 }]);
    } finally {
      await app.close();
      clearPermissionCache();
      await db.delete(inventoryCountLines).where(eq(inventoryCountLines.salonId, salonId));
      await db.delete(inventoryCounts).where(eq(inventoryCounts.salonId, salonId));
      await db.delete(inventoryProducts).where(eq(inventoryProducts.salonId, salonId));
      await db.delete(salonModules).where(eq(salonModules.salonId, salonId));
      await db.delete(authSessions).where(eq(authSessions.userId, userId));
      await db.delete(users).where(eq(users.id, userId));
      await db.delete(salons).where(eq(salons.id, salonId));
    }
  });
});
