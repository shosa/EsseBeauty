import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("review collection management API", () => {
  const routes = readFileSync(join(process.cwd(), "src", "routes", "reviews", "index.ts"), "utf8");

  it("exposes settings, collection, manual send and confirmed resend", () => {
    expect(routes).toContain('reviews/request-settings"');
    expect(routes).toContain('reviews/collection"');
    expect(routes).toContain('/send"');
    expect(routes).toContain('/resend"');
    expect(routes).toContain("scheduleReviewRequest");
    expect(routes).toContain("RESEND_CONFIRMATION_REQUIRED");
  });
});
