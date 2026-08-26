# Complete Warehouse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal Inventory CRUD with a complete Magazzino workspace for stock, suppliers, bulk documents, physical counts, expenses, equipment and reporting.

**Architecture:** Preserve the `/inventory` routes and existing product/movement tables for compatibility, then add a document-led warehouse domain. Draft documents have no effects; an atomic posting service creates immutable stock, expense and equipment records. The web app consumes focused API resources through a compact tabbed workspace and uses full-width operational dialogs for bulk work.

**Tech Stack:** Next.js 15, React 19, Fastify 5, Drizzle ORM, PostgreSQL, Vitest, TypeScript, Tailwind CSS, Lucide React.

**Spec:** `docs/superpowers/specs/2026-08-26-complete-warehouse-design.md`

## Global Constraints

- Keep route namespace `/inventory`, module key `inventory` and permission `inventory.manage` unchanged.
- Show `Magazzino`, never `Inventario`, in user-visible navigation and page copy.
- Store money as integer cents and stock as integer base units with an explicit unit label and scale.
- Draft documents never alter stock, expenses or equipment.
- Posted documents are immutable; reversal creates compensating records.
- Scope every read and mutation by the authenticated `salonId`.
- Preserve existing products, movements, sales deductions and API compatibility.
- Use Lucide icons for all new CTAs; do not add inline SVG assets.

---

## File Structure

### Database

- Modify `packages/db/schema.ts`: extend products/movements and define suppliers, documents, document lines, expenses, assets, inventory counts and count lines.
- Create `packages/db/migrations/0034_complete_warehouse.sql`: additive migration, constraints, indexes and legacy backfill.
- Modify `packages/db/schema-contract.test.ts`: protect table relations and integrity constraints.

### API

- Modify `apps/api/src/routes/inventory/index.ts`: retain legacy endpoints and register focused route modules.
- Create `apps/api/src/routes/inventory/warehouse-types.ts`: request/result contracts and supported enum literals.
- Create `apps/api/src/routes/inventory/warehouse-service.ts`: posting, reversal, valuation and count reconciliation.
- Create `apps/api/src/routes/inventory/warehouse-service.test.ts`: service behavior and idempotency tests.
- Create `apps/api/src/routes/inventory/catalog.ts`: extended product and supplier endpoints.
- Create `apps/api/src/routes/inventory/documents.ts`: draft, post, reverse and list endpoints.
- Create `apps/api/src/routes/inventory/counts.ts`: physical inventory endpoints.
- Create `apps/api/src/routes/inventory/reporting.ts`: summary, expenses, assets and reports.
- Create `apps/api/src/routes/inventory/routes-contract.test.ts`: route/permission/isolation contract.

### Web

- Modify `apps/web/app/(dashboard)/_components/DashboardShell.tsx`: visible rename.
- Modify `apps/web/app/(dashboard)/_components/app-registry.ts`: visible rename and description.
- Modify `apps/web/app/(dashboard)/inventory/page.tsx`: mount the new workspace.
- Create `apps/web/app/(dashboard)/inventory/warehouse-types.ts`: normalized API view models.
- Create `apps/web/app/(dashboard)/inventory/warehouse-api.ts`: fetch helpers with response validation.
- Create `apps/web/app/(dashboard)/inventory/warehouse-workspace.tsx`: state, tabs, filters and orchestration.
- Create `apps/web/app/(dashboard)/inventory/_components/WarehouseOverview.tsx`: metrics and alerts.
- Create `apps/web/app/(dashboard)/inventory/_components/WarehouseProducts.tsx`: dense article table and filters.
- Create `apps/web/app/(dashboard)/inventory/_components/WarehouseDocuments.tsx`: document register.
- Create `apps/web/app/(dashboard)/inventory/_components/WarehouseOperationDialog.tsx`: bulk editable document workspace.
- Create `apps/web/app/(dashboard)/inventory/_components/WarehouseCounts.tsx`: physical count workspace.
- Create `apps/web/app/(dashboard)/inventory/_components/WarehouseSuppliers.tsx`: supplier register.
- Create `apps/web/app/(dashboard)/inventory/_components/WarehouseCosts.tsx`: expenses/equipment register.
- Create `apps/web/app/(dashboard)/inventory/_components/WarehouseReports.tsx`: operational reports.
- Create `apps/web/warehouse-workspace.test.ts`: visible contract and interaction-oriented source contract.

