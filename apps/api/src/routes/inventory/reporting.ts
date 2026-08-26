import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";

import {
  inventoryAssets,
  inventoryDocumentLines,
  inventoryDocuments,
  inventoryExpenses,
  inventoryMovements,
  inventoryProducts,
  inventorySuppliers,
} from "@esse-beauty/db/schema";
import { MODULE_KEYS, requireModule } from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { authenticate, requirePermission } from "../../middleware/auth.js";

const guard = [
  authenticate,
  requireModule(MODULE_KEYS.INVENTORY),
  requirePermission(PERMISSION_KEYS.INVENTORY_MANAGE),
];

const purchaseKinds = new Set(["purchase", "supplier_invoice"]);
const itemTypes = new Set(["consumable", "equipment", "expense", "resale"]);
const reportNames = ["valuation", "consumption", "purchases", "waste", "suppliers"] as const;

type ReportingQuery = {
  date_from?: string;
  date_to?: string;
  supplier_id?: string;
  category?: string;
  item_type?: string;
};

type DateBounds = { from?: Date; to?: Date };

function ownsSalon(request: { params: { id: string }; salonId: string }, reply: { code: (status: number) => { send: (body: unknown) => unknown } }) {
  return request.params.id === request.salonId || reply.code(403).send({ error: "FORBIDDEN" });
}

