# Modular Warehouse Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split Magazzino into route-owned workspaces and add atomic cash expenses plus non-stock equipment lifecycle management.

**Architecture:** The inventory app registry owns seven real routes. Existing supplier, document, count and reporting behavior moves into focused client workspaces, while the root workspace retains only Panoramica, Articoli and Movimenti. New command services create expense/document/cash records and equipment/document/asset records transactionally so the UI remains simple without weakening audit history.

**Tech Stack:** Next.js 15, React 19, TypeScript, Fastify 5, Drizzle ORM, PostgreSQL, Vitest, Tailwind CSS, shared `@esse-beauty/ui` components.

**Spec:** `docs/superpowers/specs/2026-08-28-modular-warehouse-workspaces-design.md`

## Global Constraints

- The top-level tab order is Magazzino, Fornitori, Documenti, Inventario, Analisi, Spese, Attrezzature.
- `/inventory` retains only Panoramica, Articoli and Movimenti as internal views.
- Every workspace uses the standard page header and consolidated icon CTA with colored tooltip.
- Quick cash expenses create an expense and outgoing cash movement atomically and idempotently.
- Equipment purchases never create a product, stock quantity or inventory movement.
- Equipment removal is a tracked dismissal, never a hard delete.
- Business-facing document references use internal readable numbers, never UUIDs.
- Existing supplier, document, count, posting and reversal behavior remains the source of truth.

---

### Task 1: Route ownership and page contracts

**Files:**
- Modify: `apps/web/app/(dashboard)/_components/app-registry.ts`
- Modify: `apps/web/app-registry.test.ts`
- Create: `apps/web/inventory-workspace-routes.test.ts`
- Create: `apps/web/app/(dashboard)/inventory/suppliers/page.tsx`
- Create: `apps/web/app/(dashboard)/inventory/documents/page.tsx`
- Create: `apps/web/app/(dashboard)/inventory/counts/page.tsx`
- Create: `apps/web/app/(dashboard)/inventory/analytics/page.tsx`
- Create: `apps/web/app/(dashboard)/inventory/expenses/page.tsx`
- Create: `apps/web/app/(dashboard)/inventory/assets/page.tsx`

**Interfaces:**
- Consumes: `AppDefinition.tabs`, `ContextTabs` longest-route matching.
- Produces: stable route entry points for all later workspace components.

- [ ] **Step 1: Write the failing route registry and page-presence tests**

```ts
it("owns every modular warehouse route", () => {
  const permissions = new Set(Object.values(PERMISSION_KEYS));
  expect(contextTabsForPath("/inventory/assets", permissions).map((tab) => [tab.label, tab.href])).toEqual([
    ["Magazzino", "/inventory"],
    ["Fornitori", "/inventory/suppliers"],
    ["Documenti", "/inventory/documents"],
    ["Inventario", "/inventory/counts"],
    ["Analisi", "/inventory/analytics"],
    ["Spese", "/inventory/expenses"],
    ["Attrezzature", "/inventory/assets"],
  ]);
});
```

