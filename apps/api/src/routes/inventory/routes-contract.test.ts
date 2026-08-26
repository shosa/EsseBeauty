import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { productValues } from "./catalog.js";

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
});
