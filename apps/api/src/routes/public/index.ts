import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, gt, ilike, inArray, lt, ne, or } from "drizzle-orm";

import { appointmentRescheduleRequests, appointments, availabilityBlocks, calendarSettings, customers, pwaBrandingSettings, reviews, salonClosures, salonSpecialOpenings, salons, salonSettings, serviceCategories, services, serviceStaff, staff } from "@esse-beauty/db/schema";
import { computeAvailableSlots, normalizePhoneE164 } from "@esse-beauty/shared";
import { isModuleEnabled, MODULE_KEYS } from "@esse-beauty/feature-flags";
import { ensureCustomerCancellationNotification, ensureOnlineBookingNotifications, ensureRescheduleRequestNotifications } from "../../jobs/staff-request-notifications.js";
import { pushPublicKey } from "@esse-beauty/comms-contracts";
import { availableResourceFor, qualifiedStaffIds } from "../../lib/scheduling-resources.js";
import { applySpecialOpeningHours, findSpecialOpening } from "../../lib/special-openings.js";
import { resolveCustomerId } from "./customer-auth.js";

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
    allowWaitlist: settings.allowWaitlist ?? true,
    bookingDefaultStatus: settings.bookingDefaultStatus === "confirmed" ? "confirmed" as const : "pending" as const,
    cancellationPolicyHours: calendarRows[0]?.cancellationPolicyHours ?? 24,
    maxAdvanceDays: Number(settings.maxAdvanceDays ?? 90),
    minBookingNoticeHours: calendarRows[0]?.minBookingNoticeHours ?? 2,
    pushPublicKey: pushPublicKey(),
    requireEmail: settings.requireEmail ?? true,
    requirePhone: settings.requirePhone ?? false,
  };
}

async function slotsFor(app: FastifyInstance, salon: any, member: any, service: any, date: string) {
  return slotsForServices(app, salon, member, [service], date);
}

async function slotsForServices(app: FastifyInstance, salon: any, member: any, selectedServices: any[], date: string) {
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
  const specialOpening = await findSpecialOpening(app.db, salon.id, date);
  const effectiveWorkingHours = applySpecialOpeningHours(member.workingHours, date, specialOpening, member.id);
  const slots = computeAvailableSlots({ date, timezone: salon.timezone, workingHours: effectiveWorkingHours,
    durationMinutes: selectedServices.reduce((total, service) => total + service.durationMinutes, 0), appointments: busy, blocks });
  return Promise.all(slots.map(async (slot) => {
    if (!slot.available) return slot;
    let segmentStart = new Date(slot.starts_at);
    for (const service of selectedServices) {
      const segmentEnd = new Date(segmentStart.getTime() + service.durationMinutes * 60_000);
      const resource = await availableResourceFor(app.db, salon.id, service.id, segmentStart, segmentEnd, member.locationId);
      if (resource.required && !resource.resource) return { ...slot, available: false };
      segmentStart = segmentEnd;
    }
    return slot;
  }));
}

function requestedServiceIds(input: { serviceId?: string; serviceIds?: string } | { service_id?: string; service_ids?: string[] }) {
  const body = input as { service_id?: string; service_ids?: string[] };
  const query = input as { serviceId?: string; serviceIds?: string };
  const raw = body.service_ids?.length
    ? body.service_ids
    : body.service_id ? [body.service_id] : (query.serviceIds?.split(",").filter(Boolean) ?? [query.serviceId].filter(Boolean));
  return [...new Set(raw)] as string[];
}

function requestedStaffIds(input: { staffId?: string; staffIds?: string } | { staff_id?: string; staff_ids?: Array<string | null> }, serviceCount: number) {
  const body = input as { staff_id?: string; staff_ids?: Array<string | null> };
  const query = input as { staffId?: string; staffIds?: string };
  if (body.staff_ids?.length) return Array.from({ length: serviceCount }, (_, index) => body.staff_ids?.[index] || undefined);
  if (query.staffIds !== undefined) return Array.from({ length: serviceCount }, (_, index) => query.staffIds?.split(",")[index] || undefined);
  const legacy = body.staff_id ?? query.staffId;
  return Array.from({ length: serviceCount }, () => legacy || undefined);
}