In `inventory-workspace-routes.test.ts`, assert that each route file exists and references a distinct exported workspace component.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm --filter @esse-beauty/web test -- app-registry.test.ts inventory-workspace-routes.test.ts`

Expected: FAIL because inventory has no top-level tabs and the six new route files do not exist.

- [ ] **Step 3: Register the seven tabs and create minimal route entry points**

Add to the inventory app definition:

```ts
tabs: [
  { href: "/inventory", label: "Magazzino" },
  { href: "/inventory/suppliers", label: "Fornitori" },
  { href: "/inventory/documents", label: "Documenti" },
  { href: "/inventory/counts", label: "Inventario" },
  { href: "/inventory/analytics", label: "Analisi" },
  { href: "/inventory/expenses", label: "Spese" },
  { href: "/inventory/assets", label: "Attrezzature" },
],
```

Each route imports its named client workspace, for example:

```tsx
import { SupplierWorkspace } from "../_workspaces/SupplierWorkspace";
export default function SupplierPage() { return <SupplierWorkspace />; }
```

Create the named workspace components with `AppPage`, `PageHeader`, the correct title and an honest empty state explaining that no records exist yet. Do not render fabricated counters or records.

- [ ] **Step 4: Run registry tests and typecheck**

Run: `pnpm --filter @esse-beauty/web test -- app-registry.test.ts inventory-workspace-routes.test.ts && pnpm --filter @esse-beauty/web typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app-registry.test.ts apps/web/inventory-workspace-routes.test.ts apps/web/app/(dashboard)/_components/app-registry.ts apps/web/app/(dashboard)/inventory
git commit -m "feat: add modular warehouse routes"
```

### Task 2: Suppliers workspace extraction

**Files:**
- Create: `apps/web/app/(dashboard)/inventory/_workspaces/SupplierWorkspace.tsx`
- Create: `apps/web/app/(dashboard)/inventory/_components/SupplierFormDialog.tsx`
- Modify: `apps/web/app/(dashboard)/inventory/_components/WarehouseSuppliers.tsx`
- Modify: `apps/web/app/(dashboard)/inventory/warehouse-api.ts`
- Modify: `apps/web/app/(dashboard)/inventory/suppliers/page.tsx`
- Modify: `apps/web/inventory-workspace-routes.test.ts`

**Interfaces:**
- Consumes: `warehouseApi.getSuppliers`, `createSupplier`, `updateSupplier`; `WarehouseSupplier`.
- Produces: `SupplierWorkspace`, independent supplier query/mutation state and reusable `SupplierFormDialog`.

- [ ] **Step 1: Extend the failing page contract test**

Assert the suppliers source contains `PageHeader`, `ExpandableAction`, `label="Nuovo fornitore"`, query and active-state controls, `SupplierFormDialog`, and no import of `WarehouseWorkspace`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @esse-beauty/web test -- inventory-workspace-routes.test.ts`

Expected: FAIL because the suppliers route is still a shell.

- [ ] **Step 3: Implement the supplier workspace**

Use this state boundary:

```ts
const [items, setItems] = useState<WarehouseSupplier[]>([]);
const [query, setQuery] = useState("");
const [activeFilter, setActiveFilter] = useState<"all" | "active" | "archived">("active");
const [editing, setEditing] = useState<WarehouseSupplier>();
const [formOpen, setFormOpen] = useState(false);
```

Fetch only suppliers. Put create/edit fields and mutation handling in `SupplierFormDialog`. Keep archive semantics in the existing API; refresh after success. Add document/purchase summary only when returned by a supplier detail endpoint, not by loading every document client-side.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `pnpm --filter @esse-beauty/web test -- inventory-workspace-routes.test.ts warehouse-workspace.test.ts && pnpm --filter @esse-beauty/web typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(dashboard)/inventory apps/web/inventory-workspace-routes.test.ts
git commit -m "refactor: extract supplier workspace"
```

### Task 3: Documents, counts and analytics workspaces

**Files:**
- Create: `apps/web/app/(dashboard)/inventory/_workspaces/DocumentWorkspace.tsx`
- Create: `apps/web/app/(dashboard)/inventory/_workspaces/CountWorkspace.tsx`
- Create: `apps/web/app/(dashboard)/inventory/_workspaces/AnalyticsWorkspace.tsx`
- Create: `apps/web/app/(dashboard)/inventory/_components/WarehouseAnalytics.tsx`
- Modify: `apps/web/app/(dashboard)/inventory/_components/WarehouseDocuments.tsx`
- Modify: `apps/web/app/(dashboard)/inventory/_components/WarehouseCounts.tsx`
- Modify: `apps/web/app/(dashboard)/inventory/warehouse-api.ts`
- Modify: `apps/web/app/(dashboard)/inventory/warehouse-types.ts`
- Modify: `apps/api/src/routes/inventory/index.ts`
- Modify: `apps/api/src/routes/inventory/reporting.ts`
- Create: `apps/api/src/routes/inventory/reporting.registration.test.ts`
- Modify: `apps/web/inventory-workspace-routes.test.ts`

