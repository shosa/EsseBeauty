import { MODULE_KEYS } from "@esse-beauty/feature-flags";
import { describe, expect, it } from "vitest";

import { buildDemoScenario } from "./build-demo-scenario.js";
import { validateDemoScenario } from "./validate-demo-scenario.js";

const options = {
  anchor: new Date("2026-09-02T10:00:00.000Z"),
  moduleKeys: Object.values(MODULE_KEYS),
  seed: 20260902,
};

describe("validateDemoScenario", () => {
  it("reports no errors for the canonical scenario", () => {
    const report = validateDemoScenario(buildDemoScenario(options));
    expect(report.errors).toEqual([]);
    expect(report.tableCounts.appointments).toBeGreaterThan(0);
  });

  it("catches a broken foreign key", () => {
    const scenario = buildDemoScenario(options);
    scenario.rows.appointments[0]!.customerId = "not-a-real-customer-id";
    const report = validateDemoScenario(scenario);
    expect(report.errors.some((error) => error.includes("customerId"))).toBe(true);
  });

  it("catches an overlapping appointment for the same staff member", () => {
    const scenario = buildDemoScenario(options);
    const [first, second] = scenario.rows.appointments;
    first!.status = "confirmed";
    second!.status = "confirmed";
    second!.staffId = first!.staffId;
    second!.resourceId = null;
    second!.startsAt = new Date(first!.startsAt.getTime() + 60_000);
    second!.endsAt = new Date(first!.endsAt.getTime() + 60_000);
    const report = validateDemoScenario(scenario);
    expect(report.errors.some((error) => error.includes("overlap"))).toBe(true);
  });

  it("catches a sale total that does not match its items", () => {
    const scenario = buildDemoScenario(options);
    scenario.rows.sales[0]!.totalCents = (scenario.rows.sales[0]!.totalCents ?? 0) + 1;
    const report = validateDemoScenario(scenario);
    expect(report.errors.some((error) => error.includes("does not match its item totals"))).toBe(true);
  });

  it("catches a stock balance that does not match its movement ledger", () => {
    const scenario = buildDemoScenario(options);
    scenario.rows.inventoryProducts[0]!.stockQuantity = (scenario.rows.inventoryProducts[0]!.stockQuantity ?? 0) + 5;
    const report = validateDemoScenario(scenario);
    expect(report.errors.some((error) => error.includes("does not match its movement ledger"))).toBe(true);
  });
});
