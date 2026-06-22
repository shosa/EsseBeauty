import type { FastifyInstance } from "fastify";
import { and, asc, eq, gt, ilike, lt, ne, or } from "drizzle-orm";

import { appointmentRescheduleRequests, appointments, availabilityBlocks, calendarSettings, customers, pwaBrandingSettings, salonClosures, salons, salonSettings, serviceCategories, services, serviceStaff, staff } from "@esse-beauty/db/schema";
import { computeAvailableSlots } from "@esse-beauty/shared";
import { ensureOnlineBookingNotifications } from "../../jobs/staff-request-notifications.js";
import { availableResourceFor, qualifiedStaffIds } from "../../lib/scheduling-resources.js";

async function getSalon(app: FastifyInstance, slug: string) {
  const rows = await app.db.select().from(salons).where(and(eq(salons.slug, slug), eq(salons.active, true)));
  return rows[0];
}

async function getPwaOptions(app: FastifyInstance, salonId: string) {
  const [categoryRows, calendarRows] = await Promise.all([
    app.db.select().from(salonSettings).where(and(eq(salonSettings.salonId, salonId), eq(salonSettings.category, "pwa"))),
    app.db.select().from(calendarSettings).where(eq(calendarSettings.salonId, salonId)),
  ]);
  const settings = categoryRows[0]?.settings ?? {};
  return {
    allowCancellation: settings.allowCancellation ?? true,
    allowReschedule: settings.allowReschedule ?? true,
    allowStaffPreference: settings.allowStaffPreference ?? true,
    bookingDefaultStatus: settings.bookingDefaultStatus === "confirmed" ? "confirmed" as const : "pending" as const,
    cancellationPolicyHours: calendarRows[0]?.cancellationPolicyHours ?? 24,
    maxAdvanceDays: Number(settings.maxAdvanceDays ?? 90),
    minBookingNoticeHours: calendarRows[0]?.minBookingNoticeHours ?? 2,
    requireEmail: settings.requireEmail ?? true,
    requirePhone: settings.requirePhone ?? false,
  };
}

async function slotsFor(app: FastifyInstance, salon: any, member: any, service: any, date: string) {
  if (await isSalonClosed(app, salon.id, date)) return [];
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 36 * 60 * 60_000);
  const [busy, blocks] = await Promise.all([
    app.db.select({ startsAt: appointments.startsAt, endsAt: appointments.endsAt }).from(appointments).where(and(
      eq(appointments.staffId, member.id), ne(appointments.status, "cancelled"),
      lt(appointments.startsAt, dayEnd), gt(appointments.endsAt, dayStart))),
    app.db.select({ startsAt: availabilityBlocks.startsAt, endsAt: availabilityBlocks.endsAt }).from(availabilityBlocks).where(and(
      eq(availabilityBlocks.staffId, member.id), lt(availabilityBlocks.startsAt, dayEnd), gt(availabilityBlocks.endsAt, dayStart))),
  ]);
  const slots = computeAvailableSlots({ date, timezone: salon.timezone, workingHours: member.workingHours,
    durationMinutes: service.durationMinutes, appointments: busy, blocks });
  return Promise.all(slots.map(async (slot) => {
    if (!slot.available) return slot;
    const resource = await availableResourceFor(
      app.db,
      salon.id,
      service.id,
      new Date(slot.starts_at),
      new Date(slot.ends_at),
      member.locationId,
    );
    return { ...slot, available: !resource.required || Boolean(resource.resource) };
  }));
}

async function isSalonClosed(app: FastifyInstance, salonId: string, date: string) {
  const closures = await app.db.select({ date: salonClosures.date, recurringYearly: salonClosures.recurringYearly }).from(salonClosures).where(eq(salonClosures.salonId, salonId));
  return closures.some((closure) => closure.date === date || (closure.recurringYearly && closure.date.slice(5) === date.slice(5)));
}

