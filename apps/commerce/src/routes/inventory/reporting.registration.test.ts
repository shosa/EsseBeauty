import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("inventory reporting registration", () => {
  it("registers reporting routes without owning the catalog summary endpoint", () => {
    const inventoryIndexSource = readFileSync(join(process.cwd(), "src", "routes", "inventory", "index.ts"), "utf8");
    const reportingSource = readFileSync(join(process.cwd(), "src", "routes", "inventory", "reporting.ts"), "utf8");

    expect(inventoryIndexSource).toContain("registerInventoryReportingRoutes(app)");
    expect(reportingSource).toContain("/api/salons/:id/inventory/analytics/summary");
    expect(reportingSource).not.toContain('"/api/salons/:id/inventory/summary"');
  });
});
