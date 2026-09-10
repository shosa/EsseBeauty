import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { productValues } from "./catalog.js";
import { parseDocumentDateFilter } from "./documents.js";
import { previewWarehouseImport } from "./counts.js";

const routeRoot = resolve(import.meta.dirname);
const catalogSource = readFileSync(resolve(routeRoot, "catalog.ts"), "utf8");
const countsSource = readFileSync(resolve(routeRoot, "counts.ts"), "utf8");
const documentsSource = readFileSync(resolve(routeRoot, "documents.ts"), "utf8");
const reportingSource = readFileSync(resolve(routeRoot, "reporting.ts"), "utf8");
const indexSource = readFileSync(resolve(routeRoot, "index.ts"), "utf8");
const numberingPath = resolve(routeRoot, "document-number.ts");
const numberingSource = existsSync(numberingPath) ? readFileSync(numberingPath, "utf8") : "";

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

  test("maps rich product master data without collapsing purchase cost and sale price", () => {
    expect(productValues({
      barcode: "800123",
      brand: "Esse",
      category: "Creme",
      cost_cents: 800,
      description: "Crema viso retail",
      manufacturer_code: "CRM-VISO-50",
      name: "Crema viso",
      notes: "Esporre vicino alla cassa",
      storage_location: "Scaffale A2",
      unit_price_cents: 1500,
      vat_rate_basis_points: 2200,
    }, "salon-1")).toMatchObject({
      barcode: "800123",
      brand: "Esse",
      category: "Creme",
      costCents: 800,
      description: "Crema viso retail",
      manufacturerCode: "CRM-VISO-50",
      name: "Crema viso",
      notes: "Esporre vicino alla cassa",
      storageLocation: "Scaffale A2",
      unitPriceCents: 1500,
      vatRateBasisPoints: 2200,
    });
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

  test("generates short progressive references for warehouse documents", () => {
    expect(numberingSource).toContain("nextInventoryDocumentNumber");
    expect(numberingSource).toContain("padStart(4");
    expect(numberingSource).toContain("pg_advisory_xact_lock");
    expect(documentsSource).not.toContain("`WH-${randomUUID()}`");
    expect(indexSource).not.toContain("`ADJ-${randomUUID()}`");
  });

  test("exposes tenant-scoped count sessions and a write-free import preview", () => {
    for (const route of ["/counts", "/counts/:countId", "/counts/:countId/post", "/imports/preview"]) {
      expect(`${indexSource}${countsSource}`).toContain(route);
    }
    const preview = previewWarehouseImport({
      mapping: { barcode: "code", quantity: "qty" },
      rows: [{ code: "8001", qty: "2" }, { code: "missing", qty: "1" }],
    }, [{ barcode: "8001", id: "product-1", itemType: "resale", name: "Crema", sku: "CRM-1" }]);
    expect(preview).toMatchObject({ matched: 1, unmatched: 1 });
    expect(preview.rows[0]).toMatchObject({ product_id: "product-1", quantity: 2 });
    expect(preview.errors).toEqual([{ field: "barcode", line: 2, message: "Product not found" }]);
  });

  test("exposes reporting metrics, operational reports and scoped filters", () => {
    for (const metric of ["stock_value_cents", "low_stock_count", "draft_documents", "purchase_total_cents", "expense_total_cents", "asset_value_cents"]) {
      expect(reportingSource).toContain(metric);
    }
    for (const report of ["valuation", "consumption", "purchases", "waste", "suppliers"]) {
      expect(reportingSource).toContain(report);
    }
    for (const filter of ["date_from", "date_to", "supplier_id", "category", "item_type"]) {
      expect(reportingSource).toContain(filter);
    }
    for (const route of ["/summary", "/expenses", "/assets", "/reports"]) {
      expect(`${reportingSource}${indexSource}`).toContain(route);
    }
  });
});
