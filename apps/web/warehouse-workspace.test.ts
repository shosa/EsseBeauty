import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

  it("keeps future operational actions visibly unavailable", () => {
    const workspace = readFileSync(join(dashboard, "inventory", "warehouse-workspace.tsx"), "utf8");
    expect(workspace).toContain('disabled title="Disponibile nei prossimi incrementi"');
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
});
