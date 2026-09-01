import { describe, expect, it } from "vitest";
import { scheduledReviewTime } from "./review-policy.js";

describe("review request delay presets", () => {
  const completedAt = new Date("2026-09-01T14:30:00.000Z");

  it("supports immediate and elapsed-hour presets", () => {
    expect(scheduledReviewTime(completedAt, "immediate", "Europe/Rome").toISOString()).toBe("2026-09-01T14:30:00.000Z");
    expect(scheduledReviewTime(completedAt, "one_hour", "Europe/Rome").toISOString()).toBe("2026-09-01T15:30:00.000Z");
    expect(scheduledReviewTime(completedAt, "three_hours", "Europe/Rome").toISOString()).toBe("2026-09-01T17:30:00.000Z");
  });

  it("schedules calendar presets at 10:00 in the salon timezone", () => {
    expect(scheduledReviewTime(completedAt, "next_day", "Europe/Rome").toISOString()).toBe("2026-09-02T08:00:00.000Z");
    expect(scheduledReviewTime(completedAt, "two_days", "Europe/Rome").toISOString()).toBe("2026-09-03T08:00:00.000Z");
  });
});