---

### Task 1: Rename the app and establish the operational workspace shell

**Files:**
- Modify: `apps/web/app/(dashboard)/_components/DashboardShell.tsx`
- Modify: `apps/web/app/(dashboard)/_components/app-registry.ts`
- Modify: `apps/web/app/(dashboard)/inventory/page.tsx`
- Create: `apps/web/app/(dashboard)/inventory/warehouse-types.ts`
- Create: `apps/web/app/(dashboard)/inventory/warehouse-workspace.tsx`
- Create: `apps/web/warehouse-workspace.test.ts`

**Interfaces:**
- Produces: `WarehouseTab`, `WarehouseSummary`, `WarehouseWorkspace`.
- Consumes: existing `useAuth`, `AppPage`, `PageHeaderMetrics`, `Button`, `StatusBadge`.

- [ ] **Step 1: Write the failing workspace contract test**

```ts
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
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm --filter @esse-beauty/web test -- warehouse-workspace.test.ts`

Expected: FAIL because `warehouse-workspace.tsx` does not exist and visible labels still include `Inventario`.

- [ ] **Step 3: Add the shared view contracts and workspace shell**

```ts
export type WarehouseTab = "overview" | "products" | "movements" | "documents" | "counts" | "suppliers" | "costs" | "reports";

export interface WarehouseSummary {
  asset_value_cents: number;
  draft_documents: number;
  expense_total_cents: number;
  low_stock_count: number;
  purchase_total_cents: number;
  stock_value_cents: number;
  tracked_items: number;
}
```

Implement `WarehouseWorkspace` with a compact header, the eight tab buttons, global search and the four icon CTAs. Initially reuse the existing product list inside the `products` tab so the increment remains usable.

- [ ] **Step 4: Rename all visible shell and breadcrumb copy**

Change the app registry and navigation label to `Magazzino`, title to `Magazzino operativo`, and legacy breadcrumbs to `Magazzino`. Keep hrefs unchanged.

- [ ] **Step 5: Verify GREEN**

Run: `pnpm --filter @esse-beauty/web test -- warehouse-workspace.test.ts app-registry.test.ts app-shell-contract.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(dashboard\)/_components apps/web/app/\(dashboard\)/inventory apps/web/warehouse-workspace.test.ts
git commit -m "feat: establish Magazzino workspace"
```

---

### Task 2: Add the complete warehouse schema and backward-compatible migration

**Files:**
- Modify: `packages/db/schema.ts`
- Modify: `packages/db/schema-contract.test.ts`
- Create: `packages/db/migrations/0034_complete_warehouse.sql`

**Interfaces:**
- Produces: `inventorySuppliers`, `inventoryDocuments`, `inventoryDocumentLines`, `inventoryExpenses`, `inventoryAssets`, `inventoryCounts`, `inventoryCountLines`.
- Extends: `inventoryProducts`, `inventoryMovements`.

- [ ] **Step 1: Add failing schema contract assertions**

```ts
import {
  inventoryAssets,
  inventoryCountLines,
  inventoryCounts,
  inventoryDocumentLines,
  inventoryDocuments,
  inventoryExpenses,
  inventorySuppliers,
} from "./schema";

expect(inventorySuppliers).toBeDefined();
expect(inventoryDocuments).toBeDefined();
expect(inventoryDocumentLines).toBeDefined();
expect(inventoryCounts).toBeDefined();
expect(inventoryCountLines).toBeDefined();
expect(inventoryExpenses).toBeDefined();
expect(inventoryAssets).toBeDefined();
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @esse-beauty/db build`

Expected: FAIL because the new schema exports do not exist.

- [ ] **Step 3: Extend products and movements**

Add these exact columns to `inventoryProducts`:

```ts
itemType: text("item_type").default("resale").notNull(),
unit: text("unit").default("pz").notNull(),
unitScale: integer("unit_scale").default(1).notNull(),
trackStock: boolean("track_stock").default(true).notNull(),
sellable: boolean("sellable").default(true).notNull(),
internallyConsumable: boolean("internally_consumable").default(false).notNull(),
averageCostCents: integer("average_cost_cents").default(0).notNull(),
lastCostCents: integer("last_cost_cents").default(0).notNull(),
preferredSupplierId: uuid("preferred_supplier_id"),
```

