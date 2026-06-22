import type { FastifyInstance } from "fastify";
import { and, asc, eq, gt, lt, ne } from "drizzle-orm";

import { appointments, availabilityBlocks, calendarSettings, customers, salonClosures, sales, salons, services, staff } from "@esse-beauty/db/schema";
import { computeAvailableSlots, hasPermission, PERMISSION_KEYS } from "@esse-beauty/shared";
import { availableResourceFor, isStaffQualified } from "../../lib/scheduling-resources.js";
import { authenticate } from "../../middleware/auth.js";

async function ownStaffId(request: any): Promise<string | undefined> {
  const rows = await request.server.db.select({ id: staff.id }).from(staff).where(and(
    eq(staff.userId, request.user.id), eq(staff.salonId, request.salonId),
  ));
  return rows[0]?.id;
}

async function canManage(request: any, staffId: string): Promise<boolean> {
  const own = await ownStaffId(request);
  return hasPermission(request.user.id,
    own === staffId ? PERMISSION_KEYS.CALENDAR_MANAGE_OWN : PERMISSION_KEYS.CALENDAR_MANAGE_OTHERS,
    request.server.db);
}

function closureMatchesDate(closure: { date: string; recurringYearly: boolean }, date: string) {
  return closure.date === date || (closure.recurringYearly && closure.date.slice(5) === date.slice(5));
}

async function isSalonClosed(db: any, salonId: string, date: string) {
  const rows = await db.select({ date: salonClosures.date, recurringYearly: salonClosures.recurringYearly }).from(salonClosures).where(eq(salonClosures.salonId, salonId));
  return rows.some((closure: { date: string; recurringYearly: boolean }) => closureMatchesDate(closure, date));
}

interface AppointmentConflictRules {
  allowOverbooking: boolean;
  bufferMinutes: number;
  overbookingLimit: number;
}

async function getCalendarRules(db: any, salonId: string): Promise<AppointmentConflictRules> {
  const rows = await db.select({
    allowOverbooking: calendarSettings.allowOverbooking,
    bufferMinutes: calendarSettings.bufferMinutes,
    overbookingLimit: calendarSettings.overbookingLimit,
  }).from(calendarSettings).where(eq(calendarSettings.salonId, salonId));
  return {
    allowOverbooking: rows[0]?.allowOverbooking ?? false,
    bufferMinutes: rows[0]?.bufferMinutes ?? 0,
    overbookingLimit: rows[0]?.overbookingLimit ?? 0,
  };
}

export async function hasAppointmentConflict(db: any, salonId: string, staffId: string, startsAt: Date, endsAt: Date, excludeId?: string, rules?: AppointmentConflictRules) {
  const activeRules = rules ?? await getCalendarRules(db, salonId);
  const bufferMs = Math.max(0, activeRules.bufferMinutes) * 60_000;
  const protectedStart = new Date(startsAt.getTime() - bufferMs);
  const protectedEnd = new Date(endsAt.getTime() + bufferMs);
  const appointmentRows = await db.select({ id: appointments.id }).from(appointments).where(and(
    eq(appointments.salonId, salonId), eq(appointments.staffId, staffId),
    ne(appointments.status, "cancelled"), lt(appointments.startsAt, protectedEnd), gt(appointments.endsAt, protectedStart),
    ...(excludeId ? [ne(appointments.id, excludeId)] : []),
  ));
  const blockRows = await db.select({ id: availabilityBlocks.id }).from(availabilityBlocks).where(and(
    eq(availabilityBlocks.salonId, salonId), eq(availabilityBlocks.staffId, staffId),
    lt(availabilityBlocks.startsAt, protectedEnd), gt(availabilityBlocks.endsAt, protectedStart),
  ));
  if (blockRows.length > 0) return true;
  if (!activeRules.allowOverbooking) return appointmentRows.length > 0;
  return appointmentRows.length > Math.max(0, activeRules.overbookingLimit);
}

