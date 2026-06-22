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
    expect(appointments).toContain("RESOURCE_CONFLICT");
    expect(publicBooking).toContain("qualifiedStaffIds");
    expect(publicBooking).toContain("availableResourceFor");
    expect(resources).toContain("serviceResources");
    expect(resources).toContain("appointments.resourceId");
  });
});
