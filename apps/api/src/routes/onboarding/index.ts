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

  app.patch<{ Body: { locations: Array<{ active?: boolean; address?: string; email?: string; id?: string; name: string; phone?: string; timezone?: string }> } }>(
    "/api/onboarding/locations",
    ownerOnly,
    async (request, reply) => {
      const drafts = request.body.locations ?? [];
      if (!drafts.length || drafts.some((item) => !item.name?.trim())) return reply.code(400).send({ error: "INVALID_LOCATIONS" });
      const modules = await app.db.select().from(salonModules).where(eq(salonModules.salonId, request.salonId));
      if (drafts.length > 1 && !modules.some((item) => item.enabled && item.moduleKey === "multi_location")) {
        return reply.code(409).send({ error: "MULTI_LOCATION_REQUIRED" });
      }
      const existing = await app.db.select().from(salonLocations).where(eq(salonLocations.salonId, request.salonId));
      const existingIds = new Set(existing.map((item) => item.id));
      if (drafts.some((item) => item.id && !existingIds.has(item.id))) return reply.code(400).send({ error: "INVALID_LOCATION" });
      await app.db.transaction(async (tx) => {
        for (const item of drafts) {
          const values = { active: item.active ?? true, address: item.address?.trim() || null, email: item.email?.trim() || null, name: item.name.trim(), phone: item.phone?.trim() || null, timezone: item.timezone?.trim() || null };
          if (item.id) await tx.update(salonLocations).set(values).where(eq(salonLocations.id, item.id));
          else await tx.insert(salonLocations).values({ ...values, salonId: request.salonId });
        }
        const kept = new Set(drafts.flatMap((item) => item.id ? [item.id] : []));
        for (const item of existing) if (!kept.has(item.id)) await tx.update(salonLocations).set({ active: false }).where(eq(salonLocations.id, item.id));
      });
      return { saved: drafts.length };
    },
  );

  app.patch<{ Body: { resources: Array<{ active?: boolean; capacity?: number; id?: string; location_id: string; name: string; type?: string }> } }>(
    "/api/onboarding/resources",
    ownerOnly,
    async (request, reply) => {
      const drafts = request.body.resources ?? [];
      if (drafts.some((item) => !item.name?.trim() || !item.location_id)) return reply.code(400).send({ error: "INVALID_RESOURCES" });
      const [existing, locations] = await Promise.all([
        app.db.select().from(salonResources).where(eq(salonResources.salonId, request.salonId)),
        app.db.select().from(salonLocations).where(eq(salonLocations.salonId, request.salonId)),
      ]);
      const existingIds = new Set(existing.map((item) => item.id));
      const locationIds = new Set(locations.map((item) => item.id));
      if (drafts.some((item) => (item.id && !existingIds.has(item.id)) || !locationIds.has(item.location_id))) return reply.code(400).send({ error: "INVALID_RESOURCE" });
      await app.db.transaction(async (tx) => {
        for (const item of drafts) {
          const values = { active: item.active ?? true, capacity: Math.max(1, item.capacity ?? 1), locationId: item.location_id, name: item.name.trim(), type: item.type ?? "cabin" };
          if (item.id) await tx.update(salonResources).set(values).where(eq(salonResources.id, item.id));
          else await tx.insert(salonResources).values({ ...values, salonId: request.salonId });
        }
        const kept = new Set(drafts.flatMap((item) => item.id ? [item.id] : []));
        for (const item of existing) if (!kept.has(item.id)) await tx.update(salonResources).set({ active: false }).where(eq(salonResources.id, item.id));
      });
      return { saved: drafts.length };
    },
  );

  app.patch<{
    Body: {
      categories?: Array<{
        active?: boolean;
        icon?: string;
        id?: string;
        name: string;
      }>;
      services: Array<{
        active?: boolean;
        buffer_after_minutes?: number;
        buffer_before_minutes?: number;
        category: string;
        category_id?: string;
        duration_minutes: number;
        name: string;
        id?: string;
        online_booking_enabled?: boolean;
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
    const [existingCategories, existingServices] = await Promise.all([
      app.db.select().from(serviceCategories).where(eq(serviceCategories.salonId, request.salonId)),
      app.db.select().from(services).where(eq(services.salonId, request.salonId)),
    ]);
    const categoryIds = new Set(existingCategories.map((item) => item.id));
    const serviceIds = new Set(existingServices.map((item) => item.id));
    if (normalizedCategories.some((item) => item.id && !item.id.startsWith("local-") && !categoryIds.has(item.id)) || rows.some((item) => item.id && !serviceIds.has(item.id))) {
      return reply.code(400).send({ error: "INVALID_SERVICES" });
    }
    await app.db.transaction(async (tx) => {
      const insertedCategories = [] as Array<{ id: string; name: string }>;
      for (const [index, item] of normalizedCategories.entries()) {
        if (item.id && categoryIds.has(item.id)) {
          const updated = await tx.update(serviceCategories).set({ active: true, displayOrder: index, icon: item.icon, name: item.name }).where(eq(serviceCategories.id, item.id)).returning();
          if (updated[0]) insertedCategories.push(updated[0]);
        } else {
          const inserted = await tx.insert(serviceCategories).values({ active: true, displayOrder: index, icon: item.icon, name: item.name, salonId: request.salonId }).returning();
          if (inserted[0]) insertedCategories.push(inserted[0]);
        }
      }
      const categoryByKey = new Map<string, { id: string; name: string }>();
      insertedCategories.forEach((item, index) => {
        const draft = normalizedCategories[index];
        if (draft?.id) categoryByKey.set(draft.id, item);
        categoryByKey.set(item.name, item);
      });

      for (const [index, item] of rows.entries()) {
        const values = {
          active: item.active ?? true,
          bufferAfterMinutes: Math.max(0, item.buffer_after_minutes ?? 0),
          bufferBeforeMinutes: Math.max(0, item.buffer_before_minutes ?? 0),
          category: (categoryByKey.get(item.category_id ?? "") ?? categoryByKey.get(item.category.trim()))?.name ?? item.category.trim(),
          categoryId: (categoryByKey.get(item.category_id ?? "") ?? categoryByKey.get(item.category.trim()))?.id,
          displayOrder: index,
          durationMinutes: item.duration_minutes,
          name: item.name.trim(),
          onlineBookingEnabled: item.online_booking_enabled ?? true,
          priceCents: item.price_cents,
        };
        if (item.id) await tx.update(services).set(values).where(eq(services.id, item.id));
        else await tx.insert(services).values({ ...values, salonId: request.salonId });
      }
      const keptServices = new Set(rows.flatMap((item) => item.id ? [item.id] : []));
      for (const item of existingServices) if (!keptServices.has(item.id)) await tx.update(services).set({ active: false, onlineBookingEnabled: false }).where(eq(services.id, item.id));
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
    const extendedRows = rows as Array<{ active?: boolean; color?: string; display_name: string; id?: string; job_title?: string; location_id?: string | null; working_hours?: WorkingHours }>;
    const [existingStaff, locations] = await Promise.all([
      app.db.select().from(staff).where(eq(staff.salonId, request.salonId)),
      app.db.select().from(salonLocations).where(eq(salonLocations.salonId, request.salonId)),
    ]);
    const staffIds = new Set(existingStaff.map((item) => item.id));
    const locationIds = new Set(locations.map((item) => item.id));
    if (extendedRows.some((item) => (item.id && !staffIds.has(item.id)) || (item.location_id && !locationIds.has(item.location_id)))) return reply.code(400).send({ error: "INVALID_STAFF" });
    await app.db.transaction(async (tx) => {
      for (const [index, item] of extendedRows.entries()) {
        const values = {
          active: item.active ?? true,
          color: item.color || colors[index % colors.length] || "#792f59",
          displayName: item.display_name.trim(),
          jobTitle: item.job_title?.trim() || null,
          locationId: item.location_id || null,
          userId: request.body.link_owner && index === 0 ? request.user.id : null,
          workingHours: item.working_hours ?? request.body.working_hours,
        };
        if (item.id) await tx.update(staff).set(values).where(eq(staff.id, item.id));
        else await tx.insert(staff).values({ ...values, salonId: request.salonId });
      }
      const kept = new Set(extendedRows.flatMap((item) => item.id ? [item.id] : []));
      for (const item of existingStaff) if (!kept.has(item.id)) await tx.update(staff).set({ active: false }).where(eq(staff.id, item.id));
      const salonRows = await tx.select({ step: salons.onboardingStep }).from(salons).where(eq(salons.id, request.salonId));
      await tx.update(salons).set({
        onboardingStep: nextStep(salonRows[0]?.step ?? 1, 4),
        updatedAt: new Date(),
      }).where(eq(salons.id, request.salonId));
    });
    return { saved: rows.length };
  });

  app.put<{ Body: { service_resources?: Array<{ resource_id: string; service_id: string }>; service_staff?: Array<{ service_id: string; staff_id: string }> } }>(
    "/api/onboarding/assignments",
    ownerOnly,
    async (request, reply) => {
      const staffPairs = request.body.service_staff ?? [];
      const resourcePairs = request.body.service_resources ?? [];
      const [serviceRows, staffRows, resourceRows] = await Promise.all([
        app.db.select({ id: services.id }).from(services).where(eq(services.salonId, request.salonId)),
        app.db.select({ id: staff.id }).from(staff).where(eq(staff.salonId, request.salonId)),
        app.db.select({ id: salonResources.id }).from(salonResources).where(eq(salonResources.salonId, request.salonId)),
      ]);
      const serviceIds = new Set(serviceRows.map((item) => item.id));
      const staffIds = new Set(staffRows.map((item) => item.id));
      const resourceIds = new Set(resourceRows.map((item) => item.id));
      if (staffPairs.some((item) => !serviceIds.has(item.service_id) || !staffIds.has(item.staff_id))) return reply.code(400).send({ error: "INVALID_STAFF_ASSIGNMENT" });
      if (resourcePairs.some((item) => !serviceIds.has(item.service_id) || !resourceIds.has(item.resource_id))) return reply.code(400).send({ error: "INVALID_RESOURCE_ASSIGNMENT" });
      await app.db.transaction(async (tx) => {
        await tx.delete(serviceStaff).where(eq(serviceStaff.salonId, request.salonId));
        await tx.delete(serviceResources).where(eq(serviceResources.salonId, request.salonId));
        const uniqueStaff = [...new Map(staffPairs.map((item) => [`${item.service_id}:${item.staff_id}`, item])).values()];
        const uniqueResources = [...new Map(resourcePairs.map((item) => [`${item.service_id}:${item.resource_id}`, item])).values()];
        if (uniqueStaff.length) await tx.insert(serviceStaff).values(uniqueStaff.map((item) => ({ salonId: request.salonId, serviceId: item.service_id, staffId: item.staff_id })));
        if (uniqueResources.length) await tx.insert(serviceResources).values(uniqueResources.map((item) => ({ resourceId: item.resource_id, salonId: request.salonId, serviceId: item.service_id })));
      });
      return { saved: staffPairs.length + resourcePairs.length };
    },
  );

  app.post("/api/onboarding/complete", ownerOnly, async (request, reply) => {
    const [salonRows, locationRows, resourceRows, serviceRows, staffRows, staffAssignmentRows, resourceAssignmentRows, moduleRows] = await Promise.all([
      app.db.select().from(salons).where(eq(salons.id, request.salonId)),
      app.db.select().from(salonLocations).where(eq(salonLocations.salonId, request.salonId)),
      app.db.select().from(salonResources).where(eq(salonResources.salonId, request.salonId)),
      app.db.select().from(services).where(eq(services.salonId, request.salonId)),
      app.db.select().from(staff).where(eq(staff.salonId, request.salonId)),
      app.db.select().from(serviceStaff).where(eq(serviceStaff.salonId, request.salonId)),
      app.db.select().from(serviceResources).where(eq(serviceResources.salonId, request.salonId)),
      app.db.select().from(salonModules).where(eq(salonModules.salonId, request.salonId)),
    ]);
    const readiness = evaluateOnboardingReadiness({
      enabledModules: new Set(moduleRows.filter((item) => item.enabled).map((item) => item.moduleKey)),
      identityComplete: Boolean(salonRows[0]?.name.trim()),
      locations: locationRows.map((item) => ({ active: item.active, id: item.id })),
      resources: resourceRows.map((item) => ({ active: item.active, id: item.id, locationId: item.locationId })),
      services: serviceRows.map((item) => ({ active: item.active, id: item.id, onlineBookingEnabled: item.onlineBookingEnabled })),
      staff: staffRows.map((item) => ({ active: item.active, id: item.id, locationId: item.locationId })),
      serviceStaff: staffAssignmentRows,
      serviceResources: resourceAssignmentRows,
    });
    if (!readiness.ready) return reply.code(409).send({ error: "ONBOARDING_INCOMPLETE", issues: readiness.issues });
    await app.db.update(salons).set({
      onboardingCompletedAt: new Date(),
      onboardingStep: 5,
      updatedAt: new Date(),
    }).where(eq(salons.id, request.salonId));
    return { completed: true };
  });
}
