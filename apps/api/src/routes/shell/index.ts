import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

import {
  appointmentRescheduleRequests,
  appointments,
  customers,
  inventoryProducts,
  marketingCampaigns,
  notifications,
  services,
  staff,
  staffAvailabilityRequests,
  userInterfacePreferences,
} from "@esse-beauty/db/schema";
import { hasPermission, PERMISSION_KEYS } from "@esse-beauty/shared";

import {
  ensureOnlineBookingNotifications,
  ensureStaffRequestReviewNotifications,
} from "../../jobs/staff-request-notifications.js";
import { parseBody, type SafeParseSchema } from "../../lib/http-validation.js";
import { authenticate } from "../../middleware/auth.js";

const shellPreferencesBodySchema: SafeParseSchema<{
  navigation_collapsed: boolean;
}> = {
  safeParse(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {
        error: { fieldErrors: { body: ["Corpo della richiesta non valido"] } },
        success: false as const,
      };
    }

    const navigationCollapsed = (value as { navigation_collapsed?: unknown })
      .navigation_collapsed;
    return typeof navigationCollapsed === "boolean"
      ? { data: { navigation_collapsed: navigationCollapsed }, success: true as const }
      : {
          error: {
            fieldErrors: {
              navigation_collapsed: ["Valore obbligatorio"],
            },
          },
          success: false as const,
        };
  },
};

const searchGroups = [
  "customers",
  "appointments",
  "services",
  "staff",
  "campaigns",
  "products",
] as const;

type SearchGroup = (typeof searchGroups)[number];

export interface SearchResult {
  group: SearchGroup;
  href: string;
  title: string;
  subtitle?: string | null;
  status?: string | null;
}

type SearchResponse = Record<SearchGroup, Array<Omit<SearchResult, "group">>>;

interface NotificationRow {
  category: string;
  channel: string;
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityId: string | null;
  entityType: string | null;
  payload: Record<string, unknown>;
  priority: string;
  readAt: Date | null;
  createdAt: Date;
}

export function normalizeSearchQuery(query: string): string {
  const normalized = query.replace(/\s+/g, " ").trim().slice(0, 64);
  return normalized.length >= 3 ? normalized : "";
}

export function buildSearchResponse(results: SearchResult[]): SearchResponse {
  const response: SearchResponse = {
    customers: [],
    appointments: [],
    services: [],
    staff: [],
    campaigns: [],
    products: [],
  };

  for (const { group, ...item } of results) {
    response[group].push(item);
  }

  return response;
}

export function notificationToDto(row: NotificationRow & { actionPending?: boolean }) {
  const href = typeof row.payload.href === "string" ? row.payload.href : null;

  return {
    id: row.id,
    category: row.category,
    channel: row.channel,
    type: row.type,
    priority: row.priority,
    title: row.title,
    body: row.body,
    entity_id: row.entityId,
    entity_type: row.entityType,
    href,
    read_at: row.readAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    unread: !row.readAt,
    action_pending: Boolean(row.actionPending),
  };
}

/**
 * Notification types whose linked record can still require action (a pending staff
 * request, an unconfirmed online booking, an unreviewed reschedule request). Those
 * can't be archived until the linked record is resolved elsewhere in the app.
 */
const ACTION_PENDING_TABLES = {
  online_booking_received: appointments,
  reschedule_request: appointmentRescheduleRequests,
  staff_availability_request: staffAvailabilityRequests,
} as const;

