import type { FastifyInstance } from "fastify";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";

import {
  appointments,
  customers,
  services,
  staff,
  staffAvailabilityRequests,
} from "@esse-beauty/db/schema";
import { isModuleEnabled, MODULE_KEYS } from "@esse-beauty/feature-flags";
import {
  hasPermission,
  PERMISSION_KEYS,
  resolvePermissions,
} from "@esse-beauty/shared";

import { ensureStaffRequestReviewNotifications } from "../../jobs/staff-request-notifications.js";
import { authenticate } from "../../middleware/auth.js";

async function ownStaff(request: Parameters<FastifyInstance["get"]>[1] extends never ? never : any) {
  const rows = await request.server.db
    .select()
    .from(staff)
    .where(
      and(
        eq(staff.userId, request.user.id),
        eq(staff.salonId, request.salonId),
        eq(staff.active, true),
      ),
    );
  return rows[0];
}

async function requireOwnStaff(request: any, reply: any) {
  const member = await ownStaff(request);
  if (!member) {
    await reply.code(404).send({ error: "STAFF_PROFILE_NOT_FOUND" });
    return null;
  }
  return member;
}

async function ensurePermission(request: any, reply: any, permission: string) {
  if (!(await hasPermission(request.user.id, permission as never, request.server.db))) {
    await reply.code(403).send({ error: "PERMISSION_DENIED", required: permission });
    return false;
  }
  return true;
}

function range(from?: string, to?: string) {
  return [
    ...(from ? [gte(appointments.startsAt, new Date(from))] : []),
    ...(to ? [lte(appointments.startsAt, new Date(to))] : []),
  ];
}

export async function registerStaffAppRoutes(app: FastifyInstance) {
  app.get("/api/staff-app/me", { preHandler: [authenticate] }, async (request, reply) => {
    const member = await requireOwnStaff(request, reply);
    if (!member) return;

    return {
      permissions: await resolvePermissions(request.user.id, request.user.role, app.db),
      salon_id: request.salonId,
      staff: {
        color: member.color,
        display_name: member.displayName,
        id: member.id,
        job_title: member.jobTitle,
      },
      modules: {
        staff_performance: await isModuleEnabled(request.salonId, MODULE_KEYS.STAFF_PERF, app.db),
      },
      user: {
        id: request.user.id,
        role: request.user.role,
      },
    };
  });

  app.get<{
    Querystring: { from?: string; to?: string };
  }>("/api/staff-app/appointments", { preHandler: [authenticate] }, async (request, reply) => {
    const member = await requireOwnStaff(request, reply);
    if (!member) return;
    if (!(await ensurePermission(request, reply, PERMISSION_KEYS.CALENDAR_VIEW_OWN))) return;

    return app.db
      .select({
        color: staff.color,
        customer_name: customers.fullName,
        customer_notes: customers.notes,
        ends_at: appointments.endsAt,
        id: appointments.id,
        notes: appointments.internalNotes,
        service_name: services.name,
        staff_name: staff.displayName,
        starts_at: appointments.startsAt,
        status: appointments.status,
      })
      .from(appointments)
      .innerJoin(customers, eq(customers.id, appointments.customerId))
      .innerJoin(services, eq(services.id, appointments.serviceId))
      .innerJoin(staff, eq(staff.id, appointments.staffId))
      .where(
        and(
          eq(appointments.salonId, request.salonId),
          eq(appointments.staffId, member.id),
          ...range(request.query.from, request.query.to),
        ),
      )
      .orderBy(asc(appointments.startsAt));
  });

  app.patch<{
    Body: { status: "confirmed" | "completed" | "no_show" };
    Params: { appointmentId: string };
  }>(
    "/api/staff-app/appointments/:appointmentId/status",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const member = await requireOwnStaff(request, reply);
      if (!member) return;
      if (!(await ensurePermission(request, reply, PERMISSION_KEYS.CALENDAR_MANAGE_OWN))) return;

      const rows = await app.db
        .update(appointments)
        .set({
          checkedInAt: request.body.status === "confirmed" ? new Date() : undefined,
          status: request.body.status,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(appointments.id, request.params.appointmentId),
            eq(appointments.salonId, request.salonId),
            eq(appointments.staffId, member.id),
          ),
        )
        .returning();

      return rows[0] ?? reply.code(404).send({ error: "APPOINTMENT_NOT_FOUND" });
    },
  );

  app.get("/api/staff-app/availability-requests", { preHandler: [authenticate] }, async (request, reply) => {
    const member = await requireOwnStaff(request, reply);
    if (!member) return;
    if (!(await ensurePermission(request, reply, PERMISSION_KEYS.CALENDAR_VIEW_OWN))) return;

    return app.db
      .select({
        ends_at: staffAvailabilityRequests.endsAt,
        id: staffAvailabilityRequests.id,
        reason: staffAvailabilityRequests.reason,
        review_note: staffAvailabilityRequests.reviewNote,
        starts_at: staffAvailabilityRequests.startsAt,
        status: staffAvailabilityRequests.status,
      })
      .from(staffAvailabilityRequests)
      .where(
        and(
          eq(staffAvailabilityRequests.salonId, request.salonId),
          eq(staffAvailabilityRequests.staffId, member.id),
        ),
      )
      .orderBy(asc(staffAvailabilityRequests.startsAt));
  });

  app.post<{
    Body: { ends_at: string; reason?: string; starts_at: string };
  }>("/api/staff-app/availability-requests", { preHandler: [authenticate] }, async (request, reply) => {
    const member = await requireOwnStaff(request, reply);
    if (!member) return;
    if (!(await ensurePermission(request, reply, PERMISSION_KEYS.CALENDAR_MANAGE_OWN))) return;

    const rows = await app.db
      .insert(staffAvailabilityRequests)
      .values({
        endsAt: new Date(request.body.ends_at),
        reason: request.body.reason,
        salonId: request.salonId,
        staffId: member.id,
        startsAt: new Date(request.body.starts_at),
      })
      .returning();
    const requestRow = rows[0]!;
    await ensureStaffRequestReviewNotifications(app, request.salonId, requestRow.id);
    return reply.code(201).send(requestRow);
  });

  app.get<{
    Querystring: { from?: string; to?: string };
  }>("/api/staff-app/reports", { preHandler: [authenticate] }, async (request, reply) => {
    const member = await requireOwnStaff(request, reply);
    if (!member) return;
    if (!(await ensurePermission(request, reply, PERMISSION_KEYS.REPORTS_VIEW_OWN))) return;
    if (!(await isModuleEnabled(request.salonId, MODULE_KEYS.STAFF_PERF, app.db))) {
      return reply.code(403).send({ error: "MODULE_DISABLED", module: MODULE_KEYS.STAFF_PERF });
    }

    const rows = await app.db
      .select({
        appointment_count: sql<number>`count(*)::int`,
        completed_count: sql<number>`count(*) filter (where ${appointments.status} = 'completed')::int`,
        no_show_count: sql<number>`count(*) filter (where ${appointments.status} = 'no_show')::int`,
        unique_customers: sql<number>`count(distinct ${appointments.customerId})::int`,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.salonId, request.salonId),
          eq(appointments.staffId, member.id),
          ...range(request.query.from, request.query.to),
        ),
      );

    return rows[0] ?? {
      appointment_count: 0,
      completed_count: 0,
      no_show_count: 0,
      unique_customers: 0,
    };
  });
}
