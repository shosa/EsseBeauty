import { describe, expect, it } from "vitest";

import { firstActionableStep } from "./app/onboarding/types";

describe("onboarding navigation", () => {
  it("resumes at the first incomplete required step", () => {
    expect(firstActionableStep([
      { key: "identity", required: true, status: "complete" },
      { key: "locations", required: true, status: "needs_attention" },
      { key: "review", required: true, status: "not_started" },
    ])).toBe("locations");
  });

  it("falls back to review when every required setup step is complete", () => {
    expect(firstActionableStep([
      { key: "identity", required: true, status: "complete" },
      { key: "review", required: true, status: "complete" },
    ])).toBe("review");
  });
});