async function computeActionPending(
  app: FastifyInstance,
  rows: ReadonlyArray<{ id: string; type: string; entityId: string | null }>,
): Promise<Map<string, boolean>> {
  const idsByType = new Map<keyof typeof ACTION_PENDING_TABLES, string[]>();
  for (const row of rows) {
    if (!row.entityId || !(row.type in ACTION_PENDING_TABLES)) continue;
    const type = row.type as keyof typeof ACTION_PENDING_TABLES;
    const ids = idsByType.get(type) ?? [];
    ids.push(row.entityId);
    idsByType.set(type, ids);
  }

  const pendingIdsByType = new Map<keyof typeof ACTION_PENDING_TABLES, Set<string>>();
  await Promise.all(Array.from(idsByType.entries()).map(async ([type, ids]) => {
    const table = ACTION_PENDING_TABLES[type];
    const pending = await app.db.select({ id: table.id }).from(table).where(and(inArray(table.id, ids), eq(table.status, "pending")));
    pendingIdsByType.set(type, new Set(pending.map((item) => item.id)));
  }));

  const map = new Map<string, boolean>();
  for (const row of rows) {
    const type = row.type as keyof typeof ACTION_PENDING_TABLES;
    map.set(row.id, Boolean(row.entityId && pendingIdsByType.get(type)?.has(row.entityId)));
  }
  return map;
}

function page(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, maximum)) : fallback;
}

export function normalizeShellPreferences(
  value: unknown,
): { navigation_collapsed: boolean } {
  if (!value || typeof value !== "object") {
    return { navigation_collapsed: false };
  }

  return {
    navigation_collapsed:
      (value as { navigation_collapsed?: unknown }).navigation_collapsed === true,
  };
}

export function visibleNotification(
  request: Pick<FastifyRequest, "user">,
  notification: typeof notifications,
) {
  return or(
    eq(notification.userId, request.user.id),
    eq(notification.targetRole, request.user.role),
  );
}


function like(query: string): string {
  return `%${query}%`;
}

async function canSearch(
  app: FastifyInstance,
  userId: string,
  permissions: string[],
): Promise<boolean> {
  for (const permission of permissions) {
    if (await hasPermission(userId, permission as never, app.db)) {
      return true;
    }
  }

  return false;
}

