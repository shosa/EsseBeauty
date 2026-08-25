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
import { createWorkbook, excelContentType, styleWorksheet, workbookBuffer } from "../../lib/excel-workbook.js";

function range(from?: string, to?: string) {
  return [
    ...(from ? [gte(appointments.startsAt, new Date(from))] : []),
    ...(to ? [lte(appointments.startsAt, new Date(to))] : []),
  ];
}

export async function registerReportRoutes(app: FastifyInstance) {
  app.get<{
    Params: { id: string };
    Querystring: { from?: string; to?: string };
  }>(
    "/api/salons/:id/reports/overview",
    {
      preHandler: [
        authenticate,
        requireModule(MODULE_KEYS.STAFF_PERF),
        requirePermission(PERMISSION_KEYS.REPORTS_VIEW_ALL),
      ],
    },
    async (request) => {
      const conditions = [eq(appointments.salonId, request.salonId), ...range(request.query.from, request.query.to)];
      const [summaryRows, daily] = await Promise.all([
        app.db.select({
          appointment_count: sql<number>`count(*)::int`,
          cancellation_count: sql<number>`count(*) filter (where ${appointments.status} = 'cancelled')::int`,
          completed_count: sql<number>`count(*) filter (where ${appointments.status} = 'completed')::int`,
          no_show_count: sql<number>`count(*) filter (where ${appointments.status} = 'no_show')::int`,
          unique_customers: sql<number>`count(distinct ${appointments.customerId})::int`,
        }).from(appointments).where(and(...conditions)),
        app.db.select({
          appointment_count: sql<number>`count(*)::int`,
          completed_count: sql<number>`count(*) filter (where ${appointments.status} = 'completed')::int`,
          day: sql<string>`to_char(date_trunc('day', ${appointments.startsAt}), 'YYYY-MM-DD')`,
        }).from(appointments).where(and(...conditions))
          .groupBy(sql`date_trunc('day', ${appointments.startsAt})`)
          .orderBy(sql`date_trunc('day', ${appointments.startsAt})`),
      ]);
      return { daily, summary: summaryRows[0] ?? { appointment_count: 0, cancellation_count: 0, completed_count: 0, no_show_count: 0, unique_customers: 0 } };
    },
  );

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
          completed_count: sql<number>`count(*) filter (where ${appointments.status} = 'completed')`,
          no_show_count: sql<number>`count(*) filter (where ${appointments.status} = 'no_show')`,
          unique_customers: sql<number>`count(distinct ${appointments.customerId})`,
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
      const workbook = createWorkbook("Report appuntamenti");
      const sheet = workbook.addWorksheet("Appuntamenti");
      sheet.addRow(["ID", "Data", "Stato", "Cliente", "Servizio", "Staff"]);
      rows.forEach((row) => sheet.addRow([row.id, row.starts_at, row.status, row.customer, row.service, row.staff]));
      sheet.getColumn(2).numFmt = "dd/mm/yyyy hh:mm";
      styleWorksheet(sheet);
      const summary = workbook.addWorksheet("Riepilogo");
      summary.addRow(["Indicatore", "Valore"]);
      summary.addRows([
        ["Appuntamenti", rows.length],
        ["Completati", rows.filter((row) => row.status === "completed").length],
        ["Cancellati", rows.filter((row) => row.status === "cancelled").length],
        ["No-show", rows.filter((row) => row.status === "no_show").length],
        ["Clienti unici", new Set(rows.map((row) => row.customer)).size],
      ]);
      styleWorksheet(summary);
      return reply
        .header("content-type", excelContentType)
        .header("content-disposition", 'attachment; filename="report-appuntamenti.xlsx"')
        .send(await workbookBuffer(workbook));
    },
  );
}
