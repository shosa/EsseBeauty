import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("sale checkout loyalty trigger", () => {
  const sales = readFileSync(join(process.cwd(), "src", "routes", "sales", "index.ts"), "utf8");

  it("awards loyalty for a completed sale via the cross-service event, not an in-process call", () => {
    expect(sales).toContain("scheduleSaleCompletedLoyaltyAward");
    expect(sales).not.toContain("awardSaleLoyalty");
  });

  it("expires a voided sale's loyalty points via the cross-service event", () => {
    expect(sales).toContain("scheduleSaleVoidedLoyaltyExpiry");
  });

  it("schedules the automatic review request after checkout, since booking's own PATCH refuses direct completion", () => {
    expect(sales).toContain("scheduleAutomaticReviewRequest");
  });
});
