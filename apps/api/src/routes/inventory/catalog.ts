import type { FastifyInstance } from "fastify";
import { and, eq, ilike, lt, or, sql } from "drizzle-orm";

import {
  inventoryDocuments,
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

const itemTypes = new Set(["consumable", "equipment", "expense", "resale"]);

function page(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, maximum)) : fallback;
}

function ownsSalon(request: { params: { id: string }; salonId: string }, reply: { code: (status: number) => { send: (body: unknown) => unknown } }) {
  return request.params.id === request.salonId || reply.code(403).send({ error: "FORBIDDEN" });
}

export async function registerInventoryCatalogRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>("/api/salons/:id/inventory/summary", { preHandler: guard }, async (request, reply) => {
    if (ownsSalon(request, reply) !== true) return;
    const [products, suppliers, draftDocuments] = await Promise.all([
      app.db.select({ count: sql<number>`count(*)::int` }).from(inventoryProducts).where(and(eq(inventoryProducts.salonId, request.salonId), eq(inventoryProducts.active, true))),
      app.db.select({ count: sql<number>`count(*)::int` }).from(inventorySuppliers).where(and(eq(inventorySuppliers.salonId, request.salonId), eq(inventorySuppliers.active, true))),
      app.db.select({ count: sql<number>`count(*)::int` }).from(inventoryDocuments).where(and(eq(inventoryDocuments.salonId, request.salonId), eq(inventoryDocuments.status, "draft"))),
    ]);
    return { draft_documents: draftDocuments[0]?.count ?? 0, products: products[0]?.count ?? 0, suppliers: suppliers[0]?.count ?? 0 };
  });

  app.get<{
    Params: { id: string };
    Querystring: { active?: string; limit?: string; low_stock?: string; offset?: string; q?: string; item_type?: string; supplier_id?: string };
  }>("/api/salons/:id/inventory/products", { preHandler: guard }, async (request, reply) => {
    if (ownsSalon(request, reply) !== true) return;
    const { active, item_type: itemType, low_stock: lowStock, q, supplier_id: supplierId } = request.query;
    if (itemType && !itemTypes.has(itemType)) return reply.code(422).send({ error: "INVALID_ITEM_TYPE" });
    const filters = [eq(inventoryProducts.salonId, request.salonId)];
    if (active !== undefined) filters.push(eq(inventoryProducts.active, active === "true"));
    if (itemType) filters.push(eq(inventoryProducts.itemType, itemType));
    if (supplierId) filters.push(eq(inventoryProducts.preferredSupplierId, supplierId));
    if (lowStock === "true") filters.push(lt(inventoryProducts.stockQuantity, inventoryProducts.lowStockThreshold));
    if (q?.trim()) filters.push(or(ilike(inventoryProducts.name, `%${q.trim()}%`), ilike(inventoryProducts.sku, `%${q.trim()}%`))!);
    return app.db.select().from(inventoryProducts).where(and(...filters)).limit(page(request.query.limit, 50, 200)).offset(page(request.query.offset, 0, 100_000));
  });

  app.post<{
    Params: { id: string };
    Body: ProductInput;
  }>("/api/salons/:id/inventory/products", { preHandler: guard }, async (request, reply) => {
    if (ownsSalon(request, reply) !== true) return;
    if (!request.body.name?.trim() || (request.body.item_type && !itemTypes.has(request.body.item_type))) return reply.code(422).send({ error: "INVALID_PRODUCT" });
    const rows = await app.db.insert(inventoryProducts).values(productValues(request.body, request.salonId) as typeof inventoryProducts.$inferInsert).returning();
    return reply.code(201).send(rows[0]);
  });

  app.patch<{
    Params: { id: string; productId: string };
    Body: Partial<ProductInput>;
  }>("/api/salons/:id/inventory/products/:productId", { preHandler: guard }, async (request, reply) => {
    if (ownsSalon(request, reply) !== true) return;
    if (request.body.item_type && !itemTypes.has(request.body.item_type)) return reply.code(422).send({ error: "INVALID_ITEM_TYPE" });
    const rows = await app.db.update(inventoryProducts).set({ ...productValues(request.body, request.salonId, true), updatedAt: new Date() }).where(and(eq(inventoryProducts.id, request.params.productId), eq(inventoryProducts.salonId, request.salonId))).returning();
    return rows[0] ?? reply.code(404).send({ error: "PRODUCT_NOT_FOUND" });
  });

  app.get<{ Params: { id: string }; Querystring: { active?: string; limit?: string; offset?: string; q?: string } }>("/api/salons/:id/inventory/suppliers", { preHandler: guard }, async (request, reply) => {
    if (ownsSalon(request, reply) !== true) return;
    const filters = [eq(inventorySuppliers.salonId, request.salonId)];
    if (request.query.active !== undefined) filters.push(eq(inventorySuppliers.active, request.query.active === "true"));
    if (request.query.q?.trim()) filters.push(or(ilike(inventorySuppliers.name, `%${request.query.q.trim()}%`), ilike(inventorySuppliers.email, `%${request.query.q.trim()}%`))!);
    return app.db.select().from(inventorySuppliers).where(and(...filters)).limit(page(request.query.limit, 50, 200)).offset(page(request.query.offset, 0, 100_000));
  });

  app.post<{ Params: { id: string }; Body: SupplierInput }>("/api/salons/:id/inventory/suppliers", { preHandler: guard }, async (request, reply) => {
    if (ownsSalon(request, reply) !== true) return;
    if (!request.body.name?.trim()) return reply.code(422).send({ error: "INVALID_SUPPLIER" });
    const rows = await app.db.insert(inventorySuppliers).values(supplierValues(request.body, request.salonId) as typeof inventorySuppliers.$inferInsert).returning();
    return reply.code(201).send(rows[0]);
  });

  app.patch<{ Params: { id: string; supplierId: string }; Body: Partial<SupplierInput> }>("/api/salons/:id/inventory/suppliers/:supplierId", { preHandler: guard }, async (request, reply) => {
    if (ownsSalon(request, reply) !== true) return;
    if (request.body.name !== undefined && !request.body.name.trim()) return reply.code(422).send({ error: "INVALID_SUPPLIER" });
    const rows = await app.db.update(inventorySuppliers).set({ ...supplierValues(request.body, request.salonId, true), updatedAt: new Date() }).where(and(eq(inventorySuppliers.id, request.params.supplierId), eq(inventorySuppliers.salonId, request.salonId))).returning();
    return rows[0] ?? reply.code(404).send({ error: "SUPPLIER_NOT_FOUND" });
  });

  app.delete<{ Params: { id: string; supplierId: string } }>("/api/salons/:id/inventory/suppliers/:supplierId", { preHandler: guard }, async (request, reply) => {
    if (ownsSalon(request, reply) !== true) return;
    const supplierId = request.params.supplierId;
    const [product, document] = await Promise.all([
      app.db.select({ id: inventoryProducts.id }).from(inventoryProducts).where(and(eq(inventoryProducts.salonId, request.salonId), eq(inventoryProducts.preferredSupplierId, supplierId))).limit(1),
      app.db.select({ id: inventoryDocuments.id }).from(inventoryDocuments).where(and(eq(inventoryDocuments.salonId, request.salonId), eq(inventoryDocuments.supplierId, supplierId))).limit(1),
    ]);
    if (product[0] || document[0]) {
      const rows = await app.db.update(inventorySuppliers).set({ active: false, archivedAt: new Date(), updatedAt: new Date() }).where(and(eq(inventorySuppliers.id, supplierId), eq(inventorySuppliers.salonId, request.salonId))).returning();
      return rows[0] ?? reply.code(404).send({ error: "SUPPLIER_NOT_FOUND" });
    }
    const rows = await app.db.delete(inventorySuppliers).where(and(eq(inventorySuppliers.id, supplierId), eq(inventorySuppliers.salonId, request.salonId))).returning();
    return rows[0] ?? reply.code(404).send({ error: "SUPPLIER_NOT_FOUND" });
  });
}

