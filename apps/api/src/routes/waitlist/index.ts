import type { FastifyInstance } from "fastify";
import { and, asc, eq } from "drizzle-orm";

import {
  customers,
  salons,
  services,
  staff,
  waitlistEntries,
} from "@esse-beauty/db/schema";
import {
  isModuleEnabled,
  MODULE_KEYS,
  requireModule,
} from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { authenticate, requirePermission } from "../../middleware/auth.js";

const guard = [
  authenticate,
  requireModule(MODULE_KEYS.WAITLIST),
  requirePermission(PERMISSION_KEYS.WAITLIST_MANAGE),
];

export async function registerWaitlistRoutes(app: FastifyInstance) {
  app.post<{
    Params: { slug: string };
    Body: {
      service_id: string;
      staff_id?: string;
      requested_date: string;
      customer: { full_name: string; email?: string; phone?: string };
    };
  }>("/api/public/:slug/waitlist", async (request, reply) => {
    const salonRows = await app.db
      .select()
      .from(salons)
      .where(eq(salons.slug, request.params.slug));
    const salon = salonRows[0];
    if (
      !salon ||
      !(await isModuleEnabled(salon.id, MODULE_KEYS.WAITLIST, app.db))
    ) {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }
    if (!request.body.customer.email && !request.body.customer.phone) {
      return reply.code(400).send({ error: "CONTACT_REQUIRED" });
    }
    const customerRows = await app.db
      .insert(customers)
      .values({
        salonId: salon.id,
        fullName: request.body.customer.full_name,
        email: request.body.customer.email,
        phone: request.body.customer.phone,
      })
      .returning();
    const rows = await app.db
      .insert(waitlistEntries)
      .values({
        salonId: salon.id,
        serviceId: request.body.service_id,
        staffId: request.body.staff_id,
        customerId: customerRows[0]!.id,
        requestedDate: new Date(request.body.requested_date),
      })
      .returning();
    return reply.code(201).send(rows[0]);
  });

  app.get<{
    Params: { id: string };
    Querystring: { status?: string; date?: string; serviceId?: string };
  }>("/api/salons/:id/waitlist", { preHandler: guard }, async (request, reply) => {
    if (request.params.id !== request.salonId) {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }
    return app.db
      .select({
        id: waitlistEntries.id,
        requested_date: waitlistEntries.requestedDate,
        status: waitlistEntries.status,
        created_at: waitlistEntries.createdAt,
        customer_name: customers.fullName,
        customer_email: customers.email,
        customer_phone: customers.phone,
        service_name: services.name,
        staff_name: staff.displayName,
      })
      .from(waitlistEntries)
      .innerJoin(customers, eq(customers.id, waitlistEntries.customerId))
      .innerJoin(services, eq(services.id, waitlistEntries.serviceId))
      .leftJoin(staff, eq(staff.id, waitlistEntries.staffId))
      .where(
        and(
          eq(waitlistEntries.salonId, request.salonId),
          ...(request.query.status
            ? [eq(waitlistEntries.status, request.query.status as "waiting")]
            : []),
          ...(request.query.serviceId
            ? [eq(waitlistEntries.serviceId, request.query.serviceId)]
            : []),
          ...(request.query.date
            ? [
                eq(
                  waitlistEntries.requestedDate,
                  new Date(request.query.date),
                ),
              ]
            : []),
        ),
      )
      .orderBy(asc(waitlistEntries.createdAt));
  });

  app.patch<{
    Params: { id: string; entryId: string };
    Body: { status: "waiting" | "notified" | "booked" | "expired" };
  }>("/api/salons/:id/waitlist/:entryId", { preHandler: guard }, async (request, reply) => {
    const rows = await app.db
      .update(waitlistEntries)
      .set({ status: request.body.status })
      .where(
        and(
          eq(waitlistEntries.id, request.params.entryId),
          eq(waitlistEntries.salonId, request.salonId),
        ),
      )
      .returning();
    return rows[0] ?? reply.code(404).send({ error: "WAITLIST_NOT_FOUND" });
  });

  app.delete<{ Params: { id: string; entryId: string } }>(
    "/api/salons/:id/waitlist/:entryId",
    { preHandler: guard },
    async (request, reply) => {
      const rows = await app.db
        .delete(waitlistEntries)
        .where(
          and(
            eq(waitlistEntries.id, request.params.entryId),
            eq(waitlistEntries.salonId, request.salonId),
          ),
        )
        .returning();
      return rows[0] ?? reply.code(404).send({ error: "WAITLIST_NOT_FOUND" });
    },
  );
}
