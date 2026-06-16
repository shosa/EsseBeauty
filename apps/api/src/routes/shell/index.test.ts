import { describe, expect, it } from "vitest";

import {
  buildSearchResponse,
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
        id: "n1",
        type: "inventory_low_stock",
        title: "Scorta bassa",
        body: null,
        payload: { href: "/inventory/p1" },
        readAt: null,
        createdAt: new Date("2026-06-16T08:00:00Z"),
      }),
    ).toEqual({
      id: "n1",
      type: "inventory_low_stock",
      title: "Scorta bassa",
      body: null,
      href: "/inventory/p1",
      read_at: null,
      created_at: "2026-06-16T08:00:00.000Z",
      unread: true,
    });
  });
});
