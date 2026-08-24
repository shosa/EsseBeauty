import { and, eq, sql } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import {
  customers,
  loyaltyPoints,
  loyaltyRewardRedemptions,
  loyaltyRewards,
  loyaltySettings,
  users,
} from "@esse-beauty/db/schema";

export class LoyaltyOperationError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(code);
  }
}

export interface LoyaltyTierLike {
  id: string;
  minPoints: number;
  name: string;
}

export function resolveLoyaltyTier<T extends LoyaltyTierLike>(balance: number, tiers: T[]) {
  const ordered = [...tiers].sort((left, right) => left.minPoints - right.minPoints);
  const currentTier = [...ordered].reverse().find((tier) => tier.minPoints <= balance) ?? null;
  const upcoming = ordered.find((tier) => tier.minPoints > balance) ?? null;
  return {
    currentTier,
    nextTier: upcoming ? { ...upcoming, pointsRemaining: upcoming.minPoints - balance } : null,
  };
}

export const activeLoyaltyBalanceSql = sql<number>`greatest(coalesce(sum(
  case
    when ${loyaltyPoints.expiredAt} is null
      and (${loyaltyPoints.expiresAt} is null or ${loyaltyPoints.expiresAt} > now())
    then ${loyaltyPoints.delta}
    else 0
  end
), 0), 0)::int`;

async function activeBalance(tx: any, salonId: string, customerId: string): Promise<number> {
  const rows = await tx
    .select({ balance: activeLoyaltyBalanceSql })
    .from(loyaltyPoints)
    .where(and(eq(loyaltyPoints.salonId, salonId), eq(loyaltyPoints.customerId, customerId)));
  return Number(rows[0]?.balance ?? 0);
}

async function lockCustomer(tx: any, salonId: string, customerId: string) {
  const rows = await tx
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.salonId, salonId)))
    .for("update");
  if (!rows[0]) throw new LoyaltyOperationError("CUSTOMER_NOT_FOUND", 404);
}

async function assertActor(tx: any, salonId: string, actorUserId: string) {
  const rows = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, actorUserId), eq(users.salonId, salonId)));
  if (!rows[0]) throw new LoyaltyOperationError("ACTOR_NOT_FOUND", 404);
}

export async function redeemLoyaltyReward(
  db: DrizzleDB,
  input: {
    actorUserId: string;
    customerId: string;
    idempotencyKey: string;
    notes?: string;
    rewardId: string;
    salonId: string;
  },
) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${input.salonId}:${input.idempotencyKey}`}, 0))`);
    const existing = await tx
      .select()
      .from(loyaltyRewardRedemptions)
      .where(and(
        eq(loyaltyRewardRedemptions.salonId, input.salonId),
        eq(loyaltyRewardRedemptions.idempotencyKey, input.idempotencyKey),
      ));
    if (existing[0]) {
      if (existing[0].customerId !== input.customerId || existing[0].rewardId !== input.rewardId) {
        throw new LoyaltyOperationError("IDEMPOTENCY_CONFLICT", 409);
      }
      return {
        balance: await activeBalance(tx, input.salonId, input.customerId),
        id: existing[0].id,
        idempotent: true,
        pointsSpent: existing[0].pointsSpent,
        status: existing[0].status,
      };
    }

    await lockCustomer(tx, input.salonId, input.customerId);
    await assertActor(tx, input.salonId, input.actorUserId);
    const rewardRows = await tx
      .select()
      .from(loyaltyRewards)
      .where(and(
        eq(loyaltyRewards.id, input.rewardId),
        eq(loyaltyRewards.salonId, input.salonId),
        eq(loyaltyRewards.active, true),
      ));
    const reward = rewardRows[0];
    if (!reward) throw new LoyaltyOperationError("REWARD_NOT_AVAILABLE", 404);

    const balance = await activeBalance(tx, input.salonId, input.customerId);
    if (balance < reward.pointsRequired) {
      throw new LoyaltyOperationError("INSUFFICIENT_POINTS", 409);
    }

    const redemptionRows = await tx
      .insert(loyaltyRewardRedemptions)
      .values({
        approvedByUserId: input.actorUserId,
        customerId: input.customerId,
        idempotencyKey: input.idempotencyKey,
        notes: input.notes?.trim() || null,
        pointsSpent: reward.pointsRequired,
        redeemedAt: new Date(),
        rewardId: reward.id,
        salonId: input.salonId,
        status: "redeemed",
      })
      .returning();
    const redemption = redemptionRows[0]!;
    await tx.insert(loyaltyPoints).values({
      createdByUserId: input.actorUserId,
      customerId: input.customerId,
      delta: -reward.pointsRequired,
      reason: `Riscatto premio: ${reward.name}`,
      redemptionId: redemption.id,
      salonId: input.salonId,
    });
    return {
      balance: balance - reward.pointsRequired,
      id: redemption.id,
      idempotent: false,
      pointsSpent: reward.pointsRequired,
      status: redemption.status,
    };
  });
}

export async function adjustLoyaltyBalance(
  db: DrizzleDB,
  input: { actorUserId: string; customerId: string; delta: number; reason: string; salonId: string },
) {
  return db.transaction(async (tx) => {
    await assertActor(tx, input.salonId, input.actorUserId);
    await lockCustomer(tx, input.salonId, input.customerId);
    const balance = await activeBalance(tx, input.salonId, input.customerId);
    const settingRows = await tx
      .select({ allowNegativeBalance: loyaltySettings.allowNegativeBalance })
      .from(loyaltySettings)
      .where(eq(loyaltySettings.salonId, input.salonId));
    if (!settingRows[0]?.allowNegativeBalance && balance + input.delta < 0) {
      throw new LoyaltyOperationError("INSUFFICIENT_POINTS", 409);
    }
    const rows = await tx.insert(loyaltyPoints).values({
      createdByUserId: input.actorUserId,
      customerId: input.customerId,
      delta: input.delta,
      reason: input.reason.trim(),
      salonId: input.salonId,
    }).returning();
    return { balance: Math.max(0, balance + input.delta), movement: rows[0] };
  });
}
