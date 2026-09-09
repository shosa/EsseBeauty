import { and, eq, sql } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import {
  customers,
  loyaltyPoints,
  loyaltyRewardRedemptions,
  loyaltyRewards,
  loyaltySettings,
  purchaseVouchers,
  users,
} from "@esse-beauty/db/schema";

import { issuePurchaseVoucher } from "./purchase-vouchers.js";

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
      const existingVoucher = await tx
        .select({ code: purchaseVouchers.code })
        .from(purchaseVouchers)
        .where(eq(purchaseVouchers.sourceRewardRedemptionId, existing[0].id));
      return {
        balance: await activeBalance(tx, input.salonId, input.customerId),
        id: existing[0].id,
        idempotent: true,
        pointsSpent: existing[0].pointsSpent,
        status: existing[0].status,
        voucherCode: existingVoucher[0]?.code,
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
    // Solo il tipo "credito" può essere riscattato fuori da una vendita: gli
    // altri tipi (trattamento/prodotto omaggio, sconto fisso/%) hanno senso solo
    // legati a un carrello e vanno riscattati in cassa (vedi redeemRewardsInSale).
    if (reward.type !== "credit") {
      throw new LoyaltyOperationError("REWARD_REQUIRES_CHECKOUT", 400);
    }

    const balance = await activeBalance(tx, input.salonId, input.customerId);
    if (balance < reward.pointsRequired) {
      throw new LoyaltyOperationError("INSUFFICIENT_POINTS", 409);
    }

    const redemptionRows = await tx
      .insert(loyaltyRewardRedemptions)
      .values({
        appliedDiscountCents: reward.discountAmountCents,
        appliedType: reward.type,
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
    const voucher = await issuePurchaseVoucher(tx, {
      amountCents: reward.discountAmountCents!,
      customerId: input.customerId,
      issuedByUserId: input.actorUserId,
      issuedSaleId: null,
      message: `Generato dal premio fedeltà: ${reward.name}`,
      salonId: input.salonId,
      sourceRewardRedemptionId: redemption.id,
    });
    return {
      balance: balance - reward.pointsRequired,
      id: redemption.id,
      idempotent: false,
      pointsSpent: reward.pointsRequired,
      status: redemption.status,
      voucherCode: voucher.code,
    };
  });
}

export interface RewardSaleLine {
  itemType: string;
  packageQuantity: number;
  productId?: string | null;
  quantity: number;
  serviceId?: string | null;
  unitPriceCents: number;
}

export interface RewardRedemptionPlanEntry {
  appliedDiscountCents: number;
  appliedProductId: string | null;
  appliedServiceId: string | null;
  appliedType: string;
  lineIndex: number | null;
  pointsSpent: number;
  rewardId: string;
  rewardName: string;
}

/**
 * Calcola (senza scrivere nulla) lo sconto che ogni premio selezionato in cassa deve
 * produrre, validando cliente/punti/vincoli — mai un importo proposto dal client.
 * Va chiamata PRIMA dell'insert della vendita (serve solo a calcolare i totali);
 * la scrittura effettiva avviene con commitRewardRedemptions dopo che la vendita esiste.
 */
