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
});