Add document/valuation references to `inventoryMovements`: `documentId`, `documentLineId`, `movementType`, `stockBefore`, `unitCostCents`, `valueCents`, and `reversesMovementId`.

- [ ] **Step 4: Define the new tables**

Use these stable statuses and kinds:

```ts
export const WAREHOUSE_DOCUMENT_KINDS = ["opening", "purchase", "supplier_invoice", "internal_use", "waste", "supplier_return", "adjustment", "count", "credit_note", "equipment_purchase", "expense"] as const;
export const WAREHOUSE_DOCUMENT_STATUSES = ["draft", "posted", "cancelled", "reversed"] as const;
```

Define supplier identity/contact fields; document header totals and audit references; document lines with `itemType`, quantity, `stockDelta`, unit cost, tax rate and total; count snapshot/count/difference fields; expense competence/category fields; and asset purchase/warranty/disposal fields. Add unique `(salon_id, internal_number)` and indexes on salon/status/date and salon/product/date.

- [ ] **Step 5: Write migration SQL**

The migration must:

```sql
ALTER TABLE inventory_products ADD COLUMN item_type text NOT NULL DEFAULT 'resale';
ALTER TABLE inventory_products ADD COLUMN unit text NOT NULL DEFAULT 'pz';
ALTER TABLE inventory_products ADD COLUMN unit_scale integer NOT NULL DEFAULT 1;
ALTER TABLE inventory_products ADD COLUMN track_stock boolean NOT NULL DEFAULT true;
ALTER TABLE inventory_products ADD COLUMN sellable boolean NOT NULL DEFAULT true;
ALTER TABLE inventory_products ADD COLUMN internally_consumable boolean NOT NULL DEFAULT false;
ALTER TABLE inventory_products ADD COLUMN average_cost_cents integer NOT NULL DEFAULT 0;
ALTER TABLE inventory_products ADD COLUMN last_cost_cents integer NOT NULL DEFAULT 0;
UPDATE inventory_products SET average_cost_cents = COALESCE(cost_cents, 0), last_cost_cents = COALESCE(cost_cents, 0);
```

Create the seven new tables, checks for valid statuses/types and non-negative monetary totals, then add foreign keys only after their referenced tables exist. Create one posted `opening` technical document per salon and link no historical movement to it; current quantities remain authoritative and are not incremented.

- [ ] **Step 6: Verify schema and migration**

Run: `pnpm --filter @esse-beauty/db build`

Run: `pnpm --filter @esse-beauty/db typecheck`

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/db/schema.ts packages/db/schema-contract.test.ts packages/db/migrations/0034_complete_warehouse.sql
git commit -m "feat: add complete warehouse domain schema"
```

---

### Task 3: Implement atomic document posting, valuation and reversal

**Files:**
- Create: `apps/api/src/routes/inventory/warehouse-types.ts`
- Create: `apps/api/src/routes/inventory/warehouse-service.ts`
- Create: `apps/api/src/routes/inventory/warehouse-service.test.ts`

**Interfaces:**
- Produces: `postWarehouseDocument(db, input)`, `reverseWarehouseDocument(db, input)`, `reconcileInventoryCount(db, input)`.
- Consumes: Task 2 schema exports.

- [ ] **Step 1: Define service contracts in the failing test**

```ts
export interface PostWarehouseDocumentInput {
  actorUserId: string;
  documentId: string;
  salonId: string;
}

export interface PostWarehouseDocumentResult {
  documentId: string;
  expenseIds: string[];
  assetIds: string[];
  movementIds: string[];
  status: "posted";
}
```

Test four cases using a transaction-aware in-memory repository adapter: a mixed purchase creates stock + expense + asset records; a draft is posted only once; forbidden negative stock rolls back all effects; reversal restores stock and links compensating movements.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/inventory/warehouse-service.test.ts`

Expected: FAIL because service exports do not exist.

- [ ] **Step 3: Implement deterministic line calculations**

```ts
export function calculateLine(input: { quantity: number; unitCostCents: number; discountCents: number; taxRateBasisPoints: number }) {
  const netCents = input.quantity * input.unitCostCents - input.discountCents;
  const taxCents = Math.round(netCents * input.taxRateBasisPoints / 10_000);
  return { netCents, taxCents, totalCents: netCents + taxCents };
}

export function weightedAverageCost(currentQuantity: number, currentCostCents: number, incomingQuantity: number, incomingCostCents: number) {
  const nextQuantity = currentQuantity + incomingQuantity;
  if (nextQuantity <= 0) return currentCostCents;
  return Math.round((currentQuantity * currentCostCents + incomingQuantity * incomingCostCents) / nextQuantity);
}
```