**Interfaces:**
- Consumes: document/count/report endpoints and readable `warehouseDocumentLabel`.
- Produces: three independently loaded workspaces and a registered reporting router.

- [ ] **Step 1: Write failing registration and workspace tests**

API assertion:

```ts
expect(inventoryIndexSource).toContain("registerInventoryReportingRoutes(app)");
```

Web assertions require `DocumentWorkspace` to call `getDocuments`, `CountWorkspace` to call `getCounts`, and `AnalyticsWorkspace` to call new `getReports(filters)` without importing the root warehouse workspace.

- [ ] **Step 2: Run the tests and verify RED**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/inventory/reporting.registration.test.ts && pnpm --filter @esse-beauty/web test -- inventory-workspace-routes.test.ts`

Expected: FAIL because reporting is not registered and the route workspaces are shells.

- [ ] **Step 3: Register reporting and expose typed client methods**

In `inventory/index.ts` call `await registerInventoryReportingRoutes(app)` after document routes. Resolve the existing duplicate `/inventory/summary` route by retaining the catalog summary for root counters and renaming the reporting summary endpoint to `/inventory/analytics/summary`.

Add typed calls:

```ts
getReports(salonId: string, filters: WarehouseReportingFilters): Promise<WarehouseReports>;
getAnalyticsSummary(salonId: string, filters: WarehouseReportingFilters): Promise<WarehouseAnalyticsSummary>;
```

- [ ] **Step 4: Move each domain into its workspace**

`DocumentWorkspace` owns document filters, viewer state, reversal and document-operation opening. `CountWorkspace` owns products needed for counting plus count sessions. `AnalyticsWorkspace` owns reporting filters and renders server-calculated valuation, purchases, consumption, waste and supplier totals through `WarehouseAnalytics`.

- [ ] **Step 5: Run API/web tests and typechecks**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/inventory/reporting.registration.test.ts src/routes/inventory/counts.postgres.test.ts && pnpm --filter @esse-beauty/web test -- inventory-workspace-routes.test.ts warehouse-workspace.test.ts && pnpm --filter @esse-beauty/api typecheck && pnpm --filter @esse-beauty/web typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/inventory apps/web/app/(dashboard)/inventory apps/web/inventory-workspace-routes.test.ts
git commit -m "refactor: extract warehouse document count and analytics workspaces"
```

### Task 4: Reduce the root Magazzino workspace

**Files:**
- Modify: `apps/web/app/(dashboard)/inventory/warehouse-workspace.tsx`
- Modify: `apps/web/app/(dashboard)/inventory/warehouse-types.ts`
- Modify: `apps/web/warehouse-workspace.test.ts`

**Interfaces:**
- Consumes: extracted workspaces from Tasks 2–3 through direct routes, not imports.
- Produces: root workspace with only `overview | products | movements` local views.

- [ ] **Step 1: Replace obsolete expectations with a failing ownership test**

```ts
expect(workspaceSource).toContain('{ id: "overview", label: "Panoramica" }');
expect(workspaceSource).toContain('{ id: "products", label: "Articoli" }');
expect(workspaceSource).toContain('{ id: "movements", label: "Movimenti" }');
for (const removed of ["WarehouseDocuments", "WarehouseCounts", "WarehouseSuppliers", "WarehouseCosts", "WarehouseReports"]) {
  expect(workspaceSource).not.toContain(removed);
}
```

- [ ] **Step 2: Run and verify RED**

Run: `pnpm --filter @esse-beauty/web test -- warehouse-workspace.test.ts`

Expected: FAIL because the root still owns all domains.

- [ ] **Step 3: Remove unrelated state, data fetching, dialogs and local tabs**

Limit `WarehouseTab` to:

```ts
export type WarehouseTab = "overview" | "products" | "movements";
```

