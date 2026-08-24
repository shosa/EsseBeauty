import { describe, expect, it } from "vitest";

import { MODULE_KEYS } from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import {
  APP_DOMAINS,
  APP_REGISTRY,
  appForPath,
  contextTabsForPath,
  visibleApps,
  visibleQuickActions,
} from "./app/(dashboard)/_components/app-registry.js";

describe("app-oriented dashboard registry", () => {
  it("groups every dashboard destination into the four approved domains", () => {
    expect(APP_DOMAINS.map((domain) => domain.key)).toEqual([
      "day",
      "relationships",
      "growth",
      "control",
    ]);
    expect(APP_REGISTRY.map((app) => app.key)).toEqual(expect.arrayContaining([
      "home",
      "calendar",
      "sales",
      "clients",
      "staff",
      "services",
      "vouchers",
      "marketing",
      "loyalty",
      "reviews",
      "waitlist",
      "inventory",
      "accounting",
      "reports",
      "settings",
    ]));
  });

  it("resolves nested paths to their owning app using the most specific route", () => {
    expect(appForPath("/calendar/appointments/new")?.key).toBe("calendar");
    expect(appForPath("/settings/loyalty/rewards/new")?.key).toBe("loyalty");
    expect(appForPath("/settings/services/new")?.key).toBe("services");
    expect(appForPath("/settings/users/invite")?.key).toBe("settings");
  });

  it("hides optional apps unless their feature is enabled", () => {
    const allPermissions = new Set(Object.values(PERMISSION_KEYS));
    const withoutModules = visibleApps(new Set(), allPermissions);
    expect(withoutModules.some((app) => app.key === "inventory")).toBe(false);
    expect(withoutModules.some((app) => app.key === "calendar")).toBe(true);

    const withInventory = visibleApps(new Set([MODULE_KEYS.INVENTORY]), allPermissions);
    expect(withInventory.some((app) => app.key === "inventory")).toBe(true);
  });

  it("hides apps when the user lacks every required permission", () => {
    const appKeys = visibleApps(
      new Set(),
      new Set([PERMISSION_KEYS.CLIENTS_VIEW]),
    ).map((app) => app.key);

    expect(appKeys).toContain("clients");
    expect(appKeys).not.toContain("calendar");
    expect(appKeys).not.toContain("sales");
  });

  it("hides quick actions without their stricter write permission", () => {
    const calendar = appForPath("/calendar");

    expect(
      visibleQuickActions(
        calendar,
        new Set([PERMISSION_KEYS.CALENDAR_VIEW_OWN]),
      ),
    ).toEqual([]);
    expect(
      visibleQuickActions(
        calendar,
        new Set([PERMISSION_KEYS.CALENDAR_MANAGE_OWN]),
      ).map((action) => action.href),
    ).toEqual(["/calendar/appointments/new"]);
  });

  it("uses correct Italian labels and provides contextual tabs", () => {
    expect(APP_REGISTRY.find((app) => app.key === "accounting")?.label).toBe("Contabilità");
    expect(APP_REGISTRY.find((app) => app.key === "loyalty")?.label).toBe("Fedeltà");
    expect(APP_REGISTRY.find((app) => app.key === "audit")?.label).toBe("Attività");
    expect(contextTabsForPath("/calendar").map((tab) => tab.label)).toEqual([
      "Agenda",
      "Nuovo appuntamento",
    ]);
  });
});
