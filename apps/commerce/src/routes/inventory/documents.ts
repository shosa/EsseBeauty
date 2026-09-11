import type { FastifyInstance } from "fastify";
import { and, desc, eq, gte, lte } from "drizzle-orm";

import {
  inventoryDocumentLines,
  inventoryDocuments,
} from "@esse-beauty/db/schema";
import { MODULE_KEYS, requireModule } from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { authenticate, requirePermission } from "../../middleware/auth.js";
import {
  createDrizzleWarehouseRepository,
  WarehouseConflictError,
  WarehouseValidationError,
  postWarehouseDocument,
  reverseWarehouseDocument,
} from "./warehouse-service.js";
import { nextInventoryDocumentNumber } from "./document-number.js";

const guard = [
  authenticate,
  requireModule(MODULE_KEYS.INVENTORY),
  requirePermission(PERMISSION_KEYS.INVENTORY_MANAGE),
];
const documentKinds = new Set(["adjustment", "count", "credit_note", "equipment_purchase", "expense", "internal_use", "opening", "purchase", "supplier_invoice", "supplier_return", "waste"]);
const itemTypes = new Set(["consumable", "equipment", "expense", "resale"]);

function ownsSalon(request: { params: { id: string }; salonId: string }, reply: { code: (status: number) => { send: (body: unknown) => unknown } }) {
  return request.params.id === request.salonId || reply.code(403).send({ error: "FORBIDDEN" });
}

function limit(value?: string) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 200)) : 50;
}

function offset(value?: string) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 100_000)) : 0;
}

function lineErrors(lines: unknown): Array<{ field: string; line: number; message: string }> {
  if (!Array.isArray(lines)) return [{ field: "lines", line: 0, message: "Lines must be an array" }];
  const errors: Array<{ field: string; line: number; message: string }> = [];
  for (const [index, line] of lines.entries()) {
    if (!line || typeof line !== "object") { errors.push({ field: "line", line: index + 1, message: "Line must be an object" }); continue; }
    const input = line as DocumentLineInput;
    if (!input.description?.trim()) errors.push({ field: "description", line: index + 1, message: "Description is required" });
    if (!itemTypes.has(input.item_type ?? "resale")) errors.push({ field: "item_type", line: index + 1, message: "Invalid item type" });
    for (const field of ["quantity", "stock_delta", "unit_cost_cents", "discount_cents", "tax_rate_basis_points"] as const) {
      const value = input[field];
      if (value !== undefined && (!Number.isInteger(value) || value < 0 && field !== "stock_delta")) errors.push({ field, line: index + 1, message: "Must be a valid integer" });
    }
    if ((input.tax_rate_basis_points ?? 0) > 10_000) errors.push({ field: "tax_rate_basis_points", line: index + 1, message: "Must not exceed 10000" });
    if ((input.discount_cents ?? 0) > (input.quantity ?? 0) * (input.unit_cost_cents ?? 0)) errors.push({ field: "discount_cents", line: index + 1, message: "Cannot exceed the line amount" });
    if ((input.stock_delta ?? 0) !== 0 && !input.product_id) errors.push({ field: "product_id", line: index + 1, message: "Required when stock changes" });
  }
  return errors;
}

function toDate(value: string | undefined, fallback = new Date()) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

