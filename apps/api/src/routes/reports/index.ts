import type { FastifyInstance } from "fastify";
import { and, eq, gte, lte, sql } from "drizzle-orm";

import {
  appointments,
  customers,
  services,
  staff,
} from "@esse-beauty/db/schema";
import { MODULE_KEYS, requireModule } from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { authenticate, requirePermission } from "../../middleware/auth.js";

function range(from?: string, to?: string) {
  return [
    ...(from ? [gte(appointments.startsAt, new Date(from))] : []),
    ...(to ? [lte(appointments.startsAt, new Date(to))] : []),
  ];
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export async function registerReportRoutes(app: FastifyInstance) {
  app.get<{
    Params: { id: string };
    Querystring: { from?: string; to?: string; staffId?: string };
  }>(
    "/api/salons/:id/reports/staff",
    {
      preHandler: [
        authenticate,
        requireModule(MODULE_KEYS.STAFF_PERF),
        requirePermission(PERMISSION_KEYS.REPORTS_VIEW_ALL),
      ],
    },
    async (request) =>
      app.db
        .select({
          staff_id: staff.id,
          staff_name: staff.displayName,
          appointment_count: sql<number>`count(${appointments.id})`,
          completed_count: sql<number>`count(*) filter (where ${appointments.status} = 'completed')`,
          no_show_count: sql<number>`count(*) filter (where ${appointments.status} = 'no_show')`,
          cancellation_count: sql<number>`count(*) filter (where ${appointments.status} = 'cancelled')`,
          unique_customers: sql<number>`count(distinct ${appointments.customerId})`,
          most_performed_service: sql<string | null>`mode() within group (order by ${services.name})`,
        })
        .from(staff)
        .leftJoin(
          appointments,
          and(
            eq(appointments.staffId, staff.id),
            ...range(request.query.from, request.query.to),
          ),
        )
        .leftJoin(services, eq(services.id, appointments.serviceId))
        .where(
          and(
            eq(staff.salonId, request.salonId),
            ...(request.query.staffId
              ? [eq(staff.id, request.query.staffId)]
              : []),
          ),
        )
        .groupBy(staff.id),
  );

  app.get<{
    Params: { id: string };
    Querystring: { from?: string; to?: string };
  }>(
    "/api/salons/:id/reports/own",
    {
      preHandler: [
        authenticate,
        requireModule(MODULE_KEYS.STAFF_PERF),
        requirePermission(PERMISSION_KEYS.REPORTS_VIEW_OWN),
      ],
    },
    async (request) => {
      const own = await app.db
        .select({ id: staff.id })
        .from(staff)
        .where(
          and(
            eq(staff.userId, request.user.id),
            eq(staff.salonId, request.salonId),
          ),
        );
      if (!own[0]) return [];
      return app.db
        .select({
          appointment_count: sql<number>`count(*)`,
          completed_count: sql<number>`count(*) filter (where ${appointments.status} = 'completed')`,
          no_show_count: sql<number>`count(*) filter (where ${appointments.status} = 'no_show')`,
          cancellation_count: sql<number>`count(*) filter (where ${appointments.status} = 'cancelled')`,
          unique_customers: sql<number>`count(distinct ${appointments.customerId})`,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.staffId, own[0].id),
            ...range(request.query.from, request.query.to),
          ),
        );
    },
  );

  app.get<{
    Params: { id: string };
    Querystring: { from?: string; to?: string };
  }>(
    "/api/salons/:id/reports/services",
    {
      preHandler: [
        authenticate,
        requireModule(MODULE_KEYS.STAFF_PERF),
        requirePermission(PERMISSION_KEYS.REPORTS_VIEW_ALL),
      ],
    },
    async (request) =>
      app.db
        .select({
          service_id: services.id,
          service_name: services.name,
          appointment_count: sql<number>`count(${appointments.id})`,
        })
        .from(services)
        .leftJoin(
          appointments,
          and(
            eq(appointments.serviceId, services.id),
            ...range(request.query.from, request.query.to),
          ),
        )
        .where(eq(services.salonId, request.salonId))
        .groupBy(services.id)
        .orderBy(sql`count(${appointments.id}) desc`),
  );

  app.get<{
    Params: { id: string };
    Querystring: { from?: string; to?: string };
  }>(
    "/api/salons/:id/reports/export",
    {
      preHandler: [
        authenticate,
        requireModule(MODULE_KEYS.STAFF_PERF),
        requirePermission(PERMISSION_KEYS.REPORTS_EXPORT),
      ],
    },
    async (request, reply) => {
      const rows = await app.db
        .select({
          id: appointments.id,
          starts_at: appointments.startsAt,
          status: appointments.status,
          customer: customers.fullName,
          service: services.name,
          staff: staff.displayName,
        })
        .from(appointments)
        .innerJoin(customers, eq(customers.id, appointments.customerId))
        .innerJoin(services, eq(services.id, appointments.serviceId))
        .innerJoin(staff, eq(staff.id, appointments.staffId))
        .where(
          and(
            eq(appointments.salonId, request.salonId),
            ...range(request.query.from, request.query.to),
          ),
        );
      const csv = [
        ["ID", "Data", "Stato", "Cliente", "Servizio", "Staff"]
          .map(csvCell)
          .join(","),
        ...rows.map((row) =>
          [
            row.id,
            row.starts_at.toISOString(),
            row.status,
            row.customer,
            row.service,
            row.staff,
          ]
            .map(csvCell)
            .join(","),
        ),
      ].join("\r\n");
      return reply
        .header("content-type", "text/csv; charset=utf-8")
        .header(
          "content-disposition",
          'attachment; filename="appointments.csv"',
        )
        .send(`\uFEFF${csv}`);
    },
  );
}
