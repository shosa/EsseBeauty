import type { FastifyInstance } from "fastify";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import {
  appointments,
  customers,
  loyaltyPoints,
  services,
  staff,
} from "@esse-beauty/db/schema";
import { isModuleEnabled, MODULE_KEYS } from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { authenticate, requirePermission } from "../../middleware/auth.js";

const viewGuard = [
  authenticate,
  requirePermission(PERMISSION_KEYS.CLIENTS_VIEW),
];
const editGuard = [
  authenticate,
  requirePermission(PERMISSION_KEYS.CLIENTS_EDIT),
];

export async function registerCustomerRoutes(app: FastifyInstance) {
  app.get<{
    Params: { id: string };
    Querystring: {
      page?: string;
      search?: string;
      tag?: string;
      blocked?: string;
    };
  }>("/api/salons/:id/customers", { preHandler: viewGuard }, async (request, reply) => {
    if (request.params.id !== request.salonId) {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }
    const page = Math.max(1, Number(request.query.page) || 1);
    const search = request.query.search?.trim();
    const conditions = [
      eq(customers.salonId, request.salonId),
      ...(search
        ? [
            or(
              ilike(customers.fullName, `%${search}%`),
              ilike(customers.email, `%${search}%`),
              ilike(customers.phone, `%${search}%`),
            )!,
          ]
        : []),
      ...(request.query.tag
        ? [sql`${request.query.tag} = any(${customers.tags})`]
        : []),
      ...(request.query.blocked !== undefined
        ? [eq(customers.blocked, request.query.blocked === "true")]
        : []),
    ];
    const [rows, totalRows] = await Promise.all([
      app.db
        .select({
          id: customers.id,
          full_name: customers.fullName,
          email: customers.email,
          phone: customers.phone,
          tags: customers.tags,
          blocked: customers.blocked,
          last_visit: sql<Date | null>`(
            select max(a.starts_at) from appointments a
            where a.customer_id = ${customers.id} and a.status = 'completed'
          )`,
          total_appointments: sql<number>`(
            select count(*) from appointments a where a.customer_id = ${customers.id}
          )`,
          loyalty_points: sql<number>`(
            select coalesce(sum(lp.delta), 0) from loyalty_points lp
            where lp.customer_id = ${customers.id}
          )`,
        })
        .from(customers)
        .where(and(...conditions))
        .orderBy(customers.fullName)
        .limit(20)
        .offset((page - 1) * 20),
      app.db
        .select({ count: sql<number>`count(*)` })
        .from(customers)
        .where(and(...conditions)),
    ]);
    return {
      items: rows,
      page,
      page_size: 20,
      total: Number(totalRows[0]?.count ?? 0),
    };
  });

  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/customers/tags",
    { preHandler: viewGuard },
    async (request) => {
      const rows = await app.db.execute<{ tag: string }>(
        sql`select distinct unnest(tags) as tag from customers where salon_id = ${request.salonId} order by tag`,
      );
      return rows.map((row) => row.tag);
    },
  );

  app.get<{ Params: { id: string; customerId: string } }>(
    "/api/salons/:id/customers/:customerId",
    { preHandler: viewGuard },
    async (request, reply) => {
      const rows = await app.db
        .select()
        .from(customers)
        .where(
          and(
            eq(customers.id, request.params.customerId),
            eq(customers.salonId, request.salonId),
          ),
        );
      const customer = rows[0];
      if (!customer) {
        return reply.code(404).send({ error: "CUSTOMER_NOT_FOUND" });
      }
      const history = await app.db
        .select({
          id: appointments.id,
          starts_at: appointments.startsAt,
          status: appointments.status,
          service_name: services.name,
          staff_name: staff.displayName,
        })
        .from(appointments)
        .innerJoin(services, eq(services.id, appointments.serviceId))
        .innerJoin(staff, eq(staff.id, appointments.staffId))
        .where(eq(appointments.customerId, customer.id))
        .orderBy(desc(appointments.startsAt))
        .limit(20);
      const loyaltyEnabled = await isModuleEnabled(
        request.salonId,
        MODULE_KEYS.LOYALTY,
        app.db,
      );
      const points = loyaltyEnabled
        ? await app.db
            .select()
            .from(loyaltyPoints)
            .where(eq(loyaltyPoints.customerId, customer.id))
            .orderBy(desc(loyaltyPoints.createdAt))
        : [];
      return {
        ...customer,
        appointments: history,
        loyalty: loyaltyEnabled
          ? {
              balance: points.reduce((sum, item) => sum + item.delta, 0),
              history: points,
            }
          : null,
      };
    },
  );

  app.post<{
    Params: { id: string };
    Body: {
      full_name: string;
      email?: string;
      phone?: string;
      notes?: string;
      tags?: string[];
    };
  }>("/api/salons/:id/customers", { preHandler: editGuard }, async (request, reply) => {
    const rows = await app.db
      .insert(customers)
      .values({
        salonId: request.salonId,
        fullName: request.body.full_name,
        email: request.body.email,
        phone: request.body.phone,
        notes: request.body.notes,
        tags: request.body.tags ?? [],
      })
      .returning();
    return reply.code(201).send(rows[0]);
  });

  app.patch<{
    Params: { id: string; customerId: string };
    Body: Partial<{
      full_name: string;
      email: string | null;
      phone: string | null;
      notes: string | null;
      tags: string[];
    }>;
  }>("/api/salons/:id/customers/:customerId", { preHandler: editGuard }, async (request, reply) => {
    const rows = await app.db
      .update(customers)
      .set({
        ...(request.body.full_name !== undefined && {
          fullName: request.body.full_name,
        }),
        ...(request.body.email !== undefined && { email: request.body.email }),
        ...(request.body.phone !== undefined && { phone: request.body.phone }),
        ...(request.body.notes !== undefined && { notes: request.body.notes }),
        ...(request.body.tags !== undefined && { tags: request.body.tags }),
      })
      .where(
        and(
          eq(customers.id, request.params.customerId),
          eq(customers.salonId, request.salonId),
        ),
      )
      .returning();
    return rows[0] ?? reply.code(404).send({ error: "CUSTOMER_NOT_FOUND" });
  });

  app.patch<{
    Params: { id: string; customerId: string };
    Body: { blocked: boolean; reason?: string };
  }>(
    "/api/salons/:id/customers/:customerId/block",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.CLIENTS_BLOCK),
      ],
    },
    async (request, reply) => {
      const rows = await app.db
        .update(customers)
        .set({
          blocked: request.body.blocked,
          ...(request.body.reason && {
            notes: sql`concat_ws(E'\n', ${customers.notes}, ${`Blocco: ${request.body.reason}`})`,
          }),
        })
        .where(
          and(
            eq(customers.id, request.params.customerId),
            eq(customers.salonId, request.salonId),
          ),
        )
        .returning();
      return rows[0] ?? reply.code(404).send({ error: "CUSTOMER_NOT_FOUND" });
    },
  );

  app.get<{
    Params: { id: string; customerId: string };
    Querystring: { page?: string };
  }>(
    "/api/salons/:id/customers/:customerId/appointments",
    { preHandler: viewGuard },
    async (request) => {
      const page = Math.max(1, Number(request.query.page) || 1);
      return app.db
        .select({
          id: appointments.id,
          starts_at: appointments.startsAt,
          ends_at: appointments.endsAt,
          status: appointments.status,
          service_name: services.name,
          staff_name: staff.displayName,
        })
        .from(appointments)
        .innerJoin(services, eq(services.id, appointments.serviceId))
        .innerJoin(staff, eq(staff.id, appointments.staffId))
        .where(
          and(
            eq(appointments.salonId, request.salonId),
            eq(appointments.customerId, request.params.customerId),
          ),
        )
        .orderBy(desc(appointments.startsAt))
        .limit(20)
        .offset((page - 1) * 20);
    },
  );
}