- [ ] **Step 4: Implement posting inside one transaction**

Within `db.transaction`, lock the draft document and affected products, reject a non-draft status, validate every line, then create movements only for tracked lines, expenses for `expense`, assets for `equipment`, update product quantities/costs and finally mark the document posted. Return the created identifiers.

Use a guarded update (`WHERE status = 'draft'`) as the final idempotency barrier. If it updates zero rows, throw `WarehouseConflictError("DOCUMENT_ALREADY_POSTED")`.

- [ ] **Step 5: Implement reversal**

Create a new reversal document, negate stock deltas and monetary entries, link `reversalOfDocumentId` and `reversesMovementId`, and set the source status to `reversed`. Never delete the source rows.

- [ ] **Step 6: Verify GREEN and API typecheck**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/inventory/warehouse-service.test.ts`

Run: `pnpm --filter @esse-beauty/api typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/inventory/warehouse-types.ts apps/api/src/routes/inventory/warehouse-service.ts apps/api/src/routes/inventory/warehouse-service.test.ts
git commit -m "feat: post and reverse warehouse documents atomically"
```

---

### Task 4: Add supplier, catalog and document APIs

**Files:**
- Modify: `apps/api/src/routes/inventory/index.ts`
- Create: `apps/api/src/routes/inventory/catalog.ts`
- Create: `apps/api/src/routes/inventory/documents.ts`
- Create: `apps/api/src/routes/inventory/routes-contract.test.ts`

**Interfaces:**
- Produces: supplier CRUD, extended catalog CRUD, document draft CRUD/list/post/reverse.
- Consumes: Task 2 schema and Task 3 services.

- [ ] **Step 1: Write failing route contract tests**

```ts
for (const route of ["/summary", "/products", "/suppliers", "/documents", "/documents/:documentId/post", "/documents/:documentId/reverse"]) {
  expect(`${catalogSource}${documentsSource}${indexSource}`).toContain(route);
}
expect(`${catalogSource}${documentsSource}`).toContain("PERMISSION_KEYS.INVENTORY_MANAGE");
expect(`${catalogSource}${documentsSource}`).toContain("request.salonId");
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/inventory/routes-contract.test.ts`

Expected: FAIL because focused routes do not exist.

- [ ] **Step 3: Implement supplier and product endpoints**

Register:

```ts
GET    /api/salons/:id/inventory/products
POST   /api/salons/:id/inventory/products
PATCH  /api/salons/:id/inventory/products/:productId
GET    /api/salons/:id/inventory/suppliers
POST   /api/salons/:id/inventory/suppliers
PATCH  /api/salons/:id/inventory/suppliers/:supplierId
DELETE /api/salons/:id/inventory/suppliers/:supplierId
```

Support `q`, `item_type`, `low_stock`, `active`, `supplier_id`, `limit` and `offset`. Archive instead of deleting referenced records.

- [ ] **Step 4: Implement document endpoints**

Register:

```ts
GET  /api/salons/:id/inventory/documents
POST /api/salons/:id/inventory/documents
GET  /api/salons/:id/inventory/documents/:documentId
PUT  /api/salons/:id/inventory/documents/:documentId
POST /api/salons/:id/inventory/documents/:documentId/post
POST /api/salons/:id/inventory/documents/:documentId/reverse
```

`PUT` replaces draft lines in a transaction and refuses posted documents. Posting/reversal delegate only to Task 3 service functions. Return `409` for service conflicts and `422` with `{ error, line_errors: [{ line, field, message }] }` for invalid lines.

- [ ] **Step 5: Preserve legacy routes**

Keep existing `/inventory` product endpoints and movement history. Adapt legacy creation to default `itemType="resale"`, `trackStock=true`, `sellable=true`. Adapt manual movement creation to create and post an `adjustment` document through the service.

- [ ] **Step 6: Verify GREEN**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/inventory/routes-contract.test.ts src/routes/inventory/warehouse-service.test.ts`

Run: `pnpm --filter @esse-beauty/api typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/inventory
git commit -m "feat: expose warehouse catalog and document APIs"
```

---

### Task 5: Build the dense article, supplier and bulk-document UI

