# Modular Warehouse Workspaces Design

Date: 2026-08-28
Status: approved for implementation planning

## Objective

Replace the single oversized warehouse workspace with route-owned workspaces. Each workspace must load only its data, expose domain-specific actions, and remain connected through the Magazzino application top navigation.

The design must preserve the existing document-backed audit trail while presenting simple, task-specific forms. Expenses and equipment must not look or behave like generic stock movements.

## Information architecture

The Magazzino application owns these top-level routes:

| Tab | Route | Responsibility |
| --- | --- | --- |
| Magazzino | `/inventory` | Panoramica, Articoli and Movimenti as internal views |
| Fornitori | `/inventory/suppliers` | Supplier registry and supplier activity |
| Documenti | `/inventory/documents` | Warehouse document register and document workflows |
| Inventario | `/inventory/counts` | Physical count sessions and resulting adjustments |
| Analisi | `/inventory/analytics` | Stock, purchases, consumption, waste and supplier reporting |
| Spese | `/inventory/expenses` | Cash withdrawals and documented operating expenses |
| Attrezzature | `/inventory/assets` | Durable equipment purchases and lifecycle |

These are real routes registered as Magazzino context tabs, not query-string views in one component. The longest matching tab remains the only active tab on nested routes.

## Shared application shell

All routes use the standard EsseBeauty page header and consolidated icon actions with colored borders and matching tooltips. A small inventory domain layer owns shared API calls, money/date formatting, document labels and reusable filters.

Each route owns its loading, empty, error and mutation states. It must not fetch unrelated datasets. Shared dialogs may be extracted only for genuinely shared workflows, such as opening a warehouse document or selecting a supplier.

The existing `warehouse-workspace.tsx` is reduced to the Magazzino landing workspace. Its internal tabs are limited to Panoramica, Articoli and Movimenti. Suppliers, documents, counts, costs and reports are removed from its local state and rendering.

## Workspace behavior

### Magazzino

- Panoramica summarizes stock value, low stock and recent activity.
- Articoli manages resale and consumable items, stock thresholds, costs and manual adjustments.
- Movimenti shows posted stock-affecting events and opens their source document.
- Header actions remain stock-specific: carico, scarico, importazione, rettifica, scarto, rivalutazione and nuovo articolo.
- Expense and equipment actions are removed from this route.

### Fornitori

- Searchable supplier list with active/archived filtering.
- Create, edit and archive actions use supplier-specific forms.
- Supplier details expose contact, fiscal and payment data plus related documents and purchase totals.
- Archiving is blocked or softened according to existing product/document references; historical records remain readable.

### Documenti

- Searchable and filterable document register with status, kind, supplier and date range.
- Documents open in the existing readable document viewer, not a read-only movement form.
- Actions cover document creation, draft editing, posting and reversal according to document status.
- Internal human-readable numbers remain the primary identifiers; UUIDs are never shown as business references.

### Inventario

- List physical count sessions by status and date.
- Start a count, enter quantities, save a draft and post differences.
- Posted sessions link to the generated count/adjustment document.
- Existing server-side inventory count logic remains the source of truth.

### Analisi

- Date, supplier, category and item-type filters.
- Stock valuation, purchases, internal consumption, waste and supplier totals.
- Reporting calls the existing reporting endpoints and does not duplicate calculations in the client.
- The page uses operational summaries and compact tables; decorative status pills are avoided.

### Spese

The primary CTA is `Registra spesa`. It opens a progressive form with two levels of detail.

**Quick cash expense** requires:

- amount;
- reason/description;
- category;
- transaction date;
- payment source, defaulting to Contanti;
- optional note.

Saving a quick cash expense creates both a warehouse expense record backed by an internal expense document and an outgoing accounting/cash-register movement. The two records share a stable source reference so retries cannot duplicate either side.

**Documented expense** reveals optional administrative fields:

- supplier;
- supplier document number and date;
- taxable amount, VAT and total;
- competence date;
- document/reference notes.

