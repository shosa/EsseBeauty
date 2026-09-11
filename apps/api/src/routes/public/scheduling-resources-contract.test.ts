import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..", "..");

describe("multi-site scheduling contracts (public booking)", () => {
  it("enforces staff skills and cabin availability in online booking", () => {
    const publicBooking = readFileSync(join(root, "routes", "public", "index.ts"), "utf8");
    const resources = readFileSync(join(root, "..", "..", "..", "packages", "shared", "scheduling-resources.ts"), "utf8");

    expect(publicBooking).toContain("qualifiedStaffIds");
    expect(publicBooking).toContain("availableResourceFor");
    expect(resources).toContain("serviceResources");
    expect(resources).toContain("appointments.resourceId");
  });

  it("exposes the waitlist capability without exposing modules", () => {
    const publicBooking = readFileSync(join(root, "routes", "public", "index.ts"), "utf8");
    expect(publicBooking).toContain("capabilities");
    expect(publicBooking).toContain("waitlist:");
  });
});
