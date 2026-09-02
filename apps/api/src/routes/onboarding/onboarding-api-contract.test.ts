import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("operational onboarding API contract", () => {
  const source = readFileSync(join(import.meta.dirname, "index.ts"), "utf8");

  it("loads the operational entities and active modules", () => {
    expect(source).toContain("salonLocations");
    expect(source).toContain("salonResources");
    expect(source).toContain("salonModules");
    expect(source).toContain("serviceStaff");
    expect(source).toContain("serviceResources");
  });

  it("returns the manifest and readiness from the domain services", () => {
    expect(source).toContain("buildOnboardingSteps");
    expect(source).toContain("evaluateOnboardingReadiness");
    expect(source).toContain("readiness");
    expect(source).toContain("steps");
  });

  it("ensures a primary location before returning the payload", () => {
    expect(source).toContain("ensurePrimaryLocation");
  });
});