Root loading requests only stock summary, products and the document data strictly required by Movimenti. Change the count header action to navigate to `/inventory/counts`; remove expense/equipment actions now owned by their pages.

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm --filter @esse-beauty/web test -- warehouse-workspace.test.ts inventory-workspace-routes.test.ts && pnpm --filter @esse-beauty/web typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(dashboard)/inventory apps/web/warehouse-workspace.test.ts
git commit -m "refactor: focus root warehouse on stock operations"
```

### Task 5: Persist idempotent cash outflows and asset metadata

**Files:**
- Modify: `packages/db/schema.ts`
- Create: `packages/db/migrations/0035_modular_warehouse_workspaces.sql`
- Modify: `packages/db/migrations/meta/_journal.json`
- Create: generated `packages/db/migrations/meta/0035_snapshot.json`
- Modify: `packages/db/schema-contract.test.ts`

**Interfaces:**
- Produces: `cashMovements`, expense/asset `cashMovementId` and `idempotencyKey`, plus asset lifecycle metadata used by command APIs.

- [ ] **Step 1: Write failing schema contract assertions**

```ts
expect(schemaSource).toContain('export const cashMovements = pgTable("cash_movements"');
expect(schemaSource).toContain('idempotencyKey: text("idempotency_key")');
expect(schemaSource).toContain('cashMovementId: uuid("cash_movement_id")');
expect(schemaSource).toContain('location: text("location")');
expect(schemaSource).toContain('disposedByUserId: uuid("disposed_by_user_id")');
```

- [ ] **Step 2: Run and verify RED**

Run: `pnpm exec vitest run packages/db/schema-contract.test.ts`

Expected: FAIL because the schema fields and table are absent.

- [ ] **Step 3: Add schema definitions**

Define cash movements with the following contract:

```ts
export const cashMovements = pgTable("cash_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id").notNull().references(() => salons.id, { onDelete: "cascade" }),
  direction: text("direction").notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  amountCents: integer("amount_cents").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  reason: text("reason").notNull(),
  category: text("category").notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: uuid("source_id"),
  idempotencyKey: text("idempotency_key").notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  reversedByMovementId: uuid("reversed_by_movement_id").references((): AnyPgColumn => cashMovements.id, { onDelete: "set null" }),
  notes: text("notes"),
  ...timestamps,
}, (table) => [
  uniqueIndex("cash_movements_salon_idempotency_unique").on(table.salonId, table.idempotencyKey),
  check("cash_movements_direction_valid", sql`${table.direction} in ('in', 'out')`),
  check("cash_movements_amount_positive", sql`${table.amountCents} > 0`),
]);
```

Add `cashMovementId` and `idempotencyKey` to both `inventoryExpenses` and `inventoryAssets`. Add `location` and `disposedByUserId` to `inventoryAssets`, with the latter referencing `users` using `onDelete: "set null"`. Add unique salon/idempotency indexes for expenses and assets. Generate migration metadata with `pnpm --filter @esse-beauty/db db:generate` and inspect the SQL for unique indexes, checks and foreign keys.

- [ ] **Step 4: Run schema and type checks**

Run: `pnpm --filter @esse-beauty/db typecheck && pnpm --filter @esse-beauty/db build && pnpm exec vitest run packages/db/schema-contract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db
git commit -m "feat: persist warehouse cash outflows and asset locations"
```

### Task 6: Transactional expense command API

**Files:**
- Create: `apps/api/src/routes/inventory/expense-service.ts`
- Create: `apps/api/src/routes/inventory/expense-service.test.ts`
- Create: `apps/api/src/routes/inventory/expenses.ts`
- Create: `apps/api/src/routes/inventory/expenses.routes.test.ts`
- Modify: `apps/api/src/routes/inventory/index.ts`
- Modify: `apps/api/src/routes/inventory/reporting.ts`
- Modify: `apps/api/src/routes/reports/index.ts`

**Interfaces:**
- Consumes: inventory document posting rules, `cashMovements`, `inventoryExpenses`, payment method enum.
- Produces: `POST /api/salons/:id/inventory/expenses`, `POST /api/salons/:id/inventory/expenses/:expenseId/reverse`, and expense list data with cash source references.

- [ ] **Step 1: Write failing service tests**

Test these real behaviors against an in-memory transaction repository:

```ts
it("creates one posted expense and one cash outflow for the same idempotency key", async () => {
  const first = await registerExpense(repo, input);
  const second = await registerExpense(repo, input);
  expect(second.expenseId).toBe(first.expenseId);
  expect(repo.state.expenses).toHaveLength(1);
  expect(repo.state.cashMovements).toHaveLength(1);
});

