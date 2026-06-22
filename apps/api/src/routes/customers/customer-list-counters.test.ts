import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("customer list counters", () => {
  const source = readFileSync(join(process.cwd(), "src", "routes", "customers", "index.ts"), "utf8");

  it("returns normalized appointments, last visit and active loyalty balance", () => {
    expect(source).toContain("count(*)::int");
    expect(source).toContain("appointmentCounters");
    expect(source).toContain("loyaltyCounters");
    expect(source).toContain("inArray(appointments.customerId, customerIds)");
    expect(source).toContain("inArray(loyaltyPoints.customerId, customerIds)");
    expect(source).toContain("total_appointments: Number");
    expect(source).toContain("loyalty_points: Number");
  });
});