export async function registerAppointmentRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string }; Querystring: { from?: string; to?: string; staffId?: string; status?: string } }>("/api/salons/:id/appointments", {
    preHandler: [authenticate],
  }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    const own = await ownStaffId(request);
    const viewOthers = await hasPermission(request.user.id, PERMISSION_KEYS.CALENDAR_VIEW_OTHERS, request.server.db);
    const viewOwn = await hasPermission(request.user.id, PERMISSION_KEYS.CALENDAR_VIEW_OWN, request.server.db);
    if (!viewOthers && (!viewOwn || !own)) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const selectedStaff = request.query.staffId ?? (viewOthers ? undefined : own);
    return request.server.db.select({
      id: appointments.id, starts_at: appointments.startsAt, ends_at: appointments.endsAt,
      status: appointments.status, notes: appointments.internalNotes, staff_id: appointments.staffId,
      location_id: appointments.locationId, resource_id: appointments.resourceId,
      customer_name: customers.fullName, service_name: services.name, staff_name: staff.displayName, color: staff.color,
    }).from(appointments)
      .innerJoin(customers, eq(customers.id, appointments.customerId))
      .innerJoin(services, eq(services.id, appointments.serviceId))
      .innerJoin(staff, eq(staff.id, appointments.staffId))
      .where(and(eq(appointments.salonId, request.salonId),
        ...(selectedStaff ? [eq(appointments.staffId, selectedStaff)] : []),
        ...(request.query.status ? [eq(appointments.status, request.query.status as any)] : []),
        ...(request.query.from ? [gt(appointments.endsAt, new Date(request.query.from))] : []),
        ...(request.query.to ? [lt(appointments.startsAt, new Date(request.query.to))] : [])))
      .orderBy(asc(appointments.startsAt));
  });

  app.get<{ Params: { id: string }; Querystring: { staffId: string; serviceId: string; date: string } }>("/api/salons/:id/slots", {
    preHandler: [authenticate],
  }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    const [staffRows, serviceRows, salonRows] = await Promise.all([
      request.server.db.select().from(staff).where(and(eq(staff.id, request.query.staffId), eq(staff.salonId, request.salonId))),
      request.server.db.select().from(services).where(and(eq(services.id, request.query.serviceId), eq(services.salonId, request.salonId))),
      request.server.db.select().from(salons).where(eq(salons.id, request.salonId)),
    ]);
    const member = staffRows[0], service = serviceRows[0], salon = salonRows[0];
    if (!member || !service || !salon) return reply.code(404).send({ error: "NOT_FOUND" });
    if (!(await isStaffQualified(request.server.db, request.salonId, service.id, member.id))) {
      return reply.code(409).send({ error: "STAFF_NOT_QUALIFIED" });
    }
    if (await isSalonClosed(request.server.db, request.salonId, request.query.date)) {
      return [];
    }
    const dayStart = new Date(`${request.query.date}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart.getTime() + 36 * 60 * 60_000);
    const [busy, blocks] = await Promise.all([
      request.server.db.select({ startsAt: appointments.startsAt, endsAt: appointments.endsAt }).from(appointments).where(and(
        eq(appointments.staffId, member.id), ne(appointments.status, "cancelled"),
        lt(appointments.startsAt, dayEnd), gt(appointments.endsAt, dayStart))),
      request.server.db.select({ startsAt: availabilityBlocks.startsAt, endsAt: availabilityBlocks.endsAt }).from(availabilityBlocks).where(and(
        eq(availabilityBlocks.staffId, member.id), lt(availabilityBlocks.startsAt, dayEnd), gt(availabilityBlocks.endsAt, dayStart))),
    ]);
    const slots = computeAvailableSlots({ date: request.query.date, timezone: salon.timezone, workingHours: member.workingHours,
      durationMinutes: service.durationMinutes, appointments: busy, blocks });
    return Promise.all(slots.map(async (slot) => {
      if (!slot.available) return slot;
      const resource = await availableResourceFor(
        request.server.db,
        request.salonId,
        service.id,
        new Date(slot.starts_at),
        new Date(slot.ends_at),
        member.locationId,
      );
      return { ...slot, available: !resource.required || Boolean(resource.resource) };
    }));
  });

  app.get<{ Params: { id: string }; Querystring: { from?: string; to?: string; staffId?: string; status?: string } }>("/api/salons/:id/calendar-events", {
    preHandler: [authenticate],
  }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    const own = await ownStaffId(request);
    const viewOthers = await hasPermission(request.user.id, PERMISSION_KEYS.CALENDAR_VIEW_OTHERS, request.server.db);
    const viewOwn = await hasPermission(request.user.id, PERMISSION_KEYS.CALENDAR_VIEW_OWN, request.server.db);
    if (!viewOthers && (!viewOwn || !own)) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const selectedStaff = request.query.staffId ?? (viewOthers ? undefined : own);
    const from = request.query.from ? new Date(request.query.from) : new Date(new Date().setHours(0, 0, 0, 0));
    const to = request.query.to ? new Date(request.query.to) : new Date(from.getTime() + 7 * 24 * 60 * 60_000);
    const appointmentRows = await request.server.db.select({
      id: appointments.id, starts_at: appointments.startsAt, ends_at: appointments.endsAt,
      status: appointments.status, notes: appointments.internalNotes, staff_id: appointments.staffId,
      location_id: appointments.locationId, resource_id: appointments.resourceId,
      customer_name: customers.fullName, service_name: services.name, staff_name: staff.displayName, color: staff.color,
    }).from(appointments)
      .innerJoin(customers, eq(customers.id, appointments.customerId))
      .innerJoin(services, eq(services.id, appointments.serviceId))
      .innerJoin(staff, eq(staff.id, appointments.staffId))
      .where(and(eq(appointments.salonId, request.salonId),
        ...(selectedStaff ? [eq(appointments.staffId, selectedStaff)] : []),
        ...(request.query.status ? [eq(appointments.status, request.query.status as any)] : []),
        gt(appointments.endsAt, from),
        lt(appointments.startsAt, to)))
      .orderBy(asc(appointments.startsAt));
    const blockRows = await request.server.db.select({
      color: staff.color,
      ends_at: availabilityBlocks.endsAt,
      id: availabilityBlocks.id,
      reason: availabilityBlocks.reason,
      location_id: staff.locationId,
      staff_id: availabilityBlocks.staffId,
      staff_name: staff.displayName,
      starts_at: availabilityBlocks.startsAt,
    }).from(availabilityBlocks)
      .innerJoin(staff, eq(staff.id, availabilityBlocks.staffId))
      .where(and(eq(availabilityBlocks.salonId, request.salonId),
        ...(selectedStaff ? [eq(availabilityBlocks.staffId, selectedStaff)] : []),
        gt(availabilityBlocks.endsAt, from),
        lt(availabilityBlocks.startsAt, to)))
      .orderBy(asc(availabilityBlocks.startsAt));
    const closureRows = await request.server.db.select().from(salonClosures)
      .where(eq(salonClosures.salonId, request.salonId))
      .orderBy(asc(salonClosures.date));
    const fromDate = from.toISOString().slice(0, 10);
    const toDate = to.toISOString().slice(0, 10);
    const visibleClosures = closureRows.filter((closure) => {
      if (closure.recurringYearly) return true;
      return closure.date >= fromDate && closure.date <= toDate;
    });
    return {
      appointments: appointmentRows,
      availability_blocks: blockRows,
      salon_closures: visibleClosures,
    };
  });

  app.post<{ Params: { id: string }; Body: { customer_id: string; staff_id: string; service_id: string; starts_at: string; notes?: string; source?: "manual" | "walk_in" } }>(
    "/api/salons/:id/appointments", { preHandler: [authenticate] }, async (request, reply) => {
      if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
      if (!(await canManage(request, request.body.staff_id))) return reply.code(403).send({ error: "PERMISSION_DENIED" });
      const serviceRows = await request.server.db.select().from(services).where(and(eq(services.id, request.body.service_id), eq(services.salonId, request.salonId)));
      const service = serviceRows[0];
      if (!service) return reply.code(404).send({ error: "SERVICE_NOT_FOUND" });
      const staffRows = await request.server.db.select().from(staff).where(and(
        eq(staff.id, request.body.staff_id),
        eq(staff.salonId, request.salonId),
        eq(staff.active, true),
      ));
      const member = staffRows[0];
      if (!member) return reply.code(404).send({ error: "STAFF_NOT_FOUND" });
      if (!(await isStaffQualified(request.server.db, request.salonId, service.id, member.id))) {
        return reply.code(409).send({ error: "STAFF_NOT_QUALIFIED" });
      }
      const startsAt = new Date(request.body.starts_at);
      const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
      const rules = await getCalendarRules(request.server.db, request.salonId);
      if (await hasAppointmentConflict(request.server.db, request.salonId, request.body.staff_id, startsAt, endsAt, undefined, rules))
        return reply.code(409).send({ error: "APPOINTMENT_CONFLICT" });
      const resource = await availableResourceFor(
        request.server.db,
        request.salonId,
        service.id,
        startsAt,
        endsAt,
        member.locationId,
      );
      if (resource.required && !resource.resource) {
        return reply.code(409).send({ error: "RESOURCE_CONFLICT" });
      }
      const rows = await request.server.db.insert(appointments).values({
        salonId: request.salonId, customerId: request.body.customer_id, staffId: request.body.staff_id,
        serviceId: request.body.service_id, startsAt, endsAt, status: "confirmed",
        internalNotes: request.body.notes, source: request.body.source ?? "manual",
        locationId: member.locationId,
        resourceId: resource.resource?.id,
      }).returning();
      return reply.code(201).send(rows[0]);
    });

  app.get<{ Params: { id: string; appointmentId: string } }>("/api/salons/:id/appointments/:appointmentId", {
    preHandler: [authenticate],
  }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    const rows = await request.server.db.select({
      id: appointments.id, starts_at: appointments.startsAt, ends_at: appointments.endsAt,
      status: appointments.status, notes: appointments.internalNotes, staff_id: appointments.staffId,
      customer_id: appointments.customerId, customer_name: customers.fullName,
      customer_email: customers.email, customer_phone: customers.phone,
      service_id: appointments.serviceId, service_name: services.name, service_price_cents: services.priceCents,
      staff_name: staff.displayName, color: staff.color,
    }).from(appointments)
      .innerJoin(customers, eq(customers.id, appointments.customerId))
      .innerJoin(services, eq(services.id, appointments.serviceId))
      .innerJoin(staff, eq(staff.id, appointments.staffId))
      .where(and(eq(appointments.id, request.params.appointmentId), eq(appointments.salonId, request.salonId)));
    return rows[0] ?? reply.code(404).send({ error: "APPOINTMENT_NOT_FOUND" });
  });

  app.patch<{ Params: { id: string; appointmentId: string }; Body: { duration_minutes?: number; starts_at?: string; status?: "pending"|"confirmed"|"cancelled"|"no_show"|"completed"; notes?: string } }>(
    "/api/salons/:id/appointments/:appointmentId", { preHandler: [authenticate] }, async (request, reply) => {
      if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
      const rows = await request.server.db.select().from(appointments).where(and(eq(appointments.id, request.params.appointmentId), eq(appointments.salonId, request.salonId)));
      const item = rows[0];
      if (!item) return reply.code(404).send({ error: "APPOINTMENT_NOT_FOUND" });
      if (!(await canManage(request, item.staffId))) return reply.code(403).send({ error: "PERMISSION_DENIED" });
      if (request.body.status && request.body.status !== item.status) {
        const paidSales = await request.server.db.select({ id: sales.id }).from(sales).where(and(
          eq(sales.appointmentId, item.id),
          eq(sales.salonId, request.salonId),
          eq(sales.status, "paid"),
        ));
        if (paidSales.length > 0) return reply.code(409).send({ error: "APPOINTMENT_STATUS_LOCKED_BY_SALE" });
      }
      const startsAt = request.body.starts_at ? new Date(request.body.starts_at) : item.startsAt;
      if (Number.isNaN(startsAt.getTime())) return reply.code(400).send({ error: "INVALID_STARTS_AT" });
      const requestedDuration = request.body.duration_minutes;
      if (requestedDuration !== undefined && (!Number.isInteger(requestedDuration) || requestedDuration < 5 || requestedDuration > 720)) {
        return reply.code(400).send({ error: "INVALID_DURATION" });
      }
      const durationMinutes = requestedDuration ?? Math.round((item.endsAt.getTime() - item.startsAt.getTime()) / 60_000);
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
      const rules = await getCalendarRules(request.server.db, request.salonId);
      if ((request.body.starts_at || requestedDuration !== undefined) && await hasAppointmentConflict(request.server.db, request.salonId, item.staffId, startsAt, endsAt, item.id, rules))
        return reply.code(409).send({ error: "APPOINTMENT_CONFLICT" });
      const resource = await availableResourceFor(
        request.server.db,
        request.salonId,
        item.serviceId,
        startsAt,
        endsAt,
        item.locationId,
        item.id,
      );
      if (resource.required && !resource.resource) {
        return reply.code(409).send({ error: "RESOURCE_CONFLICT" });
      }
      const updated = await request.server.db.update(appointments).set({
        startsAt, endsAt, ...(request.body.status && { status: request.body.status }),
        ...(request.body.notes !== undefined && { internalNotes: request.body.notes }),
        ...(resource.required && { resourceId: resource.resource?.id }),
      }).where(eq(appointments.id, item.id)).returning();
      return updated[0];
    });

  app.delete<{ Params: { id: string; appointmentId: string } }>("/api/salons/:id/appointments/:appointmentId", {
    preHandler: [authenticate],
  }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    if (!(await hasPermission(request.user.id, PERMISSION_KEYS.CALENDAR_DELETE, request.server.db)))
      return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const rows = await request.server.db.delete(appointments).where(and(
      eq(appointments.id, request.params.appointmentId), eq(appointments.salonId, request.salonId),
    )).returning();
    return rows[0] ?? reply.code(404).send({ error: "APPOINTMENT_NOT_FOUND" });
  });
}
