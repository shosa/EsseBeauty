import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";

import { appointments, authSessions, availabilityBlocks, notifications, services, staff, staffAvailabilityRequests, userCredentials, users } from "@esse-beauty/db/schema";
import { hasPermission, PERMISSION_KEYS, type WorkingHours } from "@esse-beauty/shared";
import { createNotification } from "../../jobs/notifications.js";
import { authenticate, requirePermission } from "../../middleware/auth.js";
import { hashPassword } from "../auth/local-auth.js";

interface StaffBody {
  user_id?: string | null;
  display_name: string;
  bio?: string;
  specializations?: string[];
  working_hours: WorkingHours;
  color: string;
  active?: boolean;
}

interface StaffAccessBody {
  active?: boolean;
  email: string;
  password?: string;
}

export async function registerStaffRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string }; Querystring: { from?: string; to?: string } }>(
    "/api/salons/:id/operations/staff",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
      const viewOthers = await hasPermission(request.user.id, PERMISSION_KEYS.CALENDAR_VIEW_OTHERS, request.server.db);
      const viewOwn = await hasPermission(request.user.id, PERMISSION_KEYS.CALENDAR_VIEW_OWN, request.server.db);
      if (!viewOthers && !viewOwn) return reply.code(403).send({ error: "PERMISSION_DENIED" });
      const ownRows = await request.server.db.select({ id: staff.id }).from(staff)
        .where(and(eq(staff.userId, request.user.id), eq(staff.salonId, request.salonId)));
      const ownStaffId = ownRows[0]?.id;
      if (!viewOthers && !ownStaffId) return reply.code(403).send({ error: "STAFF_PROFILE_NOT_FOUND" });
      const from = request.query.from ? new Date(request.query.from) : new Date(new Date().setHours(0, 0, 0, 0));
      const to = request.query.to ? new Date(request.query.to) : new Date(from.getTime() + 24 * 60 * 60_000);

      return request.server.db
        .select({
          active: staff.active,
          appointment_count: sql<number>`count(${appointments.id})::int`,
          color: staff.color,
          completed_count: sql<number>`count(*) filter (where ${appointments.status} = 'completed')::int`,
          display_name: staff.displayName,
          id: staff.id,
          next_service: sql<string | null>`min(${services.name}) filter (where ${appointments.startsAt} >= now())`,
          working_hours: staff.workingHours,
        })
        .from(staff)
        .leftJoin(
          appointments,
          and(
            eq(appointments.staffId, staff.id),
            gte(appointments.startsAt, from),
            lt(appointments.startsAt, to),
          ),
        )
        .leftJoin(services, eq(services.id, appointments.serviceId))
        .where(and(
          eq(staff.salonId, request.salonId),
          eq(staff.active, true),
          ...(!viewOthers && ownStaffId ? [eq(staff.id, ownStaffId)] : []),
        ))
        .groupBy(staff.id)
        .orderBy(asc(staff.displayName));
    },
  );

  app.post<{ Body: { ends_at: string; reason?: string; starts_at: string }; Params: { id: string; staffId: string } }>(
    "/api/salons/:id/operations/staff/:staffId/absence",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
      const ownRows = await request.server.db.select({ id: staff.id }).from(staff)
        .where(and(eq(staff.userId, request.user.id), eq(staff.salonId, request.salonId)));
      const ownStaffId = ownRows[0]?.id;
      const permission = ownStaffId === request.params.staffId ? PERMISSION_KEYS.CALENDAR_MANAGE_OWN : PERMISSION_KEYS.CALENDAR_MANAGE_OTHERS;
      if (!(await hasPermission(request.user.id, permission, request.server.db))) {
        return reply.code(403).send({ error: "PERMISSION_DENIED", required: permission });
      }
      const rows = await request.server.db.insert(availabilityBlocks).values({
        endsAt: new Date(request.body.ends_at),
        reason: request.body.reason ?? "Assenza last-minute",
        salonId: request.salonId,
        staffId: request.params.staffId,
        startsAt: new Date(request.body.starts_at),
      }).returning();
      return reply.code(201).send(rows[0]);
    },
  );

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

  app.get<{ Params: { id: string }; Querystring: { status?: string } }>("/api/salons/:id/staff-availability-requests", {
    preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_STAFF)],
  }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    return request.server.db.select({
      ends_at: staffAvailabilityRequests.endsAt,
      id: staffAvailabilityRequests.id,
      reason: staffAvailabilityRequests.reason,
      review_note: staffAvailabilityRequests.reviewNote,
      reviewed_at: staffAvailabilityRequests.reviewedAt,
      staff_id: staffAvailabilityRequests.staffId,
      staff_name: staff.displayName,
      starts_at: staffAvailabilityRequests.startsAt,
      status: staffAvailabilityRequests.status,
    }).from(staffAvailabilityRequests)
      .innerJoin(staff, eq(staff.id, staffAvailabilityRequests.staffId))
      .where(and(
        eq(staffAvailabilityRequests.salonId, request.salonId),
        ...(request.query.status ? [eq(staffAvailabilityRequests.status, request.query.status as "pending" | "approved" | "rejected" | "cancelled")] : []),
      ))
      .orderBy(asc(staffAvailabilityRequests.startsAt));
  });

  app.get<{ Params: { id: string } }>("/api/salons/:id/staff-availability-requests-summary", {
    preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_STAFF)],
  }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    const rows = await request.server.db.select({
      pending_count: sql<number>`count(*) filter (where ${staffAvailabilityRequests.status} = 'pending')::int`,
    }).from(staffAvailabilityRequests)
      .where(eq(staffAvailabilityRequests.salonId, request.salonId));
    return { pending_count: rows[0]?.pending_count ?? 0 };
  });

  app.patch<{
    Body: { review_note?: string; status: "approved" | "rejected" };
    Params: { id: string; requestId: string };
  }>("/api/salons/:id/staff-availability-requests/:requestId", {
    preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_STAFF)],
  }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    const rows = await request.server.db.select({
      endsAt: staffAvailabilityRequests.endsAt,
      id: staffAvailabilityRequests.id,
      reason: staffAvailabilityRequests.reason,
      staffId: staffAvailabilityRequests.staffId,
      startsAt: staffAvailabilityRequests.startsAt,
      status: staffAvailabilityRequests.status,
      userId: staff.userId,
    }).from(staffAvailabilityRequests)
      .innerJoin(staff, eq(staff.id, staffAvailabilityRequests.staffId))
      .where(and(
        eq(staffAvailabilityRequests.id, request.params.requestId),
        eq(staffAvailabilityRequests.salonId, request.salonId),
      ));
    const item = rows[0];
    if (!item) return reply.code(404).send({ error: "REQUEST_NOT_FOUND" });
    if (item.status !== "pending") return reply.code(409).send({ error: "REQUEST_ALREADY_REVIEWED" });

    const updated = await request.server.db.update(staffAvailabilityRequests).set({
      reviewNote: request.body.review_note,
      reviewedAt: new Date(),
      reviewedByUserId: request.user.id,
      status: request.body.status,
    }).where(and(
      eq(staffAvailabilityRequests.id, item.id),
      eq(staffAvailabilityRequests.status, "pending"),
    )).returning();
    if (!updated[0]) return reply.code(409).send({ error: "REQUEST_ALREADY_REVIEWED" });

    if (request.body.status === "approved") {
      await request.server.db.insert(availabilityBlocks).values({
        endsAt: item.endsAt,
        reason: item.reason ?? "Richiesta staff approvata",
        salonId: request.salonId,
        staffId: item.staffId,
        startsAt: item.startsAt,
      });
    }
    if (item.userId) {
      await createNotification(request.server, {
        body: request.body.review_note || (request.body.status === "approved" ? "La richiesta è stata approvata." : "La richiesta è stata rifiutata."),
        category: "staff",
        entityId: item.id,
        entityType: "staff_availability_request",
        href: "/",
        priority: "normal",
        salonId: request.salonId,
        title: request.body.status === "approved" ? "Richiesta approvata" : "Richiesta rifiutata",
        type: "staff_availability_review",
        userId: item.userId,
      });
    }
    await request.server.db.update(notifications).set({
      archivedAt: new Date(),
      readAt: new Date(),
    }).where(and(
      eq(notifications.salonId, request.salonId),
      eq(notifications.entityType, "staff_availability_request"),
      eq(notifications.entityId, item.id),
    ));
    return updated[0];
  });

  app.get<{ Params: { id: string; staffId: string }; Querystring: { from?: string; to?: string } }>("/api/salons/:id/staff/:staffId/availability-blocks", {
    preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_STAFF)],
  }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    return request.server.db.select().from(availabilityBlocks)
    .where(and(eq(availabilityBlocks.staffId, request.params.staffId), eq(availabilityBlocks.salonId, request.salonId)))
    .orderBy(asc(availabilityBlocks.startsAt));
  });

  app.get<{ Params: { id: string; staffId: string } }>("/api/salons/:id/staff/:staffId/access", {
    preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_STAFF)],
  }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    const rows = await request.server.db
      .select({
        active: users.active,
        email: users.email,
        user_id: users.id,
      })
      .from(staff)
      .leftJoin(users, eq(users.id, staff.userId))
      .where(and(eq(staff.id, request.params.staffId), eq(staff.salonId, request.salonId)));
    if (!rows[0]) return reply.code(404).send({ error: "STAFF_NOT_FOUND" });
    return rows[0].user_id ? rows[0] : { active: false, email: "", user_id: null };
  });

  app.patch<{ Body: StaffAccessBody; Params: { id: string; staffId: string } }>("/api/salons/:id/staff/:staffId/access", {
    preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_STAFF)],
  }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    const email = request.body.email.trim().toLowerCase();
    if (!email.includes("@")) return reply.code(400).send({ error: "INVALID_EMAIL" });
    if (request.body.password !== undefined && request.body.password.length < 10) {
      return reply.code(400).send({ error: "PASSWORD_TOO_SHORT" });
    }

    const staffRows = await request.server.db.select().from(staff)
      .where(and(eq(staff.id, request.params.staffId), eq(staff.salonId, request.salonId)));
    const member = staffRows[0];
    if (!member) return reply.code(404).send({ error: "STAFF_NOT_FOUND" });

    const existingUserRows = await request.server.db.select().from(users)
      .where(and(eq(users.salonId, request.salonId), eq(users.email, email)));
    const existingUser = existingUserRows[0];
    if (existingUser && existingUser.id !== member.userId) {
      return reply.code(409).send({ error: "EMAIL_ALREADY_USED" });
    }

    const userId = member.userId ?? randomUUID();
    if (member.userId) {
      await request.server.db.update(users).set({
        active: request.body.active ?? true,
        email,
        fullName: member.displayName,
        role: "employee",
      }).where(and(eq(users.id, member.userId), eq(users.salonId, request.salonId)));
    } else {
      if (!request.body.password) return reply.code(400).send({ error: "PASSWORD_REQUIRED" });
      await request.server.db.insert(users).values({
        active: request.body.active ?? true,
        email,
        fullName: member.displayName,
        id: userId,
        role: "employee",
        salonId: request.salonId,
      });
      await request.server.db.update(staff).set({ email, userId }).where(eq(staff.id, member.id));
    }

    if (request.body.password) {
      const password = await hashPassword(request.body.password);
      await request.server.db.insert(userCredentials).values({
        mustChangePassword: false,
        passwordHash: password.hash,
        passwordSalt: password.salt,
        userId,
      }).onConflictDoUpdate({
        target: userCredentials.userId,
        set: {
          mustChangePassword: false,
          passwordHash: password.hash,
          passwordSalt: password.salt,
          updatedAt: new Date(),
        },
      });
      await request.server.db.delete(authSessions).where(eq(authSessions.userId, userId));
    }

    await request.server.db.update(staff).set({ email }).where(eq(staff.id, member.id));
    return { active: request.body.active ?? true, email, user_id: userId };
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
