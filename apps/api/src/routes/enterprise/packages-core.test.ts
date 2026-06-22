import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("service packages core integration", () => {
  const enterprise = readFileSync(join(process.cwd(), "src", "routes", "enterprise", "index.ts"), "utf8");
  const sales = readFileSync(join(process.cwd(), "src", "routes", "sales", "index.ts"), "utf8");

  it("tracks package items, customer balances and transactional checkout usage", () => {
    expect(enterprise).toContain("servicePackageItems");
    expect(enterprise).toContain("customerPackageItemBalances");
    expect(enterprise).toContain('"/api/salons/:id/customer-service-packages"');
    expect(sales).toContain("consumePackageItems");
    expect(sales).toContain("PACKAGE_COVERAGE_INVALID");
    expect(sales).toContain("packageQuantity");
    expect(sales).toContain("servicePackageUsages");
  });
});