it("rolls back the expense when cash movement creation fails", async () => {
  repo.failCashMovement = true;
  await expect(registerExpense(repo, input)).rejects.toThrow("CASH_MOVEMENT_FAILED");
  expect(repo.state.expenses).toHaveLength(0);
  expect(repo.state.documents).toHaveLength(0);
});
```

Also assert `stockMovements` remains empty for expense documents.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/inventory/expense-service.test.ts`

Expected: FAIL because `registerExpense` does not exist.

- [ ] **Step 3: Implement the command service**

Expose:

```ts
export interface RegisterExpenseInput {
  actorUserId: string;
  salonId: string;
  idempotencyKey: string;
  amountCents: number;
  netCents: number;
  taxCents: number;
  description: string;
  category: string;
  transactionDate: Date;
  competenceDate: Date;
  paymentMethod: "cash" | "card" | "bank_transfer" | "other";
  supplierId?: string | null;
  externalReference?: string | null;
  externalDocumentDate?: Date | null;
  notes?: string | null;
}

export async function registerExpense(repository: ExpenseCommandRepository, input: RegisterExpenseInput): Promise<{ documentId: string; expenseId: string; cashMovementId: string }>;
```

Validate positive totals and `netCents + taxCents === amountCents`. Within one database transaction, create/post the expense document and line, create the expense record, then create an `out` cash movement linked by source ID and idempotency key. Return the existing result on idempotent retry.

- [ ] **Step 4: Add guarded routes and reversal**

Validate ownership plus inventory-manage permission. Parse human API values as integer cents/basis points before calling the service. Reversal creates compensating expense/document/cash records and never deletes source rows. Register routes in `inventory/index.ts`.

Update accounting reporting to include manual cash movements as outflows while keeping sales payments as inflows; return separate `inflow_cents`, `outflow_cents` and `net_cents` fields.

- [ ] **Step 5: Run API tests and typecheck**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/inventory/expense-service.test.ts src/routes/inventory/expenses.routes.test.ts src/routes/inventory/warehouse-service.test.ts && pnpm --filter @esse-beauty/api typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/inventory apps/api/src/routes/reports
git commit -m "feat: register atomic warehouse expenses and cash outflows"
```

### Task 7: Expenses workspace UI

**Files:**
- Create: `apps/web/app/(dashboard)/inventory/_workspaces/ExpenseWorkspace.tsx`
- Create: `apps/web/app/(dashboard)/inventory/_components/ExpenseDialog.tsx`
- Create: `apps/web/app/(dashboard)/inventory/expense-form.ts`
- Create: `apps/web/inventory-expenses.test.ts`
- Modify: `apps/web/app/(dashboard)/inventory/expenses/page.tsx`
- Modify: `apps/web/app/(dashboard)/inventory/warehouse-api.ts`
- Modify: `apps/web/app/(dashboard)/inventory/warehouse-types.ts`

**Interfaces:**
- Consumes: Task 6 expense list/register/reverse endpoints.
- Produces: simple progressive expense form and period/category/payment-source register.

- [ ] **Step 1: Write failing form and page tests**

```ts
expect(buildExpensePayload({ amount: "20,00", vat: "0", description: "Piccola spesa", category: "Varie", date: "2026-08-28", paymentMethod: "cash" })).toMatchObject({
  amount_cents: 2000,
  tax_cents: 0,
  net_cents: 2000,
  payment_method: "cash",
});
```

Source assertions require `label="Registra spesa"`, `Aggiungi dettagli documento`, default `cash`, an expense register, and no `WarehouseOperationDialog`.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm --filter @esse-beauty/web test -- inventory-expenses.test.ts inventory-workspace-routes.test.ts`

Expected: FAIL because the form mapper and workspace do not exist.

- [ ] **Step 3: Implement progressive expense form**

