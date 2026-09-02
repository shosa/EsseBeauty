import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildAssetPayload, buildExpensePayload } from "./app/(dashboard)/inventory/expense-form";

const inventoryRoot = join(process.cwd(), "app", "(dashboard)", "inventory");

describe("inventory expense and asset workspaces", () => {
  it("maps human expense values to integer API payloads", () => {
    expect(buildExpensePayload({ amount: "20,00", vat: "0", description: "Piccola spesa", category: "Varie", date: "2026-08-28", paymentMethod: "cash" })).toMatchObject({
      amount_cents: 2000,
      tax_cents: 0,
      net_cents: 2000,
      payment_method: "cash",
    });
  });

  it("maps asset purchases without stock fields", () => {
    expect(buildAssetPayload({ cost: "120,50", date: "2026-08-28", description: "Lampada", paymentMethod: "card" })).toMatchObject({
      description: "Lampada",
      payment_method: "card",
      purchase_cost_cents: 12050,
    });
  });

  it("uses domain-specific workspace actions", () => {
    const expenses = readFileSync(join(inventoryRoot, "_workspaces", "ExpenseWorkspace.tsx"), "utf8");
    const assets = readFileSync(join(inventoryRoot, "_workspaces", "AssetWorkspace.tsx"), "utf8");
    const expenseDialog = readFileSync(join(inventoryRoot, "_components", "ExpenseDialog.tsx"), "utf8");
    expect(expenses).toContain("Registra spesa");
    expect(expenseDialog).toContain("Aggiungi dettagli documento");
    expect(expenseDialog).toContain('paymentMethod: "cash"');
    expect(expenses).not.toContain("WarehouseOperationDialog");
    expect(assets).toContain('label="Inserisci attrezzatura"');
    expect(assets).toContain("serialNumber");
    expect(assets).toContain("warrantyExpiresAt");
    expect(assets).toContain("location");
    expect(assets).not.toContain("stock_quantity");
  });
});
