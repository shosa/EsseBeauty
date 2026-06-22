import type { FastifyInstance } from "fastify";
import { and, desc, eq, gte, ilike, sql } from "drizzle-orm";

import {
  appointments,
  customers,
  loyaltyEarningRules,
  loyaltyPoints,
  loyaltyRewards,
  loyaltySettings,
  salons,
} from "@esse-beauty/db/schema";
import {
  isModuleEnabled,
  MODULE_KEYS,
  requireModule,
} from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { authenticate, requirePermission } from "../../middleware/auth.js";
import { ensureLoyaltyRules, LOYALTY_RULE_DEFAULTS, type LoyaltyRuleAction } from "../../lib/loyalty-engine.js";

const guard = [
  authenticate,
  requireModule(MODULE_KEYS.LOYALTY),
  requirePermission(PERMISSION_KEYS.LOYALTY_MANAGE),
];

export async function registerLoyaltyRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/loyalty/summary",
    { preHandler: guard },
    async (request) => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const [leaders, totals] = await Promise.all([
        app.db
          .select({
            customer_id: customers.id,
            name: customers.fullName,
            total_points: sql<number>`coalesce(sum(${loyaltyPoints.delta}), 0)`,
          })
          .from(customers)
          .leftJoin(loyaltyPoints, eq(loyaltyPoints.customerId, customers.id))
          .where(eq(customers.salonId, request.salonId))
          .groupBy(customers.id)
          .orderBy(desc(sql`coalesce(sum(${loyaltyPoints.delta}), 0)`))
          .limit(5),
        app.db
          .select({
            total: sql<number>`coalesce(sum(${loyaltyPoints.delta}), 0)`,
          })
          .from(loyaltyPoints)
          .where(
            and(
              eq(loyaltyPoints.salonId, request.salonId),
              gte(loyaltyPoints.createdAt, monthStart),
            ),
          ),
      ]);
      return { leaders, points_issued_this_month: totals[0]?.total ?? 0 };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/loyalty/settings",
    { preHandler: guard },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
      const rows = await app.db
        .insert(loyaltySettings)
        .values({ salonId: request.salonId })
        .onConflictDoNothing()
        .returning();
      const settings = rows[0] ?? (await app.db
        .select()
        .from(loyaltySettings)
        .where(eq(loyaltySettings.salonId, request.salonId)))[0];
      const rules = await ensureLoyaltyRules(app.db, request.salonId, settings?.pointsPerAppointment ?? 10);
      return { ...settings, earningRules: rules };
    },
  );

  app.patch<{
    Params: { id: string };
    Body: {
      points_per_appointment?: number;
      earning_rules?: Array<{ action: LoyaltyRuleAction; active: boolean; points: number }>;
    };
  }>(
    "/api/salons/:id/loyalty/settings",
    { preHandler: guard },
    async (request, reply) => {
      if (
        request.params.id !== request.salonId ||
        (request.body.points_per_appointment !== undefined && request.body.points_per_appointment < 0) ||
        request.body.earning_rules?.some((rule) =>
          !LOYALTY_RULE_DEFAULTS.some((allowed) => allowed.action === rule.action) ||
          !Number.isInteger(rule.points) ||
          rule.points < 0
        )
      ) {
        return reply.code(400).send({ error: "INVALID_SETTINGS" });
      }
      const rows = await app.db
        .insert(loyaltySettings)
        .values({
          salonId: request.salonId,
          pointsPerAppointment: request.body.points_per_appointment ?? 10,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: loyaltySettings.salonId,
          set: {
            ...(request.body.points_per_appointment !== undefined && {
              pointsPerAppointment: request.body.points_per_appointment,
            }),
            updatedAt: new Date(),
          },
        })
        .returning();
      for (const rule of request.body.earning_rules ?? []) {
        await app.db.insert(loyaltyEarningRules).values({
          action: rule.action,
          active: rule.active,
          points: rule.points,
          salonId: request.salonId,
        }).onConflictDoUpdate({
          target: [loyaltyEarningRules.salonId, loyaltyEarningRules.action],
          set: { active: rule.active, points: rule.points, updatedAt: new Date() },
        });
      }
      const rules = await ensureLoyaltyRules(app.db, request.salonId, rows[0]?.pointsPerAppointment ?? 10);
      return { ...rows[0], earningRules: rules };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/loyalty/rewards",
    { preHandler: guard },
    async (request) =>
      app.db
        .select()
        .from(loyaltyRewards)
        .where(eq(loyaltyRewards.salonId, request.salonId)),
  );

  app.post<{
    Params: { id: string };
    Body: { name: string; points_required: number; description?: string };
  }>("/api/salons/:id/loyalty/rewards", { preHandler: guard }, async (request, reply) => {
    const rows = await app.db
      .insert(loyaltyRewards)
      .values({
        salonId: request.salonId,
        name: request.body.name,
        pointsRequired: request.body.points_required,
        description: request.body.description,
      })
      .returning();
    return reply.code(201).send(rows[0]);
  });

  app.patch<{
    Params: { id: string; rewardId: string };
    Body: Partial<{
      name: string;
      points_required: number;
      description: string | null;
      active: boolean;
    }>;
  }>("/api/salons/:id/loyalty/rewards/:rewardId", { preHandler: guard }, async (request, reply) => {
    const rows = await app.db
      .update(loyaltyRewards)
      .set({
        ...(request.body.name !== undefined && { name: request.body.name }),
        ...(request.body.points_required !== undefined && {
          pointsRequired: request.body.points_required,
        }),
        ...(request.body.description !== undefined && {
          description: request.body.description,
        }),
        ...(request.body.active !== undefined && { active: request.body.active }),
      })
      .where(
        and(
          eq(loyaltyRewards.id, request.params.rewardId),
          eq(loyaltyRewards.salonId, request.salonId),
        ),
      )
      .returning();
    return rows[0] ?? reply.code(404).send({ error: "REWARD_NOT_FOUND" });
  });

  app.delete<{ Params: { id: string; rewardId: string } }>(
    "/api/salons/:id/loyalty/rewards/:rewardId",
    { preHandler: guard },
    async (request, reply) => {
      const rows = await app.db
        .delete(loyaltyRewards)
        .where(
          and(
            eq(loyaltyRewards.id, request.params.rewardId),
            eq(loyaltyRewards.salonId, request.salonId),
          ),
        )
        .returning();
      return rows[0] ?? reply.code(404).send({ error: "REWARD_NOT_FOUND" });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/loyalty/customers",
    { preHandler: guard },
    async (request) =>
      app.db
        .select({
          customer_id: customers.id,
          name: customers.fullName,
          total_points: sql<number>`coalesce(sum(${loyaltyPoints.delta}), 0)`,
          appointments_count: sql<number>`count(distinct ${appointments.id})`,
        })
        .from(customers)
        .leftJoin(loyaltyPoints, eq(loyaltyPoints.customerId, customers.id))
        .leftJoin(appointments, eq(appointments.customerId, customers.id))
        .where(eq(customers.salonId, request.salonId))
        .groupBy(customers.id)
        .orderBy(desc(sql`coalesce(sum(${loyaltyPoints.delta}), 0)`)),
  );

  app.get<{ Params: { id: string; customerId: string } }>(
    "/api/salons/:id/loyalty/customers/:customerId",
    { preHandler: guard },
    async (request) =>
      app.db
        .select()
        .from(loyaltyPoints)
        .where(
          and(
            eq(loyaltyPoints.salonId, request.salonId),
            eq(loyaltyPoints.customerId, request.params.customerId),
          ),
        )
        .orderBy(desc(loyaltyPoints.createdAt)),
  );

  app.post<{
    Params: { id: string; customerId: string };
    Body: { delta: number; reason: string };
  }>(
    "/api/salons/:id/loyalty/customers/:customerId/adjust",
    { preHandler: guard },
    async (request, reply) => {
      const rows = await app.db
        .insert(loyaltyPoints)
        .values({
          salonId: request.salonId,
          customerId: request.params.customerId,
          delta: request.body.delta,
          reason: request.body.reason,
        })
        .returning();
      return reply.code(201).send(rows[0]);
    },
  );

  app.get<{
    Params: { slug: string };
    Querystring: { email: string };
  }>("/api/public/:slug/loyalty", async (request, reply) => {
    const salonRows = await app.db
      .select()
      .from(salons)
      .where(eq(salons.slug, request.params.slug));
    const salon = salonRows[0];
    if (
      !salon ||
      !(await isModuleEnabled(salon.id, MODULE_KEYS.LOYALTY, app.db))
    ) {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }
    const customerRows = await app.db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.salonId, salon.id),
          ilike(customers.email, request.query.email),
        ),
      );
    const customer = customerRows[0];
    if (!customer) return reply.code(404).send({ error: "CUSTOMER_NOT_FOUND" });
    const [history, rewards] = await Promise.all([
      app.db
        .select()
        .from(loyaltyPoints)
        .where(eq(loyaltyPoints.customerId, customer.id))
        .orderBy(desc(loyaltyPoints.createdAt)),
      app.db
        .select()
        .from(loyaltyRewards)
        .where(
          and(
            eq(loyaltyRewards.salonId, salon.id),
            eq(loyaltyRewards.active, true),
          ),
        ),
    ]);
    return {
      customer: { name: customer.fullName },
      balance: history.reduce((sum, item) => sum + item.delta, 0),
      history,
      rewards,
    };
  });
}