**Files:**
- Create: `apps/web/app/(dashboard)/inventory/warehouse-api.ts`
- Modify: `apps/web/app/(dashboard)/inventory/warehouse-types.ts`
- Modify: `apps/web/app/(dashboard)/inventory/warehouse-workspace.tsx`
- Create: `apps/web/app/(dashboard)/inventory/_components/WarehouseOverview.tsx`
- Create: `apps/web/app/(dashboard)/inventory/_components/WarehouseProducts.tsx`
- Create: `apps/web/app/(dashboard)/inventory/_components/WarehouseDocuments.tsx`
- Create: `apps/web/app/(dashboard)/inventory/_components/WarehouseOperationDialog.tsx`
- Create: `apps/web/app/(dashboard)/inventory/_components/WarehouseSuppliers.tsx`
- Modify: `apps/web/warehouse-workspace.test.ts`

**Interfaces:**
- Produces: `warehouseApi`, `WarehouseOperationDialog` and functional overview/products/documents/suppliers tabs.
- Consumes: Task 4 endpoints.

- [ ] **Step 1: Extend the failing web contract**

```ts
for (const component of ["WarehouseOverview", "WarehouseProducts", "WarehouseDocuments", "WarehouseOperationDialog", "WarehouseSuppliers"]) {
  expect(workspaceImports).toContain(component);
}
for (const field of ["Riferimento documento", "Fornitore", "Quantità", "Costo", "IVA", "Destinazione"]) {
  expect(operationDialog).toContain(field);
}
expect(operationDialog).toContain("Incolla righe");
expect(operationDialog).toContain("Salva bozza");
expect(operationDialog).toContain("Registra documento");
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @esse-beauty/web test -- warehouse-workspace.test.ts`

Expected: FAIL because operational components are missing.

- [ ] **Step 3: Implement typed API helpers**

```ts
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`, { credentials: "include", ...init });
  if (!response.ok) throw new WarehouseApiError(response.status, await response.json().catch(() => ({})));
  return response.json() as Promise<T>;
}
```

Expose `getSummary`, `getProducts`, `getSuppliers`, `getDocuments`, `saveDocument`, `postDocument` and `reverseDocument`.

- [ ] **Step 4: Implement compact operational tabs**

Products: dense table, persistent filters, item-type badges, low-stock state, multi-select and row menu. Suppliers: dense register and modal form. Documents: status/type/date filters, totals, open draft, reverse posted document.

Overview: six compact metrics, low-stock/action queue and recent documents without large decorative cards.

- [ ] **Step 5: Implement the bulk operation dialog**

Use a viewport-sized dialog (`min(1480px, calc(100vw - 40px))`) with sticky header/footer. Maintain line state with stable generated keys:

```ts
interface EditableWarehouseLine {
  key: string;
  product_id: string | null;
  description: string;
  item_type: "resale" | "consumable" | "equipment" | "expense";
  quantity: number;
  unit_cost_cents: number;
  discount_cents: number;
  tax_rate_basis_points: number;
  stock_delta: number;
}
```

Provide product autocomplete, free expense/equipment rows, add/remove/duplicate row, paste tabular rows, line errors and live net/tax/total summary. `Salva bozza` writes without effects; `Registra documento` saves then posts after confirmation.

- [ ] **Step 6: Verify GREEN**

Run: `pnpm --filter @esse-beauty/web test -- warehouse-workspace.test.ts app-registry.test.ts app-shell-contract.test.ts`

Run: `pnpm --filter @esse-beauty/web typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/\(dashboard\)/inventory apps/web/warehouse-workspace.test.ts
git commit -m "feat: build operational warehouse workspace"
```

---

### Task 6: Add physical counts and safe CSV/paste import

**Files:**
- Create: `apps/api/src/routes/inventory/counts.ts`
- Modify: `apps/api/src/routes/inventory/index.ts`
- Modify: `apps/api/src/routes/inventory/warehouse-service.ts`
- Modify: `apps/api/src/routes/inventory/warehouse-service.test.ts`
- Create: `apps/web/app/(dashboard)/inventory/_components/WarehouseCounts.tsx`
- Modify: `apps/web/app/(dashboard)/inventory/_components/WarehouseOperationDialog.tsx`
- Modify: `apps/web/app/(dashboard)/inventory/warehouse-workspace.tsx`
- Modify: `apps/web/warehouse-workspace.test.ts`

**Interfaces:**
- Produces: count create/save/post endpoints and `parseWarehousePaste(text)`.
- Consumes: Task 3 reconciliation and Task 5 operation UI.

- [ ] **Step 1: Add failing count/reconciliation tests**

Test that opening a count snapshots theoretical quantities, saving counts has no stock effect, posting produces only differences, posting twice conflicts, and barcode/paste matching reports unknown rows.

```ts
expect(await reconcile([{ theoretical: 10, counted: 7 }])).toEqual([{ delta: -3 }]);
expect(await reconcile([{ theoretical: 10, counted: 10 }])).toEqual([]);
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/inventory/warehouse-service.test.ts`

Expected: FAIL because count reconciliation is incomplete.

- [ ] **Step 3: Implement count APIs and reconciliation**

Register:

```ts
GET  /api/salons/:id/inventory/counts
POST /api/salons/:id/inventory/counts
GET  /api/salons/:id/inventory/counts/:countId
PUT  /api/salons/:id/inventory/counts/:countId
POST /api/salons/:id/inventory/counts/:countId/post
POST /api/salons/:id/inventory/imports/preview
```

Create snapshots in a transaction. On post, create an `adjustment` document containing only non-zero differences and delegate to `postWarehouseDocument`.

- [ ] **Step 4: Implement safe import preview**

Accept CSV text or normalized rows, map columns from an explicit client-provided mapping, match SKU/barcode, and return:

```ts
interface ImportPreview {
  rows: EditableWarehouseLine[];
  errors: Array<{ line: number; field: string; message: string }>;
  matched: number;
  unmatched: number;
}
```

Never write database rows from preview.

- [ ] **Step 5: Implement count and paste UI**

`WarehouseCounts` shows open/posted counts and opens a wide counting workspace with theoretical, counted, difference and note columns. Add barcode focus and row status. `parseWarehousePaste` parses tab/newline input locally, then sends normalized rows to preview for matching.

- [ ] **Step 6: Verify GREEN**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/inventory/warehouse-service.test.ts src/routes/inventory/routes-contract.test.ts`

