import type { FastifyInstance } from "fastify";
import { and, asc, eq, inArray } from "drizzle-orm";

import { inventoryCountLines, inventoryCounts, inventoryProducts } from "@esse-beauty/db/schema";
import { MODULE_KEYS, requireModule } from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { authenticate, requirePermission } from "../../middleware/auth.js";
import { createDrizzleWarehouseRepository, reconcileInventoryCount, WarehouseConflictError, WarehouseValidationError } from "./warehouse-service.js";

const guard = [authenticate, requireModule(MODULE_KEYS.INVENTORY), requirePermission(PERMISSION_KEYS.INVENTORY_MANAGE)];
const itemTypes = new Set(["consumable", "equipment", "expense", "resale"]);

type EditableWarehouseLine = {
  key: string;
  product_id: string | null;
  description: string;
  item_type: "consumable" | "equipment" | "expense" | "resale";
  quantity: number;
  unit_cost_cents: number;
  discount_cents: number;
  tax_rate_basis_points: number;
  stock_delta: number;
  destination: string;
};

export interface ImportPreview {
  rows: EditableWarehouseLine[];
  errors: Array<{ line: number; field: string; message: string }>;
  matched: number;
  unmatched: number;
}

export interface ImportMapping {
  sku?: string;
  barcode?: string;
  name?: string;
  quantity?: string;
  unit_cost_cents?: string;
  tax_rate_basis_points?: string;
}

export interface ImportPreviewInput {
  mapping: ImportMapping;
  rows?: Array<Record<string, unknown>>;
  text?: string;
}

type PreviewProduct = { barcode: string | null; id: string; itemType: string; name: string; sku: string | null; lastCostCents?: number | null };

function ownSalon(request: { params: { id: string }; salonId: string }, reply: { code(status: number): { send(body: unknown): unknown } }) {
  return request.params.id === request.salonId || reply.code(403).send({ error: "FORBIDDEN" });
}

function value(row: Record<string, unknown>, column?: string) {
  const raw = column ? row[column] : undefined;
  return typeof raw === "string" || typeof raw === "number" ? String(raw).trim() : "";
}

function integer(value: string, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function normalized(value: string) { return value.toLocaleLowerCase("it-IT").trim(); }

function csvRows(text: string): Array<Record<string, string>> {
  const rows = text.split(/\r?\n/).filter((line) => line.trim());
  if (!rows.length) return [];
  const delimiter = rows[0]!.includes("\t") ? "\t" : rows[0]!.includes(";") ? ";" : ",";
  const headers = rows[0]!.split(delimiter).map((cell) => cell.trim());
  return rows.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, line.split(delimiter)[index]?.trim() ?? ""])));
}

/** Converts a client-supplied CSV/normalized table to editable lines without persisting anything. */
export function previewWarehouseImport(input: ImportPreviewInput, products: PreviewProduct[]): ImportPreview {
  const errors: ImportPreview["errors"] = [];
  const rows: EditableWarehouseLine[] = [];
  const sourceRows = input.rows ?? (input.text ? csvRows(input.text) : []);
  let matched = 0;
  let unmatched = 0;
  for (const [index, source] of sourceRows.entries()) {
    const line = index + 1;
    const barcode = value(source, input.mapping.barcode);
    const sku = value(source, input.mapping.sku);
    const name = value(source, input.mapping.name);
    const product = products.find((candidate) =>
      (barcode && candidate.barcode && normalized(candidate.barcode) === normalized(barcode))
      || (sku && candidate.sku && normalized(candidate.sku) === normalized(sku))
      || (name && normalized(candidate.name) === normalized(name)),
    );
    const referenceField = barcode ? "barcode" : sku ? "sku" : "name";
    if (!product) { errors.push({ line, field: referenceField, message: "Product not found" }); unmatched++; continue; }
    const quantity = integer(value(source, input.mapping.quantity), 1);
    const unitCost = integer(value(source, input.mapping.unit_cost_cents), product.lastCostCents ?? 0);
    const taxRate = integer(value(source, input.mapping.tax_rate_basis_points), 2200);
    if (quantity === undefined) { errors.push({ line, field: "quantity", message: "Must be a non-negative integer" }); unmatched++; continue; }
    if (unitCost === undefined) { errors.push({ line, field: "unit_cost_cents", message: "Must be a non-negative integer" }); unmatched++; continue; }
    if (taxRate === undefined || taxRate > 10_000) { errors.push({ line, field: "tax_rate_basis_points", message: "Must be an integer between 0 and 10000" }); unmatched++; continue; }
    if (!itemTypes.has(product.itemType)) { errors.push({ line, field: "item_type", message: "Invalid product item type" }); unmatched++; continue; }
    rows.push({ key: `preview-${line}`, product_id: product.id, description: product.name, item_type: product.itemType as EditableWarehouseLine["item_type"], quantity, unit_cost_cents: unitCost, discount_cents: 0, tax_rate_basis_points: taxRate, stock_delta: 1, destination: "stock" });
    matched++;
  }
  return { rows, errors, matched, unmatched };
}