The initial form shows amount, reason, category, date, payment source and note. The collapsed documented section adds supplier, reference number/date, taxable amount and VAT. Generate an idempotency key once when the dialog opens and reuse it for retries until success.

Use `ExpandableAction` with `ReceiptText`, tone `orange`, for the header action. Use a separate reverse action with confirmation for posted expenses.

- [ ] **Step 4: Implement independent list and summaries**

Load expenses and suppliers only. Render period totals, category/payment filters, source document link and cash movement reference. On success close the dialog and refresh; on validation error keep entered values and show field-specific messages.

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm --filter @esse-beauty/web test -- inventory-expenses.test.ts inventory-workspace-routes.test.ts ui-polish-regression.test.ts && pnpm --filter @esse-beauty/web typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/(dashboard)/inventory apps/web/inventory-expenses.test.ts apps/web/inventory-workspace-routes.test.ts
git commit -m "feat: add simple warehouse expense workspace"
```

### Task 8: Equipment purchase and dismissal API

**Files:**
- Create: `apps/api/src/routes/inventory/asset-service.ts`
- Create: `apps/api/src/routes/inventory/asset-service.test.ts`
- Create: `apps/api/src/routes/inventory/assets.ts`
- Create: `apps/api/src/routes/inventory/assets.routes.test.ts`
- Modify: `apps/api/src/routes/inventory/index.ts`
- Modify: `apps/api/src/routes/inventory/reporting.ts`
- Modify: `apps/api/src/routes/inventory/warehouse-types.ts`

**Interfaces:**
- Produces: `POST /api/salons/:id/inventory/assets` and `POST /api/salons/:id/inventory/assets/:assetId/dispose`.

- [ ] **Step 1: Write failing asset lifecycle tests**

```ts
it("registers equipment without product or stock movement", async () => {
  const result = await registerAssetPurchase(repo, input);
  expect(result.assetId).toBeTruthy();
  expect(repo.state.products).toHaveLength(0);
  expect(repo.state.movements).toHaveLength(0);
  expect(repo.state.assets[0]?.status).toBe("active");
});

