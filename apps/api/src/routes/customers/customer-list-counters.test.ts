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

  it("manages WhatsApp marketing consent inside the tenant with clients.edit", () => {
    expect(source).toContain('communication-consents/whatsapp-marketing');
    expect(source).toContain('{ preHandler: editGuard }');
    expect(source).toContain('eq(communicationConsents.salonId, request.salonId)');
    expect(source).toContain('eq(customers.salonId, request.salonId)');
    expect(source).toContain('by_user_id: request.user.id');
    expect(source).toContain('status: request.body.status');
  });
});
