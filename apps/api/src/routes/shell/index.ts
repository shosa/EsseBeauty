import type { FastifyInstance } from "fastify";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";

import {
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
import { authenticate } from "../../middleware/auth.js";

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

export function notificationToDto(row: NotificationRow) {
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
  };
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

async function hasPendingStaffTask(app: FastifyInstance, salonId: string, notificationId: string) {
  const rows = await app.db
    .select({ status: staffAvailabilityRequests.status })
    .from(notifications)
    .innerJoin(staffAvailabilityRequests, eq(staffAvailabilityRequests.id, notifications.entityId))
    .where(and(
      eq(notifications.id, notificationId),
      eq(notifications.salonId, salonId),
      eq(notifications.entityType, "staff_availability_request"),
      eq(staffAvailabilityRequests.status, "pending"),
    ));
  return Boolean(rows[0]);
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
      schema: {
        body: {
          additionalProperties: false,
          properties: {
            navigation_collapsed: { type: "boolean" },
          },
          required: ["navigation_collapsed"],
          type: "object",
        },
      },
    },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
      const rows = await app.db
        .insert(userInterfacePreferences)
        .values({
          navigationCollapsed: request.body.navigation_collapsed,
          salonId: request.salonId,
          userId: request.user.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          set: {
            navigationCollapsed: request.body.navigation_collapsed,
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
            href: `/services/${row.id}`,
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
            href: `/staff/${row.id}`,
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

  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/notifications",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
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
        .where(
          and(
            eq(notifications.salonId, request.salonId),
            isNull(notifications.archivedAt),
            or(
              eq(notifications.userId, request.user.id),
              eq(notifications.targetRole, request.user.role),
            ),
          ),
        )
        .orderBy(desc(notifications.createdAt))
        .limit(30);

      return {
        unread_count: rows.filter((row) => !row.readAt).length,
        items: rows.map(notificationToDto),
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
      if (await hasPendingStaffTask(app, request.salonId, request.params.notificationId)) {
        return reply.code(409).send({ error: "TASK_STILL_PENDING" });
      }

      const rows = await app.db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.id, request.params.notificationId),
            eq(notifications.salonId, request.salonId),
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
      if (await hasPendingStaffTask(app, request.salonId, request.params.notificationId)) {
        return reply.code(409).send({ error: "TASK_STILL_PENDING" });
      }

      const rows = await app.db
        .update(notifications)
        .set({ archivedAt: new Date() })
        .where(
          and(
            eq(notifications.id, request.params.notificationId),
            eq(notifications.salonId, request.salonId),
          ),
        )
        .returning();

      return rows[0] ?? reply.code(404).send({ error: "NOTIFICATION_NOT_FOUND" });
    },
  );
}
