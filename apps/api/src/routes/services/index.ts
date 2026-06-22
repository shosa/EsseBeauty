import type { FastifyInstance } from "fastify";
import { and, asc, eq } from "drizzle-orm";

import { serviceCategories, services } from "@esse-beauty/db/schema";
import { hasPermission, PERMISSION_KEYS } from "@esse-beauty/shared";
import { authenticate, requirePermission } from "../../middleware/auth.js";

interface ServiceBody {
  name: string;
  category: string;
  category_id?: string;
  description?: string;
  duration_minutes: number;
  price_cents: number;
  display_order?: number;
  active?: boolean;
}

interface CategoryBody {
  active?: boolean;
  display_order?: number;
  icon?: string;
  name?: string;
}

const serviceSelection = {
  active: services.active,
  category: services.category,
  categoryIcon: serviceCategories.icon,
  categoryId: services.categoryId,
  color: services.color,
  description: services.description,
  displayOrder: services.displayOrder,
  durationMinutes: services.durationMinutes,
  id: services.id,
  name: services.name,
  onlineBookingEnabled: services.onlineBookingEnabled,
  priceCents: services.priceCents,
};

async function resolveCategory(
  app: FastifyInstance,
  salonId: string,
  categoryId?: string,
  categoryName?: string,
) {
  if (categoryId) {
    const rows = await app.db.select().from(serviceCategories).where(and(
      eq(serviceCategories.id, categoryId),
      eq(serviceCategories.salonId, salonId),
    ));
    return rows[0];
  }
  const name = categoryName?.trim();
  if (!name) return undefined;
  const existing = await app.db.select().from(serviceCategories).where(and(
    eq(serviceCategories.salonId, salonId),
    eq(serviceCategories.name, name),
  ));
  if (existing[0]) return existing[0];
  const created = await app.db.insert(serviceCategories).values({
    icon: "sparkles",
    name,
    salonId,
  }).returning();
  return created[0];
}

