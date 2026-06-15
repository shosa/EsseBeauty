import type { FastifyInstance } from "fastify";
import { and, asc, eq } from "drizzle-orm";

import { services } from "@esse-beauty/db/schema";
import { PERMISSION_KEYS } from "@esse-beauty/shared";
import { authenticate, requirePermission } from "../../middleware/auth.js";

interface ServiceBody {
  name: string;
  category: string;
  description?: string;
  duration_minutes: number;
  price_cents: number;
  display_order?: number;
  active?: boolean;
}

export async function registerServiceRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string }; Querystring: { active?: string } }>("/api/salons/:id/services", { preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_SERVICES)] }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    return request.server.db
      .select()
      .from(services)
      .where(and(eq(services.salonId, request.salonId),
        ...(request.query.active === "true" ? [eq(services.active, true)] : [])))
      .orderBy(asc(services.category), asc(services.displayOrder), asc(services.name));
  });

  app.post<{ Params: { id: string }; Body: ServiceBody }>(
    "/api/salons/:id/services",
    { preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_SERVICES)] },
    async (request, reply) => {
      if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
      const rows = await request.server.db.insert(services).values({
        salonId: request.salonId,
        name: request.body.name,
        category: request.body.category,
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
      const rows = await request.server.db.update(services).set({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.category !== undefined && { category: body.category }),
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
