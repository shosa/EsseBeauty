import type { FastifyInstance } from "fastify";
import { and, asc, eq } from "drizzle-orm";

import { availabilityBlocks, staff } from "@esse-beauty/db/schema";
import { PERMISSION_KEYS, type WorkingHours } from "@esse-beauty/shared";
import { authenticate, requirePermission } from "../../middleware/auth.js";

interface StaffBody {
  user_id?: string | null;
  display_name: string;
  bio?: string;
  specializations?: string[];
  working_hours: WorkingHours;
  color: string;
  active?: boolean;
}

export async function registerStaffRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string }; Querystring: { active?: string } }>("/api/salons/:id/staff", { preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_STAFF)] }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    return request.server.db.select().from(staff)
      .where(and(eq(staff.salonId, request.salonId), ...(request.query.active === "true" ? [eq(staff.active, true)] : [])))
      .orderBy(asc(staff.displayName));
  });

  app.post<{ Params: { id: string }; Body: StaffBody }>("/api/salons/:id/staff", {
    preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_STAFF)],
  }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    const body = request.body;
    const rows = await request.server.db.insert(staff).values({
      salonId: request.salonId,
      userId: body.user_id,
      displayName: body.display_name,
      bio: body.bio,
      specializations: body.specializations ?? [],
      workingHours: body.working_hours,
      color: body.color,
      active: body.active ?? true,
    }).returning();
    return reply.code(201).send(rows[0]);
  });

  app.patch<{ Params: { id: string; staffId: string }; Body: Partial<StaffBody> }>("/api/salons/:id/staff/:staffId", {
    preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_STAFF)],
  }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    const body = request.body;
    const rows = await request.server.db.update(staff).set({
      ...(body.user_id !== undefined && { userId: body.user_id }),
      ...(body.display_name !== undefined && { displayName: body.display_name }),
      ...(body.bio !== undefined && { bio: body.bio }),
      ...(body.specializations !== undefined && { specializations: body.specializations }),
      ...(body.working_hours !== undefined && { workingHours: body.working_hours }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.active !== undefined && { active: body.active }),
    }).where(and(eq(staff.id, request.params.staffId), eq(staff.salonId, request.salonId))).returning();
    return rows[0] ?? reply.code(404).send({ error: "STAFF_NOT_FOUND" });
  });

  app.delete<{ Params: { id: string; staffId: string } }>("/api/salons/:id/staff/:staffId", {
    preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_STAFF)],
  }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    const rows = await request.server.db.update(staff).set({ active: false })
      .where(and(eq(staff.id, request.params.staffId), eq(staff.salonId, request.salonId))).returning();
    return rows[0] ?? reply.code(404).send({ error: "STAFF_NOT_FOUND" });
  });

  app.get<{ Params: { id: string; staffId: string }; Querystring: { from?: string; to?: string } }>("/api/salons/:id/staff/:staffId/availability-blocks", {
    preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_STAFF)],
  }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    return request.server.db.select().from(availabilityBlocks)
    .where(and(eq(availabilityBlocks.staffId, request.params.staffId), eq(availabilityBlocks.salonId, request.salonId)))
    .orderBy(asc(availabilityBlocks.startsAt));
  });

  app.post<{ Params: { id: string; staffId: string }; Body: { starts_at: string; ends_at: string; reason?: string; recurring?: boolean; recurrence_rule?: string } }>(
    "/api/salons/:id/staff/:staffId/availability-blocks",
    { preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_STAFF)] },
    async (request, reply) => {
      if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
      const rows = await request.server.db.insert(availabilityBlocks).values({
        salonId: request.salonId,
        staffId: request.params.staffId,
        startsAt: new Date(request.body.starts_at),
        endsAt: new Date(request.body.ends_at),
        reason: request.body.reason,
        recurring: request.body.recurring ?? false,
        recurrenceRule: request.body.recurrence_rule,
      }).returning();
      return reply.code(201).send(rows[0]);
    },
  );

  app.delete<{ Params: { id: string; staffId: string; blockId: string } }>("/api/salons/:id/staff/:staffId/availability-blocks/:blockId", {
    preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_STAFF)],
  }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    const rows = await request.server.db.delete(availabilityBlocks).where(and(
      eq(availabilityBlocks.id, request.params.blockId),
      eq(availabilityBlocks.staffId, request.params.staffId),
      eq(availabilityBlocks.salonId, request.salonId),
    )).returning();
    return rows[0] ?? reply.code(404).send({ error: "BLOCK_NOT_FOUND" });
  });
}
