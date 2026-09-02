import { describe, expect, it } from "vitest";

import { MODULE_KEYS } from "@esse-beauty/feature-flags";

import { buildOnboardingSteps } from "./definition.js";

describe("buildOnboardingSteps", () => {
  it("keeps one location and omits resources without multi-location", () => {
    const steps = buildOnboardingSteps(new Set(), {});
    expect(steps.map((step) => step.key)).toEqual([
      "identity", "locations", "services", "staff", "assignments", "review",
    ]);
    expect(steps.find((step) => step.key === "locations")?.mode).toBe("single");
  });

  it("adds resources and multiple-location mode for multi_location", () => {
    const steps = buildOnboardingSteps(new Set([MODULE_KEYS.MULTI_LOCATION]), {});
    expect(steps.map((step) => step.key)).toEqual([
      "identity", "locations", "resources", "services", "staff", "assignments", "review",
    ]);
    expect(steps.find((step) => step.key === "locations")?.mode).toBe("multiple");
  });

  it("does not create empty steps for modules with usable defaults", () => {
    const steps = buildOnboardingSteps(new Set([MODULE_KEYS.REMINDERS, MODULE_KEYS.INVENTORY]), {});
    expect(steps.some((step) => step.module_key === MODULE_KEYS.REMINDERS)).toBe(false);
    expect(steps.some((step) => step.module_key === MODULE_KEYS.INVENTORY)).toBe(false);
  });
});
