import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mapWarehouseLineErrors } from "./app/(dashboard)/inventory/warehouse-api";
import { normalizeLineForItemType, parsePastedRows, resolveProductReference } from "./app/(dashboard)/inventory/_components/WarehouseOperationDialog";

const dashboard = join(process.cwd(), "app", "(dashboard)");

describe("warehouse workspace", () => {
  it("renames Inventory and exposes every operational area", () => {
    const shell = readFileSync(join(dashboard, "_components", "DashboardShell.tsx"), "utf8");
    const registry = readFileSync(join(dashboard, "_components", "app-registry.ts"), "utf8");
    const workspace = readFileSync(join(dashboard, "inventory", "warehouse-workspace.tsx"), "utf8");
    expect(`${shell}${registry}`).toContain('label: "Magazzino"');
    for (const label of ["Panoramica", "Articoli", "Movimenti", "Documenti", "Inventari", "Fornitori", "Spese e attrezzature", "Analisi"]) {
      expect(workspace).toContain(label);
    }
    for (const action of ["Carico", "Scarico", "Inventario", "Importa"]) expect(workspace).toContain(action);
  });

  it("keeps the required quick actions live", () => {
    const workspace = readFileSync(join(dashboard, "inventory", "warehouse-workspace.tsx"), "utf8");
    for (const action of ["Carico", "Scarico", "Inventario", "Importa"]) expect(workspace).toContain(action);
    expect(workspace).not.toContain('disabled title="Disponibile nei prossimi incrementi"');
  });

  it("matches the API strict low-stock rule and exposes complete tab semantics", () => {
    const workspace = readFileSync(join(dashboard, "inventory", "warehouse-workspace.tsx"), "utf8");
    expect(workspace).toContain("stockQuantity < item.lowStockThreshold");
    expect(workspace).toContain("aria-controls={panelId}");
    expect(workspace).toContain('role="tabpanel"');
    expect(workspace).toContain("aria-live");
  });

  it("wires the dense operational components and bulk document vocabulary", () => {
    const workspace = readFileSync(join(dashboard, "inventory", "warehouse-workspace.tsx"), "utf8");
    const operationDialog = readFileSync(join(dashboard, "inventory", "_components", "WarehouseOperationDialog.tsx"), "utf8");
    for (const component of ["WarehouseOverview", "WarehouseProducts", "WarehouseDocuments", "WarehouseOperationDialog", "WarehouseSuppliers"]) {
      expect(workspace).toContain(component);
    }
    for (const field of ["Riferimento documento", "Fornitore", "Quantità", "Costo", "IVA", "Destinazione"]) {
      expect(operationDialog).toContain(field);
    }
    expect(operationDialog).toContain("Incolla righe");
    expect(operationDialog).toContain("Salva bozza");
    expect(operationDialog).toContain("Registra documento");
  });

  it("resolves product selection by id, SKU, or name", () => {
    const products = [{ id: "p1", name: "Crema", sku: "CRM-01" }] as never[];
    expect(resolveProductReference(products as Parameters<typeof resolveProductReference>[0], "CRM-01")?.id).toBe("p1");
    expect(resolveProductReference(products as Parameters<typeof resolveProductReference>[0], "Crema")?.id).toBe("p1");
  });

  it("maps pasted product rows and rejects malformed numeric values", () => {
    const products = [{ id: "p1", name: "Crema", sku: "CRM-01", itemType: "resale", lastCostCents: 100 }] as never[];
    const result = parsePastedRows("CRM-01\t2\t120\t2200\nCrema\tbad\t120\t2200", products as Parameters<typeof parsePastedRows>[1], "purchase");
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.product_id).toBe("p1");
    expect(result.errors[0]?.message).toContain("Quantità");
  });

  it("normalizes expense rows to non-stock lines", () => {
    const line = { key: "line-1", product_id: "p1", description: "Servizio", item_type: "resale", quantity: 1, unit_cost_cents: 100, discount_cents: 0, tax_rate_basis_points: 0, stock_delta: 1, destination: "stock" } as Parameters<typeof normalizeLineForItemType>[0];
    expect(normalizeLineForItemType(line, "expense")).toMatchObject({ product_id: null, stock_delta: 0, item_type: "expense" });
  });

  it("maps API line errors back to stable editable row keys and fields", () => {
    const lines = [{ key: "stable-1" }, { key: "stable-2" }] as Parameters<typeof mapWarehouseLineErrors>[1];
    const result = mapWarehouseLineErrors({ line_errors: [{ line: 2, field: "unit_cost_cents", message: "Costo obbligatorio" }] }, lines);
    expect(result).toEqual({ "stable-2": { unit_cost_cents: "Costo obbligatorio" } });
  });
});
