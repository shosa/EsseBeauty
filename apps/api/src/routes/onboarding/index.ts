import type { FastifyInstance } from "fastify";
import { asc, eq, sql } from "drizzle-orm";

import {
  salonLocations,
  salonModules,
  salonResources,
  salons,
  serviceCategories,
  serviceResources,
  serviceStaff,
  services,
  staff,
  type WorkingHours,
} from "@esse-beauty/db/schema";

import { authenticate, requireRole } from "../../middleware/auth.js";
import { buildOnboardingSteps } from "./definition.js";
import { ensurePrimaryLocation } from "./persistence.js";
import { evaluateOnboardingReadiness } from "./readiness.js";

const colors = ["#792f59", "#b85888", "#5f7661", "#8b6f47", "#536b89", "#9b5c45"];

function nextStep(current: number, completed: number): number {
  return Math.max(current, Math.min(completed + 1, 5));
}

export async function registerOnboardingRoutes(app: FastifyInstance) {
  const ownerOnly = { preHandler: [authenticate, requireRole("owner")] };

  app.get("/api/onboarding", ownerOnly, async (request, reply) => {
    const salonRows = await app.db.select().from(salons).where(eq(salons.id, request.salonId));
    const salon = salonRows[0];
    if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });
    await ensurePrimaryLocation(app.db, salon);
    const [categoryRows, serviceRows, staffRows, locationRows, resourceRows, moduleRows, staffAssignmentRows, resourceAssignmentRows] = await Promise.all([
      app.db.select().from(serviceCategories).where(eq(serviceCategories.salonId, request.salonId)).orderBy(asc(serviceCategories.displayOrder), asc(serviceCategories.name)),
      app.db.select().from(services).where(eq(services.salonId, request.salonId)).orderBy(asc(services.displayOrder)),
      app.db.select().from(staff).where(eq(staff.salonId, request.salonId)).orderBy(asc(staff.createdAt)),
      app.db.select().from(salonLocations).where(eq(salonLocations.salonId, request.salonId)).orderBy(asc(salonLocations.displayOrder)),
      app.db.select().from(salonResources).where(eq(salonResources.salonId, request.salonId)).orderBy(asc(salonResources.name)),
      app.db.select().from(salonModules).where(eq(salonModules.salonId, request.salonId)),
      app.db.select().from(serviceStaff).where(eq(serviceStaff.salonId, request.salonId)),
      app.db.select().from(serviceResources).where(eq(serviceResources.salonId, request.salonId)),
    ]);
    const enabledModules = new Set(moduleRows.filter((item) => item.enabled).map((item) => item.moduleKey));
    const readiness = evaluateOnboardingReadiness({
      enabledModules,
      identityComplete: Boolean(salon.name.trim()),
      locations: locationRows.map((item) => ({ active: item.active, id: item.id })),
      resources: resourceRows.map((item) => ({ active: item.active, id: item.id, locationId: item.locationId })),
      services: serviceRows.map((item) => ({ active: item.active, id: item.id, onlineBookingEnabled: item.onlineBookingEnabled })),
      staff: staffRows.map((item) => ({ active: item.active, id: item.id, locationId: item.locationId })),
      serviceStaff: staffAssignmentRows,
      serviceResources: resourceAssignmentRows,
    });
    const steps = buildOnboardingSteps(enabledModules, readiness.statuses).map((step) => ({
      ...step,
      issues: readiness.issues.filter((issue) => issue.step_key === step.key),
    }));
    return {
      completed: Boolean(salon.onboardingCompletedAt),
      locations: locationRows.map((item) => ({
        active: item.active, address: item.address, email: item.email, id: item.id, name: item.name,
        phone: item.phone, timezone: item.timezone,
      })),
      modules: [...enabledModules],
      readiness,
      resources: resourceRows.map((item) => ({
        active: item.active, capacity: item.capacity, id: item.id, location_id: item.locationId,
        name: item.name, type: item.type,
      })),
      salon: {
        address: salon.address ?? "",
        email: salon.email ?? "",
        id: salon.id,
        name: salon.name,
        opening_hours: salon.openingHours,
        phone: salon.phone ?? "",
      },
      service_categories: categoryRows.map((item) => ({
        icon: item.icon,
        id: item.id,
        name: item.name,
      })),
      services: serviceRows.map((item) => ({
        category: item.category,
        category_id: item.categoryId,
        active: item.active,
        buffer_after_minutes: item.bufferAfterMinutes,
        buffer_before_minutes: item.bufferBeforeMinutes,
        duration_minutes: item.durationMinutes,
        id: item.id,
        name: item.name,
        online_booking_enabled: item.onlineBookingEnabled,
        price_cents: item.priceCents,
      })),
      service_resources: resourceAssignmentRows.map((item) => ({ resource_id: item.resourceId, service_id: item.serviceId })),
      service_staff: staffAssignmentRows.map((item) => ({ service_id: item.serviceId, staff_id: item.staffId })),
      staff: staffRows.map((item) => ({
        active: item.active,
        color: item.color,
        display_name: item.displayName,
        id: item.id,
        job_title: item.jobTitle,
        linked_to_owner: item.userId === request.user.id,
        location_id: item.locationId,
        working_hours: item.workingHours,
      })),
      step: salon.onboardingStep,
      steps,
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
      categories?: Array<{
        icon?: string;
        id?: string;
        name: string;
      }>;
      services: Array<{
        category: string;
        category_id?: string;
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
    const categoryDrafts: Array<{ icon?: string; id?: string; name: string }> = request.body.categories?.length
      ? request.body.categories
      : Array.from(new Set(rows.map((item) => item.category.trim()))).map((name) => ({ name }));
    const normalizedCategories = categoryDrafts
      .map((item) => ({
        icon: item.icon?.trim() || "sparkles",
        id: item.id,
        name: item.name.trim(),
      }))
      .filter((item, index, list) => item.name && list.findIndex((candidate) => candidate.name === item.name) === index);
    if (normalizedCategories.length === 0) {
      return reply.code(400).send({ error: "INVALID_SERVICES" });
    }
    await app.db.transaction(async (tx) => {
      await tx.delete(services).where(eq(services.salonId, request.salonId));
      await tx.delete(serviceCategories).where(eq(serviceCategories.salonId, request.salonId));
      const insertedCategories = await tx.insert(serviceCategories).values(
        normalizedCategories.map((item, index) => ({
          displayOrder: index,
          icon: item.icon,
          name: item.name,
          salonId: request.salonId,
        })),
      ).returning();
      const categoryByKey = new Map<string, { id: string; name: string }>();
      insertedCategories.forEach((item, index) => {
        const draft = normalizedCategories[index];
        if (draft?.id) categoryByKey.set(draft.id, item);
        categoryByKey.set(item.name, item);
      });

      await tx.insert(services).values(
        rows.map((item, index) => ({
          category: (categoryByKey.get(item.category_id ?? "") ?? categoryByKey.get(item.category.trim()))?.name ?? item.category.trim(),
          categoryId: (categoryByKey.get(item.category_id ?? "") ?? categoryByKey.get(item.category.trim()))?.id,
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
