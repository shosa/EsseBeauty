import type { FastifyInstance } from "fastify";
import { asc, eq, sql } from "drizzle-orm";

import {
  salons,
  services,
  staff,
  type WorkingHours,
} from "@esse-beauty/db/schema";

import { authenticate, requireRole } from "../../middleware/auth.js";

const colors = ["#792f59", "#b85888", "#5f7661", "#8b6f47", "#536b89", "#9b5c45"];

function nextStep(current: number, completed: number): number {
  return Math.max(current, Math.min(completed + 1, 5));
}

export async function registerOnboardingRoutes(app: FastifyInstance) {
  const ownerOnly = { preHandler: [authenticate, requireRole("owner")] };

  app.get("/api/onboarding", ownerOnly, async (request, reply) => {
    const [salonRows, serviceRows, staffRows] = await Promise.all([
      app.db.select().from(salons).where(eq(salons.id, request.salonId)),
      app.db.select().from(services).where(eq(services.salonId, request.salonId)).orderBy(asc(services.displayOrder)),
      app.db.select().from(staff).where(eq(staff.salonId, request.salonId)).orderBy(asc(staff.createdAt)),
    ]);
    const salon = salonRows[0];
    if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });
    return {
      completed: Boolean(salon.onboardingCompletedAt),
      salon: {
        address: salon.address ?? "",
        email: salon.email ?? "",
        id: salon.id,
        name: salon.name,
        opening_hours: salon.openingHours,
        phone: salon.phone ?? "",
      },
      services: serviceRows.map((item) => ({
        category: item.category,
        duration_minutes: item.durationMinutes,
        id: item.id,
        name: item.name,
        price_cents: item.priceCents,
      })),
      staff: staffRows.map((item) => ({
        color: item.color,
        display_name: item.displayName,
        id: item.id,
        linked_to_owner: item.userId === request.user.id,
      })),
      step: salon.onboardingStep,
    };
  });

  app.patch<{
    Body: { address?: string; email?: string; name: string; phone?: string };
  }>("/api/onboarding/salon", ownerOnly, async (request, reply) => {
    const name = request.body.name?.trim();
    if (!name) return reply.code(400).send({ error: "NAME_REQUIRED" });
    const rows = await app.db
      .update(salons)
      .set({
        address: request.body.address?.trim() || null,
        email: request.body.email?.trim().toLowerCase() || null,
        name,
        onboardingStep: sql`greatest(${salons.onboardingStep}, 2)`,
        phone: request.body.phone?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(salons.id, request.salonId))
      .returning();
    return rows[0];
  });

  app.patch<{ Body: { opening_hours: WorkingHours } }>(
    "/api/onboarding/hours",
    ownerOnly,
    async (request, reply) => {
      if (!request.body.opening_hours) {
        return reply.code(400).send({ error: "OPENING_HOURS_REQUIRED" });
      }
      const rows = await app.db
        .update(salons)
        .set({
          onboardingStep: sql`greatest(${salons.onboardingStep}, 3)`,
          openingHours: request.body.opening_hours,
          updatedAt: new Date(),
        })
        .where(eq(salons.id, request.salonId))
        .returning();
      return rows[0];
    },
  );

  app.patch<{
    Body: {
      services: Array<{
        category: string;
        duration_minutes: number;
        name: string;
        price_cents: number;
      }>;
    };
  }>("/api/onboarding/services", ownerOnly, async (request, reply) => {
    const rows = request.body.services ?? [];
    if (
      rows.length === 0 ||
      rows.some((item) => !item.name?.trim() || !item.category?.trim() || item.duration_minutes < 5 || item.price_cents < 0)
    ) {
      return reply.code(400).send({ error: "INVALID_SERVICES" });
    }
    await app.db.transaction(async (tx) => {
      await tx.delete(services).where(eq(services.salonId, request.salonId));
      await tx.insert(services).values(
        rows.map((item, index) => ({
          category: item.category.trim(),
          displayOrder: index,
          durationMinutes: item.duration_minutes,
          name: item.name.trim(),
          priceCents: item.price_cents,
          salonId: request.salonId,
        })),
      );
      const salonRows = await tx.select({ step: salons.onboardingStep }).from(salons).where(eq(salons.id, request.salonId));
      await tx.update(salons).set({
        onboardingStep: nextStep(salonRows[0]?.step ?? 1, 3),
        updatedAt: new Date(),
      }).where(eq(salons.id, request.salonId));
    });
    return { saved: rows.length };
  });

  app.patch<{
    Body: {
      link_owner?: boolean;
      staff: Array<{ color?: string; display_name: string }>;
      working_hours: WorkingHours;
    };
  }>("/api/onboarding/staff", ownerOnly, async (request, reply) => {
    const rows = request.body.staff ?? [];
    if (rows.length === 0 || rows.some((item) => !item.display_name?.trim())) {
      return reply.code(400).send({ error: "INVALID_STAFF" });
    }
    await app.db.transaction(async (tx) => {
      await tx.delete(staff).where(eq(staff.salonId, request.salonId));
      await tx.insert(staff).values(
        rows.map((item, index) => ({
          color: item.color || colors[index % colors.length] || "#792f59",
          displayName: item.display_name.trim(),
          salonId: request.salonId,
          userId: request.body.link_owner && index === 0 ? request.user.id : null,
          workingHours: request.body.working_hours,
        })),
      );
      const salonRows = await tx.select({ step: salons.onboardingStep }).from(salons).where(eq(salons.id, request.salonId));
      await tx.update(salons).set({
        onboardingStep: nextStep(salonRows[0]?.step ?? 1, 4),
        updatedAt: new Date(),
      }).where(eq(salons.id, request.salonId));
    });
    return { saved: rows.length };
  });

  app.post("/api/onboarding/complete", ownerOnly, async (request, reply) => {
    const [serviceCount, staffCount] = await Promise.all([
      app.db.select({ count: sql<number>`count(*)` }).from(services).where(eq(services.salonId, request.salonId)),
      app.db.select({ count: sql<number>`count(*)` }).from(staff).where(eq(staff.salonId, request.salonId)),
    ]);
    if (Number(serviceCount[0]?.count ?? 0) === 0 || Number(staffCount[0]?.count ?? 0) === 0) {
      return reply.code(409).send({ error: "ONBOARDING_INCOMPLETE" });
    }
    await app.db.update(salons).set({
      onboardingCompletedAt: new Date(),
      onboardingStep: 5,
      updatedAt: new Date(),
    }).where(eq(salons.id, request.salonId));
    return { completed: true };
  });
}
