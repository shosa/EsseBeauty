import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mapWarehouseLineErrors } from "./app/(dashboard)/inventory/warehouse-api";
import {
  createLine,
  normalizeLineForItemType,
  parsePastedRows,
  productReferenceLabel,
  resolveProductReference,
} from "./app/(dashboard)/inventory/_components/WarehouseOperationDialog";
import { parseWarehousePaste } from "./app/(dashboard)/inventory/_components/WarehouseCounts";
import * as warehouseOperations from "./app/(dashboard)/inventory/_components/WarehouseOperationDialog";

const dashboard = join(process.cwd(), "app", "(dashboard)");

describe("warehouse workspace", () => {
  it("renames Inventory and exposes every operational area", () => {
    const shell = readFileSync(
      join(dashboard, "_components", "DashboardShell.tsx"),
      "utf8",
    );
    const registry = readFileSync(
      join(dashboard, "_components", "app-registry.ts"),
      "utf8",
    );
    const workspace = readFileSync(
      join(dashboard, "inventory", "warehouse-workspace.tsx"),
      "utf8",
    );
    expect(`${shell}${registry}`).toContain('label: "Magazzino"');
    for (const label of [
      "Panoramica",
      "Articoli",
      "Movimenti",
      "Documenti",
      "Inventari",
      "Fornitori",
      "Spese e attrezzature",
      "Analisi",
    ]) {
      expect(workspace).toContain(label);
    }
    for (const action of ["Carico", "Scarico", "Inventario", "Importa"])
      expect(workspace).toContain(action);
  });

  it("keeps the required quick actions live", () => {
    const workspace = readFileSync(
      join(dashboard, "inventory", "warehouse-workspace.tsx"),
      "utf8",
    );
    for (const action of ["Carico", "Scarico", "Inventario", "Importa"])
      expect(workspace).toContain(action);
    expect(workspace).not.toContain(
      'disabled title="Disponibile nei prossimi incrementi"',
    );
    expect(workspace).not.toContain('label="Nuovo documento"');
  });

  it("renders fixed-size colored warehouse actions with labels in accessible tooltips", () => {
    const workspace = readFileSync(
      join(dashboard, "inventory", "warehouse-workspace.tsx"),
      "utf8",
    );
    const ui = readFileSync(join(process.cwd(), "..", "..", "packages", "ui", "index.tsx"), "utf8");
    expect(workspace).toContain("ExpandableAction");
    expect(ui).not.toContain("group-hover:max-w-");
    expect(ui).not.toContain("group-focus-visible:max-w-");
    expect(ui).toContain("bottom-full");
    expect(ui).toContain("group-hover:opacity-100");
    expect(ui).toContain("group-focus-visible:opacity-100");
    expect(ui).toContain("expandableActionTooltipTones");
    for (const color of [
      "fuchsia",
      "emerald",
      "sky",
      "amber",
      "indigo",
      "violet",
      "rose",
      "orange",
      "teal",
    ]) {
      expect(ui).toContain(`border-${color}-`);
      expect(ui).toContain(`hover:bg-${color}-`);
    }
  });

  it("matches the API strict low-stock rule and exposes complete tab semantics", () => {
    const workspace = readFileSync(
      join(dashboard, "inventory", "warehouse-workspace.tsx"),
      "utf8",
    );
    expect(workspace).toContain("stockQuantity < item.lowStockThreshold");
    expect(workspace).toContain("aria-controls={panelId}");
    expect(workspace).toContain('role="tabpanel"');
    expect(workspace).toContain("aria-live");
  });

  it("wires the dense operational components and bulk document vocabulary", () => {
    const workspace = readFileSync(
      join(dashboard, "inventory", "warehouse-workspace.tsx"),
      "utf8",
    );
    const operationDialog = readFileSync(
      join(
        dashboard,
        "inventory",
        "_components",
        "WarehouseOperationDialog.tsx",
      ),
      "utf8",
    );
    for (const component of [
      "WarehouseOverview",
      "WarehouseProducts",
      "WarehouseDocuments",
      "WarehouseOperationDialog",
      "WarehouseSuppliers",
    ]) {
      expect(workspace).toContain(component);
    }
    for (const field of [
      "Riferimento documento",
      "Fornitore",
      "Quantità",
      "Costo unit.",
      "IVA",
      "Disponibile",
      "Direzione",
      "Impatto valore",
    ]) {
      expect(operationDialog).toContain(field);
    }
    expect(operationDialog).toContain("Inserimento rapido righe");
    expect(operationDialog).toContain("Salva bozza");
    for (const action of [
      "Registra carico",
      "Conferma scarico",
      "Registra scarto",
      "Applica rivalutazione",
      "Applica rettifica",
    ]) {
      expect(operationDialog).toContain(action);
    }
  });

  it("resolves product selection by id, SKU, or name", () => {
    const products = [{ id: "p1", name: "Crema", sku: "CRM-01" }] as never[];
    expect(
      resolveProductReference(
        products as Parameters<typeof resolveProductReference>[0],
        "CRM-01",
      )?.id,
    ).toBe("p1");
    expect(
      resolveProductReference(
        products as Parameters<typeof resolveProductReference>[0],
        "Crema",
      )?.id,
    ).toBe("p1");
    expect(productReferenceLabel(products[0] as never)).toBe("Crema · CRM-01");
    expect(
      resolveProductReference(
        products as Parameters<typeof resolveProductReference>[0],
        "Crema · CRM-01",
      )?.id,
    ).toBe("p1");
  });

  it("collects document and competence dates without exposing product UUIDs", () => {
    const operationDialog = readFileSync(
      join(dashboard, "inventory", "_components", "WarehouseOperationDialog.tsx"),
      "utf8",
    );
    expect(operationDialog).toContain('type="date"');
    expect(operationDialog).toContain("document_date: documentDate");
    expect(operationDialog).toContain("competence_date: competenceDate || null");
    expect(operationDialog).toContain("productReferenceLabel(product)");
    expect(operationDialog).not.toContain('value={product.id}');
    expect(operationDialog).not.toContain("ID, SKU o nome");
  });

  it("opens posted movements as a dedicated warehouse document instead of the operation form", () => {
    const workspace = readFileSync(
      join(dashboard, "inventory", "warehouse-workspace.tsx"),
      "utf8",
    );
    const documents = readFileSync(
      join(dashboard, "inventory", "_components", "WarehouseDocuments.tsx"),
      "utf8",
    );
    expect(workspace).toContain("WarehouseDocumentViewer");
    expect(workspace).toContain("viewingDocument");
    expect(workspace).toContain("setViewingDocument(details)");
    expect(documents).not.toContain('disabled={doc.status !== "draft"}');
  });

  it("renders existing UUID references through a compact stable document label", () => {
    const workspace = readFileSync(join(dashboard, "inventory", "warehouse-workspace.tsx"), "utf8");
    const documents = readFileSync(join(dashboard, "inventory", "_components", "WarehouseDocuments.tsx"), "utf8");
    expect(`${workspace}${documents}`).toContain("warehouseDocumentLabel");
    expect(`${workspace}${documents}`).not.toContain("document.externalReference || document.internalNumber");
    expect(`${workspace}${documents}`).not.toContain("doc.externalReference || doc.internalNumber");
  });

  it("maps pasted product rows and rejects malformed numeric values", () => {
    const products = [
      {
        id: "p1",
        name: "Crema",
        sku: "CRM-01",
        itemType: "resale",
        lastCostCents: 100,
      },
    ] as never[];
    const result = parsePastedRows(
      "CRM-01\t2\t1,20\t22\nCrema\tbad\t1,20\t22",
      products as Parameters<typeof parsePastedRows>[1],
      "purchase",
    );
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.product_id).toBe("p1");
    expect(result.errors[0]?.message).toContain("Quantità");
  });

  it("normalizes expense rows to non-stock lines", () => {
    const line = {
      key: "line-1",
      product_id: "p1",
      description: "Servizio",
      item_type: "resale",
      quantity: 1,
      unit_cost_cents: 100,
      discount_cents: 0,
      tax_rate_basis_points: 0,
      stock_delta: 1,
      destination: "stock",
    } as Parameters<typeof normalizeLineForItemType>[0];
    expect(normalizeLineForItemType(line, "expense")).toMatchObject({
      product_id: null,
      stock_delta: 0,
      item_type: "expense",
    });
    expect(
      createLine(
        {
          id: "p2",
          name: "Lampada",
          sku: "LAMP",
          itemType: "equipment",
          averageCostCents: 100,
          lastCostCents: 100,
        } as never,
        "purchase",
      ),
    ).toMatchObject({
      product_id: null,
      stock_delta: 0,
      item_type: "equipment",
    });
    expect(
      createLine(
        {
          id: "p3",
          name: "Crema",
          sku: "CRM",
          itemType: "resale",
          averageCostCents: 100,
          lastCostCents: 100,
        } as never,
        "purchase",
      ),
    ).toMatchObject({ product_id: "p3", stock_delta: 1 });
  });

  it("maps API line errors back to stable editable row keys and fields", () => {
    const lines = [{ key: "stable-1" }, { key: "stable-2" }] as Parameters<
      typeof mapWarehouseLineErrors
    >[1];
    const result = mapWarehouseLineErrors(
      {
        line_errors: [
          { line: 2, field: "unit_cost_cents", message: "Costo obbligatorio" },
        ],
      },
      lines,
    );
    expect(result).toEqual({
      "stable-2": { unit_cost_cents: "Costo obbligatorio" },
    });
  });

  it("rejects fractional quantities and invalid euro or VAT values", () => {
    const products = [
      {
        id: "p1",
        name: "Crema",
        sku: "CRM-01",
        itemType: "resale",
        lastCostCents: 100,
      },
    ] as never[];
    const result = parsePastedRows(
      "p1\t1.5\t1,20\t22\np1\t1\tbad\t22\np1\t1\t1,20\t101",
      products as Parameters<typeof parsePastedRows>[1],
      "purchase",
    );
    expect(result.lines).toHaveLength(0);
    expect(result.errors.map((error) => error.message)).toEqual([
      "Quantità non valida",
      "Costo non valido",
      "IVA non valida",
    ]);
  });

  it("opens physical counts outside the document adjustment dialog", () => {
    const workspace = readFileSync(
      join(dashboard, "inventory", "warehouse-workspace.tsx"),
      "utf8",
    );
    const operationDialog = readFileSync(
      join(
        dashboard,
        "inventory",
        "_components",
        "WarehouseOperationDialog.tsx",
      ),
      "utf8",
    );
    const counts = readFileSync(
      join(dashboard, "inventory", "_components", "WarehouseCounts.tsx"),
      "utf8",
    );
    expect(workspace).toContain('setActiveTab("counts")');
    expect(workspace).toContain('openOperation("adjustment")');
    expect(workspace).toContain("WarehouseCounts");
    expect(counts).toContain("Quantità teorica");
    expect(counts).toContain("Quantità contata");
    expect(counts).toContain("Differenza");
    expect(operationDialog).not.toContain("Inventario fisico");
  });

  it("parses tabbed pasted count rows locally before preview matching", () => {
    expect(parseWarehousePaste("CRM-01\t7\tScaffale A\n8001\t2")).toEqual([
      { barcode: "", counted_quantity: 7, note: "Scaffale A", sku: "CRM-01" },
      { barcode: "8001", counted_quantity: 2, note: "", sku: "" },
    ]);
  });

  it("gives each warehouse action a distinct operational contract", () => {
    const getOperationPresentation = Reflect.get(
      warehouseOperations,
      "getOperationPresentation",
    ) as
      | ((mode: string) => {
          title: string;
          fields: string[];
          confirmation: string;
        })
      | undefined;

    expect(getOperationPresentation).toBeTypeOf("function");
    expect(getOperationPresentation?.("purchase")).toMatchObject({
      title: "Carico merce",
      fields: [
        "document",
        "supplier",
        "quantity",
        "unit_cost",
        "discount",
        "tax",
      ],
    });
    expect(getOperationPresentation?.("issue")).toMatchObject({
      title: "Scarico per utilizzo",
      fields: ["reason", "quantity", "availability"],
    });
    expect(getOperationPresentation?.("waste")).toMatchObject({
      title: "Registra scarto",
      fields: ["cause", "quantity", "availability", "cost_impact"],
    });
    expect(getOperationPresentation?.("revaluation")).toMatchObject({
      title: "Rivaluta costo medio",
      fields: ["current_cost", "new_cost", "value_impact"],
    });
    expect(getOperationPresentation?.("adjustment")).toMatchObject({
      title: "Rettifica manuale",
      fields: ["reason", "direction", "quantity", "unit_cost"],
    });
    expect(getOperationPresentation?.("purchase").confirmation).not.toBe(
      getOperationPresentation?.("issue").confirmation,
    );
    expect(getOperationPresentation?.("issue").confirmation).not.toBe(
      getOperationPresentation?.("waste").confirmation,
    );
  });

  it("accepts human euro and VAT values while keeping integer storage units", () => {
    const euroToCents = Reflect.get(warehouseOperations, "euroToCents") as
      | ((value: string | number) => number)
      | undefined;
    const percentToBasisPoints = Reflect.get(
      warehouseOperations,
      "percentToBasisPoints",
    ) as ((value: string | number) => number) | undefined;
    expect(euroToCents).toBeTypeOf("function");
    expect(percentToBasisPoints).toBeTypeOf("function");
    expect(euroToCents?.("22,50")).toBe(2250);
    expect(percentToBasisPoints?.("22")).toBe(2200);

    const products = [
      {
        id: "p1",
        name: "Crema",
        sku: "CRM-01",
        itemType: "resale",
        lastCostCents: 100,
      },
    ] as never[];
    expect(
      parsePastedRows(
        "CRM-01\t2\t1,20\t22",
        products as Parameters<typeof parsePastedRows>[1],
        "purchase",
      ).lines[0],
    ).toMatchObject({
      unit_cost_cents: 120,
      tax_rate_basis_points: 2200,
    });
  });
});

describe("warehouse completed operational areas", () => {
  it("does not expose placeholder tabs", () => {
    const workspaceSource = readFileSync(
      join(dashboard, "inventory", "warehouse-workspace.tsx"),
      "utf8",
    );
    expect(workspaceSource).not.toContain("Area in preparazione");
    expect(workspaceSource).toContain("WarehouseMovements");
    expect(workspaceSource).toContain("WarehouseCosts");
    expect(workspaceSource).toContain("WarehouseReports");
  });

  it("does not show a redundant healthy-stock badge in the page header", () => {
    const workspaceSource = readFileSync(
      join(dashboard, "inventory", "warehouse-workspace.tsx"),
      "utf8",
    );
    expect(workspaceSource).not.toContain("Scorte ok");
  });
});
