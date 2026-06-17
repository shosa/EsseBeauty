import { describe, expect, it } from "vitest";

import {
  buildSearchResponse,
  normalizeShellPreferences,
  normalizeSearchQuery,
  notificationToDto,
} from "./index.js";

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
});
