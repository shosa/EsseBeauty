import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import type { DrizzleDB } from "@esse-beauty/db";
import { notifications } from "@esse-beauty/db/schema";

import {
  buildSearchResponse,
  normalizeShellPreferences,
  normalizeSearchQuery,
  notificationToDto,
  registerShellRoutes,
} from "./index.js";

const apps: Array<ReturnType<typeof Fastify>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function notificationMutationApp({ accessible = false, notificationType = "inventory_low_stock", pending = false } = {}) {
  const employee = {
    active: true,
    id: "employee-id",
    role: "employee" as const,
    salonId: "salon-id",
    sessionId: "session-id",
  };
  const dialect = new PgDialect();
  const db = {
    select(selection: Record<string, unknown>) {
      return {
        from(table: unknown) {
          return {
            innerJoin() {
              return {
                where: async () => "sessionId" in selection ? [employee] : [],
              };
            },
            where: async () => {
              if (table === notifications) {
                return accessible ? [{ entityId: "entity-1", id: "visible-notification", type: notificationType }] : [];
              }
              return pending ? [{ id: "entity-1" }] : [];
            },
          };
        },
      };
    },
    update() {
      return {
        set() {
          return {
            where(condition: SQL) {
              const params = dialect.sqlToQuery(condition).params;
              const notificationIsVisible = params.includes(employee.id)
                && params.includes(employee.role)
                && accessible;
              return {
                returning: async () => notificationIsVisible ? [{ id: "visible-notification" }] : [],
              };
            },
          };
        },
      };
    },
  } as unknown as DrizzleDB;
  const app = Fastify();
  app.decorate("db", db);
  app.decorateRequest("salonId", "");
  app.decorateRequest("user");
  void app.register(cookie);
  void registerShellRoutes(app);
  apps.push(app);
  return app;
}

describe("shell route helpers", () => {
  it("normalizes and bounds global search queries", () => {
    expect(normalizeSearchQuery("  Maria   Rossi  ")).toBe("Maria Rossi");
    expect(normalizeSearchQuery("ab")).toBe("");
    expect(normalizeSearchQuery("x".repeat(90))).toHaveLength(64);
  });

  it("groups search results by shell group", () => {
    expect(
      buildSearchResponse([
        { group: "customers", href: "/clients/1", title: "Maria" },
        { group: "services", href: "/services/1", title: "Piega" },
      ]),
    ).toEqual({
      customers: [{ href: "/clients/1", title: "Maria" }],
      appointments: [],
      services: [{ href: "/services/1", title: "Piega" }],
      staff: [],
      campaigns: [],
      products: [],
    });
  });

  it("maps notification payload links without persisting href as a schema column", () => {
    expect(
      notificationToDto({
        category: "inventory",
        channel: "in_app",
        entityId: "p1",
        entityType: "inventory_product",
        id: "n1",
        priority: "high",
        type: "inventory_low_stock",
        title: "Scorta bassa",
        body: null,
        payload: { href: "/inventory/p1" },
        readAt: null,
        createdAt: new Date("2026-06-16T08:00:00Z"),
      }),
    ).toEqual({
      action_pending: false,
      category: "inventory",
      channel: "in_app",
      entity_id: "p1",
      entity_type: "inventory_product",
      id: "n1",
      priority: "high",
      type: "inventory_low_stock",
      title: "Scorta bassa",
      body: null,
      href: "/inventory/p1",
      read_at: null,
      created_at: "2026-06-16T08:00:00.000Z",
      unread: true,
    });
  });

  it("normalizes persisted shell navigation preferences", () => {
    expect(normalizeShellPreferences({ navigation_collapsed: true })).toEqual({
      navigation_collapsed: true,
    });
    expect(normalizeShellPreferences({ navigation_collapsed: "yes" })).toEqual({
      navigation_collapsed: false,
    });
    expect(normalizeShellPreferences(null)).toEqual({
      navigation_collapsed: false,
    });
  });

  it("cannot archive another user's notification", async () => {
    const employee = notificationMutationApp();

    const response = await employee.inject({
      headers: { cookie: "esse-session=employee-session" },
      method: "DELETE",
      url: "/api/salons/salon-id/notifications/owner-notification",
    });

    expect(response.statusCode, response.body).toBe(404);
  });

  it("cannot mark another user's notification as read", async () => {
    const employee = notificationMutationApp();

    const response = await employee.inject({
      headers: { cookie: "esse-session=employee-session" },
      method: "PATCH",
      url: "/api/salons/salon-id/notifications/owner-notification/read",
    });

    expect(response.statusCode, response.body).toBe(404);
  });

  it("allows a pending task notification to be acknowledged without completing the task", async () => {
    const employee = notificationMutationApp({ accessible: true, pending: true });

    const response = await employee.inject({
      headers: { cookie: "esse-session=employee-session" },
      method: "PATCH",
      url: "/api/salons/salon-id/notifications/visible-notification/read",
    });

    expect(response.statusCode, response.body).toBe(200);
  });

  it("archives a notification whose linked task is already resolved", async () => {
    const employee = notificationMutationApp({ accessible: true, notificationType: "staff_availability_request", pending: false });

    const response = await employee.inject({
      headers: { cookie: "esse-session=employee-session" },
      method: "DELETE",
      url: "/api/salons/salon-id/notifications/visible-notification",
    });

    expect(response.statusCode, response.body).toBe(200);
  });

  it("refuses to archive a notification whose linked task is still pending", async () => {
    const employee = notificationMutationApp({ accessible: true, notificationType: "staff_availability_request", pending: true });

    const response = await employee.inject({
      headers: { cookie: "esse-session=employee-session" },
      method: "DELETE",
      url: "/api/salons/salon-id/notifications/visible-notification",
    });

    expect(response.statusCode, response.body).toBe(409);
  });
});
