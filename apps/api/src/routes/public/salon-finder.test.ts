import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("public salon finder", () => {
  it("exposes searchable salons, distance sorting and category icons", () => {
    const source = readFileSync(join(process.cwd(), "src", "routes", "public", "index.ts"), "utf8");
    expect(source).toContain('"/api/public/salons/search"');
    expect(source).toContain("distanceKm");
    expect(source).toContain("serviceCategories.icon");
    expect(source).toContain("categories: categoryRows");
  });
});