Run: `pnpm --filter @esse-beauty/web test -- warehouse-workspace.test.ts`

Run: `pnpm --filter @esse-beauty/api typecheck`

Run: `pnpm --filter @esse-beauty/web typecheck`

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/inventory apps/web/app/\(dashboard\)/inventory apps/web/warehouse-workspace.test.ts
git commit -m "feat: add physical inventory and bulk import"
```

---

### Task 7: Add expenses, equipment, summary and operational reports

**Files:**
- Create: `apps/api/src/routes/inventory/reporting.ts`
- Modify: `apps/api/src/routes/inventory/index.ts`
- Modify: `apps/api/src/routes/inventory/routes-contract.test.ts`
- Create: `apps/web/app/(dashboard)/inventory/_components/WarehouseCosts.tsx`
- Create: `apps/web/app/(dashboard)/inventory/_components/WarehouseReports.tsx`
- Modify: `apps/web/app/(dashboard)/inventory/_components/WarehouseOverview.tsx`
- Modify: `apps/web/app/(dashboard)/inventory/warehouse-api.ts`
- Modify: `apps/web/app/(dashboard)/inventory/warehouse-workspace.tsx`
- Modify: `apps/web/warehouse-workspace.test.ts`

**Interfaces:**
- Produces: `/summary`, `/expenses`, `/assets`, `/reports` and complete remaining tabs.
- Consumes: posted document, expense, asset and movement records.

- [ ] **Step 1: Add failing reporting contracts**

```ts
for (const metric of ["stock_value_cents", "low_stock_count", "draft_documents", "purchase_total_cents", "expense_total_cents", "asset_value_cents"]) {
  expect(reportingSource).toContain(metric);
}
for (const report of ["valuation", "consumption", "purchases", "waste", "suppliers"]) expect(reportingSource).toContain(report);
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/inventory/routes-contract.test.ts`

Expected: FAIL because reporting routes are missing.

- [ ] **Step 3: Implement reporting queries**

Summary counts only active products and posted documents in the selected date range. Stock valuation equals `stockQuantity * averageCostCents`. Expenses/assets derive only from posted, non-reversed source documents plus compensations. Support `date_from`, `date_to`, `supplier_id`, `category` and `item_type`.

- [ ] **Step 4: Implement costs and reports UI**

Costs tab separates Expenses and Equipment, links every record to its source document and provides date/supplier/category filters. Reports tab shows dense tables for valuation, consumption, purchases, waste and supplier spend with totals and CSV download generated from the already-filtered response.

- [ ] **Step 5: Complete overview action queues**

Load summary, low-stock items, draft documents and recent activity in parallel. Each alert links directly to the relevant tab or draft document.

- [ ] **Step 6: Verify GREEN**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/inventory/routes-contract.test.ts src/routes/inventory/warehouse-service.test.ts`

