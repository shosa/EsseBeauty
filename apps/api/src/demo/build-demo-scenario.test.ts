import { MODULE_KEYS } from "@esse-beauty/feature-flags";
import { describe, expect, it } from "vitest";

import { buildDemoScenario } from "./build-demo-scenario.js";

const options = {
  anchor: new Date("2026-09-02T10:00:00.000Z"),
  moduleKeys: Object.values(MODULE_KEYS),
  seed: 20260902,
};

describe("buildDemoScenario", () => {
  it("builds a busy deterministic salon with complete core relationships", () => {
    const scenario = buildDemoScenario(options);
    const repeated = buildDemoScenario(options);

    expect(scenario).toEqual(repeated);
    expect(scenario.rows.salons).toHaveLength(1);
    expect(scenario.rows.salonLocations).toHaveLength(3);
    expect(scenario.rows.salonResources.length).toBeGreaterThanOrEqual(12);
    expect(scenario.rows.staff.length).toBeGreaterThanOrEqual(14);
    expect(scenario.rows.services.length).toBeGreaterThanOrEqual(48);
    expect(scenario.rows.customers.length).toBeGreaterThanOrEqual(400);
    expect(scenario.rows.inventoryProducts.length).toBeGreaterThanOrEqual(100);
    expect(scenario.rows.appointments.length).toBeGreaterThanOrEqual(1_500);
    expect(scenario.rows.sales.length).toBeGreaterThanOrEqual(500);

    const enabledModules = scenario.rows.salonModules.filter((row) => row.enabled).map((row) => row.moduleKey);
    expect(new Set(enabledModules)).toEqual(new Set(options.moduleKeys));

    const assignments = new Set(
      scenario.rows.serviceStaff.map((row) => `${row.serviceId}:${row.staffId}`),
    );
    for (const appointment of scenario.rows.appointments) {
      expect(assignments.has(`${appointment.serviceId}:${appointment.staffId}`)).toBe(true);
      expect(appointment.endsAt.getTime()).toBeGreaterThan(appointment.startsAt.getTime());
    }
  });

  it("keeps future appointments within a rolling twelve-month horizon", () => {
    const scenario = buildDemoScenario(options);
    const future = scenario.rows.appointments.filter((row) => row.startsAt > options.anchor);
    const horizon = new Date(options.anchor);
    horizon.setUTCFullYear(horizon.getUTCFullYear() + 1);

    expect(future.length).toBeGreaterThan(700);
    expect(Math.max(...future.map((row) => row.startsAt.getTime())))
      .toBeLessThanOrEqual(horizon.getTime());
  });

  it("reconciles sales and warehouse balances", () => {
    const scenario = buildDemoScenario(options);
    const itemTotals = new Map<string, number>();
    const stockTotals = new Map<string, number>();

    for (const item of scenario.rows.saleItems) {
      itemTotals.set(item.saleId, (itemTotals.get(item.saleId) ?? 0) + item.totalCents);
    }
    for (const sale of scenario.rows.sales) {
      expect(itemTotals.get(sale.id!)).toBe(sale.totalCents);
    }
    for (const movement of scenario.rows.inventoryMovements) {
      stockTotals.set(movement.productId, (stockTotals.get(movement.productId) ?? 0) + movement.delta);
    }
    for (const product of scenario.rows.inventoryProducts) {
      expect(stockTotals.get(product.id!)).toBe(product.stockQuantity);
    }
  });
});