export async function registerInventoryCountRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>("/api/salons/:id/inventory/counts", { preHandler: guard }, async (request, reply) => {
    if (ownSalon(request, reply) !== true) return;
    return app.db.select().from(inventoryCounts).where(eq(inventoryCounts.salonId, request.salonId)).orderBy(asc(inventoryCounts.openedAt));
  });

  app.post<{ Params: { id: string }; Body: { category?: string | null; notes?: string | null; product_ids?: string[] } }>("/api/salons/:id/inventory/counts", { preHandler: guard }, async (request, reply) => {
    if (ownSalon(request, reply) !== true) return;
    const ids = request.body.product_ids;
    if (ids && (!Array.isArray(ids) || ids.some((id) => typeof id !== "string"))) return reply.code(422).send({ error: "INVALID_COUNT_PRODUCTS" });
    const created = await app.db.transaction(async (tx) => {
      const filters = [eq(inventoryProducts.salonId, request.salonId), eq(inventoryProducts.active, true), eq(inventoryProducts.trackStock, true)];
      if (ids?.length) filters.push(inArray(inventoryProducts.id, [...new Set(ids)]));
      const products = await tx.select().from(inventoryProducts).where(and(...filters)).orderBy(asc(inventoryProducts.id)).for("update");
      if (ids?.length && products.length !== new Set(ids).size) throw new WarehouseValidationError("PRODUCT_NOT_FOUND");
      const counts = await tx.insert(inventoryCounts).values({ category: request.body.category ?? null, createdByUserId: request.user.id, notes: request.body.notes ?? null, salonId: request.salonId, status: "counting" }).returning();
      const count = counts[0]!;
      if (products.length) await tx.insert(inventoryCountLines).values(products.map((product) => ({ countId: count.id, productId: product.id, salonId: request.salonId, theoreticalQuantity: product.stockQuantity })));
      return { ...count, lines: products.map((product) => ({ productId: product.id, theoreticalQuantity: product.stockQuantity })) };
    }).catch((error: unknown) => error instanceof WarehouseValidationError ? error : Promise.reject(error));
    return reply.code(201).send(created);
  });

  app.get<{ Params: { id: string; countId: string } }>("/api/salons/:id/inventory/counts/:countId", { preHandler: guard }, async (request, reply) => {
    if (ownSalon(request, reply) !== true) return;
    const counts = await app.db.select().from(inventoryCounts).where(and(eq(inventoryCounts.id, request.params.countId), eq(inventoryCounts.salonId, request.salonId)));
    if (!counts[0]) return reply.code(404).send({ error: "COUNT_NOT_FOUND" });
    const lines = await app.db.select().from(inventoryCountLines).where(and(eq(inventoryCountLines.countId, counts[0].id), eq(inventoryCountLines.salonId, request.salonId))).orderBy(asc(inventoryCountLines.productId));
    return { ...counts[0], lines };
  });

  app.put<{ Params: { id: string; countId: string }; Body: { notes?: string | null; lines: Array<{ counted_quantity?: number | null; note?: string | null; product_id: string }> } }>("/api/salons/:id/inventory/counts/:countId", { preHandler: guard }, async (request, reply) => {
    if (ownSalon(request, reply) !== true) return;
    if (!Array.isArray(request.body.lines) || request.body.lines.some((line) => !line || typeof line.product_id !== "string" || (line.counted_quantity !== undefined && line.counted_quantity !== null && (!Number.isInteger(line.counted_quantity) || line.counted_quantity < 0)))) return reply.code(422).send({ error: "INVALID_COUNT_LINES" });
    const saved = await app.db.transaction(async (tx) => {
      const counts = await tx.select().from(inventoryCounts).where(and(eq(inventoryCounts.id, request.params.countId), eq(inventoryCounts.salonId, request.salonId))).for("update");
      const count = counts[0];
      if (!count) return { error: "COUNT_NOT_FOUND" as const };
      if (count.status !== "draft" && count.status !== "counting") return { error: "COUNT_ALREADY_POSTED" as const };
      if (request.body.notes !== undefined) {
        await tx.update(inventoryCounts).set({ notes: request.body.notes }).where(and(eq(inventoryCounts.id, count.id), eq(inventoryCounts.salonId, request.salonId)));
      }
      for (const line of request.body.lines) await tx.update(inventoryCountLines).set({ ...(line.counted_quantity !== undefined && { countedQuantity: line.counted_quantity }), ...(line.note !== undefined && { note: line.note }) }).where(and(eq(inventoryCountLines.countId, count.id), eq(inventoryCountLines.productId, line.product_id), eq(inventoryCountLines.salonId, request.salonId)));
      return { count };
    });
    if ("error" in saved) return reply.code(saved.error === "COUNT_NOT_FOUND" ? 404 : 409).send({ error: saved.error });
    return { ...saved.count, lines: request.body.lines };
  });

  app.post<{ Params: { id: string; countId: string } }>("/api/salons/:id/inventory/counts/:countId/post", { preHandler: guard }, async (request, reply) => {
    if (ownSalon(request, reply) !== true) return;
    try { return await reconcileInventoryCount(createDrizzleWarehouseRepository(app.db), { actorUserId: request.user.id, countId: request.params.countId, salonId: request.salonId }); }
    catch (error) { if (error instanceof WarehouseConflictError) return reply.code(409).send({ error: error.code }); if (error instanceof WarehouseValidationError) return reply.code(error.statusCode).send({ error: error.code }); throw error; }
  });

  app.post<{ Params: { id: string }; Body: ImportPreviewInput }>("/api/salons/:id/inventory/imports/preview", { preHandler: guard }, async (request, reply) => {
    if (ownSalon(request, reply) !== true) return;
    if (!request.body?.mapping || (!Array.isArray(request.body.rows) && typeof request.body.text !== "string")) return reply.code(422).send({ error: "INVALID_IMPORT_PREVIEW" });
    const products = await app.db.select({ barcode: inventoryProducts.barcode, id: inventoryProducts.id, itemType: inventoryProducts.itemType, lastCostCents: inventoryProducts.lastCostCents, name: inventoryProducts.name, sku: inventoryProducts.sku }).from(inventoryProducts).where(and(eq(inventoryProducts.salonId, request.salonId), eq(inventoryProducts.active, true)));
    return previewWarehouseImport(request.body, products);
  });
}