interface ProductInput {
  active?: boolean;
  allow_negative_stock?: boolean;
  average_cost_cents?: number;
  barcode?: string | null;
  category?: string | null;
  cost_cents?: number | null;
  internally_consumable?: boolean;
  item_type?: string;
  last_cost_cents?: number;
  low_stock_threshold?: number;
  name: string;
  preferred_supplier?: string | null;
  preferred_supplier_id?: string | null;
  reorder_quantity?: number;
  sellable?: boolean;
  sku?: string | null;
  stock_quantity?: number;
  supplier?: string | null;
  track_stock?: boolean;
  unit?: string;
  unit_price_cents?: number;
  unit_scale?: number;
}

export function productValues(input: Partial<ProductInput>, salonId: string, partial = false) {
  const values = {
    ...(input.active !== undefined && { active: input.active }), ...(input.allow_negative_stock !== undefined && { allowNegativeStock: input.allow_negative_stock }), ...(input.barcode !== undefined && { barcode: input.barcode }), ...(input.category !== undefined && { category: input.category }), ...(input.cost_cents !== undefined && { costCents: input.cost_cents }), ...(input.internally_consumable !== undefined && { internallyConsumable: input.internally_consumable }), ...(input.item_type !== undefined && { itemType: input.item_type }), ...(input.low_stock_threshold !== undefined && { lowStockThreshold: input.low_stock_threshold }), ...(input.name !== undefined && { name: input.name.trim() }), ...(input.preferred_supplier !== undefined && { preferredSupplier: input.preferred_supplier }), ...(input.preferred_supplier_id !== undefined && { preferredSupplierId: input.preferred_supplier_id }), ...(input.reorder_quantity !== undefined && { reorderQuantity: input.reorder_quantity }), ...(input.sellable !== undefined && { sellable: input.sellable }), ...(input.sku !== undefined && { sku: input.sku }), ...(input.supplier !== undefined && { supplier: input.supplier }), ...(input.track_stock !== undefined && { trackStock: input.track_stock }), ...(input.unit !== undefined && { unit: input.unit }), ...(input.unit_price_cents !== undefined && { unitPriceCents: input.unit_price_cents }), ...(input.unit_scale !== undefined && { unitScale: input.unit_scale }),
  };
  return partial ? values : { salonId, active: true, allowNegativeStock: false, averageCostCents: 0, itemType: "resale", lastCostCents: 0, lowStockThreshold: 0, reorderQuantity: 0, sellable: true, stockQuantity: 0, trackStock: true, unit: "pz", unitPriceCents: 0, unitScale: 1, ...values };
}

interface SupplierInput { active?: boolean; address?: string | null; city?: string | null; contact_name?: string | null; country?: string | null; email?: string | null; name: string; notes?: string | null; payment_terms?: string | null; phone?: string | null; postal_code?: string | null; tax_code?: string | null; vat_number?: string | null; }

function supplierValues(input: Partial<SupplierInput>, salonId: string, partial = false) {
  const values = { ...(input.active !== undefined && { active: input.active }), ...(input.address !== undefined && { address: input.address }), ...(input.city !== undefined && { city: input.city }), ...(input.contact_name !== undefined && { contactName: input.contact_name }), ...(input.country !== undefined && { country: input.country }), ...(input.email !== undefined && { email: input.email }), ...(input.name !== undefined && { name: input.name.trim() }), ...(input.notes !== undefined && { notes: input.notes }), ...(input.payment_terms !== undefined && { paymentTerms: input.payment_terms }), ...(input.phone !== undefined && { phone: input.phone }), ...(input.postal_code !== undefined && { postalCode: input.postal_code }), ...(input.tax_code !== undefined && { taxCode: input.tax_code }), ...(input.vat_number !== undefined && { vatNumber: input.vat_number }) };
  return partial ? values : { salonId, active: true, ...values };
}