Run: `pnpm --filter @esse-beauty/web test -- warehouse-workspace.test.ts`

Run: `pnpm --filter @esse-beauty/api typecheck`

Run: `pnpm --filter @esse-beauty/web typecheck`

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/inventory apps/web/app/\(dashboard\)/inventory apps/web/warehouse-workspace.test.ts
git commit -m "feat: complete warehouse costs and reporting"
```

---

### Task 8: Harden compatibility, permissions and end-to-end behavior

**Files:**
- Modify: `apps/api/src/routes/sales/index.ts`
- Modify: `apps/api/src/routes/inventory/warehouse-service.test.ts`
- Modify: `apps/api/src/routes/inventory/routes-contract.test.ts`
- Modify: `apps/web/app/(dashboard)/inventory/[productId]/page.tsx`
- Modify: `apps/web/app/(dashboard)/inventory/new/page.tsx`
- Modify: `apps/web/critical-crud-routes.test.ts`
- Modify: `apps/web/ui-polish-regression.test.ts`

**Interfaces:**
- Produces: preserved sale deductions, upgraded legacy forms and verified authorization/isolation.
- Consumes: all previous tasks.

- [ ] **Step 1: Add failing compatibility tests**

Cover: sale of tracked resale item creates valued stock movement; non-tracked item creates no movement; consumable is absent from sale catalog; legacy product create defaults correctly; cross-salon product/document/count access returns 403/404 without data leakage.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/inventory/warehouse-service.test.ts src/routes/inventory/routes-contract.test.ts`

Expected: at least the sale valuation/non-tracked assertions FAIL.

- [ ] **Step 3: Integrate sales with warehouse rules**

Before decrementing a sold item, read `trackStock`, `sellable`, `averageCostCents` and `allowNegativeStock`. Reject non-sellable items, skip movement for non-tracked items, and store `movementType="sale"`, `unitCostCents`, `valueCents`, `stockBefore`, `stockAfter` and sale/appointment references.

- [ ] **Step 4: Upgrade legacy product forms**

Add item type, unit, stock tracking, sellable, internally consumable, purchase cost and preferred supplier. Preserve direct URLs and redirect back to the correct workspace tab.

- [ ] **Step 5: Run the full verification matrix**

Run: `pnpm --filter @esse-beauty/db build`

Run: `pnpm --filter @esse-beauty/db typecheck`

Run: `pnpm --filter @esse-beauty/api test`

Run: `pnpm --filter @esse-beauty/api typecheck`

Run: `pnpm --filter @esse-beauty/web test`

Run: `pnpm --filter @esse-beauty/web typecheck`

Run: `git diff --check`

Expected: every command exits 0 with no test failures or whitespace errors.

- [ ] **Step 6: Manual smoke test with local PostgreSQL and Redis**

Run migrations, start `npm run dev`, then verify: create supplier; create mixed purchase with resale, consumable, equipment and expense lines; confirm quantities/costs/registries; create internal-use document; run a physical count; reverse the purchase; confirm reports and audit links.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/sales apps/api/src/routes/inventory apps/web/app/\(dashboard\)/inventory apps/web/critical-crud-routes.test.ts apps/web/ui-polish-regression.test.ts
git commit -m "feat: harden complete Magazzino workflows"
```

---

## Plan Self-Review

- Every specification area maps to a task: rename/workspace (1), schema/migration (2), posting/reversal/valuation (3), suppliers/documents (4), bulk UI (5), counts/import (6), costs/assets/reports (7), compatibility/security (8).
- Stable names are consistent across tasks: `inventoryDocuments`, `inventoryDocumentLines`, `postWarehouseDocument`, `reverseWarehouseDocument`, `reconcileInventoryCount`, `WarehouseWorkspace`.
- Each increment includes its own red-green test cycle and produces usable behavior.
- No task performs direct import-to-stock writes; imports always create validated draft data.
- No task deletes posted operational history.
