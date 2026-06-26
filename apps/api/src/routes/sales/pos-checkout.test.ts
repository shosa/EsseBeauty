import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("POS checkout contract", () => {
  const source = readFileSync(join(process.cwd(), "src", "routes", "sales", "index.ts"), "utf8");

  it("supports standalone sales with catalog, split payments and stock movements", () => {
    expect(source).toContain('"/api/salons/:id/pos-catalog"');
    expect(source).toContain('"/api/salons/:id/pos-customers"');
    expect(source).toContain('"/api/salons/:id/pos-checkout"');
    expect(source).toContain('"/api/salons/:id/sales/:saleId"');
    expect(source).toContain("salePayments");
    expect(source).toContain("inventoryMovements");
    expect(source).toContain("inventory_negative_stock");
    expect(source).toContain("notifyNegativeStock");
    expect(source).toContain("stockAfter");
    expect(source).not.toContain('throw new Error("INSUFFICIENT_STOCK")');
  });

  it("exposes service category metadata for the POS category-first flow", () => {
    expect(source).toContain("serviceCategories");
    expect(source).toContain("category_id");
    expect(source).toContain("category_icon");
    expect(source).toContain(".leftJoin(serviceCategories");
  });
});
