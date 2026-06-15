import type { FastifyInstance } from "fastify";
import { and, asc, eq, gt, ilike, lt, ne, or } from "drizzle-orm";

import { appointments, availabilityBlocks, customers, salons, services, staff } from "@esse-beauty/db/schema";
import { computeAvailableSlots } from "@esse-beauty/shared";

async function getSalon(app: FastifyInstance, slug: string) {
  const rows = await app.db.select().from(salons).where(and(eq(salons.slug, slug), eq(salons.active, true)));
  return rows[0];
}

async function slotsFor(app: FastifyInstance, salon: any, member: any, service: any, date: string) {
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 36 * 60 * 60_000);
  const [busy, blocks] = await Promise.all([
    app.db.select({ startsAt: appointments.startsAt, endsAt: appointments.endsAt }).from(appointments).where(and(
      eq(appointments.staffId, member.id), ne(appointments.status, "cancelled"),
      lt(appointments.startsAt, dayEnd), gt(appointments.endsAt, dayStart))),
    app.db.select({ startsAt: availabilityBlocks.startsAt, endsAt: availabilityBlocks.endsAt }).from(availabilityBlocks).where(and(
      eq(availabilityBlocks.staffId, member.id), lt(availabilityBlocks.startsAt, dayEnd), gt(availabilityBlocks.endsAt, dayStart))),
  ]);
  return computeAvailableSlots({ date, timezone: salon.timezone, workingHours: member.workingHours,
    durationMinutes: service.durationMinutes, appointments: busy, blocks });
}

export async function registerPublicRoutes(app: FastifyInstance) {
  app.get<{ Params: { slug: string } }>("/api/public/:slug", async (request, reply) => {
    const salon = await getSalon(app, request.params.slug);
    if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });
    if (!salon.onlineBookingEnabled) {
      return reply.code(503).send({ error: "BOOKING_UNAVAILABLE" });
    }
    const [serviceRows, staffRows] = await Promise.all([
      app.db.select().from(services).where(and(eq(services.salonId, salon.id), eq(services.active, true)))
        .orderBy(asc(services.category), asc(services.displayOrder)),
      app.db.select().from(staff).where(and(eq(staff.salonId, salon.id), eq(staff.active, true)))
        .orderBy(asc(staff.displayName)),
    ]);
    return { salon, services: serviceRows, staff: staffRows, opening_hours: salon.openingHours };
  });

  app.get<{ Params: { slug: string }; Querystring: { serviceId: string; staffId?: string; date: string } }>(
    "/api/public/:slug/slots", async (request, reply) => {
      const salon = await getSalon(app, request.params.slug);
      if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });
      if (!salon.onlineBookingEnabled) {
        return reply.code(503).send({ error: "BOOKING_UNAVAILABLE" });
      }
      const serviceRows = await app.db.select().from(services).where(and(
        eq(services.id, request.query.serviceId), eq(services.salonId, salon.id), eq(services.active, true)));
      const service = serviceRows[0];
      if (!service) return reply.code(404).send({ error: "SERVICE_NOT_FOUND" });
      const staffRows = await app.db.select().from(staff).where(and(
        eq(staff.salonId, salon.id), eq(staff.active, true),
        ...(request.query.staffId ? [eq(staff.id, request.query.staffId)] : []),
      )).orderBy(asc(staff.displayName));
      if (request.query.staffId && !staffRows[0]) return reply.code(404).send({ error: "STAFF_NOT_FOUND" });
      for (const member of staffRows) {
        const slots = await slotsFor(app, salon, member, service, request.query.date);
        if (request.query.staffId || slots.some((slot) => slot.available)) return { staff_id: member.id, slots };
      }
      return { staff_id: null, slots: [] };
    });

  app.post<{ Params: { slug: string }; Body: { service_id: string; staff_id?: string; starts_at: string; customer: { full_name: string; email?: string; phone?: string }; notes?: string } }>(
    "/api/public/:slug/book", async (request, reply) => {
      const salon = await getSalon(app, request.params.slug);
      if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });
      if (!salon.onlineBookingEnabled) {
        return reply.code(503).send({ error: "BOOKING_UNAVAILABLE" });
      }
      const customerInput = request.body.customer;
      let customerRows = customerInput.email || customerInput.phone
        ? await app.db.select().from(customers).where(and(eq(customers.salonId, salon.id), or(
          ...(customerInput.email ? [ilike(customers.email, customerInput.email)] : []),
          ...(customerInput.phone ? [eq(customers.phone, customerInput.phone)] : []),
        )))
        : [];
      if (customerRows[0]?.blocked) {
        return reply.code(403).send({ error: "CUSTOMER_BLOCKED" });
      }
      const serviceRows = await app.db.select().from(services).where(and(
        eq(services.id, request.body.service_id), eq(services.salonId, salon.id), eq(services.active, true)));
      const service = serviceRows[0];
      if (!service) return reply.code(404).send({ error: "SERVICE_NOT_FOUND" });
      const date = new Intl.DateTimeFormat("en-CA", { timeZone: salon.timezone }).format(new Date(request.body.starts_at));
      const candidates = await app.db.select().from(staff).where(and(
        eq(staff.salonId, salon.id), eq(staff.active, true),
        ...(request.body.staff_id ? [eq(staff.id, request.body.staff_id)] : []),
      )).orderBy(asc(staff.displayName));
      let selected = candidates[0];
      for (const member of candidates) {
        const slots = await slotsFor(app, salon, member, service, date);
        if (slots.some((slot) => slot.starts_at === new Date(request.body.starts_at).toISOString() && slot.available)) {
          selected = member;
          break;
        }
        selected = undefined;
      }
      if (!selected) return reply.code(409).send({ error: "APPOINTMENT_CONFLICT" });
      if (!customerRows[0]) customerRows = await app.db.insert(customers).values({
        salonId: salon.id, fullName: customerInput.full_name, email: customerInput.email, phone: customerInput.phone,
      }).returning();
      const customer = customerRows[0]!;
      const startsAt = new Date(request.body.starts_at);
      const rows = await app.db.insert(appointments).values({
        salonId: salon.id, customerId: customer.id, staffId: selected.id, serviceId: service.id,
        startsAt, endsAt: new Date(startsAt.getTime() + service.durationMinutes * 60_000),
        status: "pending", internalNotes: request.body.notes, source: "online",
      }).returning();
      return reply.code(201).send({ ...rows[0], staff_name: selected.displayName, service_name: service.name, salon_name: salon.name });
    });

  app.get<{ Params: { slug: string }; Querystring: { email: string } }>("/api/public/:slug/appointments", async (request, reply) => {
    const salon = await getSalon(app, request.params.slug);
    if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });
    return app.db.select({
      id: appointments.id, starts_at: appointments.startsAt, ends_at: appointments.endsAt, status: appointments.status,
      service_name: services.name, staff_name: staff.displayName,
    }).from(appointments)
      .innerJoin(customers, eq(customers.id, appointments.customerId))
      .innerJoin(services, eq(services.id, appointments.serviceId))
      .innerJoin(staff, eq(staff.id, appointments.staffId))
      .where(and(eq(appointments.salonId, salon.id), ilike(customers.email, request.query.email),
        gt(appointments.endsAt, new Date()), ne(appointments.status, "cancelled")))
      .orderBy(asc(appointments.startsAt));
  });
}