The page lists expenses independently of generic warehouse documents, shows totals by period/category/payment source and links to both the source document and related cash movement. Reversal must compensate both records rather than deleting history.

## Attrezzature

The primary CTA is `Inserisci attrezzatura`. Equipment includes durable salon tools such as scissors, tweezers, hair dryers, lamps and beds.

Required purchase information:

- description;
- purchase date;
- purchase cost;
- payment source;
- optional supplier and supplier-document reference.

Optional management information:

- serial number;
- warranty expiry;
- location;
- notes.

Registering a purchase creates a document-backed cost and an asset record. It must never create a stock item, quantity, reorder rule or inventory movement.

An active asset can be dismissed through a dedicated `Dismetti attrezzatura` action. Dismissal records date and reason and changes the asset to `disposed`. It does not hard-delete the asset or alter warehouse stock. Active and dismissed assets remain filterable and auditable.

## Data and API changes

Existing supplier, document, count and reporting endpoints are retained and wrapped by page-specific client methods.

The expense flow needs a transactional command endpoint that:

1. validates salon ownership and inventory/accounting permissions;
2. creates and posts an expense document and expense record;
3. creates the outgoing accounting movement when a payment source is selected;
4. persists an idempotency/source key shared across the records;
5. rolls back the entire operation if any required write fails.

The asset flow needs command endpoints for purchase registration and dismissal. Purchase registration reuses the warehouse document service with an equipment line and zero stock delta, then returns the created asset. Dismissal updates the existing asset lifecycle fields through a guarded endpoint and records the actor/date/reason in the audit trail.

If the accounting schema lacks a neutral manual cash-out source reference, add the smallest migration needed rather than storing an unstructured note as the only connection.

## Navigation and redirects

The app registry exposes all seven top-level tabs in the specified order. Old in-memory warehouse tab destinations are mapped to their new routes. No legacy public URL currently exists for these internal views, so no external redirects are required beyond preserving `/inventory` and product detail routes.

Header actions navigate directly to the owning workspace when appropriate. For example, an analysis link uses `/inventory/analytics`, and a count action uses `/inventory/counts`.

## Error handling and consistency

- Mutations disable their CTA while pending and provide an inline actionable error.
- A failed transactional expense or equipment purchase leaves no partial cash/document/asset record.
- Posting and reversal conflicts return domain-specific 409 responses.
- Invalid totals, dates and payment sources return field-level 422 responses.
- Lists refresh only after confirmed success.
- Historical records are reversed or dismissed, never silently deleted.

## Testing

- Registry tests verify route ownership, tab ordering and single active-tab behavior.
- Page contract tests verify each workspace has its own header, actions and domain component.
- API tests cover quick cash expense atomicity, idempotency, documented expense totals, equipment purchase without stock movement and asset dismissal.
- Existing warehouse service tests continue to protect posting, reversal and inventory-count behavior.
- Type checks cover web, API and database packages.

## Migration sequence

1. Add route registry entries and page shells.
2. Extract page-specific API clients and move suppliers, documents, counts and reporting without behavior changes.
3. Reduce the main Magazzino workspace to Panoramica, Articoli and Movimenti.
4. Implement transactional expense and accounting integration.
5. Implement equipment purchase and dismissal lifecycle.
6. Remove obsolete local tabs, state and duplicated components.
7. Run focused regression tests, workspace type checks and production builds proportional to changed packages.

## Acceptance criteria

- Every top-level tab has a direct URL and only one tab is active.
- Each page loads and mutates only its own domain.
- Quick expenses create a visible cash outflow and expense record atomically.
- Documented expenses retain supplier and fiscal references.
- Equipment purchases remain outside product stock and inventory movements.
- Equipment can be dismissed with date and reason while preserving history.
- Source documents use readable business identifiers throughout the UI.
- The old mega-workspace no longer owns suppliers, documents, counts, analysis, expenses or assets.
