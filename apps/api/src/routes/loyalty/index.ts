import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import { and, asc, desc, eq, gte, ilike, sql } from "drizzle-orm";

import {
  customers,
  loyaltyEarningRules,
  loyaltyPoints,
  loyaltyRewardRedemptions,
  loyaltyRewards,
  loyaltySettings,
  loyaltyTiers,
  salons,
  users,
} from "@esse-beauty/db/schema";
import { isModuleEnabled, MODULE_KEYS, requireModule } from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { ensureLoyaltyRules, LOYALTY_RULE_DEFAULTS, type LoyaltyRuleAction } from "../../lib/loyalty-engine.js";
import { resolveCustomerId } from "../public/customer-auth.js";
import {
  activeLoyaltyBalanceSql,
  adjustLoyaltyBalance,
  LoyaltyOperationError,
  redeemLoyaltyReward,
  resolveLoyaltyTier,
} from "../../lib/loyalty-service.js";
import { authenticate, requirePermission } from "../../middleware/auth.js";

const enforceTenant: preHandlerHookHandler = async (request, reply) => {
  if ((request.params as { id?: string }).id !== request.salonId) {
    await reply.code(403).send({ error: "FORBIDDEN" });
  }
};

const guard = [
  authenticate,
  enforceTenant,
  requireModule(MODULE_KEYS.LOYALTY),
  requirePermission(PERMISSION_KEYS.LOYALTY_MANAGE),
];

function integer(value: unknown, minimum?: number): value is number {
  return Number.isInteger(value) && (minimum === undefined || Number(value) >= minimum);
}

function tierBody(value: unknown): value is { tiers: Array<{ benefits?: string; id?: string; min_points: number; name: string }> } {
  if (!value || typeof value !== "object" || !Array.isArray((value as { tiers?: unknown }).tiers)) return false;
  const tiers = (value as { tiers: Array<Record<string, unknown>> }).tiers;
  if (!tiers.every((tier) => typeof tier.name === "string" && tier.name.trim().length > 0 && integer(tier.min_points, 0) && (tier.benefits === undefined || typeof tier.benefits === "string"))) return false;
  return new Set(tiers.map((tier) => Number(tier.min_points))).size === tiers.length;
}

function rewardBody(value: unknown, partial = false): value is { active?: boolean; description?: string | null; name?: string; points_required?: number } {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  if (!partial && (typeof body.name !== "string" || !integer(body.points_required, 1))) return false;
  return (
    (body.name === undefined || (typeof body.name === "string" && body.name.trim().length > 0)) &&
    (body.points_required === undefined || integer(body.points_required, 1)) &&
    (body.description === undefined || body.description === null || typeof body.description === "string") &&
    (body.active === undefined || typeof body.active === "boolean")
  );
}

function operationError(reply: any, error: unknown) {
  if (error instanceof LoyaltyOperationError) {
    return reply.code(error.statusCode).send({ error: error.code });
  }
  throw error;
}

async function orderedTiers(app: FastifyInstance, salonId: string) {
  return app.db.select().from(loyaltyTiers).where(and(eq(loyaltyTiers.salonId, salonId), eq(loyaltyTiers.active, true))).orderBy(asc(loyaltyTiers.minPoints));
}

async function customerBalances(app: FastifyInstance, salonId: string, search = "") {
  const rows = await app.db
    .select({
      balance: activeLoyaltyBalanceSql,
      customer_id: customers.id,
      email: customers.email,
      movement_count: sql<number>`count(${loyaltyPoints.id})::int`,
      name: customers.fullName,
      phone: customers.phone,
    })
    .from(customers)
    .leftJoin(loyaltyPoints, and(eq(loyaltyPoints.customerId, customers.id), eq(loyaltyPoints.salonId, salonId)))
    .where(and(
      eq(customers.salonId, salonId),
      search.trim() ? sql`(${customers.fullName} ilike ${`%${search.trim()}%`} or ${customers.email} ilike ${`%${search.trim()}%`} or ${customers.phone} ilike ${`%${search.trim()}%`})` : undefined,
    ))
    .groupBy(customers.id)
    .orderBy(desc(activeLoyaltyBalanceSql), asc(customers.fullName));
  return rows.map((row) => ({ ...row, balance: Number(row.balance) }));
}

