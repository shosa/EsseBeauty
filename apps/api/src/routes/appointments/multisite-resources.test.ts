import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..", "..");

describe("multi-site scheduling contracts", () => {
  it("enforces staff skills and cabin availability in manual and online booking", () => {
    const appointments = readFileSync(join(root, "routes", "appointments", "index.ts"), "utf8");
    const publicBooking = readFileSync(join(root, "routes", "public", "index.ts"), "utf8");
    const resources = readFileSync(join(root, "lib", "scheduling-resources.ts"), "utf8");

    expect(appointments).toContain("STAFF_NOT_QUALIFIED");
    expect(appointments).toContain("RESOURCE_OCCUPIED");
    expect(publicBooking).toContain("qualifiedStaffIds");
    expect(publicBooking).toContain("availableResourceFor");
    expect(resources).toContain("serviceResources");
    expect(resources).toContain("appointments.resourceId");
    expect(appointments).toContain("resource_name");
    expect(appointments).toContain("salonResources");
    expect(appointments).toContain("force_conflicts");
    expect(appointments).toContain("resource_id");
    expect(appointments).toContain("STAFF_AVAILABILITY_BLOCK");
    expect(appointments).toContain("RESOURCE_OCCUPIED");
    expect(appointments).toContain("SALON_CLOSED");
    expect(appointments).toContain("INVALID_APPOINTMENT_STATUS_TRANSITION");
    const backfill = readFileSync(join(root, "..", "..", "..", "packages", "db", "migrations", "0022_backfill_appointment_resources.sql"), "utf8");
    expect(backfill).toContain('UPDATE "appointments"');
    expect(backfill).toContain('HAVING count(*) = 1');
  });
});
