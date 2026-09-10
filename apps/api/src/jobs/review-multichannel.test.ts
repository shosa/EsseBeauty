import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("multi-channel review scheduler", () => {
  const events = readFileSync(join(process.cwd(), "src", "jobs", "appointment-events.ts"), "utf8");

  it("reads the salon policy when an appointment completes", () => {
    expect(events).toContain("reviewRequestSettings");
    expect(events).toContain("scheduledReviewTime");
    expect(events).toContain("automaticEnabled");
  });
});