async function serviceStaffCandidates(app: FastifyInstance, salonId: string, serviceId: string, preferredStaffId?: string) {
  const qualified = await qualifiedStaffIds(app.db, salonId, serviceId);
  return (await app.db.select().from(staff).where(and(
    eq(staff.salonId, salonId), eq(staff.active, true),
    ...(preferredStaffId ? [eq(staff.id, preferredStaffId)] : []),
  )).orderBy(asc(staff.displayName))).filter((member) => !qualified || qualified.has(member.id));
}

async function findServiceSequence(app: FastifyInstance, salon: any, selectedServices: any[], startsAt: Date, staffPreferences: Array<string | undefined>) {
  const assignments: Array<{ member: any; service: any; startsAt: Date; endsAt: Date }> = [];
  let segmentStart = startsAt;
  for (const [index, service] of selectedServices.entries()) {
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: salon.timezone }).format(segmentStart);
    const candidates = await serviceStaffCandidates(app, salon.id, service.id, staffPreferences[index]);
    const previousStaffId = assignments.at(-1)?.member.id;
    if (!staffPreferences[index] && previousStaffId) {
      candidates.sort((left, right) => Number(right.id === previousStaffId) - Number(left.id === previousStaffId));
    }
    let assigned;
    for (const member of candidates) {
      const slots = await slotsFor(app, salon, member, service, date);
      if (slots.some((slot) => slot.starts_at === segmentStart.toISOString() && slot.available)) {
        assigned = member;
        break;
      }
    }
    if (!assigned) return undefined;
    const endsAt = new Date(segmentStart.getTime() + service.durationMinutes * 60_000);
    assignments.push({ endsAt, member: assigned, service, startsAt: segmentStart });
    segmentStart = endsAt;
  }
  return assignments;
}

