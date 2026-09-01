import type { FastifyInstance } from "fastify";
import { and, asc, eq, gte, inArray, isNull, lt, or } from "drizzle-orm";
import { customers, salons, salonSettings, services, staff, waitlistEntries } from "@esse-beauty/db/schema";
import { isModuleEnabled, MODULE_KEYS, requireModule } from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";
import { normalizePhoneE164 } from "../../lib/phone-normalization.js";
import { authenticate, requirePermission } from "../../middleware/auth.js";

const guard = [authenticate, requireModule(MODULE_KEYS.WAITLIST), requirePermission(PERMISSION_KEYS.WAITLIST_MANAGE)];
const preferences = ["any", "morning", "afternoon", "evening"] as const;
const statuses = ["waiting", "notified", "booked", "expired"] as const;
type TimePreference = (typeof preferences)[number];
type WaitlistStatus = (typeof statuses)[number];

function parseDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function registerWaitlistRoutes(app: FastifyInstance) {
  app.post<{ Params: { slug: string }; Body: { service_id: string; staff_id?: string; requested_date: string; time_preference?: TimePreference; customer: { full_name: string; email?: string; phone?: string } } }>("/api/public/:slug/waitlist", async (request, reply) => {
    const salon = (await app.db.select().from(salons).where(and(eq(salons.slug, request.params.slug), eq(salons.active, true))))[0];
    if (!salon || !salon.onlineBookingEnabled || !(await isModuleEnabled(salon.id, MODULE_KEYS.WAITLIST, app.db))) return reply.code(404).send({ error: "NOT_FOUND" });
    const day = parseDay(request.body.requested_date);
    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    const preference = request.body.time_preference ?? "any";
    if (!day || day < today) return reply.code(400).send({ error: "INVALID_DATE" });
    if (!preferences.includes(preference)) return reply.code(400).send({ error: "INVALID_TIME_PREFERENCE" });
    const service = (await app.db.select().from(services).where(and(eq(services.id, request.body.service_id), eq(services.salonId, salon.id), eq(services.active, true), eq(services.onlineBookingEnabled, true))))[0];
    if (!service) return reply.code(400).send({ error: "INVALID_SERVICE" });
    if (request.body.staff_id) {
      const member = (await app.db.select().from(staff).where(and(eq(staff.id, request.body.staff_id), eq(staff.salonId, salon.id), eq(staff.active, true))))[0];
      if (!member) return reply.code(400).send({ error: "INVALID_STAFF" });
    }
    const name = request.body.customer.full_name?.trim();
    const email = request.body.customer.email?.trim().toLowerCase();
    const phone = request.body.customer.phone?.trim();
    const phoneNormalized = normalizePhoneE164(phone);
    const pwa = (await app.db.select().from(salonSettings).where(and(eq(salonSettings.salonId, salon.id), eq(salonSettings.category, "pwa"))))[0]?.settings ?? {};
    if (!name || (!email && !phone) || (pwa.requireEmail !== false && !email) || (pwa.requirePhone === true && !phone)) return reply.code(400).send({ error: "CONTACT_REQUIRED" });
    const contactMatch = phoneNormalized && email ? or(eq(customers.phoneNormalized, phoneNormalized), eq(customers.email, email)) : phoneNormalized ? eq(customers.phoneNormalized, phoneNormalized) : eq(customers.email, email!);
    let customer = (await app.db.select().from(customers).where(and(eq(customers.salonId, salon.id), contactMatch)))[0];
    if (!customer) customer = (await app.db.insert(customers).values({ salonId: salon.id, fullName: name, email, phone, phoneNormalized }).returning())[0]!;
    else customer = (await app.db.update(customers).set({ fullName: name, email: email ?? customer.email, phone: phone ?? customer.phone, phoneNormalized: phoneNormalized ?? customer.phoneNormalized }).where(eq(customers.id, customer.id)).returning())[0]!;
    const duplicate = (await app.db.select({ id: waitlistEntries.id }).from(waitlistEntries).where(and(eq(waitlistEntries.salonId, salon.id), eq(waitlistEntries.customerId, customer.id), eq(waitlistEntries.serviceId, service.id), eq(waitlistEntries.requestedDate, day), eq(waitlistEntries.timePreference, preference), inArray(waitlistEntries.status, ["waiting", "notified"]), request.body.staff_id ? eq(waitlistEntries.staffId, request.body.staff_id) : isNull(waitlistEntries.staffId))))[0];
    if (duplicate) return reply.code(409).send({ error: "WAITLIST_DUPLICATE" });
    const row = (await app.db.insert(waitlistEntries).values({ salonId: salon.id, serviceId: service.id, staffId: request.body.staff_id, customerId: customer.id, requestedDate: day, timePreference: preference }).returning())[0]!;
    return reply.code(201).send({ id: row.id, requested_date: row.requestedDate, status: row.status, time_preference: row.timePreference });
  });

  app.get<{ Params: { id: string }; Querystring: { status?: string; date?: string; serviceId?: string } }>("/api/salons/:id/waitlist", { preHandler: guard }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    if (request.query.status && !statuses.includes(request.query.status as WaitlistStatus)) return reply.code(400).send({ error: "INVALID_STATUS" });
    const day = request.query.date ? parseDay(request.query.date) : null;
    if (request.query.date && !day) return reply.code(400).send({ error: "INVALID_DATE" });
    const start = day ? new Date(`${request.query.date}T00:00:00.000Z`) : null;
    const end = start ? new Date(start.getTime() + 86400000) : null;
    return app.db.select({ id: waitlistEntries.id, requested_date: waitlistEntries.requestedDate, time_preference: waitlistEntries.timePreference, status: waitlistEntries.status, created_at: waitlistEntries.createdAt, customer_id: customers.id, customer_name: customers.fullName, customer_email: customers.email, customer_phone: customers.phone, service_id: services.id, service_name: services.name, staff_id: staff.id, staff_name: staff.displayName }).from(waitlistEntries).innerJoin(customers, eq(customers.id, waitlistEntries.customerId)).innerJoin(services, eq(services.id, waitlistEntries.serviceId)).leftJoin(staff, eq(staff.id, waitlistEntries.staffId)).where(and(eq(waitlistEntries.salonId, request.salonId), request.query.status ? eq(waitlistEntries.status, request.query.status as WaitlistStatus) : undefined, request.query.serviceId ? eq(waitlistEntries.serviceId, request.query.serviceId) : undefined, start ? gte(waitlistEntries.requestedDate, start) : undefined, end ? lt(waitlistEntries.requestedDate, end) : undefined)).orderBy(asc(waitlistEntries.requestedDate), asc(waitlistEntries.createdAt));
  });

  app.patch<{ Params: { id: string; entryId: string }; Body: { status: WaitlistStatus } }>("/api/salons/:id/waitlist/:entryId", { preHandler: guard }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    if (!statuses.includes(request.body.status)) return reply.code(400).send({ error: "INVALID_STATUS" });
    const row = (await app.db.update(waitlistEntries).set({ status: request.body.status }).where(and(eq(waitlistEntries.id, request.params.entryId), eq(waitlistEntries.salonId, request.salonId))).returning())[0];
    return row ?? reply.code(404).send({ error: "WAITLIST_NOT_FOUND" });
  });

  app.delete<{ Params: { id: string; entryId: string } }>("/api/salons/:id/waitlist/:entryId", { preHandler: guard }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    const row = (await app.db.delete(waitlistEntries).where(and(eq(waitlistEntries.id, request.params.entryId), eq(waitlistEntries.salonId, request.salonId))).returning())[0];
    return row ?? reply.code(404).send({ error: "WAITLIST_NOT_FOUND" });
  });
}