it("dismisses an asset while preserving its purchase", async () => {
  await disposeAsset(repo, { salonId: "salon-1", assetId: "asset-1", disposedAt: new Date("2026-08-28"), reason: "Usura" });
  expect(repo.state.assets[0]).toMatchObject({ status: "disposed", disposalNotes: "Usura" });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/inventory/asset-service.test.ts`

Expected: FAIL because command functions do not exist.

- [ ] **Step 3: Implement purchase and disposal commands**

Expose:

```ts
export interface RegisterAssetInput {
  actorUserId: string;
  salonId: string;
  description: string;
  purchaseDate: Date;
  purchaseCostCents: number;
  paymentMethod: "cash" | "card" | "bank_transfer" | "other";
  supplierId?: string | null;
  externalReference?: string | null;
  serialNumber?: string | null;
  warrantyExpiresAt?: Date | null;
  location?: string | null;
  notes?: string | null;
  idempotencyKey: string;
}
```

Create/post an `equipment_purchase` document with one `equipment` line, `productId: null`, `stockDelta: 0`, then enrich the resulting asset with serial, warranty, location, idempotency key and cash-movement reference. Create the matching cash outflow for the selected payment source in the same transaction. `disposeAsset` updates `status`, `disposedAt`, `disposalNotes` and `disposedByUserId` only.

- [ ] **Step 4: Add routes and reporting fields**

Validate positive cost, purchase date, salon ownership and active status. A second dismissal returns 409 `ASSET_ALREADY_DISPOSED`. List responses include readable source document number and supplier name.

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm --filter @esse-beauty/api test -- src/routes/inventory/asset-service.test.ts src/routes/inventory/assets.routes.test.ts src/routes/inventory/warehouse-service.test.ts && pnpm --filter @esse-beauty/api typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/inventory
git commit -m "feat: add non-stock equipment lifecycle"
```

### Task 9: Equipment workspace UI

**Files:**
- Create: `apps/web/app/(dashboard)/inventory/_workspaces/AssetWorkspace.tsx`
- Create: `apps/web/app/(dashboard)/inventory/_components/AssetPurchaseDialog.tsx`
- Create: `apps/web/app/(dashboard)/inventory/_components/AssetDisposalDialog.tsx`
- Create: `apps/web/inventory-assets.test.ts`
- Modify: `apps/web/app/(dashboard)/inventory/assets/page.tsx`
- Modify: `apps/web/app/(dashboard)/inventory/warehouse-api.ts`
- Modify: `apps/web/app/(dashboard)/inventory/warehouse-types.ts`

**Interfaces:**
- Consumes: Task 8 asset endpoints.
- Produces: active/dismissed equipment register and domain-specific purchase/dismissal flows.

- [ ] **Step 1: Write failing UI contract tests**

Require `label="Inserisci attrezzatura"`, fields for serial, warranty, location, supplier and source document, plus `label={`Dismetti ${asset.description}`}`. Assert the workspace does not contain `stock_quantity`, `low_stock_threshold`, `WarehouseProducts` or `WarehouseOperationDialog`.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm --filter @esse-beauty/web test -- inventory-assets.test.ts inventory-workspace-routes.test.ts`

Expected: FAIL because the asset workspace is still a shell.

- [ ] **Step 3: Implement purchase and dismissal dialogs**

Use `ExpandableAction` with `PackagePlus`, tone `indigo`, for purchase. The purchase form contains only asset/cost/payment/document fields. Use `ArchiveX`, tone `rose`, for dismissal with required date and reason. Neither dialog exposes stock controls.

- [ ] **Step 4: Implement register filters and detail presentation**

Filter active/dismissed, supplier, purchase date and warranty status. Display readable source document number, cost, location and warranty. Dismissed rows remain visible and openable.

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm --filter @esse-beauty/web test -- inventory-assets.test.ts inventory-workspace-routes.test.ts ui-polish-regression.test.ts && pnpm --filter @esse-beauty/web typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/(dashboard)/inventory apps/web/inventory-assets.test.ts apps/web/inventory-workspace-routes.test.ts
git commit -m "feat: add equipment purchase and dismissal workspace"
```

### Task 10: Cleanup, integration and production verification

**Files:**
- Modify: `apps/web/warehouse-workspace.test.ts`
- Modify: `apps/web/ui-polish-regression.test.ts`
- Modify: `apps/web/internal-route-integrity.test.ts` only if new routes require explicit assertions
- Modify: `README.md` only if it documents inventory URLs

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: no duplicated warehouse domain UI and verified production builds.

- [ ] **Step 1: Write the final ownership regression**

Assert every domain component appears in exactly one owning workspace, the root local tabs contain only three values, all routes resolve to the inventory app, and `ContextTabs` retains longest-route matching.

- [ ] **Step 2: Run focused suites**

Run:

```bash
pnpm --filter @esse-beauty/db typecheck
pnpm --filter @esse-beauty/api test -- src/routes/inventory
pnpm --filter @esse-beauty/web test -- warehouse-workspace.test.ts inventory-workspace-routes.test.ts inventory-expenses.test.ts inventory-assets.test.ts app-registry.test.ts ui-polish-regression.test.ts internal-route-integrity.test.ts
pnpm --filter @esse-beauty/api typecheck
pnpm --filter @esse-beauty/web typecheck
```

Expected: all commands exit 0 with zero failing tests.

- [ ] **Step 3: Run production builds**

Run:

```bash
pnpm --filter @esse-beauty/db build
pnpm --filter @esse-beauty/ui build
pnpm --filter @esse-beauty/api build
pnpm --filter @esse-beauty/web build
```

Expected: all builds exit 0.

- [ ] **Step 4: Inspect migration and repository state**

Run: `git diff --check && git status --short && git log --oneline -10`

Expected: no whitespace errors, only intended files pending if any, and one focused commit per task.

- [ ] **Step 5: Commit final cleanup and push**

```bash
git add apps packages README.md
git commit -m "refactor: complete modular warehouse workspaces"
git push origin main
```