export function parseDocumentDateFilter(value: string, endOfDay: boolean) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z` : value);
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

function lineValues(lines: DocumentLineInput[], salonId: string, documentId: string) {
  return lines.map((line, index) => ({
    description: line.description.trim(),
    discountCents: line.discount_cents ?? 0,
    documentId,
    itemType: line.item_type ?? "resale",
    lineNumber: index + 1,
    productId: line.product_id ?? null,
    quantity: line.quantity ?? 0,
    salonId,
    stockDelta: line.stock_delta ?? 0,
    supplierId: line.supplier_id ?? null,
    taxRateBasisPoints: line.tax_rate_basis_points ?? 0,
    unit: line.unit ?? "pz",
    unitCostCents: line.unit_cost_cents ?? 0,
    unitScale: line.unit_scale ?? 1,
    destination: line.destination ?? null,
    note: line.note ?? null,
  }));
}

function documentValues(input: DocumentInput, salonId: string, actorId: string, fallbackInternalNumber = "") {
  const documentDate = toDate(input.document_date);
  const competenceDate = input.competence_date === null ? null : toDate(input.competence_date);
  if (!documentDate || competenceDate === undefined || !documentKinds.has(input.kind)) return undefined;
  return {
    attachmentUrl: input.attachment_url ?? null,
    competenceDate,
    createdByUserId: actorId,
    documentDate,
    externalReference: input.external_reference ?? null,
    internalNumber: input.internal_number?.trim() || fallbackInternalNumber,
    kind: input.kind,
    notes: input.notes ?? null,
    salonId,
    supplierId: input.supplier_id ?? null,
  };
}

export async function registerInventoryDocumentRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string }; Querystring: { date_from?: string; date_to?: string; kind?: string; limit?: string; offset?: string; status?: string } }>("/api/salons/:id/inventory/documents", { preHandler: guard }, async (request, reply) => {
    if (ownsSalon(request, reply) !== true) return;
    const filters = [eq(inventoryDocuments.salonId, request.salonId)];
    if (request.query.kind) filters.push(eq(inventoryDocuments.kind, request.query.kind));
    if (request.query.status) filters.push(eq(inventoryDocuments.status, request.query.status));
    const dateFrom = request.query.date_from ? parseDocumentDateFilter(request.query.date_from, false) : undefined;
    const dateTo = request.query.date_to ? parseDocumentDateFilter(request.query.date_to, true) : undefined;
    if ((request.query.date_from && !dateFrom) || (request.query.date_to && !dateTo) || (dateFrom && dateTo && dateFrom > dateTo)) return reply.code(422).send({ error: "INVALID_DATE_FILTER" });
    if (dateFrom) filters.push(gte(inventoryDocuments.documentDate, dateFrom));
    if (dateTo) filters.push(lte(inventoryDocuments.documentDate, dateTo));
    return app.db.select().from(inventoryDocuments).where(and(...filters)).orderBy(desc(inventoryDocuments.documentDate)).limit(limit(request.query.limit)).offset(offset(request.query.offset));
  });

  app.post<{ Params: { id: string }; Body: DocumentInput }>("/api/salons/:id/inventory/documents", { preHandler: guard }, async (request, reply) => {
    if (ownsSalon(request, reply) !== true) return;
    const errors = lineErrors(request.body.lines ?? []);
    if (errors.length) return reply.code(422).send({ error: "INVALID_DOCUMENT_LINES", line_errors: errors });
    const document = documentValues(request.body, request.salonId, request.user.id);
    if (!document) return reply.code(422).send({ error: "INVALID_DOCUMENT", line_errors: [] });
    const created = await app.db.transaction(async (tx) => {
      const internalNumber = document.internalNumber || await nextInventoryDocumentNumber(tx as unknown as typeof app.db, {
        date: document.documentDate,
        kind: document.kind as Parameters<typeof nextInventoryDocumentNumber>[1]["kind"],
        salonId: request.salonId,
      });
      const rows = await tx.insert(inventoryDocuments).values({ ...document, internalNumber }).returning();
      const result = rows[0]!;
      if (request.body.lines?.length) await tx.insert(inventoryDocumentLines).values(lineValues(request.body.lines, request.salonId, result.id));
      return result;
    });
    return reply.code(201).send(created);
  });

  app.get<{ Params: { id: string; documentId: string } }>("/api/salons/:id/inventory/documents/:documentId", { preHandler: guard }, async (request, reply) => {
    if (ownsSalon(request, reply) !== true) return;
    const documents = await app.db.select().from(inventoryDocuments).where(and(eq(inventoryDocuments.id, request.params.documentId), eq(inventoryDocuments.salonId, request.salonId)));
    if (!documents[0]) return reply.code(404).send({ error: "DOCUMENT_NOT_FOUND" });
    const lines = await app.db.select().from(inventoryDocumentLines).where(and(eq(inventoryDocumentLines.documentId, documents[0].id), eq(inventoryDocumentLines.salonId, request.salonId))).orderBy(inventoryDocumentLines.lineNumber);
    return { ...documents[0], lines };
  });

  app.put<{ Params: { id: string; documentId: string }; Body: DocumentInput }>("/api/salons/:id/inventory/documents/:documentId", { preHandler: guard }, async (request, reply) => {
    if (ownsSalon(request, reply) !== true) return;
    const errors = lineErrors(request.body.lines ?? []);
    if (errors.length) return reply.code(422).send({ error: "INVALID_DOCUMENT_LINES", line_errors: errors });
    const updated = await app.db.transaction(async (tx) => {
      const current = await tx.select().from(inventoryDocuments).where(and(eq(inventoryDocuments.id, request.params.documentId), eq(inventoryDocuments.salonId, request.salonId))).for("update");
      if (!current[0]) return { error: "DOCUMENT_NOT_FOUND" as const };
      if (current[0].status !== "draft") return { error: "DOCUMENT_NOT_DRAFT" as const };
      const document = documentValues(request.body, request.salonId, request.user.id, current[0].internalNumber);
      if (!document) return { error: "INVALID_DOCUMENT" as const };
      const rows = await tx.update(inventoryDocuments).set({ ...document, createdByUserId: current[0].createdByUserId, updatedAt: new Date() }).where(and(eq(inventoryDocuments.id, current[0].id), eq(inventoryDocuments.salonId, request.salonId))).returning();
      await tx.delete(inventoryDocumentLines).where(and(eq(inventoryDocumentLines.documentId, current[0].id), eq(inventoryDocumentLines.salonId, request.salonId)));
      if (request.body.lines?.length) await tx.insert(inventoryDocumentLines).values(lineValues(request.body.lines, request.salonId, current[0].id));
      return { document: rows[0]! };
    });
    if ("error" in updated) return reply.code(updated.error === "DOCUMENT_NOT_FOUND" ? 404 : updated.error === "INVALID_DOCUMENT" ? 422 : 409).send({ error: updated.error });
    return updated.document;
  });

  app.post<{ Params: { id: string; documentId: string } }>("/api/salons/:id/inventory/documents/:documentId/post", { preHandler: guard }, async (request, reply) => {
    if (ownsSalon(request, reply) !== true) return;
    try {
      return await postWarehouseDocument(createDrizzleWarehouseRepository(app.db), { actorUserId: request.user.id, documentId: request.params.documentId, salonId: request.salonId });
    } catch (error) {
      return sendServiceError(reply, error);
    }
  });

  app.post<{ Params: { id: string; documentId: string } }>("/api/salons/:id/inventory/documents/:documentId/reverse", { preHandler: guard }, async (request, reply) => {
    if (ownsSalon(request, reply) !== true) return;
    try {
      return await reverseWarehouseDocument(createDrizzleWarehouseRepository(app.db), { actorUserId: request.user.id, documentId: request.params.documentId, salonId: request.salonId });
    } catch (error) {
      return sendServiceError(reply, error);
    }
  });
}

function sendServiceError(reply: { code: (status: number) => { send: (body: unknown) => unknown } }, error: unknown) {
  if (error instanceof WarehouseConflictError) return reply.code(409).send({ error: error.code });
  if (error instanceof WarehouseValidationError && error.code === "LINE_INVALID") return reply.code(422).send({ error: error.code, line_errors: [] });
  if (error instanceof WarehouseValidationError) return reply.code(error.statusCode).send({ error: error.code });
  throw error;
}

interface DocumentLineInput { description: string; destination?: string | null; discount_cents?: number; item_type?: string; note?: string | null; product_id?: string | null; quantity?: number; stock_delta?: number; supplier_id?: string | null; tax_rate_basis_points?: number; unit?: string; unit_cost_cents?: number; unit_scale?: number; }
interface DocumentInput { attachment_url?: string | null; competence_date?: string | null; document_date?: string; external_reference?: string | null; internal_number?: string; kind: string; lines?: DocumentLineInput[]; notes?: string | null; supplier_id?: string | null; }
