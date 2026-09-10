import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";

import { createDatabase, type DrizzleDB } from "@esse-beauty/db";
import {
  customers,
  loyaltyPoints,
  loyaltyRewardRedemptions,
  loyaltyRewards,
  salons,
  users,
} from "@esse-beauty/db/schema";

import {
  LoyaltyOperationError,
  redeemLoyaltyReward,
  resolveLoyaltyTier,
} from "../../lib/loyalty-service.js";
import { testDatabaseUrl } from "../../test/postgres.js";

const databaseUrl = testDatabaseUrl();
const postgresSuite = databaseUrl ? describe : describe.skip;

describe("loyalty tier resolution", () => {
  it("returns the current tier and the next ordered threshold", () => {
    expect(resolveLoyaltyTier(250, [
      { id: "gold", minPoints: 500, name: "Gold" },
      { id: "bronze", minPoints: 0, name: "Bronze" },
      { id: "silver", minPoints: 200, name: "Silver" },
    ])).toEqual({
      currentTier: { id: "silver", minPoints: 200, name: "Silver" },
      nextTier: { id: "gold", minPoints: 500, name: "Gold", pointsRemaining: 250 },
    });
  });
});

postgresSuite("loyalty reward redemption with PostgreSQL", () => {
  let db: DrizzleDB;

  beforeAll(() => { db = createDatabase(databaseUrl!); });
  afterAll(async () => { await db.$client.end(); });

  async function fixture() {
    const salonId = randomUUID();
    const otherSalonId = randomUUID();
    const customerId = randomUUID();
    const rewardId = randomUUID();
    const actorUserId = randomUUID();
    await db.insert(salons).values([
      { id: salonId, locale: "it-IT", name: "Loyalty Test", slug: `loyalty-${salonId}`, timezone: "Europe/Rome" },
      { id: otherSalonId, locale: "it-IT", name: "Other Loyalty Test", slug: `loyalty-${otherSalonId}`, timezone: "Europe/Rome" },
    ]);
    await db.insert(customers).values({ email: `${customerId}@example.invalid`, fullName: "Mario Rossi", id: customerId, salonId });
    await db.insert(users).values({ email: `${actorUserId}@example.invalid`, fullName: "Owner", id: actorUserId, role: "owner", salonId });
    await db.insert(loyaltyRewards).values({ id: rewardId, name: "Trattamento omaggio", pointsRequired: 80, salonId });
    await db.insert(loyaltyPoints).values({ customerId, delta: 100, reason: "Saldo iniziale", salonId });
    return { actorUserId, customerId, otherSalonId, rewardId, salonId };
  }

  async function cleanup(salonId: string, otherSalonId: string) {
    await db.delete(salons).where(sql`${salons.id} in (${salonId}::uuid, ${otherSalonId}::uuid)`);
  }

  it("creates a redemption and an immutable negative ledger movement atomically", async () => {
    const data = await fixture();
    try {
      const result = await redeemLoyaltyReward(db, {
        actorUserId: data.actorUserId,
        customerId: data.customerId,
        idempotencyKey: randomUUID(),
        rewardId: data.rewardId,
        salonId: data.salonId,
      });
      expect(result).toMatchObject({ balance: 20, idempotent: false, pointsSpent: 80, status: "redeemed" });
      const [redemptions, ledger] = await Promise.all([
        db.select().from(loyaltyRewardRedemptions).where(eq(loyaltyRewardRedemptions.customerId, data.customerId)),
        db.select().from(loyaltyPoints).where(and(eq(loyaltyPoints.customerId, data.customerId), sql`${loyaltyPoints.delta} < 0`)),
      ]);
      expect(redemptions).toHaveLength(1);
      expect(ledger).toHaveLength(1);
      expect(ledger[0]).toMatchObject({ delta: -80, redemptionId: redemptions[0]!.id });
    } finally { await cleanup(data.salonId, data.otherSalonId); }
  });

  it("rejects insufficient active balance without persisting partial data", async () => {
    const data = await fixture();
    try {
      await db.update(loyaltyRewards).set({ pointsRequired: 120 }).where(eq(loyaltyRewards.id, data.rewardId));
      await expect(redeemLoyaltyReward(db, {
        actorUserId: data.actorUserId,
        customerId: data.customerId,
        idempotencyKey: randomUUID(),
        rewardId: data.rewardId,
        salonId: data.salonId,
      })).rejects.toMatchObject({ code: "INSUFFICIENT_POINTS", statusCode: 409 } satisfies Partial<LoyaltyOperationError>);
      expect(await db.select().from(loyaltyRewardRedemptions).where(eq(loyaltyRewardRedemptions.customerId, data.customerId))).toHaveLength(0);
    } finally { await cleanup(data.salonId, data.otherSalonId); }
  });

  it("enforces tenant isolation for customers and rewards", async () => {
    const data = await fixture();
    try {
      await expect(redeemLoyaltyReward(db, {
        actorUserId: data.actorUserId,
        customerId: data.customerId,
        idempotencyKey: randomUUID(),
        rewardId: data.rewardId,
        salonId: data.otherSalonId,
      })).rejects.toMatchObject({ code: "CUSTOMER_NOT_FOUND", statusCode: 404 } satisfies Partial<LoyaltyOperationError>);
    } finally { await cleanup(data.salonId, data.otherSalonId); }
  });

  it("returns the first result for repeated idempotency keys", async () => {
    const data = await fixture();
    const idempotencyKey = randomUUID();
    try {
      const first = await redeemLoyaltyReward(db, { actorUserId: data.actorUserId, customerId: data.customerId, idempotencyKey, rewardId: data.rewardId, salonId: data.salonId });
      const second = await redeemLoyaltyReward(db, { actorUserId: data.actorUserId, customerId: data.customerId, idempotencyKey, rewardId: data.rewardId, salonId: data.salonId });
      expect(second).toMatchObject({ balance: 20, id: first.id, idempotent: true });
      expect(await db.select().from(loyaltyRewardRedemptions).where(eq(loyaltyRewardRedemptions.customerId, data.customerId))).toHaveLength(1);
    } finally { await cleanup(data.salonId, data.otherSalonId); }
  });

  it("prevents concurrent double-spend", async () => {
    const data = await fixture();
    try {
      const attempts = await Promise.allSettled([
        redeemLoyaltyReward(db, { actorUserId: data.actorUserId, customerId: data.customerId, idempotencyKey: randomUUID(), rewardId: data.rewardId, salonId: data.salonId }),
        redeemLoyaltyReward(db, { actorUserId: data.actorUserId, customerId: data.customerId, idempotencyKey: randomUUID(), rewardId: data.rewardId, salonId: data.salonId }),
      ]);
      expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
      expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
      const balance = await db.execute(sql<{ balance: number }>`select coalesce(sum(delta), 0)::int as balance from loyalty_points where salon_id = ${data.salonId}::uuid and customer_id = ${data.customerId}::uuid`);
      expect(balance[0]?.balance).toBe(20);
    } finally { await cleanup(data.salonId, data.otherSalonId); }
  });
});