export async function registerServiceRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string }; Querystring: { active?: string } }>(
    "/api/salons/:id/service-categories",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
      const categories = await request.server.db
        .select()
        .from(serviceCategories)
        .where(and(
          eq(serviceCategories.salonId, request.salonId),
          ...(request.query.active === "true" ? [eq(serviceCategories.active, true)] : []),
        ))
        .orderBy(asc(serviceCategories.displayOrder), asc(serviceCategories.name));
      const serviceRows = await request.server.db.select({
        active: services.active,
        categoryId: services.categoryId,
      }).from(services).where(eq(services.salonId, request.salonId));
      return categories.map((category) => ({
        ...category,
        activeServiceCount: serviceRows.filter((service) => service.categoryId === category.id && service.active).length,
        serviceCount: serviceRows.filter((service) => service.categoryId === category.id).length,
      }));
    },
  );

  app.post<{ Params: { id: string }; Body: Required<Pick<CategoryBody, "icon" | "name">> & CategoryBody }>(
    "/api/salons/:id/service-categories",
    { preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_SERVICES)] },
    async (request, reply) => {
      if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
      const name = request.body.name?.trim();
      if (!name || !request.body.icon) return reply.code(400).send({ error: "INVALID_SERVICE_CATEGORY" });
      const rows = await request.server.db.insert(serviceCategories).values({
        active: request.body.active ?? true,
        displayOrder: request.body.display_order ?? 0,
        icon: request.body.icon,
        name,
        salonId: request.salonId,
      }).returning();
      return reply.code(201).send(rows[0]);
    },
  );

  app.patch<{ Params: { categoryId: string; id: string }; Body: CategoryBody }>(
    "/api/salons/:id/service-categories/:categoryId",
    { preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_SERVICES)] },
    async (request, reply) => {
      if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
      const current = await request.server.db.select().from(serviceCategories).where(and(
        eq(serviceCategories.id, request.params.categoryId),
        eq(serviceCategories.salonId, request.salonId),
      ));
      if (!current[0]) return reply.code(404).send({ error: "SERVICE_CATEGORY_NOT_FOUND" });
      const currentCategory = current[0];
      const name = request.body.name?.trim();
      const rows = await request.server.db.transaction(async (tx) => {
        const updated = await tx.update(serviceCategories).set({
          ...(request.body.active !== undefined && { active: request.body.active }),
          ...(request.body.display_order !== undefined && { displayOrder: request.body.display_order }),
          ...(request.body.icon !== undefined && { icon: request.body.icon }),
          ...(name && { name }),
        }).where(eq(serviceCategories.id, request.params.categoryId)).returning();
        if (name && name !== currentCategory.name) {
          await tx.update(services).set({ category: name }).where(and(
            eq(services.salonId, request.salonId),
            eq(services.categoryId, request.params.categoryId),
          ));
        }
        return updated;
      });
      return rows[0];
    },
  );

  app.delete<{ Params: { categoryId: string; id: string } }>(
    "/api/salons/:id/service-categories/:categoryId",
    { preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_SERVICES)] },
    async (request, reply) => {
      if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
      const rows = await request.server.db.update(serviceCategories).set({ active: false })
        .where(and(
          eq(serviceCategories.id, request.params.categoryId),
          eq(serviceCategories.salonId, request.salonId),
        )).returning();
      return rows[0] ?? reply.code(404).send({ error: "SERVICE_CATEGORY_NOT_FOUND" });
    },
  );

  app.get<{ Params: { id: string }; Querystring: { q?: string } }>(
    "/api/salons/:id/operations/services",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
      const canRead =
        await hasPermission(request.user.id, PERMISSION_KEYS.CALENDAR_VIEW_OWN, request.server.db) ||
        await hasPermission(request.user.id, PERMISSION_KEYS.CALENDAR_VIEW_OTHERS, request.server.db) ||
        await hasPermission(request.user.id, PERMISSION_KEYS.CALENDAR_MANAGE_OWN, request.server.db) ||
        await hasPermission(request.user.id, PERMISSION_KEYS.CALENDAR_MANAGE_OTHERS, request.server.db);
      if (!canRead) return reply.code(403).send({ error: "PERMISSION_DENIED" });
      const query = request.query.q?.trim().toLowerCase();
      const rows = await request.server.db
        .select(serviceSelection)
        .from(services)
        .leftJoin(serviceCategories, eq(serviceCategories.id, services.categoryId))
        .where(and(eq(services.salonId, request.salonId), eq(services.active, true)))
        .orderBy(asc(services.category), asc(services.displayOrder), asc(services.name));
      return query
        ? rows.filter((item) => `${item.name} ${item.category}`.toLowerCase().includes(query))
        : rows;
    },
  );

  app.get<{ Params: { id: string }; Querystring: { active?: string } }>("/api/salons/:id/services", { preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_SERVICES)] }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    return request.server.db
      .select(serviceSelection)
      .from(services)
      .leftJoin(serviceCategories, eq(serviceCategories.id, services.categoryId))
      .where(and(eq(services.salonId, request.salonId),
        ...(request.query.active === "true" ? [eq(services.active, true)] : [])))
      .orderBy(asc(services.category), asc(services.displayOrder), asc(services.name));
  });

  app.post<{ Params: { id: string }; Body: ServiceBody }>(
    "/api/salons/:id/services",
    { preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_SERVICES)] },
    async (request, reply) => {
      if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
      const category = await resolveCategory(app, request.salonId, request.body.category_id, request.body.category);
      if (!category) return reply.code(400).send({ error: "SERVICE_CATEGORY_REQUIRED" });
      const rows = await request.server.db.insert(services).values({
        salonId: request.salonId,
        name: request.body.name,
        category: category.name,
        categoryId: category.id,
        description: request.body.description,
        durationMinutes: request.body.duration_minutes,
        priceCents: request.body.price_cents,
        displayOrder: request.body.display_order ?? 0,
        active: request.body.active ?? true,
      }).returning();
      return reply.code(201).send(rows[0]);
    },
  );

  app.patch<{ Params: { id: string }; Body: Partial<ServiceBody> }>(
    "/api/salons/:id/services/:serviceId",
    { preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_SERVICES)] },
    async (request, reply) => {
      const body = request.body;
      const params = request.params as unknown as { id: string; serviceId: string };
      if (params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
      const category = body.category_id || body.category
        ? await resolveCategory(app, request.salonId, body.category_id, body.category)
        : undefined;
      if ((body.category_id || body.category) && !category) {
        return reply.code(400).send({ error: "SERVICE_CATEGORY_REQUIRED" });
      }
      const rows = await request.server.db.update(services).set({
        ...(body.name !== undefined && { name: body.name }),
        ...(category && { category: category.name, categoryId: category.id }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.duration_minutes !== undefined && { durationMinutes: body.duration_minutes }),
        ...(body.price_cents !== undefined && { priceCents: body.price_cents }),
        ...(body.display_order !== undefined && { displayOrder: body.display_order }),
        ...(body.active !== undefined && { active: body.active }),
      }).where(and(eq(services.id, params.serviceId), eq(services.salonId, request.salonId))).returning();
      return rows[0] ?? reply.code(404).send({ error: "SERVICE_NOT_FOUND" });
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/salons/:id/services/:serviceId",
    { preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_SERVICES)] },
    async (request, reply) => {
      const params = request.params as unknown as { id: string; serviceId: string };
      if (params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
      const rows = await request.server.db.update(services).set({ active: false })
        .where(and(eq(services.id, params.serviceId), eq(services.salonId, request.salonId))).returning();
      return rows[0] ?? reply.code(404).send({ error: "SERVICE_NOT_FOUND" });
    },
  );

  app.patch<{ Params: { id: string }; Body: { order: Array<{ id: string; display_order: number }> } }>(
    "/api/salons/:id/services/reorder",
    { preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_SERVICES)] },
    async (request, reply) => {
      if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
      await Promise.all(request.body.order.map((item) =>
        request.server.db.update(services).set({ displayOrder: item.display_order })
          .where(and(eq(services.id, item.id), eq(services.salonId, request.salonId))),
      ));
      return { ok: true };
    },
  );
}
