import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { productValues } from "./catalog.js";
import { parseDocumentDateFilter } from "./documents.js";

const routeRoot = resolve(import.meta.dirname);
const catalogSource = readFileSync(resolve(routeRoot, "catalog.ts"), "utf8");
const documentsSource = readFileSync(resolve(routeRoot, "documents.ts"), "utf8");
const indexSource = readFileSync(resolve(routeRoot, "index.ts"), "utf8");

describe("warehouse route contract", () => {
  test("registers the warehouse catalog and document routes with tenant-scoped inventory guards", () => {
    for (const route of [
      "/summary",
      "/products",
      "/suppliers",
      "/documents",
      "/documents/:documentId/post",
      "/documents/:documentId/reverse",
    ]) {
      expect(`${catalogSource}${documentsSource}${indexSource}`).toContain(route);
    }
    expect(`${catalogSource}${documentsSource}`).toContain("PERMISSION_KEYS.INVENTORY_MANAGE");
    expect(`${catalogSource}${documentsSource}`).toContain("request.salonId");
    expect(indexSource).toContain("postWarehouseDocument");
  });

  test("does not permit catalog edits to bypass the warehouse ledger", () => {
    const changes = productValues({
      average_cost_cents: 100,
      last_cost_cents: 120,
      name: "Crema",
      stock_quantity: 50,
    }, "salon-1", true);

    expect(changes).toEqual({ name: "Crema" });
  });

  test("defaults equipment and expense products to non-stock non-sellable", () => {
    expect(productValues({ item_type: "equipment", name: "Lampada" }, "salon-1")).toMatchObject({ itemType: "equipment", trackStock: false, sellable: false });
    expect(productValues({ item_type: "expense", name: "Servizio" }, "salon-1")).toMatchObject({ itemType: "expense", trackStock: false, sellable: false });
    expect(productValues({ item_type: "equipment", name: "Tracked", track_stock: true, sellable: true }, "salon-1")).toMatchObject({ trackStock: true, sellable: true });
  });

  test("supports validated date bounds on document listing", () => {
    expect(documentsSource).toContain("date_from");
    expect(documentsSource).toContain("date_to");
    expect(documentsSource).toContain("gte(inventoryDocuments.documentDate");
    expect(documentsSource).toContain("lte(inventoryDocuments.documentDate");
    expect(documentsSource).toContain("INVALID_DATE_FILTER");
    expect(parseDocumentDateFilter("2026-08-26", false)?.toISOString()).toBe("2026-08-26T00:00:00.000Z");
    expect(parseDocumentDateFilter("2026-08-26", true)?.toISOString()).toBe("2026-08-26T23:59:59.999Z");
  });
});