export async function registerLoyaltyRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string }; Querystring: { period_days?: string } }>(
    "/api/salons/:id/loyalty/summary",
    { preHandler: guard },
    async (request) => {
      const periodDays = Math.min(365, Math.max(1, Number(request.query.period_days) || 30));
      const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60_000);
      const [balances, periodTotals, tiers, recentMovements, recentRedemptions] = await Promise.all([
        customerBalances(app, request.salonId),
        app.db.select({
          earned: sql<number>`coalesce(sum(case when ${loyaltyPoints.delta} > 0 then ${loyaltyPoints.delta} else 0 end), 0)::int`,
          redeemed: sql<number>`coalesce(sum(case when ${loyaltyPoints.redemptionId} is not null then -${loyaltyPoints.delta} else 0 end), 0)::int`,
        }).from(loyaltyPoints).where(and(eq(loyaltyPoints.salonId, request.salonId), gte(loyaltyPoints.createdAt, periodStart))),
        orderedTiers(app, request.salonId),
        app.db.select({
          actor_name: users.fullName,
          created_at: loyaltyPoints.createdAt,
          customer_id: customers.id,
          customer_name: customers.fullName,
          delta: loyaltyPoints.delta,
          id: loyaltyPoints.id,
          reason: loyaltyPoints.reason,
        }).from(loyaltyPoints)
          .innerJoin(customers, and(eq(customers.id, loyaltyPoints.customerId), eq(customers.salonId, request.salonId)))
          .leftJoin(users, eq(users.id, loyaltyPoints.createdByUserId))
          .where(eq(loyaltyPoints.salonId, request.salonId))
          .orderBy(desc(loyaltyPoints.createdAt)).limit(12),
        app.db.select({
          created_at: loyaltyRewardRedemptions.createdAt,
          customer_id: customers.id,
          customer_name: customers.fullName,
          id: loyaltyRewardRedemptions.id,
          points_spent: loyaltyRewardRedemptions.pointsSpent,
          redeemed_at: loyaltyRewardRedemptions.redeemedAt,
          reward_name: loyaltyRewards.name,
          status: loyaltyRewardRedemptions.status,
        }).from(loyaltyRewardRedemptions)
          .innerJoin(customers, and(eq(customers.id, loyaltyRewardRedemptions.customerId), eq(customers.salonId, request.salonId)))
          .innerJoin(loyaltyRewards, and(eq(loyaltyRewards.id, loyaltyRewardRedemptions.rewardId), eq(loyaltyRewards.salonId, request.salonId)))
          .where(eq(loyaltyRewardRedemptions.salonId, request.salonId))
          .orderBy(desc(loyaltyRewardRedemptions.createdAt)).limit(12),
      ]);
      const tierDistribution = tiers.map((tier) => ({ id: tier.id, min_points: tier.minPoints, name: tier.name, members: 0 }));
      for (const customer of balances.filter((item) => item.movement_count > 0)) {
        const resolved = resolveLoyaltyTier(customer.balance, tiers).currentTier;
        if (resolved) tierDistribution.find((tier) => tier.id === resolved.id)!.members += 1;
      }
      return {
        leaders: balances.slice(0, 5).map((row) => ({ customer_id: row.customer_id, name: row.name, total_points: row.balance })),
        metrics: {
          earned_period: Number(periodTotals[0]?.earned ?? 0),
          members: balances.filter((row) => row.movement_count > 0).length,
          outstanding_balance: balances.reduce((sum, row) => sum + row.balance, 0),
          redeemed_period: Number(periodTotals[0]?.redeemed ?? 0),
        },
        period_days: periodDays,
        recent_movements: recentMovements,
        recent_redemptions: recentRedemptions,
        tier_distribution: tierDistribution,
      };
    },
  );

  app.get<{ Params: { id: string } }>("/api/salons/:id/loyalty/settings", { preHandler: guard }, async (request) => {
    const inserted = await app.db.insert(loyaltySettings).values({ salonId: request.salonId }).onConflictDoNothing().returning();
    const settings = inserted[0] ?? (await app.db.select().from(loyaltySettings).where(eq(loyaltySettings.salonId, request.salonId)))[0];
    const rules = await ensureLoyaltyRules(app.db, request.salonId, settings?.pointsPerAppointment ?? 10);
    return { ...settings, earningRules: rules };
  });

  app.patch<{ Params: { id: string }; Body: unknown }>("/api/salons/:id/loyalty/settings", { preHandler: guard }, async (request, reply) => {
    if (!request.body || typeof request.body !== "object") return reply.code(400).send({ error: "INVALID_SETTINGS" });
    const body = request.body as Record<string, unknown>;
    const rules = body.earning_rules as Array<{ action: LoyaltyRuleAction; active: boolean; points: number }> | undefined;
    if ((body.points_per_appointment !== undefined && !integer(body.points_per_appointment, 0)) ||
      (body.points_expire_after_days !== undefined && body.points_expire_after_days !== null && !integer(body.points_expire_after_days, 1)) ||
      (body.allow_negative_balance !== undefined && typeof body.allow_negative_balance !== "boolean") ||
      (rules !== undefined && (!Array.isArray(rules) || rules.some((rule) => !LOYALTY_RULE_DEFAULTS.some((allowed) => allowed.action === rule.action) || typeof rule.active !== "boolean" || !integer(rule.points, 0))))) {
      return reply.code(400).send({ error: "INVALID_SETTINGS" });
    }
    const rows = await app.db.insert(loyaltySettings).values({
      allowNegativeBalance: body.allow_negative_balance as boolean | undefined,
      pointsExpireAfterDays: body.points_expire_after_days as number | null | undefined,
      pointsPerAppointment: (body.points_per_appointment as number | undefined) ?? 10,
      salonId: request.salonId,
      updatedAt: new Date(),
    }).onConflictDoUpdate({ target: loyaltySettings.salonId, set: {
      ...(body.allow_negative_balance !== undefined && { allowNegativeBalance: body.allow_negative_balance as boolean }),
      ...(body.points_expire_after_days !== undefined && { pointsExpireAfterDays: body.points_expire_after_days as number | null }),
      ...(body.points_per_appointment !== undefined && { pointsPerAppointment: body.points_per_appointment as number }),
      updatedAt: new Date(),
    } }).returning();
    for (const rule of rules ?? []) {
      await app.db.insert(loyaltyEarningRules).values({ ...rule, salonId: request.salonId }).onConflictDoUpdate({ target: [loyaltyEarningRules.salonId, loyaltyEarningRules.action], set: { active: rule.active, points: rule.points, updatedAt: new Date() } });
    }
    return { ...rows[0], earningRules: await ensureLoyaltyRules(app.db, request.salonId, rows[0]?.pointsPerAppointment ?? 10) };
  });

  app.get<{ Params: { id: string } }>("/api/salons/:id/loyalty/tiers", { preHandler: guard }, async (request) => orderedTiers(app, request.salonId));

  app.put<{ Params: { id: string }; Body: unknown }>("/api/salons/:id/loyalty/tiers", { preHandler: guard }, async (request, reply) => {
    if (!tierBody(request.body)) return reply.code(400).send({ error: "INVALID_TIERS" });
    const body = request.body;
    try {
      const rows = await app.db.transaction(async (tx) => {
        await tx.delete(loyaltyTiers).where(eq(loyaltyTiers.salonId, request.salonId));
        if (!body.tiers.length) return [];
        return tx.insert(loyaltyTiers).values(body.tiers.sort((left, right) => left.min_points - right.min_points).map((tier, index) => ({
          benefits: { text: tier.benefits?.trim() ?? "" },
          displayOrder: index,
          minPoints: tier.min_points,
          name: tier.name.trim(),
          salonId: request.salonId,
        }))).returning();
      });
      return rows;
    } catch (error: any) {
      if (error?.code === "23505") return reply.code(409).send({ error: "TIER_CONFLICT" });
      throw error;
    }
  });

  app.get<{ Params: { id: string } }>("/api/salons/:id/loyalty/rewards", { preHandler: guard }, async (request) => app.db.select().from(loyaltyRewards).where(eq(loyaltyRewards.salonId, request.salonId)).orderBy(desc(loyaltyRewards.active), asc(loyaltyRewards.pointsRequired)));

  app.post<{ Params: { id: string }; Body: unknown }>("/api/salons/:id/loyalty/rewards", { preHandler: guard }, async (request, reply) => {
    if (!rewardBody(request.body)) return reply.code(400).send({ error: "INVALID_REWARD" });
    const rows = await app.db.insert(loyaltyRewards).values({ description: request.body.description?.trim() || null, name: request.body.name!.trim(), pointsRequired: request.body.points_required!, salonId: request.salonId }).returning();
    return reply.code(201).send(rows[0]);
  });

  app.patch<{ Params: { id: string; rewardId: string }; Body: unknown }>("/api/salons/:id/loyalty/rewards/:rewardId", { preHandler: guard }, async (request, reply) => {
    if (!rewardBody(request.body, true)) return reply.code(400).send({ error: "INVALID_REWARD" });
    const rows = await app.db.update(loyaltyRewards).set({
      ...(request.body.active !== undefined && { active: request.body.active }),
      ...(request.body.description !== undefined && { description: request.body.description?.trim() || null }),
      ...(request.body.name !== undefined && { name: request.body.name.trim() }),
      ...(request.body.points_required !== undefined && { pointsRequired: request.body.points_required }),
    }).where(and(eq(loyaltyRewards.id, request.params.rewardId), eq(loyaltyRewards.salonId, request.salonId))).returning();
    return rows[0] ?? reply.code(404).send({ error: "REWARD_NOT_FOUND" });
  });

  app.delete<{ Params: { id: string; rewardId: string } }>("/api/salons/:id/loyalty/rewards/:rewardId", { preHandler: guard }, async (request, reply) => {
    const rows = await app.db.update(loyaltyRewards).set({ active: false }).where(and(eq(loyaltyRewards.id, request.params.rewardId), eq(loyaltyRewards.salonId, request.salonId))).returning();
    return rows[0] ?? reply.code(404).send({ error: "REWARD_NOT_FOUND" });
  });

  app.get<{ Params: { id: string }; Querystring: { q?: string } }>("/api/salons/:id/loyalty/customers", { preHandler: guard }, async (request) => {
    const [rows, tiers] = await Promise.all([customerBalances(app, request.salonId, request.query.q), orderedTiers(app, request.salonId)]);
    return rows.map((row) => { const resolved = resolveLoyaltyTier(row.balance, tiers); return { ...row, current_tier: resolved.currentTier, next_tier: resolved.nextTier }; });
  });

  app.get<{ Params: { id: string; customerId: string } }>("/api/salons/:id/loyalty/customers/:customerId", { preHandler: guard }, async (request, reply) => {
    const rows = await customerBalances(app, request.salonId);
    const customer = rows.find((item) => item.customer_id === request.params.customerId);
    if (!customer) return reply.code(404).send({ error: "CUSTOMER_NOT_FOUND" });
    const [history, redemptions, rewards, tiers] = await Promise.all([
      app.db.select().from(loyaltyPoints).where(and(eq(loyaltyPoints.salonId, request.salonId), eq(loyaltyPoints.customerId, request.params.customerId))).orderBy(desc(loyaltyPoints.createdAt)).limit(100),
      app.db.select({ created_at: loyaltyRewardRedemptions.createdAt, id: loyaltyRewardRedemptions.id, notes: loyaltyRewardRedemptions.notes, points_spent: loyaltyRewardRedemptions.pointsSpent, redeemed_at: loyaltyRewardRedemptions.redeemedAt, reward_name: loyaltyRewards.name, status: loyaltyRewardRedemptions.status }).from(loyaltyRewardRedemptions).innerJoin(loyaltyRewards, and(eq(loyaltyRewards.id, loyaltyRewardRedemptions.rewardId), eq(loyaltyRewards.salonId, request.salonId))).where(and(eq(loyaltyRewardRedemptions.salonId, request.salonId), eq(loyaltyRewardRedemptions.customerId, request.params.customerId))).orderBy(desc(loyaltyRewardRedemptions.createdAt)),
      app.db.select().from(loyaltyRewards).where(and(eq(loyaltyRewards.salonId, request.salonId), eq(loyaltyRewards.active, true))).orderBy(asc(loyaltyRewards.pointsRequired)),
      orderedTiers(app, request.salonId),
    ]);
    const resolved = resolveLoyaltyTier(customer.balance, tiers);
    return { ...customer, available_rewards: rewards.map((reward) => ({ ...reward, available: customer.balance >= reward.pointsRequired })), current_tier: resolved.currentTier, history, next_tier: resolved.nextTier, redemptions };
  });

  app.post<{ Params: { id: string; customerId: string }; Body: unknown }>("/api/salons/:id/loyalty/customers/:customerId/adjust", { preHandler: guard }, async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || !integer(body.delta) || Number(body.delta) === 0 || typeof body.reason !== "string" || body.reason.trim().length < 3) return reply.code(400).send({ error: "INVALID_ADJUSTMENT" });
    try {
      return reply.code(201).send(await adjustLoyaltyBalance(app.db, { actorUserId: request.user.id, customerId: request.params.customerId, delta: Number(body.delta), reason: body.reason, salonId: request.salonId }));
    } catch (error) { return operationError(reply, error); }
  });

  app.post<{ Params: { id: string; customerId: string }; Body: unknown }>("/api/salons/:id/loyalty/customers/:customerId/redemptions", { preHandler: guard }, async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || typeof body.reward_id !== "string" || typeof body.idempotency_key !== "string" || body.idempotency_key.trim().length < 8 || (body.notes !== undefined && typeof body.notes !== "string")) return reply.code(400).send({ error: "INVALID_REDEMPTION" });
    try {
      const result = await redeemLoyaltyReward(app.db, { actorUserId: request.user.id, customerId: request.params.customerId, idempotencyKey: body.idempotency_key, notes: body.notes as string | undefined, rewardId: body.reward_id, salonId: request.salonId });
      return reply.code(result.idempotent ? 200 : 201).send(result);
    } catch (error) { return operationError(reply, error); }
  });

  app.get<{ Params: { slug: string }; Querystring: { email?: string } }>("/api/public/:slug/loyalty", async (request, reply) => {
    const salon = (await app.db.select().from(salons).where(eq(salons.slug, request.params.slug)))[0];
    if (!salon || !(await isModuleEnabled(salon.id, MODULE_KEYS.LOYALTY, app.db))) return reply.code(404).send({ error: "NOT_FOUND" });
    const customerId = request.query.email?.trim() ? undefined : await resolveCustomerId(app, request, salon.id);
    if (!request.query.email?.trim() && !customerId) return reply.code(400).send({ error: "INVALID_REQUEST" });
    const customer = (await app.db.select().from(customers).where(and(
      eq(customers.salonId, salon.id),
      customerId ? eq(customers.id, customerId) : ilike(customers.email, request.query.email!.trim()),
    )))[0];
    if (!customer) return reply.code(404).send({ error: "CUSTOMER_NOT_FOUND" });
    const [history, rewards, tiers] = await Promise.all([
      app.db.select().from(loyaltyPoints).where(and(eq(loyaltyPoints.salonId, salon.id), eq(loyaltyPoints.customerId, customer.id))).orderBy(desc(loyaltyPoints.createdAt)),
      app.db.select().from(loyaltyRewards).where(and(eq(loyaltyRewards.salonId, salon.id), eq(loyaltyRewards.active, true))).orderBy(asc(loyaltyRewards.pointsRequired)),
      orderedTiers(app, salon.id),
    ]);
    const balance = Math.max(0, history.filter((item) => !item.expiredAt && (!item.expiresAt || item.expiresAt > new Date())).reduce((sum, item) => sum + item.delta, 0));
    const resolved = resolveLoyaltyTier(balance, tiers);
    return { balance, current_tier: resolved.currentTier, customer: { name: customer.fullName }, history, next_tier: resolved.nextTier, rewards: rewards.map((reward) => ({ ...reward, available: balance >= reward.pointsRequired })) };
  });
}
