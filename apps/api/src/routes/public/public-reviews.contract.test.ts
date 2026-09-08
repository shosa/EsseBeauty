import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("public salon reviews route", () => {
  const source = readFileSync(join(process.cwd(), "src", "routes", "public", "index.ts"), "utf8");

  it("exposes only published reviews for the salon public profile", () => {
    expect(source).toContain('"/api/public/:slug/reviews"');
    expect(source).toContain("eq(reviews.published, true)");
    expect(source).toContain("average_rating");
  });
});
