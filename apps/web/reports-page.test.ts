import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { APP_REGISTRY, contextTabsForPath } from "./app/(dashboard)/_components/app-registry.js";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

const reportsPage = readFileSync(join(process.cwd(), "app", "(dashboard)", "reports", "page.tsx"), "utf8");

describe("reports enterprise restyle", () => {
  it("owns real topbar tabs for every report section", () => {
    const allPermissions = new Set(Object.values(PERMISSION_KEYS));

    expect(contextTabsForPath("/reports/trends", allPermissions).map((tab) => [tab.label, tab.href])).toEqual([
      ["Panoramica", "/reports"],
      ["Operatori", "/reports/staff"],
      ["Servizi", "/reports/services"],
      ["Andamento & confronti", "/reports/trends"],
      ["Esporta", "/reports/export"],
    ]);
  });

  it("hides the staff, services, trends and export tabs from view-own-only users", () => {
    expect(contextTabsForPath("/reports", new Set([PERMISSION_KEYS.REPORTS_VIEW_OWN])).map((tab) => tab.label)).toEqual(["Panoramica"]);
  });

  it("keeps the Report label and STAFF_PERF module gate", () => {
    const reports = APP_REGISTRY.find((app) => app.key === "reports");
    expect(reports?.label).toBe("Report");
    expect(reports?.tabs?.map((tab) => tab.href)).toEqual(["/reports", "/reports/staff", "/reports/services", "/reports/trends", "/reports/export"]);
  });

  it("compares against the previous period and drills into staff/service detail", () => {
    expect(reportsPage).toContain("compareEnabled");
    expect(reportsPage).toContain("shiftRangeBack");
    expect(reportsPage).toContain("DeltaChip");
    expect(reportsPage).toContain("setSelectedStaff");
    expect(reportsPage).toContain("setSelectedService");
    expect(reportsPage).toContain("dayParts");
  });

  it("exports the register as Excel with a live summary preview", () => {
    expect(reportsPage).toContain("/reports/export");
    expect(reportsPage).toContain("Anteprima riepilogo");
  });
});
