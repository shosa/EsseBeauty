import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const inventoryRoot = join(process.cwd(), "app", "(dashboard)", "inventory");

const routes = [
  ["suppliers", "SupplierWorkspace"],
  ["documents", "DocumentWorkspace"],
  ["counts", "CountWorkspace"],
  ["analytics", "AnalyticsWorkspace"],
  ["expenses", "ExpenseWorkspace"],
  ["assets", "AssetWorkspace"],
] as const;

describe("inventory workspace routes", () => {
  it("creates a real page for each modular warehouse workspace", () => {
    for (const [route, component] of routes) {
      const pagePath = join(inventoryRoot, route, "page.tsx");
      expect(existsSync(pagePath), `${route} page exists`).toBe(true);

      const source = readFileSync(pagePath, "utf8");
      expect(source).toContain(`import { ${component} }`);
      expect(source).toContain(`<${component} />`);
      expect(source).not.toContain("WarehouseWorkspace");
    }
  });

  it("uses distinct exported workspace components", () => {
    for (const [, component] of routes) {
      const workspacePath = join(inventoryRoot, "_workspaces", `${component}.tsx`);
      expect(existsSync(workspacePath), `${component} exists`).toBe(true);

      const source = readFileSync(workspacePath, "utf8");
      expect(source).toContain(`export function ${component}()`);
      expect(source).toContain("PageHeader");
      expect(source).toMatch(/EmptyState|WarehouseDocuments|WarehouseCounts|WarehouseAnalytics|WarehouseSuppliers/);
    }
  });

  it("gives suppliers an independent workspace contract", () => {
    const routeSource = readFileSync(join(inventoryRoot, "suppliers", "page.tsx"), "utf8");
    const workspaceSource = readFileSync(join(inventoryRoot, "_workspaces", "SupplierWorkspace.tsx"), "utf8");

    expect(routeSource).not.toContain("WarehouseWorkspace");
    expect(workspaceSource).toContain("Nuovo fornitore");
    expect(workspaceSource).toContain("query");
    expect(workspaceSource).toContain("activeFilter");
    expect(workspaceSource).toContain("SupplierFormDialog");
    expect(workspaceSource).toContain("warehouseApi.getSuppliers");
    expect(workspaceSource).not.toContain("WarehouseWorkspace");
  });

  it("gives documents counts and analytics independent loading contracts", () => {
    const documentSource = readFileSync(join(inventoryRoot, "_workspaces", "DocumentWorkspace.tsx"), "utf8");
    const countSource = readFileSync(join(inventoryRoot, "_workspaces", "CountWorkspace.tsx"), "utf8");
    const analyticsSource = readFileSync(join(inventoryRoot, "_workspaces", "AnalyticsWorkspace.tsx"), "utf8");

    expect(documentSource).toContain("warehouseApi.getDocuments");
    expect(documentSource).toContain("WarehouseDocuments");
    expect(documentSource).toContain("WarehouseDocumentViewer");
    expect(documentSource).not.toContain("WarehouseWorkspace");
    expect(countSource).toContain("warehouseApi.getCounts");
    expect(countSource).toContain("WarehouseCounts");
    expect(countSource).not.toContain("WarehouseWorkspace");
    expect(analyticsSource).toContain("warehouseApi.getReports");
    expect(analyticsSource).toContain("WarehouseAnalytics");
    expect(analyticsSource).not.toContain("WarehouseWorkspace");
  });
});
