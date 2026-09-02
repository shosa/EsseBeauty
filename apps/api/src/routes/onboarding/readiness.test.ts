import { describe, expect, it } from "vitest";

import { evaluateOnboardingReadiness, type OnboardingReadinessInput } from "./readiness.js";

const valid: OnboardingReadinessInput = {
  enabledModules: new Set<string>(),
  identityComplete: true,
  locations: [{ active: true, id: "location-1" }],
  resources: [],
  services: [{ active: true, id: "service-1", onlineBookingEnabled: true }],
  staff: [{ active: true, id: "staff-1", locationId: "location-1" }],
  serviceStaff: [{ serviceId: "service-1", staffId: "staff-1" }],
  serviceResources: [],
};

describe("evaluateOnboardingReadiness", () => {
  it("accepts the minimum usable configuration", () => {
    expect(evaluateOnboardingReadiness(valid)).toMatchObject({ ready: true, issues: [] });
  });

  it("blocks a bookable service without active staff", () => {
    const result = evaluateOnboardingReadiness({ ...valid, serviceStaff: [] });
    expect(result.ready).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "SERVICE_WITHOUT_STAFF",
      entity_id: "service-1",
      step_key: "assignments",
    }));
  });

  it("blocks assigned resources whose location is inactive", () => {
    const result = evaluateOnboardingReadiness({
      ...valid,
      locations: [{ active: true, id: "location-1" }, { active: false, id: "location-2" }],
      resources: [{ active: true, id: "room-1", locationId: "location-2" }],
      serviceResources: [{ resourceId: "room-1", serviceId: "service-1" }],
    });
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "RESOURCE_LOCATION_INACTIVE" }));
  });

  it("marks the affected step as needing attention", () => {
    const result = evaluateOnboardingReadiness({ ...valid, locations: [] });
    expect(result.statuses.locations).toBe("needs_attention");
    expect(result.statuses.resources).toBe("not_started");
  });
});
