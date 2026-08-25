import { describe, expect, it } from "vitest";

import { MODULE_KEYS } from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import {
  APP_DOMAINS,
  APP_REGISTRY,
  appForPath,
  browserTitleForPath,
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
      "cabins",
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
    expect(appForPath("/loyalty/rewards/new")?.key).toBe("loyalty");
    expect(appForPath("/services/new")?.key).toBe("services");
    expect(appForPath("/staff/manage")?.key).toBe("staff");
    expect(appForPath("/packages")?.key).toBe("packages");
    expect(appForPath("/cabins")?.key).toBe("cabins");
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

  it("hides the calendar creation tab from view-only users", () => {
    expect(
      contextTabsForPath(
        "/calendar",
        new Set([PERMISSION_KEYS.CALENDAR_VIEW_OWN]),
      ).map((tab) => tab.label),
    ).toEqual(["Agenda"]);
  });

  it("shows only settings tabs permitted for the user", () => {
    expect(
      contextTabsForPath(
        "/settings/users",
        new Set([PERMISSION_KEYS.SETTINGS_USERS]),
      ).map((tab) => tab.label),
    ).toEqual(["Team e accessi"]);
  });

  it("uses correct Italian labels and provides contextual tabs", () => {
    expect(APP_REGISTRY.find((app) => app.key === "accounting")?.label).toBe("Contabilità");
    expect(APP_REGISTRY.find((app) => app.key === "loyalty")?.label).toBe("Fedeltà");
    expect(APP_REGISTRY.find((app) => app.key === "audit")?.label).toBe("Attività");
    expect(contextTabsForPath("/calendar", new Set(Object.values(PERMISSION_KEYS))).map((tab) => tab.label)).toEqual([
      "Agenda",
      "Nuovo appuntamento",
    ]);
  });

  it("builds contextual browser titles from the active app", () => {
    expect(browserTitleForPath("/")).toBe("HOME | EsseBeauty");
    expect(browserTitleForPath("/sales")).toBe("CASSA | EsseBeauty");
    expect(browserTitleForPath("/loyalty/rewards/new")).toBe("FEDELTÀ | EsseBeauty");
    expect(browserTitleForPath("/apps")).toBe("APPS | EsseBeauty");
    expect(browserTitleForPath("/unknown")).toBe("EsseBeauty");
  });
});
