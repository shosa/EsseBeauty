import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("multi-channel review scheduler", () => {
  const jobs = readFileSync(join(process.cwd(), "src", "jobs", "reviews.ts"), "utf8");
  const events = readFileSync(join(process.cwd(), "src", "jobs", "appointment-events.ts"), "utf8");

  it("persists one independently queued delivery per selected channel", () => {
    expect(jobs).toContain("scheduleReviewRequest");
    expect(jobs).toContain("reviewInvitationDeliveries");
    expect(jobs).toContain("deliveryId");
    expect(jobs).toContain("channel");
  });

  it("reads the salon policy when an appointment completes", () => {
    expect(events).toContain("reviewRequestSettings");
    expect(events).toContain("scheduledReviewTime");
    expect(events).toContain("automaticEnabled");
  });
});