function distanceKm(latitude: number, longitude: number, targetLatitude: number, targetLongitude: number) {
  const radius = 6371;
  const latitudeDelta = (targetLatitude - latitude) * Math.PI / 180;
  const longitudeDelta = (targetLongitude - longitude) * Math.PI / 180;
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude * Math.PI / 180) * Math.cos(targetLatitude * Math.PI / 180)
    * Math.sin(longitudeDelta / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function registerPublicRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { lat?: string; lng?: string; q?: string } }>(
    "/api/public/salons/search",
    async (request) => {
      const query = request.query.q?.trim().toLocaleLowerCase("it-IT") ?? "";
      const latitude = Number(request.query.lat);
      const longitude = Number(request.query.lng);
      const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
      const [salonRows, brandingRows] = await Promise.all([
        app.db.select({
          address: salons.address,
          city: salons.city,
          country: salons.country,
          id: salons.id,
          latitude: salons.latitude,
          longitude: salons.longitude,
          name: salons.name,
          postalCode: salons.postalCode,
          province: salons.province,
          slug: salons.slug,
        }).from(salons).where(and(
          eq(salons.active, true),
          eq(salons.onlineBookingEnabled, true),
        )).orderBy(asc(salons.name)),
        app.db.select({
          logoUrl: pwaBrandingSettings.logoUrl,
          primaryColor: pwaBrandingSettings.primaryColor,
          salonId: pwaBrandingSettings.salonId,
        }).from(pwaBrandingSettings),
      ]);
      const branding = new Map(brandingRows.map((item) => [item.salonId, item]));
      return salonRows
        .map((salon) => ({
          ...salon,
          ...branding.get(salon.id),
          distanceKm: hasCoordinates && salon.latitude !== null && salon.longitude !== null
            ? distanceKm(latitude, longitude, salon.latitude, salon.longitude)
            : null,
        }))
        .filter((salon) => !query || [
          salon.name,
          salon.address,
          salon.city,
          salon.postalCode,
          salon.province,
          salon.country,
        ].some((value) => value?.toLocaleLowerCase("it-IT").includes(query)))
        .sort((left, right) => {
          if (left.distanceKm !== null && right.distanceKm !== null) return left.distanceKm - right.distanceKm;
          if (left.distanceKm !== null) return -1;
          if (right.distanceKm !== null) return 1;
          return left.name.localeCompare(right.name, "it");
        })
        .slice(0, 30);
    },
  );

  app.get<{ Params: { slug: string } }>("/api/public/:slug", async (request, reply) => {
    const salon = await getSalon(app, request.params.slug);
    if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });
    if (!salon.onlineBookingEnabled) {
      return reply.code(503).send({ error: "BOOKING_UNAVAILABLE" });
    }
    const [serviceRows, categoryRows, staffRows, staffServiceRows, brandingRows, pwa] = await Promise.all([
      app.db.select({
        category: services.category,
        categoryIcon: serviceCategories.icon,
        categoryId: services.categoryId,
        durationMinutes: services.durationMinutes,
        id: services.id,
        name: services.name,
        priceCents: services.priceCents,
      }).from(services)
        .leftJoin(serviceCategories, eq(serviceCategories.id, services.categoryId))
        .where(and(eq(services.salonId, salon.id), eq(services.active, true)))
        .orderBy(asc(services.category), asc(services.displayOrder)),
      app.db.select({
        icon: serviceCategories.icon,
        id: serviceCategories.id,
        name: serviceCategories.name,
      }).from(serviceCategories).where(and(
        eq(serviceCategories.salonId, salon.id),
        eq(serviceCategories.active, true),
      )).orderBy(asc(serviceCategories.displayOrder), asc(serviceCategories.name)),
      app.db.select().from(staff).where(and(eq(staff.salonId, salon.id), eq(staff.active, true)))
        .orderBy(asc(staff.displayName)),
      app.db.select({
        serviceId: serviceStaff.serviceId,
        staffId: serviceStaff.staffId,
      }).from(serviceStaff).where(eq(serviceStaff.salonId, salon.id)),
      app.db.select().from(pwaBrandingSettings).where(eq(pwaBrandingSettings.salonId, salon.id)),
      getPwaOptions(app, salon.id),
    ]);
    return {
      branding: brandingRows[0] ?? null,
      categories: categoryRows,
      pwa,
      salon,
      services: serviceRows,
      staff: pwa.allowStaffPreference
        ? staffRows.map((member) => ({
          ...member,
          serviceIds: serviceRows
            .filter((service) => {
              const assignments = staffServiceRows.filter((row) => row.serviceId === service.id);
              return assignments.length === 0 || assignments.some((row) => row.staffId === member.id);
            })
            .map((service) => service.id),
        }))
        : [],
      opening_hours: salon.openingHours,
    };
  });

  app.get<{ Params: { slug: string }; Querystring: { serviceId: string; staffId?: string; date: string } }>(
    "/api/public/:slug/slots", async (request, reply) => {
      const salon = await getSalon(app, request.params.slug);
      if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });
      if (!salon.onlineBookingEnabled) {
        return reply.code(503).send({ error: "BOOKING_UNAVAILABLE" });
      }
      const pwa = await getPwaOptions(app, salon.id);
      const requestedDate = new Date(`${request.query.date}T12:00:00`);
      const latestDate = new Date(Date.now() + pwa.maxAdvanceDays * 86400000);
      if (requestedDate.getTime() < new Date().setHours(0, 0, 0, 0) || requestedDate > latestDate) {
        return reply.code(400).send({ error: "BOOKING_DATE_OUT_OF_RANGE" });
      }
      if (!pwa.allowStaffPreference && request.query.staffId) return reply.code(400).send({ error: "STAFF_PREFERENCE_DISABLED" });
      const serviceRows = await app.db.select().from(services).where(and(
        eq(services.id, request.query.serviceId), eq(services.salonId, salon.id), eq(services.active, true)));
      const service = serviceRows[0];
      if (!service) return reply.code(404).send({ error: "SERVICE_NOT_FOUND" });
      const qualified = await qualifiedStaffIds(app.db, salon.id, service.id);
      const staffRows = (await app.db.select().from(staff).where(and(
        eq(staff.salonId, salon.id), eq(staff.active, true),
        ...(request.query.staffId ? [eq(staff.id, request.query.staffId)] : []),
      )).orderBy(asc(staff.displayName)))
        .filter((member) => !qualified || qualified.has(member.id));
      if (request.query.staffId && !staffRows[0]) return reply.code(404).send({ error: "STAFF_NOT_FOUND" });
      for (const member of staffRows) {
        const earliestStart = Date.now() + pwa.minBookingNoticeHours * 3600000;
        const slots = (await slotsFor(app, salon, member, service, request.query.date)).map((slot) => ({
          ...slot,
          available: slot.available && new Date(slot.starts_at).getTime() >= earliestStart,
        }));
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
      const pwa = await getPwaOptions(app, salon.id);
      const customerInput = request.body.customer;
      if (pwa.requireEmail && !customerInput.email?.trim()) return reply.code(400).send({ error: "EMAIL_REQUIRED" });
      if (pwa.requirePhone && !customerInput.phone?.trim()) return reply.code(400).send({ error: "PHONE_REQUIRED" });
      if (!pwa.allowStaffPreference && request.body.staff_id) return reply.code(400).send({ error: "STAFF_PREFERENCE_DISABLED" });
      const requestedStart = new Date(request.body.starts_at);
      if (
        requestedStart < new Date(Date.now() + pwa.minBookingNoticeHours * 3600000) ||
        requestedStart > new Date(Date.now() + pwa.maxAdvanceDays * 86400000)
      ) return reply.code(400).send({ error: "BOOKING_DATE_OUT_OF_RANGE" });
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
      if (await isSalonClosed(app, salon.id, date)) return reply.code(409).send({ error: "SALON_CLOSED" });
      const qualified = await qualifiedStaffIds(app.db, salon.id, service.id);
      const candidates = (await app.db.select().from(staff).where(and(
        eq(staff.salonId, salon.id), eq(staff.active, true),
        ...(request.body.staff_id ? [eq(staff.id, request.body.staff_id)] : []),
      )).orderBy(asc(staff.displayName)))
        .filter((member) => !qualified || qualified.has(member.id));
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
      const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
      const resource = await availableResourceFor(
        app.db,
        salon.id,
        service.id,
        startsAt,
        endsAt,
        selected.locationId,
      );
      if (resource.required && !resource.resource) {
        return reply.code(409).send({ error: "RESOURCE_CONFLICT" });
      }
      const rows = await app.db.insert(appointments).values({
        salonId: salon.id, customerId: customer.id, staffId: selected.id, serviceId: service.id,
        startsAt, endsAt,
        status: pwa.bookingDefaultStatus, internalNotes: request.body.notes, source: "online",
        locationId: selected.locationId,
        resourceId: resource.resource?.id,
      }).returning();
      const appointment = rows[0]!;
      await ensureOnlineBookingNotifications(app, salon.id, appointment.id);
      return reply.code(201).send({ ...appointment, staff_name: selected.displayName, service_name: service.name, salon_name: salon.name });
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

  app.post<{
    Body: { email: string; reason?: string };
    Params: { appointmentId: string; slug: string };
  }>("/api/public/:slug/appointments/:appointmentId/cancel", async (request, reply) => {
    const salon = await getSalon(app, request.params.slug);
    if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });
    const pwa = await getPwaOptions(app, salon.id);
    if (!pwa.allowCancellation) return reply.code(403).send({ error: "CANCELLATION_DISABLED" });
    const rows = await app.db
      .select({ id: appointments.id, startsAt: appointments.startsAt })
      .from(appointments)
      .innerJoin(customers, eq(customers.id, appointments.customerId))
      .where(and(
        eq(appointments.id, request.params.appointmentId),
        eq(appointments.salonId, salon.id),
        ilike(customers.email, request.body.email),
        ne(appointments.status, "cancelled"),
        gt(appointments.startsAt, new Date()),
      ));
    if (!rows[0]) return reply.code(404).send({ error: "APPOINTMENT_NOT_FOUND" });
    if (rows[0].startsAt.getTime() - Date.now() < pwa.cancellationPolicyHours * 3600000) {
      return reply.code(409).send({ error: "CANCELLATION_WINDOW_CLOSED" });
    }
    const updated = await app.db
      .update(appointments)
      .set({
        cancellationReason: request.body.reason || "Richiesta cliente",
        cancelledAt: new Date(),
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, rows[0].id))
      .returning();
    return updated[0];
  });

  app.post<{
    Body: { email: string; reason?: string; requested_starts_at: string };
    Params: { appointmentId: string; slug: string };
  }>("/api/public/:slug/appointments/:appointmentId/reschedule-requests", async (request, reply) => {
    const salon = await getSalon(app, request.params.slug);
    if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });
    const pwa = await getPwaOptions(app, salon.id);
    if (!pwa.allowReschedule) return reply.code(403).send({ error: "RESCHEDULE_DISABLED" });
    const requestedStartsAt = new Date(request.body.requested_starts_at);
    if (!request.body.email || Number.isNaN(requestedStartsAt.getTime())) {
      return reply.code(400).send({ error: "INVALID_RESCHEDULE_REQUEST" });
    }
    const rows = await app.db
      .select({ id: appointments.id })
      .from(appointments)
      .innerJoin(customers, eq(customers.id, appointments.customerId))
      .where(and(
        eq(appointments.id, request.params.appointmentId),
        eq(appointments.salonId, salon.id),
        ilike(customers.email, request.body.email),
        ne(appointments.status, "cancelled"),
        gt(appointments.startsAt, new Date()),
      ));
    if (!rows[0]) return reply.code(404).send({ error: "APPOINTMENT_NOT_FOUND" });
    const created = await app.db
      .insert(appointmentRescheduleRequests)
      .values({
        appointmentId: rows[0].id,
        reason: request.body.reason,
        requestedStartsAt,
        salonId: salon.id,
      })
      .returning();
    return reply.code(201).send(created[0]);
  });
}