async function isSalonClosed(app: FastifyInstance, salonId: string, date: string) {
  if (await findSpecialOpening(app.db, salonId, date)) return false;
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

async function resolveCustomerMatch(app: FastifyInstance, request: Parameters<typeof resolveCustomerId>[1], salonId: string, email?: string) {
  if (email?.trim()) return ilike(customers.email, email.trim());
  const customerId = await resolveCustomerId(app, request, salonId);
  return customerId ? eq(customers.id, customerId) : undefined;
}

function customerNameParts(input: { first_name?: string; full_name?: string; last_name?: string }) {
  const fullNameInput = input.full_name?.trim() ?? "";
  const firstName = input.first_name?.trim() || fullNameInput.split(/\s+/)[0] || "";
  const lastName = input.last_name?.trim() || fullNameInput.split(/\s+/).slice(1).join(" ");
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  return { firstName, fullName, lastName };
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
    const [serviceRows, categoryRows, staffRows, staffServiceRows, brandingRows, pwa, closureRows, specialOpeningRows] = await Promise.all([
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
      app.db.select({ date: salonClosures.date, recurringYearly: salonClosures.recurringYearly }).from(salonClosures).where(eq(salonClosures.salonId, salon.id)),
      app.db.select({ date: salonSpecialOpenings.date }).from(salonSpecialOpenings).where(eq(salonSpecialOpenings.salonId, salon.id)),
    ]);
    const waitlistEnabled = pwa.allowWaitlist && await isModuleEnabled(salon.id, MODULE_KEYS.WAITLIST, app.db);
    return {
      branding: brandingRows[0] ?? null,
      capabilities: { waitlist: waitlistEnabled },
      categories: categoryRows,
      closures: closureRows,
      pwa,
      special_openings: specialOpeningRows.map((row) => row.date),
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

  app.get<{ Params: { slug: string } }>("/api/public/:slug/reviews", async (request, reply) => {
    const salon = await getSalon(app, request.params.slug);
    if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });
    const enabled = await isModuleEnabled(salon.id, MODULE_KEYS.REVIEWS, app.db);
    if (!enabled) return { average_rating: null, items: [], total: 0 };
    const items = await app.db
      .select({
        comment: reviews.comment,
        created_at: reviews.createdAt,
        customer_name: customers.fullName,
        id: reviews.id,
        rating: reviews.rating,
        reply: reviews.reply,
      })
      .from(reviews)
      .innerJoin(customers, eq(customers.id, reviews.customerId))
      .where(and(eq(reviews.salonId, salon.id), eq(reviews.published, true)))
      .orderBy(desc(reviews.createdAt))
      .limit(30);
    const average = items.length
      ? Math.round((items.reduce((sum, item) => sum + item.rating, 0) / items.length) * 10) / 10
      : null;
    return {
      average_rating: average,
      items,
      total: items.length,
    };
  });

  app.get<{ Params: { slug: string }; Querystring: { serviceId?: string; serviceIds?: string; staffId?: string; staffIds?: string; date: string } }>(
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
      if (!pwa.allowStaffPreference && (request.query.staffId || request.query.staffIds?.split(",").some(Boolean))) return reply.code(400).send({ error: "STAFF_PREFERENCE_DISABLED" });
      const serviceIds = requestedServiceIds(request.query);
      if (!serviceIds.length || serviceIds.length > 10) return reply.code(400).send({ error: "INVALID_SERVICES" });
      const unorderedServices = await app.db.select().from(services).where(and(
        inArray(services.id, serviceIds), eq(services.salonId, salon.id), eq(services.active, true)));
      if (unorderedServices.length !== serviceIds.length) return reply.code(404).send({ error: "SERVICE_NOT_FOUND" });
      const selectedServices = serviceIds.map((id) => unorderedServices.find((service) => service.id === id)!);
      const staffPreferences = requestedStaffIds(request.query, selectedServices.length);
      const firstServiceStaff = await serviceStaffCandidates(app, salon.id, selectedServices[0]!.id, staffPreferences[0]);
      if (staffPreferences[0] && !firstServiceStaff[0]) return reply.code(404).send({ error: "STAFF_NOT_FOUND" });
      const closed = await isSalonClosed(app, salon.id, request.query.date);
      const candidateSlots = new Map<string, { available: boolean; ends_at: string; starts_at: string }>();
      for (const member of firstServiceStaff) {
        for (const slot of await slotsFor(app, salon, member, selectedServices[0], request.query.date)) {
          if (!candidateSlots.has(slot.starts_at) || slot.available) candidateSlots.set(slot.starts_at, slot);
        }
      }
      const earliestStart = Date.now() + pwa.minBookingNoticeHours * 3600000;
      const slots = await Promise.all([...candidateSlots.values()].sort((left, right) => left.starts_at.localeCompare(right.starts_at)).map(async (slot) => {
        const assignments = slot.available && new Date(slot.starts_at).getTime() >= earliestStart
          ? await findServiceSequence(app, salon, selectedServices, new Date(slot.starts_at), staffPreferences)
          : undefined;
        return {
          ...slot,
          available: Boolean(assignments),
          ends_at: assignments?.at(-1)?.endsAt.toISOString() ?? slot.ends_at,
          staff_ids: assignments?.map((assignment) => assignment.member.id) ?? [],
        };
      }));
      return { closed, staff_id: null, slots };
    });

  app.post<{ Params: { slug: string }; Body: { service_id?: string; service_ids?: string[]; staff_id?: string; staff_ids?: Array<string | null>; starts_at: string; customer: { first_name?: string; full_name?: string; last_name?: string; email?: string; phone?: string }; notes?: string } }>(
    "/api/public/:slug/book", async (request, reply) => {
      const salon = await getSalon(app, request.params.slug);
      if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });
      if (!salon.onlineBookingEnabled) {
        return reply.code(503).send({ error: "BOOKING_UNAVAILABLE" });
      }
      const pwa = await getPwaOptions(app, salon.id);
      const customerInput = request.body.customer;
      const name = customerNameParts(customerInput);
      const phoneNormalized = normalizePhoneE164(customerInput.phone);
      if (!name.firstName || !name.lastName) return reply.code(400).send({ error: "CUSTOMER_NAME_PARTS_REQUIRED" });
      if (pwa.requireEmail && !customerInput.email?.trim()) return reply.code(400).send({ error: "EMAIL_REQUIRED" });
      if (pwa.requirePhone && !customerInput.phone?.trim()) return reply.code(400).send({ error: "PHONE_REQUIRED" });
      if (!pwa.allowStaffPreference && (request.body.staff_id || request.body.staff_ids?.some(Boolean))) return reply.code(400).send({ error: "STAFF_PREFERENCE_DISABLED" });
      const requestedStart = new Date(request.body.starts_at);
      if (
        requestedStart < new Date(Date.now() + pwa.minBookingNoticeHours * 3600000) ||
        requestedStart > new Date(Date.now() + pwa.maxAdvanceDays * 86400000)
      ) return reply.code(400).send({ error: "BOOKING_DATE_OUT_OF_RANGE" });
      let customerRows = customerInput.email || phoneNormalized
        ? await app.db.select().from(customers).where(and(eq(customers.salonId, salon.id), or(
          ...(customerInput.email ? [ilike(customers.email, customerInput.email)] : []),
          ...(phoneNormalized ? [eq(customers.phoneNormalized, phoneNormalized)] : []),
        )))
        : [];
      if (customerRows[0]?.blocked) {
        return reply.code(403).send({ error: "CUSTOMER_BLOCKED" });
      }
      const serviceIds = requestedServiceIds(request.body);
      if (!serviceIds.length || serviceIds.length > 10) return reply.code(400).send({ error: "INVALID_SERVICES" });
      const unorderedServices = await app.db.select().from(services).where(and(
        inArray(services.id, serviceIds), eq(services.salonId, salon.id), eq(services.active, true)));
      if (unorderedServices.length !== serviceIds.length) return reply.code(404).send({ error: "SERVICE_NOT_FOUND" });
      const selectedServices = serviceIds.map((id) => unorderedServices.find((service) => service.id === id)!);
      const date = new Intl.DateTimeFormat("en-CA", { timeZone: salon.timezone }).format(new Date(request.body.starts_at));
      if (await isSalonClosed(app, salon.id, date)) return reply.code(409).send({ error: "SALON_CLOSED" });
      const staffPreferences = requestedStaffIds(request.body, selectedServices.length);
      const assignments = await findServiceSequence(app, salon, selectedServices, requestedStart, staffPreferences);
      if (!assignments) return reply.code(409).send({ error: "APPOINTMENT_CONFLICT" });
      if (!customerRows[0]) customerRows = await app.db.insert(customers).values({
        salonId: salon.id, firstName: name.firstName, lastName: name.lastName, fullName: name.fullName, email: customerInput.email, phone: customerInput.phone, phoneNormalized,
      }).returning();
      const customer = customerRows[0]!;
      const startsAt = new Date(request.body.starts_at);
      const segments: Array<(typeof assignments)[number] & { resourceId?: string }> = [];
      for (const assignment of assignments) {
        const resource = await availableResourceFor(app.db, salon.id, assignment.service.id, assignment.startsAt, assignment.endsAt, assignment.member.locationId);
        if (resource.required && !resource.resource) return reply.code(409).send({ error: "RESOURCE_CONFLICT" });
        segments.push({ ...assignment, resourceId: resource.resource?.id });
      }
      const created = await app.db.transaction(async (tx) => tx.insert(appointments).values(segments.map((segment) => ({
        salonId: salon.id, customerId: customer.id, staffId: segment.member.id, serviceId: segment.service.id,
        startsAt: segment.startsAt, endsAt: segment.endsAt,
        status: pwa.bookingDefaultStatus, internalNotes: request.body.notes, source: "online" as const,
        locationId: segment.member.locationId, resourceId: segment.resourceId,
      }))).returning());
      await Promise.all(created.map((appointment) => ensureOnlineBookingNotifications(app, salon.id, appointment.id)));
      const firstAppointment = created[0]!;
      return reply.code(201).send({
        ...firstAppointment,
        endsAt: created.at(-1)?.endsAt ?? firstAppointment.endsAt,
        appointment_ids: created.map((appointment) => appointment.id),
        staff_name: assignments.map((assignment) => assignment.member.displayName).filter((name, index, items) => items.indexOf(name) === index).join(" + "),
        service_name: selectedServices.map((service) => service.name).join(" + "),
        salon_name: salon.name,
      });
    });

  app.get<{ Params: { slug: string }; Querystring: { email?: string } }>("/api/public/:slug/appointments", async (request, reply) => {
    const salon = await getSalon(app, request.params.slug);
    if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });
    const customerMatch = await resolveCustomerMatch(app, request, salon.id, request.query.email);
    if (!customerMatch) return reply.code(400).send({ error: "CUSTOMER_IDENTIFICATION_REQUIRED" });
    const items = await app.db.select({
      id: appointments.id, starts_at: appointments.startsAt, ends_at: appointments.endsAt, status: appointments.status,
      service_id: appointments.serviceId, service_name: services.name, staff_id: appointments.staffId, staff_name: staff.displayName,
      duration_minutes: services.durationMinutes, price_cents: services.priceCents,
    }).from(appointments)
      .innerJoin(customers, eq(customers.id, appointments.customerId))
      .innerJoin(services, eq(services.id, appointments.serviceId))
      .innerJoin(staff, eq(staff.id, appointments.staffId))
      .where(and(eq(appointments.salonId, salon.id), customerMatch))
      .orderBy(desc(appointments.startsAt))
      .limit(200);
    if (items.length === 0) return items;
    const pendingRows = await app.db.select({
      appointmentId: appointmentRescheduleRequests.appointmentId,
      requestedStartsAt: appointmentRescheduleRequests.requestedStartsAt,
    }).from(appointmentRescheduleRequests).where(and(
      eq(appointmentRescheduleRequests.salonId, salon.id),
      eq(appointmentRescheduleRequests.status, "pending"),
      inArray(appointmentRescheduleRequests.appointmentId, items.map((item) => item.id)),
    ));
    const pendingByAppointment = new Map(pendingRows.map((row) => [row.appointmentId, row.requestedStartsAt]));
    return items.map((item) => ({ ...item, pending_reschedule_requested_starts_at: pendingByAppointment.get(item.id) ?? null }));
  });

  app.post<{
    Body: { email?: string; reason?: string };
    Params: { appointmentId: string; slug: string };
  }>("/api/public/:slug/appointments/:appointmentId/cancel", async (request, reply) => {
    const salon = await getSalon(app, request.params.slug);
    if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });
    const pwa = await getPwaOptions(app, salon.id);
    if (!pwa.allowCancellation) return reply.code(403).send({ error: "CANCELLATION_DISABLED" });
    const customerMatch = await resolveCustomerMatch(app, request, salon.id, request.body.email);
    if (!customerMatch) return reply.code(400).send({ error: "CUSTOMER_IDENTIFICATION_REQUIRED" });
    const rows = await app.db
      .select({ id: appointments.id, startsAt: appointments.startsAt })
      .from(appointments)
      .innerJoin(customers, eq(customers.id, appointments.customerId))
      .where(and(
        eq(appointments.id, request.params.appointmentId),
        eq(appointments.salonId, salon.id),
        customerMatch,
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
    await ensureCustomerCancellationNotification(app, salon.id, rows[0].id);
    return updated[0];
  });

  app.post<{
    Body: { email?: string; reason?: string; requested_starts_at: string };
    Params: { appointmentId: string; slug: string };
  }>("/api/public/:slug/appointments/:appointmentId/reschedule-requests", async (request, reply) => {
    const salon = await getSalon(app, request.params.slug);
    if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });
    const pwa = await getPwaOptions(app, salon.id);
    if (!pwa.allowReschedule) return reply.code(403).send({ error: "RESCHEDULE_DISABLED" });
    const requestedStartsAt = new Date(request.body.requested_starts_at);
    const customerMatch = await resolveCustomerMatch(app, request, salon.id, request.body.email);
    if (!customerMatch || Number.isNaN(requestedStartsAt.getTime())) {
      return reply.code(400).send({ error: "INVALID_RESCHEDULE_REQUEST" });
    }
    const rows = await app.db
      .select({ id: appointments.id, locationId: appointments.locationId, serviceId: appointments.serviceId, staffId: appointments.staffId })
      .from(appointments)
      .innerJoin(customers, eq(customers.id, appointments.customerId))
      .where(and(
        eq(appointments.id, request.params.appointmentId),
        eq(appointments.salonId, salon.id),
        customerMatch,
        ne(appointments.status, "cancelled"),
        gt(appointments.startsAt, new Date()),
      ));
    const appointment = rows[0];
    if (!appointment) return reply.code(404).send({ error: "APPOINTMENT_NOT_FOUND" });

    if (pwa.bookingDefaultStatus === "confirmed") {
      const serviceRows = await app.db.select().from(services).where(eq(services.id, appointment.serviceId));
      const service = serviceRows[0];
      const staffRows = await app.db.select().from(staff).where(eq(staff.id, appointment.staffId));
      const member = staffRows[0];
      if (!service || !member) return reply.code(404).send({ error: "APPOINTMENT_NOT_FOUND" });
      const date = new Intl.DateTimeFormat("en-CA", { timeZone: salon.timezone }).format(requestedStartsAt);
      const slots = await slotsFor(app, salon, member, service, date);
      const matching = slots.find((slot) => slot.starts_at === requestedStartsAt.toISOString());
      if (!matching?.available) return reply.code(409).send({ error: "APPOINTMENT_CONFLICT" });
      const endsAt = new Date(requestedStartsAt.getTime() + service.durationMinutes * 60_000);
      const resource = await availableResourceFor(app.db, salon.id, service.id, requestedStartsAt, endsAt, member.locationId, appointment.id);
      if (resource.required && !resource.resource) return reply.code(409).send({ error: "RESOURCE_CONFLICT" });
      const { created, updated } = await app.db.transaction(async (tx) => {
        const updatedRows = await tx.update(appointments).set({
          endsAt, resourceId: resource.resource?.id, startsAt: requestedStartsAt, updatedAt: new Date(),
        }).where(eq(appointments.id, appointment.id)).returning();
        const createdRows = await tx.insert(appointmentRescheduleRequests).values({
          appointmentId: appointment.id,
          reason: request.body.reason,
          requestedStartsAt,
          resolvedAt: new Date(),
          salonId: salon.id,
          status: "approved",
        }).returning();
        return { created: createdRows[0]!, updated: updatedRows[0]! };
      });
      await ensureRescheduleRequestNotifications(app, salon.id, created.id, true);
      return reply.code(200).send({ applied: true, appointment: updated });
    }

    const created = await app.db
      .insert(appointmentRescheduleRequests)
      .values({
        appointmentId: appointment.id,
        reason: request.body.reason,
        requestedStartsAt,
        salonId: salon.id,
      })
      .returning();
    await ensureRescheduleRequestNotifications(app, salon.id, created[0]!.id, false);
    return reply.code(201).send({ applied: false, ...created[0]! });
  });
}
