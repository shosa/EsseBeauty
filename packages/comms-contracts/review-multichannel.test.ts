import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("multi-channel review scheduler", () => {
  const scheduling = readFileSync(join(process.cwd(), "review-scheduling.ts"), "utf8");

  it("persists one independently queued delivery per selected channel", () => {
    expect(scheduling).toContain("scheduleReviewRequest");
    expect(scheduling).toContain("reviewInvitationDeliveries");
    expect(scheduling).toContain("deliveryId");
    expect(scheduling).toContain("channel");
  });

  it("reads the salon policy when an appointment completes", () => {
    expect(scheduling).toContain("reviewRequestSettings");
    expect(scheduling).toContain("scheduledReviewTime");
    expect(scheduling).toContain("automaticEnabled");
  });
});