export function parseReportingDateFilter(value: string, endOfDay: boolean): Date | undefined {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z` : value);
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

function dateBounds(query: ReportingQuery): DateBounds | undefined {
  const from = query.date_from ? parseReportingDateFilter(query.date_from, false) : undefined;
  const to = query.date_to ? parseReportingDateFilter(query.date_to, true) : undefined;
  if ((query.date_from && !from) || (query.date_to && !to) || (from && to && from > to)) return undefined;
  return { from, to };
}

function inDateRange(value: Date | string | null | undefined, bounds: DateBounds) {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  return (!bounds.from || date >= bounds.from) && (!bounds.to || date <= bounds.to);
}

function money(value: number | null | undefined) { return value ?? 0; }

function baseDocumentMatches(document: typeof inventoryDocuments.$inferSelect, query: ReportingQuery, bounds: DateBounds) {
  if (document.status !== "posted" || !inDateRange(document.documentDate, bounds)) return false;
  if (query.supplier_id && document.supplierId !== query.supplier_id) return false;
  return true;
}

function lineMatches(
  line: typeof inventoryDocumentLines.$inferSelect,
  product: typeof inventoryProducts.$inferSelect | undefined,
  query: ReportingQuery,
) {
  if (query.item_type && line.itemType !== query.item_type) return false;
  if (query.category && (product?.category ?? "") !== query.category) return false;
  if (query.supplier_id && line.supplierId !== query.supplier_id) return false;
  return true;
}

function sum(values: number[]) { return values.reduce((total, value) => total + value, 0); }

export async function registerInventoryReportingRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string }; Querystring: ReportingQuery }>("/api/salons/:id/inventory/summary", { preHandler: guard }, async (request, reply) => {
    if (ownsSalon(request, reply) !== true) return;
    const bounds = dateBounds(request.query);
    if (!bounds) return reply.code(422).send({ error: "INVALID_DATE_FILTER" });
    if (request.query.item_type && !itemTypes.has(request.query.item_type)) return reply.code(422).send({ error: "INVALID_ITEM_TYPE" });
    const [products, documents, lines, expenses, assets] = await Promise.all([
      app.db.select().from(inventoryProducts).where(and(eq(inventoryProducts.salonId, request.salonId), eq(inventoryProducts.active, true))),
      app.db.select().from(inventoryDocuments).where(eq(inventoryDocuments.salonId, request.salonId)),
      app.db.select().from(inventoryDocumentLines).where(eq(inventoryDocumentLines.salonId, request.salonId)),
      app.db.select().from(inventoryExpenses).where(eq(inventoryExpenses.salonId, request.salonId)),
      app.db.select().from(inventoryAssets).where(eq(inventoryAssets.salonId, request.salonId)),
    ]);
    const productById = new Map(products.map((product) => [product.id, product]));
    const documentById = new Map(documents.map((document) => [document.id, document]));
    const lineById = new Map(lines.map((line) => [line.id, line]));
    const selectedProducts = products.filter((product) =>
      (!request.query.item_type || product.itemType === request.query.item_type) &&
      (!request.query.category || product.category === request.query.category) &&
      (!request.query.supplier_id || product.preferredSupplierId === request.query.supplier_id),
    );
    const selectedDocuments = documents.filter((document) => inDateRange(document.documentDate, bounds) && (!request.query.supplier_id || document.supplierId === request.query.supplier_id));
    const selectedLines = lines.filter((line) => {
      const document = documentById.get(line.documentId);
      return document ? baseDocumentMatches(document, request.query, bounds) && lineMatches(line, productById.get(line.productId ?? ""), request.query) : false;
    });
    const selectedLineIds = new Set(selectedLines.map((line) => line.id));
    const selectedExpenses = expenses.filter((expense) => {
      const document = documentById.get(expense.documentId);
      const line = expense.documentLineId ? lineById.get(expense.documentLineId) : undefined;
      return document && baseDocumentMatches(document, request.query, bounds) && (!request.query.category || expense.category === request.query.category) && (!request.query.item_type || (line?.itemType ?? "expense") === request.query.item_type) && (!request.query.supplier_id || expense.supplierId === request.query.supplier_id) && (!line || selectedLineIds.has(line.id));
    });
    const selectedAssets = assets.filter((asset) => {
      const document = documentById.get(asset.documentId);
      return document && baseDocumentMatches(document, request.query, bounds) && (!request.query.supplier_id || asset.supplierId === request.query.supplier_id) && (!request.query.category || (asset.documentLineId ? lineById.get(asset.documentLineId)?.description : "") === request.query.category) && (!request.query.item_type || (asset.documentLineId ? lineById.get(asset.documentLineId)?.itemType : "equipment") === request.query.item_type);
    });
    const purchaseTotal = selectedDocuments.filter((document) => baseDocumentMatches(document, request.query, bounds) && purchaseKinds.has(document.kind)).reduce((total, document) => total + money(document.totalCents), 0);
    return {
      asset_value_cents: sum(selectedAssets.map((asset) => money(asset.purchaseCostCents))),
      draft_documents: selectedDocuments.filter((document) => document.status === "draft").length,
      expense_total_cents: sum(selectedExpenses.map((expense) => money(expense.totalCents))),
      low_stock_count: selectedProducts.filter((product) => product.trackStock && product.stockQuantity < product.lowStockThreshold).length,
      purchase_total_cents: purchaseTotal,
      stock_value_cents: sum(selectedProducts.filter((product) => product.trackStock).map((product) => product.stockQuantity * product.averageCostCents)),
      tracked_items: selectedProducts.filter((product) => product.trackStock).length,
    };
  });

  app.get<{ Params: { id: string }; Querystring: ReportingQuery }>("/api/salons/:id/inventory/expenses", { preHandler: guard }, async (request, reply) => {
    if (ownsSalon(request, reply) !== true) return;
    const bounds = dateBounds(request.query);
    if (!bounds) return reply.code(422).send({ error: "INVALID_DATE_FILTER" });
    const [expenses, documents, lines, suppliers] = await Promise.all([
      app.db.select().from(inventoryExpenses).where(eq(inventoryExpenses.salonId, request.salonId)),
      app.db.select().from(inventoryDocuments).where(eq(inventoryDocuments.salonId, request.salonId)),
      app.db.select().from(inventoryDocumentLines).where(eq(inventoryDocumentLines.salonId, request.salonId)),
      app.db.select().from(inventorySuppliers).where(eq(inventorySuppliers.salonId, request.salonId)),
    ]);
    const documentById = new Map(documents.map((document) => [document.id, document]));
    const lineById = new Map(lines.map((line) => [line.id, line]));
    const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
    const items = expenses.filter((expense) => {
      const document = documentById.get(expense.documentId);
      const line = expense.documentLineId ? lineById.get(expense.documentLineId) : undefined;
      return document && baseDocumentMatches(document, request.query, bounds) && (!request.query.category || expense.category === request.query.category) && (!request.query.item_type || (line?.itemType ?? "expense") === request.query.item_type) && (!request.query.supplier_id || expense.supplierId === request.query.supplier_id);
    }).map((expense) => {
      const document = documentById.get(expense.documentId)!;
      const supplier = expense.supplierId ? supplierById.get(expense.supplierId) : undefined;
      return { ...expense, source_document_id: document.id, source_document_number: document.internalNumber, supplier_name: supplier?.name ?? null };
    });
    return { items, net_total_cents: sum(items.map((item) => money(item.netCents))), tax_total_cents: sum(items.map((item) => money(item.taxCents))), total_cents: sum(items.map((item) => money(item.totalCents))) };
  });

  app.get<{ Params: { id: string }; Querystring: ReportingQuery }>("/api/salons/:id/inventory/assets", { preHandler: guard }, async (request, reply) => {
    if (ownsSalon(request, reply) !== true) return;
    const bounds = dateBounds(request.query);
    if (!bounds) return reply.code(422).send({ error: "INVALID_DATE_FILTER" });
    const [assets, documents, lines, suppliers] = await Promise.all([
      app.db.select().from(inventoryAssets).where(eq(inventoryAssets.salonId, request.salonId)),
      app.db.select().from(inventoryDocuments).where(eq(inventoryDocuments.salonId, request.salonId)),
      app.db.select().from(inventoryDocumentLines).where(eq(inventoryDocumentLines.salonId, request.salonId)),
      app.db.select().from(inventorySuppliers).where(eq(inventorySuppliers.salonId, request.salonId)),
    ]);
    const documentById = new Map(documents.map((document) => [document.id, document]));
    const lineById = new Map(lines.map((line) => [line.id, line]));
    const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
    const items = assets.filter((asset) => {
      const document = documentById.get(asset.documentId);
      const line = asset.documentLineId ? lineById.get(asset.documentLineId) : undefined;
      return document && baseDocumentMatches(document, request.query, bounds) && (!request.query.supplier_id || asset.supplierId === request.query.supplier_id) && (!request.query.category || line?.description === request.query.category) && (!request.query.item_type || (line?.itemType ?? "equipment") === request.query.item_type);
    }).map((asset) => {
      const document = documentById.get(asset.documentId)!;
      const supplier = asset.supplierId ? supplierById.get(asset.supplierId) : undefined;
      return { ...asset, source_document_id: document.id, source_document_number: document.internalNumber, supplier_name: supplier?.name ?? null };
    });
    return { items, total_cents: sum(items.map((item) => money(item.purchaseCostCents))) };
  });

  app.get<{ Params: { id: string }; Querystring: ReportingQuery }>("/api/salons/:id/inventory/reports", { preHandler: guard }, async (request, reply) => {
    if (ownsSalon(request, reply) !== true) return;
    const bounds = dateBounds(request.query);
    if (!bounds) return reply.code(422).send({ error: "INVALID_DATE_FILTER" });
    if (request.query.item_type && !itemTypes.has(request.query.item_type)) return reply.code(422).send({ error: "INVALID_ITEM_TYPE" });
    const [products, documents, lines, movements, suppliers] = await Promise.all([
      app.db.select().from(inventoryProducts).where(and(eq(inventoryProducts.salonId, request.salonId), eq(inventoryProducts.active, true))),
      app.db.select().from(inventoryDocuments).where(eq(inventoryDocuments.salonId, request.salonId)),
      app.db.select().from(inventoryDocumentLines).where(eq(inventoryDocumentLines.salonId, request.salonId)),
      app.db.select().from(inventoryMovements).where(eq(inventoryMovements.salonId, request.salonId)),
      app.db.select().from(inventorySuppliers).where(eq(inventorySuppliers.salonId, request.salonId)),
    ]);
    const productById = new Map(products.map((product) => [product.id, product]));
    const documentById = new Map(documents.map((document) => [document.id, document]));
    const lineById = new Map(lines.map((line) => [line.id, line]));
    const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
    const selectedDocuments = documents.filter((document) => baseDocumentMatches(document, request.query, bounds));
    const selectedDocumentIds = new Set(selectedDocuments.map((document) => document.id));
    const selectedLines = lines.filter((line) => selectedDocumentIds.has(line.documentId) && lineMatches(line, productById.get(line.productId ?? ""), request.query));
    const selectedLineIds = new Set(selectedLines.map((line) => line.id));
    const valuationRows = products.filter((product) => product.trackStock && (!request.query.item_type || product.itemType === request.query.item_type) && (!request.query.category || product.category === request.query.category) && (!request.query.supplier_id || product.preferredSupplierId === request.query.supplier_id)).map((product) => ({ product_id: product.id, name: product.name, category: product.category, item_type: product.itemType, stock_quantity: product.stockQuantity, average_cost_cents: product.averageCostCents, value_cents: product.stockQuantity * product.averageCostCents }));
    const reportMovements = movements.filter((movement) => {
      if (!selectedDocumentIds.has(movement.documentId ?? "") || !inDateRange(movement.createdAt, bounds)) return false;
      const line = movement.documentLineId ? lineById.get(movement.documentLineId) : undefined;
      return (!line || selectedLineIds.has(line.id)) && (!request.query.item_type || (line?.itemType ?? productById.get(movement.productId)?.itemType) === request.query.item_type) && (!request.query.category || productById.get(movement.productId)?.category === request.query.category);
    });
    const grouped = (kind: "consumption" | "waste") => {
      const rows = new Map<string, { product_id: string; name: string; quantity: number; value_cents: number }>();
      for (const movement of reportMovements) {
        const document = documentById.get(movement.documentId ?? "");
        if (!document || (kind === "waste" ? document.kind !== "waste" : document.kind === "waste") || movement.delta >= 0) continue;
        const product = productById.get(movement.productId);
        if (!product) continue;
        const current = rows.get(product.id) ?? { product_id: product.id, name: product.name, quantity: 0, value_cents: 0 };
        current.quantity += Math.abs(movement.delta);
        current.value_cents += Math.abs(money(movement.valueCents));
        rows.set(product.id, current);
      }
      return [...rows.values()];
    };
    const purchases = selectedLines.filter((line) => {
      const document = documentById.get(line.documentId);
      return document && purchaseKinds.has(document.kind) && line.stockDelta > 0;
    }).map((line) => {
      const document = documentById.get(line.documentId)!;
      const product = line.productId ? productById.get(line.productId) : undefined;
      return { document_id: document.id, document_number: document.internalNumber, product_id: line.productId, name: product?.name ?? line.description, quantity: line.quantity, total_cents: line.totalCents, supplier_id: document.supplierId };
    });
    const supplierTotals = new Map<string, number>();
    for (const document of selectedDocuments.filter((document) => purchaseKinds.has(document.kind))) supplierTotals.set(document.supplierId ?? "", (supplierTotals.get(document.supplierId ?? "") ?? 0) + money(document.totalCents));
    const supplierRows = [...supplierTotals.entries()].map(([supplierId, totalCents]) => ({ supplier_id: supplierId || null, supplier_name: supplierId ? supplierById.get(supplierId)?.name ?? "Fornitore" : "Non assegnato", total_cents: totalCents }));
    return {
      valuation: { rows: valuationRows, total_cents: sum(valuationRows.map((row) => row.value_cents)) },
      consumption: { rows: grouped("consumption"), total_cents: sum(grouped("consumption").map((row) => row.value_cents)) },
      purchases: { rows: purchases, total_cents: sum(purchases.map((row) => money(row.total_cents))) },
      waste: { rows: grouped("waste"), total_cents: sum(grouped("waste").map((row) => row.value_cents)) },
      suppliers: { rows: supplierRows, total_cents: sum(supplierRows.map((row) => row.total_cents)) },
      reports: reportNames,
    };
  });
}