export async function planRewardRedemptions(
  tx: any,
  input: {
    customerId?: string | null;
    lines: RewardSaleLine[];
    manualDiscountCents: number;
    rewardIds: string[];
    salonId: string;
    voucherCents: number;
  },
): Promise<{
  perLineDiscountCents: Map<number, number>;
  plans: RewardRedemptionPlanEntry[];
  totalRewardDiscountCents: number;
}> {
  if (!input.rewardIds.length) return { perLineDiscountCents: new Map(), plans: [], totalRewardDiscountCents: 0 };
  if (!input.customerId) throw new LoyaltyOperationError("REWARD_CUSTOMER_REQUIRED", 400);

  await lockCustomer(tx, input.salonId, input.customerId);

  const grossSubtotalCents = input.lines.reduce(
    (sum, line) => sum + Math.max(0, line.quantity - line.packageQuantity) * line.unitPriceCents,
    0,
  );
  const perLineDiscountCents = new Map<number, number>();
  const plans: RewardRedemptionPlanEntry[] = [];
  let totalRewardDiscountCents = 0;
  let totalPointsRequired = 0;
  let remainingSaleValueCents = Math.max(0, grossSubtotalCents - input.manualDiscountCents - input.voucherCents);

  for (const rewardId of input.rewardIds) {
    const rewardRows = await tx
      .select()
      .from(loyaltyRewards)
      .where(and(
        eq(loyaltyRewards.id, rewardId),
        eq(loyaltyRewards.salonId, input.salonId),
        eq(loyaltyRewards.active, true),
      ));
    const reward = rewardRows[0];
    if (!reward || reward.type === "credit") throw new LoyaltyOperationError("REWARD_NOT_AVAILABLE", 404);

    let appliedDiscountCents = 0;
    let lineIndex: number | null = null;
    let appliedServiceId: string | null = null;
    let appliedProductId: string | null = null;

    if (reward.type === "free_treatment" || reward.type === "free_product") {
      const wantsService = reward.type === "free_treatment";
      const idx = input.lines.findIndex((line, i) =>
        !perLineDiscountCents.has(i) &&
        line.itemType === (wantsService ? "service" : "product") &&
        (wantsService ? line.serviceId : line.productId) === (wantsService ? reward.serviceId : reward.productId));
      if (idx === -1) throw new LoyaltyOperationError("REWARD_ITEM_NOT_IN_CART", 400);
      const line = input.lines[idx]!;
      const gross = Math.max(0, line.quantity - line.packageQuantity) * line.unitPriceCents;
      if (gross <= 0) throw new LoyaltyOperationError("REWARD_ITEM_ALREADY_COVERED", 400);
      appliedDiscountCents = gross;
      lineIndex = idx;
      perLineDiscountCents.set(idx, gross);
      if (wantsService) appliedServiceId = reward.serviceId; else appliedProductId = reward.productId;
    } else if (reward.type === "fixed_discount") {
      if (reward.minSpendCents && remainingSaleValueCents < reward.minSpendCents) {
        throw new LoyaltyOperationError("REWARD_MIN_SPEND_NOT_MET", 400);
      }
      appliedDiscountCents = Math.min(reward.discountAmountCents ?? 0, remainingSaleValueCents);
    } else if (reward.type === "percent_discount") {
      if (reward.minSpendCents && remainingSaleValueCents < reward.minSpendCents) {
        throw new LoyaltyOperationError("REWARD_MIN_SPEND_NOT_MET", 400);
      }
      const raw = Math.round((remainingSaleValueCents * (reward.discountPercent ?? 0)) / 100);
      const capped = reward.maxDiscountCents ? Math.min(raw, reward.maxDiscountCents) : raw;
      appliedDiscountCents = Math.min(capped, remainingSaleValueCents);
    }

    remainingSaleValueCents = Math.max(0, remainingSaleValueCents - appliedDiscountCents);
    totalRewardDiscountCents += appliedDiscountCents;
    totalPointsRequired += reward.pointsRequired;
    plans.push({
      appliedDiscountCents,
      appliedProductId,
      appliedServiceId,
      appliedType: reward.type,
      lineIndex,
      pointsSpent: reward.pointsRequired,
      rewardId: reward.id,
      rewardName: reward.name,
    });
  }

  const balance = await activeBalance(tx, input.salonId, input.customerId);
  if (balance < totalPointsRequired) throw new LoyaltyOperationError("INSUFFICIENT_POINTS", 409);

  return { perLineDiscountCents, plans, totalRewardDiscountCents };
}

/** Scrive le redemption + il ledger punti dopo che la vendita è stata inserita (serve saleId). */
export async function commitRewardRedemptions(
  tx: any,
  input: { actorUserId: string; customerId: string; plans: RewardRedemptionPlanEntry[]; saleId: string; salonId: string },
) {
  for (const plan of input.plans) {
    const redemptionRows = await tx
      .insert(loyaltyRewardRedemptions)
      .values({
        appliedDiscountCents: plan.appliedDiscountCents,
        appliedProductId: plan.appliedProductId,
        appliedServiceId: plan.appliedServiceId,
        appliedType: plan.appliedType,
        approvedByUserId: input.actorUserId,
        customerId: input.customerId,
        pointsSpent: plan.pointsSpent,
        redeemedAt: new Date(),
        rewardId: plan.rewardId,
        saleId: input.saleId,
        salonId: input.salonId,
        status: "redeemed",
      })
      .returning();
    const redemption = redemptionRows[0]!;
    await tx.insert(loyaltyPoints).values({
      createdByUserId: input.actorUserId,
      customerId: input.customerId,
      delta: -plan.pointsSpent,
      reason: `Riscatto premio in cassa: ${plan.rewardName}`,
      redemptionId: redemption.id,
      salonId: input.salonId,
    });
  }
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