export async function registerShellRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/shell-preferences",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
      if (request.user.role === "owner" || request.user.role === "manager") {
        await Promise.all([
          ensureStaffRequestReviewNotifications(app, request.salonId),
          ensureOnlineBookingNotifications(app, request.salonId),
        ]);
      }
      const rows = await app.db
        .select({
          navigation_collapsed: userInterfacePreferences.navigationCollapsed,
        })
        .from(userInterfacePreferences)
        .where(
          and(
            eq(userInterfacePreferences.salonId, request.salonId),
            eq(userInterfacePreferences.userId, request.user.id),
          ),
        );

      return normalizeShellPreferences(rows[0] ?? null);
    },
  );

  app.patch<{
    Body: { navigation_collapsed: boolean };
    Params: { id: string };
  }>(
    "/api/salons/:id/shell-preferences",
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const body = parseBody(shellPreferencesBodySchema, request, reply);
      if (!body) return;
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
      const resolvedAppointments = await app.db
        .select({ id: appointments.id })
        .from(appointments)
        .where(and(
          eq(appointments.salonId, request.salonId),
          inArray(appointments.status, ["confirmed", "completed", "cancelled", "no_show"]),
        ));
      if (resolvedAppointments.length > 0) {
        await app.db.update(notifications).set({
          archivedAt: new Date(),
          readAt: new Date(),
        }).where(and(
          eq(notifications.salonId, request.salonId),
          eq(notifications.entityType, "appointment"),
          eq(notifications.type, "online_booking_received"),
          inArray(notifications.entityId, resolvedAppointments.map((item) => item.id)),
        ));
      }
      const rows = await app.db
        .insert(userInterfacePreferences)
        .values({
          navigationCollapsed: body.navigation_collapsed,
          salonId: request.salonId,
          userId: request.user.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          set: {
            navigationCollapsed: body.navigation_collapsed,
            updatedAt: new Date(),
          },
          target: [
            userInterfacePreferences.userId,
            userInterfacePreferences.salonId,
          ],
        })
        .returning({
          navigation_collapsed: userInterfacePreferences.navigationCollapsed,
        });

      return normalizeShellPreferences(rows[0] ?? null);
    },
  );

  app.get<{ Params: { id: string }; Querystring: { q?: string } }>(
    "/api/salons/:id/search",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }

      const query = normalizeSearchQuery(request.query.q ?? "");
      if (!query) {
        return buildSearchResponse([]);
      }

      const pattern = like(query);
      const results: SearchResult[] = [];
      const userId = request.user.id;

      if (
        await canSearch(app, userId, [
          PERMISSION_KEYS.CLIENTS_VIEW,
          PERMISSION_KEYS.CLIENTS_EDIT,
        ])
      ) {
        const rows = await app.db
          .select({
            id: customers.id,
            title: customers.fullName,
            subtitle: customers.email,
            status: customers.blocked,
          })
          .from(customers)
          .where(
            and(
              eq(customers.salonId, request.salonId),
              or(
                ilike(customers.fullName, pattern),
                ilike(customers.email, pattern),
                ilike(customers.phone, pattern),
              ),
            ),
          )
          .limit(5);

        results.push(
          ...rows.map((row) => ({
            group: "customers" as const,
            href: `/clients/${row.id}`,
            title: row.title,
            subtitle: row.subtitle,
            status: row.status ? "bloccato" : null,
          })),
        );
      }

      if (
        await canSearch(app, userId, [
          PERMISSION_KEYS.CALENDAR_VIEW_OWN,
          PERMISSION_KEYS.CALENDAR_VIEW_OTHERS,
          PERMISSION_KEYS.CALENDAR_MANAGE_OWN,
          PERMISSION_KEYS.CALENDAR_MANAGE_OTHERS,
        ])
      ) {
        const rows = await app.db
          .select({
            id: appointments.id,
            startsAt: appointments.startsAt,
            status: appointments.status,
            customerName: customers.fullName,
            serviceName: services.name,
          })
          .from(appointments)
          .innerJoin(customers, eq(customers.id, appointments.customerId))
          .innerJoin(services, eq(services.id, appointments.serviceId))
          .where(
            and(
              eq(appointments.salonId, request.salonId),
              or(
                ilike(customers.fullName, pattern),
                ilike(services.name, pattern),
              ),
            ),
          )
          .orderBy(desc(appointments.startsAt))
          .limit(5);

        results.push(
          ...rows.map((row) => ({
            group: "appointments" as const,
            href: `/calendar/appointments/${row.id}`,
            title: row.customerName,
            subtitle: `${row.serviceName} · ${row.startsAt.toISOString()}`,
            status: row.status,
          })),
        );
      }

      if (
        await canSearch(app, userId, [PERMISSION_KEYS.SETTINGS_SERVICES])
      ) {
        const rows = await app.db
          .select({
            id: services.id,
            title: services.name,
            subtitle: services.category,
            status: services.active,
          })
          .from(services)
          .where(
            and(
              eq(services.salonId, request.salonId),
              or(ilike(services.name, pattern), ilike(services.category, pattern)),
            ),
          )
          .limit(5);

        results.push(
          ...rows.map((row) => ({
            group: "services" as const,
            href: `/settings/services/${row.id}`,
            title: row.title,
            subtitle: row.subtitle,
            status: row.status ? "attivo" : "archiviato",
          })),
        );
      }

      if (await canSearch(app, userId, [PERMISSION_KEYS.SETTINGS_STAFF])) {
        const rows = await app.db
          .select({
            id: staff.id,
            title: staff.displayName,
            subtitle: staff.jobTitle,
            status: staff.active,
          })
          .from(staff)
          .where(
            and(
              eq(staff.salonId, request.salonId),
              or(ilike(staff.displayName, pattern), ilike(staff.email, pattern)),
            ),
          )
          .limit(5);

        results.push(
          ...rows.map((row) => ({
            group: "staff" as const,
            href: `/settings/staff/${row.id}`,
            title: row.title,
            subtitle: row.subtitle,
            status: row.status ? "attivo" : "archiviato",
          })),
        );
      }

      if (await canSearch(app, userId, [PERMISSION_KEYS.MARKETING_SEND])) {
        const rows = await app.db
          .select({
            id: marketingCampaigns.id,
            title: marketingCampaigns.name,
            subtitle: marketingCampaigns.channel,
            status: marketingCampaigns.status,
          })
          .from(marketingCampaigns)
          .where(
            and(
              eq(marketingCampaigns.salonId, request.salonId),
              ilike(marketingCampaigns.name, pattern),
            ),
          )
          .orderBy(desc(marketingCampaigns.createdAt))
          .limit(5);

        results.push(
          ...rows.map((row) => ({
            group: "campaigns" as const,
            href: `/marketing/${row.id}`,
            title: row.title,
            subtitle: row.subtitle,
            status: row.status,
          })),
        );
      }

      if (await canSearch(app, userId, [PERMISSION_KEYS.INVENTORY_MANAGE])) {
        const rows = await app.db
          .select({
            id: inventoryProducts.id,
            title: inventoryProducts.name,
            subtitle: inventoryProducts.sku,
            status: inventoryProducts.active,
          })
          .from(inventoryProducts)
          .where(
            and(
              eq(inventoryProducts.salonId, request.salonId),
              or(
                ilike(inventoryProducts.name, pattern),
                ilike(inventoryProducts.sku, pattern),
                ilike(inventoryProducts.barcode, pattern),
              ),
            ),
          )
          .limit(5);

        results.push(
          ...rows.map((row) => ({
            group: "products" as const,
            href: `/inventory/${row.id}`,
            title: row.title,
            subtitle: row.subtitle,
            status: row.status ? "attivo" : "archiviato",
          })),
        );
      }

      return buildSearchResponse(results);
    },
  );

  const notificationStatuses = ["all", "unread", "read", "archived"] as const;
  type NotificationStatusFilter = (typeof notificationStatuses)[number];

  app.get<{
    Params: { id: string };
    Querystring: { category?: string; limit?: string; offset?: string; q?: string; required?: string; status?: string };
  }>(
    "/api/salons/:id/notifications",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
      const statusFilter: NotificationStatusFilter = notificationStatuses.includes(request.query.status as NotificationStatusFilter)
        ? request.query.status as NotificationStatusFilter
        : "all";
      const search = request.query.q?.trim().slice(0, 64);

      const filters = [
        eq(notifications.salonId, request.salonId),
        visibleNotification(request, notifications),
        statusFilter === "archived" ? isNotNull(notifications.archivedAt) : isNull(notifications.archivedAt),
      ];
      if (statusFilter === "unread") filters.push(isNull(notifications.readAt));
      if (statusFilter === "read") filters.push(isNotNull(notifications.readAt));
      if (request.query.category) filters.push(eq(notifications.category, request.query.category));
      if (search) filters.push(or(ilike(notifications.title, like(search)), ilike(notifications.body, like(search)))!);

      const rows = await app.db
        .select({
          id: notifications.id,
          category: notifications.category,
          channel: notifications.channel,
          type: notifications.type,
          priority: notifications.priority,
          title: notifications.title,
          body: notifications.body,
          entityId: notifications.entityId,
          entityType: notifications.entityType,
          payload: notifications.payload,
          readAt: notifications.readAt,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .where(and(...filters))
        .orderBy(desc(notifications.createdAt))
        .limit(page(request.query.limit, 30, 100))
        .offset(page(request.query.offset, 0, 10_000));

      const actionPending = await computeActionPending(app, rows);
      const scopedRows = request.query.required === "true" ? rows.filter((row) => actionPending.get(row.id)) : rows;

      return {
        unread_count: scopedRows.filter((row) => !row.readAt).length,
        items: scopedRows.map((row) => notificationToDto({ ...row, actionPending: actionPending.get(row.id) })),
      };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/notifications-summary",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
      const [rows, guardedRows] = await Promise.all([
        app.db.select({
          archived: sql<number>`count(*) filter (where ${notifications.archivedAt} is not null)::int`,
          highPriority: sql<number>`count(*) filter (where ${notifications.archivedAt} is null and ${notifications.readAt} is null and ${notifications.priority} in ('high', 'critical'))::int`,
          total: sql<number>`count(*) filter (where ${notifications.archivedAt} is null)::int`,
          unread: sql<number>`count(*) filter (where ${notifications.archivedAt} is null and ${notifications.readAt} is null)::int`,
        }).from(notifications).where(and(
          eq(notifications.salonId, request.salonId),
          visibleNotification(request, notifications),
        )),
        app.db.select({ entityId: notifications.entityId, id: notifications.id, type: notifications.type })
          .from(notifications)
          .where(and(
            eq(notifications.salonId, request.salonId),
            isNull(notifications.archivedAt),
            visibleNotification(request, notifications),
            inArray(notifications.type, Object.keys(ACTION_PENDING_TABLES)),
          )),
      ]);
      const actionPending = await computeActionPending(app, guardedRows);
      const row = rows[0];
      return {
        archived: row?.archived ?? 0,
        high_priority: row?.highPriority ?? 0,
        mandatory: guardedRows.filter((item) => actionPending.get(item.id)).length,
        total: row?.total ?? 0,
        unread: row?.unread ?? 0,
      };
    },
  );

  app.patch<{ Params: { id: string; notificationId: string } }>(
    "/api/salons/:id/notifications/:notificationId/read",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
      const rows = await app.db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.id, request.params.notificationId),
            eq(notifications.salonId, request.salonId),
            visibleNotification(request, notifications),
          ),
        )
        .returning();

      return rows[0] ?? reply.code(404).send({ error: "NOTIFICATION_NOT_FOUND" });
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/api/salons/:id/notifications/read-all",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
      const rows = await app.db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(
          eq(notifications.salonId, request.salonId),
          isNull(notifications.archivedAt),
          isNull(notifications.readAt),
          visibleNotification(request, notifications),
        ))
        .returning({ id: notifications.id });

      return { updated: rows.length };
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/api/salons/:id/notifications/archive-read",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
      const readRows = await app.db
        .select({ entityId: notifications.entityId, id: notifications.id, type: notifications.type })
        .from(notifications)
        .where(and(
          eq(notifications.salonId, request.salonId),
          isNull(notifications.archivedAt),
          isNotNull(notifications.readAt),
          visibleNotification(request, notifications),
        ));
      const actionPending = await computeActionPending(app, readRows);
      const archivableIds = readRows.filter((row) => !actionPending.get(row.id)).map((row) => row.id);

      if (archivableIds.length === 0) {
        return { archived: 0, skipped: readRows.length };
      }
      await app.db.update(notifications).set({ archivedAt: new Date() }).where(inArray(notifications.id, archivableIds));
      return { archived: archivableIds.length, skipped: readRows.length - archivableIds.length };
    },
  );

  app.patch<{ Params: { id: string; notificationId: string } }>(
    "/api/salons/:id/notifications/:notificationId/restore",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
      const rows = await app.db
        .update(notifications)
        .set({ archivedAt: null })
        .where(
          and(
            eq(notifications.id, request.params.notificationId),
            eq(notifications.salonId, request.salonId),
            visibleNotification(request, notifications),
          ),
        )
        .returning();

      return rows[0] ?? reply.code(404).send({ error: "NOTIFICATION_NOT_FOUND" });
    },
  );

  app.delete<{ Params: { id: string; notificationId: string } }>(
    "/api/salons/:id/notifications/:notificationId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }

      const notificationRows = await app.db
        .select({ entityId: notifications.entityId, id: notifications.id, type: notifications.type })
        .from(notifications)
        .where(and(
          eq(notifications.id, request.params.notificationId),
          eq(notifications.salonId, request.salonId),
          visibleNotification(request, notifications),
        ));
      const notification = notificationRows[0];
      if (!notification) return reply.code(404).send({ error: "NOTIFICATION_NOT_FOUND" });

      const actionPending = await computeActionPending(app, [notification]);
      if (actionPending.get(notification.id)) {
        return reply.code(409).send({ error: "ACTION_PENDING" });
      }

      const rows = await app.db
        .update(notifications)
        .set({ archivedAt: new Date() })
        .where(
          and(
            eq(notifications.id, request.params.notificationId),
            eq(notifications.salonId, request.salonId),
            visibleNotification(request, notifications),
          ),
        )
        .returning();

      return rows[0] ?? reply.code(404).send({ error: "NOTIFICATION_NOT_FOUND" });
    },
  );
}
