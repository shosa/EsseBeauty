import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import {
  inventoryAssets,
  inventoryCountLines,
  inventoryCounts,
  inventoryDocumentLines,
  inventoryDocuments,
  inventoryExpenses,
  inventoryMovements,
  inventoryProducts,
  users,
} from "@esse-beauty/db/schema";

import type {
  PostWarehouseDocumentInput,
  PostWarehouseDocumentResult,
  ReconcileInventoryCountInput,
  ReconcileInventoryCountResult,
  ReverseWarehouseDocumentInput,
  WarehouseAssetRecord,
  WarehouseCountLineRecord,
  WarehouseCountRecord,
  WarehouseDocumentLineRecord,
  WarehouseDocumentRecord,
  WarehouseExpenseRecord,
  WarehouseMovementRecord,
  WarehouseProductRecord,
  WarehouseRepository,
  WarehouseTransaction,
} from "./warehouse-types.js";

export type WarehouseErrorCode =
  | "ACTOR_FORBIDDEN"
  | "COUNT_ALREADY_POSTED"
  | "COUNT_INVALID"
  | "COUNT_NOT_FOUND"
  | "DOCUMENT_ALREADY_POSTED"
  | "DOCUMENT_NOT_FOUND"
  | "DOCUMENT_NOT_POSTED"
  | "DOCUMENT_ALREADY_REVERSED"
  | "LINE_INVALID"
  | "MISSING_POSITIVE_ADJUSTMENT_COST"
  | "NEGATIVE_STOCK_FORBIDDEN"
  | "PRODUCT_NOT_FOUND"
  | "UNTRACKED_PRODUCT";

const errorStatus: Record<WarehouseErrorCode, number> = {
  ACTOR_FORBIDDEN: 403,
  COUNT_ALREADY_POSTED: 409,
  COUNT_INVALID: 400,
  COUNT_NOT_FOUND: 404,
  DOCUMENT_ALREADY_POSTED: 409,
  DOCUMENT_ALREADY_REVERSED: 409,
  DOCUMENT_NOT_FOUND: 404,
  DOCUMENT_NOT_POSTED: 409,
  LINE_INVALID: 400,
  MISSING_POSITIVE_ADJUSTMENT_COST: 400,
  NEGATIVE_STOCK_FORBIDDEN: 409,
  PRODUCT_NOT_FOUND: 404,
  UNTRACKED_PRODUCT: 400,
};

export class WarehouseConflictError extends Error {
  readonly code: Extract<WarehouseErrorCode, "COUNT_ALREADY_POSTED" | "DOCUMENT_ALREADY_POSTED" | "DOCUMENT_ALREADY_REVERSED" | "DOCUMENT_NOT_POSTED" | "NEGATIVE_STOCK_FORBIDDEN">;
  readonly statusCode = 409;

  constructor(code: WarehouseConflictError["code"]) {
    super(code);
    this.name = "WarehouseConflictError";
    this.code = code;
  }
}

export class WarehouseValidationError extends Error {
  readonly code: Exclude<WarehouseErrorCode, WarehouseConflictError["code"]>;
  readonly statusCode: number;

  constructor(code: WarehouseValidationError["code"]) {
    super(code);
    this.name = "WarehouseValidationError";
    this.code = code;
    this.statusCode = errorStatus[code];
  }
}

function fail(code: WarehouseErrorCode): never {
  if (
    code === "COUNT_ALREADY_POSTED" ||
    code === "DOCUMENT_ALREADY_POSTED" ||
    code === "DOCUMENT_ALREADY_REVERSED" ||
    code === "DOCUMENT_NOT_POSTED" ||
    code === "NEGATIVE_STOCK_FORBIDDEN"
  ) {
    throw new WarehouseConflictError(code);
  }
  throw new WarehouseValidationError(code);
}

function isInteger(value: number): boolean {
  return Number.isInteger(value);
}

export function calculateLine(input: {
  discountCents: number;
  quantity: number;
  taxRateBasisPoints: number;
  unitCostCents: number;
}) {
  const netCents = input.quantity * input.unitCostCents - input.discountCents;
  const taxCents = Math.round(netCents * input.taxRateBasisPoints / 10_000);
  return { netCents, taxCents, totalCents: netCents + taxCents };
}

export function weightedAverageCost(
  currentQuantity: number,
  currentCostCents: number,
  incomingQuantity: number,
  incomingCostCents: number,
) {
  const nextQuantity = currentQuantity + incomingQuantity;
  if (nextQuantity <= 0) return currentCostCents;
  return Math.round((currentQuantity * currentCostCents + incomingQuantity * incomingCostCents) / nextQuantity);
}

function validateLine(line: WarehouseDocumentLineRecord) {
  if (
    !isInteger(line.quantity) ||
    !isInteger(line.stockDelta) ||
    !isInteger(line.unitCostCents) ||
    !isInteger(line.discountCents) ||
    !isInteger(line.taxRateBasisPoints) ||
    line.quantity < 0 ||
    line.unitCostCents < 0 ||
    line.discountCents < 0 ||
    line.taxRateBasisPoints < 0 ||
    line.taxRateBasisPoints > 10_000 ||
    line.discountCents > line.quantity * line.unitCostCents
  ) {
    fail("LINE_INVALID");
  }
}

async function assertActor(tx: WarehouseTransaction, salonId: string, actorUserId: string) {
  if (!(await tx.actorBelongsToSalon(salonId, actorUserId))) fail("ACTOR_FORBIDDEN");
}

async function lockTrackedProducts(
  tx: WarehouseTransaction,
  salonId: string,
  lines: WarehouseDocumentLineRecord[],
): Promise<Map<string, WarehouseProductRecord>> {
  const productIds = new Set<string>();
  for (const line of lines) {
    validateLine(line);
    if (!line.productId) {
      if (line.stockDelta !== 0) fail("PRODUCT_NOT_FOUND");
      continue;
    }
    productIds.add(line.productId);
  }
  const products = await lockProductsForUpdate(tx, salonId, productIds);
  return new Map([...products].filter(([, product]) => product.trackStock));
}

async function lockProductsForUpdate(
  tx: WarehouseTransaction,
  salonId: string,
  productIds: Iterable<string>,
): Promise<Map<string, WarehouseProductRecord>> {
  const products = new Map<string, WarehouseProductRecord>();
  for (const productId of [...new Set(productIds)].sort()) {
    const product = await tx.findProductForUpdate(salonId, productId);
    if (!product) fail("PRODUCT_NOT_FOUND");
    products.set(product.id, product);
  }
  return products;
}

async function applyStockMovement(
  tx: WarehouseTransaction,
  input: {
    actorUserId: string;
    delta: number;
    documentId: string | null;
    documentLineId: string | null;
    movementType: string;
    note: string | null;
    product: WarehouseProductRecord;
    reason: string;
    reversesMovementId: string | null;
    salonId: string;
    unitCostCents: number;
    updateLastCost: boolean;
  },
): Promise<string> {
  const stockBefore = input.product.stockQuantity;
  const stockAfter = stockBefore + input.delta;
  if (stockAfter < 0 && !input.product.allowNegativeStock) fail("NEGATIVE_STOCK_FORBIDDEN");
  const unitCostCents = input.delta > 0 ? input.unitCostCents : input.product.averageCostCents;
  const averageCostCents = input.delta > 0
    ? weightedAverageCost(stockBefore, input.product.averageCostCents, input.delta, unitCostCents)
    : input.product.averageCostCents;
  const product = await tx.updateProduct(input.salonId, input.product.id, {
    averageCostCents,
    lastCostCents: input.delta > 0 && input.updateLastCost
      ? unitCostCents
      : input.product.lastCostCents,
    stockQuantity: stockAfter,
  });
  Object.assign(input.product, product);
  const movement = await tx.createMovement({
    createdByUserId: input.actorUserId,
    delta: input.delta,
    documentId: input.documentId,
    documentLineId: input.documentLineId,
    movementType: input.movementType,
    note: input.note,
    productId: input.product.id,
    reason: input.reason,
    reversesMovementId: input.reversesMovementId,
    salonId: input.salonId,
    stockAfter,
    stockBefore,
    unitCostCents,
    valueCents: input.delta * unitCostCents,
  });
  return movement.id;
}

export async function postWarehouseDocument(
  repository: WarehouseRepository,
  input: PostWarehouseDocumentInput,
): Promise<PostWarehouseDocumentResult> {
  return repository.transaction((tx) => postWarehouseDocumentInTransaction(tx, input));
}

async function postWarehouseDocumentInTransaction(
  tx: WarehouseTransaction,
  input: PostWarehouseDocumentInput,
): Promise<PostWarehouseDocumentResult> {
    await assertActor(tx, input.salonId, input.actorUserId);
    const document = await tx.findDocumentForUpdate(input.salonId, input.documentId);
    if (!document) fail("DOCUMENT_NOT_FOUND");
    if (document.status !== "draft") fail("DOCUMENT_ALREADY_POSTED");
    const lines = await tx.findDocumentLinesForUpdate(input.salonId, document.id);
    const products = await lockTrackedProducts(tx, input.salonId, lines);
    const assetIds: string[] = [];
    const expenseIds: string[] = [];
    const movementIds: string[] = [];
    let netTotalCents = 0;
    let taxTotalCents = 0;
    let totalCents = 0;

    for (const line of lines) {
      const totals = calculateLine(line);
      await tx.updateLineTotals(input.salonId, line.id, totals);
      netTotalCents += totals.netCents;
      taxTotalCents += totals.taxCents;
      totalCents += totals.totalCents;
      const product = line.productId ? products.get(line.productId) : undefined;
      if (product && document.kind === "adjustment" && line.destination === "revaluation") {
        if (line.stockDelta !== 0 || line.unitCostCents <= 0) fail("MISSING_POSITIVE_ADJUSTMENT_COST");
        const averageCostBefore = product.averageCostCents;
        const updated = await tx.updateProduct(input.salonId, product.id, {
          averageCostCents: line.unitCostCents,
          lastCostCents: line.unitCostCents,
          stockQuantity: product.stockQuantity,
        });
        Object.assign(product, updated);
        const movement = await tx.createMovement({
          createdByUserId: input.actorUserId,
          delta: 0,
          documentId: document.id,
          documentLineId: line.id,
          movementType: "revaluation",
          note: document.notes,
          productId: product.id,
          reason: document.kind,
          reversesMovementId: null,
          salonId: input.salonId,
          stockAfter: product.stockQuantity,
          stockBefore: product.stockQuantity,
          unitCostCents: averageCostBefore,
          valueCents: (line.unitCostCents - averageCostBefore) * product.stockQuantity,
        });
        movementIds.push(movement.id);
      } else if (product && line.stockDelta !== 0) {
        const unitCostCents = line.quantity === 0 ? 0 : Math.round(totals.netCents / line.quantity);
        if (document.kind === "adjustment" && line.stockDelta > 0 && unitCostCents <= 0) {
          fail("MISSING_POSITIVE_ADJUSTMENT_COST");
        }
        movementIds.push(await applyStockMovement(tx, {
          actorUserId: input.actorUserId,
          delta: line.stockDelta,
          documentId: document.id,
          documentLineId: line.id,
          movementType: "document_posting",
          note: document.notes,
          product,
          reason: document.kind,
          reversesMovementId: null,
          salonId: input.salonId,
          unitCostCents,
          updateLastCost: document.kind === "purchase" || document.kind === "supplier_invoice",
        }));
      }
      if (line.itemType === "expense") {
        const expense = await tx.createExpense({
          category: document.kind,
          competenceDate: document.competenceDate ?? document.documentDate,
          description: line.description,
          documentId: document.id,
          documentLineId: line.id,
          netCents: totals.netCents,
          notes: document.notes,
          salonId: input.salonId,
          supplierId: line.supplierId ?? document.supplierId,
          taxCents: totals.taxCents,
          totalCents: totals.totalCents,
          reversesExpenseId: null,
        });
        expenseIds.push(expense.id);
      }
      if (line.itemType === "equipment") {
        const asset = await tx.createAsset({
          description: line.description,
          documentId: document.id,
          documentLineId: line.id,
          notes: document.notes,
          purchaseCostCents: totals.totalCents,
          purchaseDate: document.documentDate,
          salonId: input.salonId,
          status: "active",
          supplierId: line.supplierId ?? document.supplierId,
          reversesAssetId: null,
        });
        assetIds.push(asset.id);
      }
    }

    await tx.updateDocumentTotals(input.salonId, document.id, {
      netTotalCents,
      taxTotalCents,
      totalCents,
    });
    if (!(await tx.markDocumentPosted(input.salonId, document.id, input.actorUserId))) {
      fail("DOCUMENT_ALREADY_POSTED");
    }
    return { assetIds, documentId: document.id, expenseIds, movementIds, status: "posted" };
}

function reversalKind(kind: WarehouseDocumentRecord["kind"]): WarehouseDocumentRecord["kind"] {
  return kind === "opening" ? "adjustment" : kind;
}

export async function reverseWarehouseDocument(
  repository: WarehouseRepository,
  input: ReverseWarehouseDocumentInput,
): Promise<PostWarehouseDocumentResult> {
  return repository.transaction(async (tx) => {
    await assertActor(tx, input.salonId, input.actorUserId);
    const source = await tx.findDocumentForUpdate(input.salonId, input.documentId);
    if (!source) fail("DOCUMENT_NOT_FOUND");
    if (source.status === "reversed") fail("DOCUMENT_ALREADY_REVERSED");
    if (source.status !== "posted") fail("DOCUMENT_NOT_POSTED");
    const sourceLines = await tx.findDocumentLinesForUpdate(input.salonId, source.id);
    const sourceMovements = await tx.findMovementsForDocument(input.salonId, source.id);
    const sourceExpenses = await tx.findExpensesForDocument(input.salonId, source.id);
    const sourceAssets = await tx.findAssetsForDocument(input.salonId, source.id);
    const products = await lockProductsForUpdate(
      tx,
      input.salonId,
      sourceMovements.map((movement) => movement.productId),
    );
    const reversal = await tx.createDocument({
      competenceDate: source.competenceDate,
      createdByUserId: input.actorUserId,
      documentDate: new Date(),
      internalNumber: `${source.internalNumber}-REV-${randomUUID().slice(0, 8)}`,
      kind: reversalKind(source.kind),
      netTotalCents: -source.netTotalCents,
      notes: `Reversal of ${source.internalNumber}`,
      reversalOfDocumentId: source.id,
      salonId: input.salonId,
      supplierId: source.supplierId,
      taxTotalCents: -source.taxTotalCents,
      totalCents: -source.totalCents,
    });
    const reversalLineIds = new Map<string, string>();
    for (const line of sourceLines) {
      const reversalLine = await tx.createDocumentLine({
        description: `Reversal: ${line.description}`,
        destination: line.destination,
        discountCents: line.discountCents,
        documentId: reversal.id,
        itemType: line.itemType,
        lineNumber: line.lineNumber,
        netCents: -line.netCents,
        productId: line.productId,
        quantity: line.quantity,
        salonId: input.salonId,
        stockDelta: -line.stockDelta,
        supplierId: line.supplierId,
        taxCents: -line.taxCents,
        taxRateBasisPoints: line.taxRateBasisPoints,
        totalCents: -line.totalCents,
        unitCostCents: line.unitCostCents,
        reversesDocumentLineId: line.id,
      });
      reversalLineIds.set(line.id, reversalLine.id);
    }
    const movementIds: string[] = [];
    for (const movement of sourceMovements) {
      const product = products.get(movement.productId);
      if (!product) fail("PRODUCT_NOT_FOUND");
      if (movement.movementType === "revaluation") {
        const stockQuantity = product.stockQuantity;
        const currentAverageCostCents = product.averageCostCents;
        const updated = await tx.updateProduct(input.salonId, product.id, {
          averageCostCents: movement.unitCostCents,
          lastCostCents: movement.unitCostCents,
          stockQuantity,
        });
        Object.assign(product, updated);
        const compensation = await tx.createMovement({
          createdByUserId: input.actorUserId,
          delta: 0,
          documentId: reversal.id,
          documentLineId: movement.documentLineId ? reversalLineIds.get(movement.documentLineId) ?? null : null,
          movementType: "document_reversal",
          note: `Reversal of revaluation ${movement.id}`,
          productId: product.id,
          reason: "reversal",
          reversesMovementId: movement.id,
          salonId: input.salonId,
          stockAfter: stockQuantity,
          stockBefore: stockQuantity,
          unitCostCents: currentAverageCostCents,
          valueCents: -movement.valueCents,
        });
        movementIds.push(compensation.id);
        continue;
      }
      movementIds.push(await applyStockMovement(tx, {
        actorUserId: input.actorUserId,
        delta: -movement.delta,
        documentId: reversal.id,
        documentLineId: movement.documentLineId ? reversalLineIds.get(movement.documentLineId) ?? null : null,
        movementType: "document_reversal",
        note: `Reversal of movement ${movement.id}`,
        product,
        reason: "reversal",
        reversesMovementId: movement.id,
        salonId: input.salonId,
        unitCostCents: movement.delta > 0 ? product.averageCostCents : movement.unitCostCents,
        updateLastCost: false,
      }));
    }
    const expenseIds: string[] = [];
    for (const expense of sourceExpenses) {
      const compensation = await tx.createExpense({
        category: expense.category,
        competenceDate: reversal.documentDate,
        description: `Reversal: ${expense.description}`,
        documentId: reversal.id,
        documentLineId: expense.documentLineId ? reversalLineIds.get(expense.documentLineId) ?? null : null,
        netCents: -expense.netCents,
        notes: `Reversal of expense ${expense.id}`,
        salonId: input.salonId,
        supplierId: expense.supplierId,
        taxCents: -expense.taxCents,
        totalCents: -expense.totalCents,
        reversesExpenseId: expense.id,
      });
      expenseIds.push(compensation.id);
    }
    const assetIds: string[] = [];
    for (const asset of sourceAssets) {
      const compensation = await tx.createAsset({
        description: `Reversal: ${asset.description}`,
        documentId: reversal.id,
        documentLineId: asset.documentLineId ? reversalLineIds.get(asset.documentLineId) ?? null : null,
        notes: `Reversal of asset ${asset.id}`,
        purchaseCostCents: -asset.purchaseCostCents,
        purchaseDate: reversal.documentDate,
        salonId: input.salonId,
        status: "disposed",
        supplierId: asset.supplierId,
        reversesAssetId: asset.id,
      });
      assetIds.push(compensation.id);
    }
    if (!(await tx.markDocumentPosted(input.salonId, reversal.id, input.actorUserId))) {
      fail("DOCUMENT_ALREADY_POSTED");
    }
    if (!(await tx.markDocumentReversed(input.salonId, source.id))) fail("DOCUMENT_ALREADY_REVERSED");
    return { assetIds, documentId: reversal.id, expenseIds, movementIds, status: "posted" };
  });
}

export async function reconcileInventoryCount(
  repository: WarehouseRepository,
  input: ReconcileInventoryCountInput,
): Promise<ReconcileInventoryCountResult> {
  return repository.transaction(async (tx) => {
    await assertActor(tx, input.salonId, input.actorUserId);
    const count = await tx.findCountForUpdate(input.salonId, input.countId);
    if (!count) fail("COUNT_NOT_FOUND");
    if (count.status === "posted") fail("COUNT_ALREADY_POSTED");
    if (count.status !== "draft" && count.status !== "counting") fail("COUNT_INVALID");
    const countLines = await tx.findCountLinesForUpdate(input.salonId, count.id);
    const reconciledCountLines: Array<WarehouseCountLineRecord & { countedQuantity: number }> = [];
    for (const countLine of countLines) {
      if (countLine.countedQuantity === null || !isInteger(countLine.countedQuantity)) fail("COUNT_INVALID");
      reconciledCountLines.push({ ...countLine, countedQuantity: countLine.countedQuantity });
    }
    const products = await lockProductsForUpdate(
      tx,
      input.salonId,
      reconciledCountLines.map((countLine) => countLine.productId),
    );
    const adjustmentLines: WarehouseDocumentLineRecord[] = [];
    for (const countLine of reconciledCountLines) {
      const product = products.get(countLine.productId);
      if (!product) fail("PRODUCT_NOT_FOUND");
      if (!product.trackStock) fail("UNTRACKED_PRODUCT");
      const differenceQuantity = countLine.countedQuantity - countLine.theoreticalQuantity;
      const differenceValueCents = differenceQuantity * product.averageCostCents;
      await tx.updateCountLine(input.salonId, countLine.id, { differenceQuantity, differenceValueCents });
      if (differenceQuantity === 0) continue;
      adjustmentLines.push({
        description: `Inventory count ${count.id}`,
        destination: "count",
        discountCents: 0,
        documentId: "",
        id: "",
        itemType: "resale",
        lineNumber: adjustmentLines.length + 1,
        netCents: 0,
        productId: product.id,
        quantity: Math.abs(differenceQuantity),
        salonId: input.salonId,
        stockDelta: differenceQuantity,
        supplierId: null,
        taxCents: 0,
        taxRateBasisPoints: 0,
        totalCents: 0,
        unitCostCents: product.averageCostCents,
        reversesDocumentLineId: null,
      });
    }
    let movementIds: string[] = [];
    if (adjustmentLines.length) {
      const adjustment = await tx.createDocument({
        competenceDate: null,
        createdByUserId: input.actorUserId,
        documentDate: new Date(),
        internalNumber: `COUNT-${count.id}`,
        kind: "adjustment",
        netTotalCents: 0,
        notes: `Inventory count ${count.id}`,
        reversalOfDocumentId: null,
        salonId: input.salonId,
        supplierId: null,
        taxTotalCents: 0,
        totalCents: 0,
      });
      await tx.attachCountDocument(input.salonId, count.id, adjustment.id);
      for (const line of adjustmentLines) {
        const { id: _id, ...lineInput } = line;
        await tx.createDocumentLine({ ...lineInput, documentId: adjustment.id });
      }
      movementIds = (await postWarehouseDocumentInTransaction(tx, {
        actorUserId: input.actorUserId,
        documentId: adjustment.id,
        salonId: input.salonId,
      })).movementIds;
    }
    if (!(await tx.markCountPosted(input.salonId, count.id, input.actorUserId))) fail("COUNT_ALREADY_POSTED");
    return { countId: count.id, movementIds, status: "posted" };
  });
}

function asDocumentRecord(value: typeof inventoryDocuments.$inferSelect): WarehouseDocumentRecord {
  return value as WarehouseDocumentRecord;
}

function asLineRecord(value: typeof inventoryDocumentLines.$inferSelect): WarehouseDocumentLineRecord {
  return value as WarehouseDocumentLineRecord;
}

function asProductRecord(value: typeof inventoryProducts.$inferSelect): WarehouseProductRecord {
  return value as WarehouseProductRecord;
}

function asMovementRecord(value: typeof inventoryMovements.$inferSelect): WarehouseMovementRecord {
  return value as WarehouseMovementRecord;
}

function drizzleTransaction(executor: DrizzleDB): WarehouseTransaction {
  return {
    async actorBelongsToSalon(salonId, actorUserId) {
      const rows = await executor.select({ id: users.id }).from(users).where(and(
        eq(users.id, actorUserId),
        eq(users.salonId, salonId),
        eq(users.active, true),
      ));
      return Boolean(rows[0]);
    },
    async createAsset(input) {
      const rows = await executor.insert(inventoryAssets).values(input).returning();
      return rows[0] as WarehouseAssetRecord;
    },
    async createDocument(input) {
      const rows = await executor.insert(inventoryDocuments).values({ ...input, status: "draft" }).returning();
      return asDocumentRecord(rows[0]!);
    },
    async createDocumentLine(input) {
      const rows = await executor.insert(inventoryDocumentLines).values(input).returning();
      return asLineRecord(rows[0]!);
    },
    async createExpense(input) {
      const rows = await executor.insert(inventoryExpenses).values(input).returning();
      return rows[0] as WarehouseExpenseRecord;
    },
    async createMovement(input) {
      const rows = await executor.insert(inventoryMovements).values(input).returning();
      return asMovementRecord(rows[0]!);
    },
    async findCountForUpdate(salonId, countId) {
      const rows = await executor.select().from(inventoryCounts).where(and(eq(inventoryCounts.id, countId), eq(inventoryCounts.salonId, salonId))).for("update");
      return rows[0] as WarehouseCountRecord | undefined;
    },
    async findCountLinesForUpdate(salonId, countId) {
      const rows = await executor.select().from(inventoryCountLines).where(and(eq(inventoryCountLines.countId, countId), eq(inventoryCountLines.salonId, salonId))).for("update");
      return rows as WarehouseCountLineRecord[];
    },
    async findDocumentForUpdate(salonId, documentId) {
      const rows = await executor.select().from(inventoryDocuments).where(and(eq(inventoryDocuments.id, documentId), eq(inventoryDocuments.salonId, salonId))).for("update");
      return rows[0] ? asDocumentRecord(rows[0]) : undefined;
    },
    async findDocumentLinesForUpdate(salonId, documentId) {
      const rows = await executor.select().from(inventoryDocumentLines).where(and(eq(inventoryDocumentLines.documentId, documentId), eq(inventoryDocumentLines.salonId, salonId))).for("update");
      return rows.map(asLineRecord);
    },
    async findExpensesForDocument(salonId, documentId) {
      const rows = await executor.select().from(inventoryExpenses).where(and(eq(inventoryExpenses.documentId, documentId), eq(inventoryExpenses.salonId, salonId))).for("update");
      return rows as WarehouseExpenseRecord[];
    },
    async findAssetsForDocument(salonId, documentId) {
      const rows = await executor.select().from(inventoryAssets).where(and(eq(inventoryAssets.documentId, documentId), eq(inventoryAssets.salonId, salonId))).for("update");
      return rows as WarehouseAssetRecord[];
    },
    async findMovementsForDocument(salonId, documentId) {
      const rows = await executor.select().from(inventoryMovements).where(and(eq(inventoryMovements.documentId, documentId), eq(inventoryMovements.salonId, salonId))).for("update");
      return rows.map(asMovementRecord);
    },
    async findProductForUpdate(salonId, productId) {
      const rows = await executor.select().from(inventoryProducts).where(and(eq(inventoryProducts.id, productId), eq(inventoryProducts.salonId, salonId))).for("update");
      return rows[0] ? asProductRecord(rows[0]) : undefined;
    },
    async markCountPosted(salonId, countId, actorUserId) {
      const rows = await executor.update(inventoryCounts).set({ postedAt: new Date(), postedByUserId: actorUserId, status: "posted" }).where(and(eq(inventoryCounts.id, countId), eq(inventoryCounts.salonId, salonId), inArray(inventoryCounts.status, ["draft", "counting"]))).returning({ id: inventoryCounts.id });
      return rows.length === 1;
    },
    async attachCountDocument(salonId, countId, documentId) {
      const rows = await executor.update(inventoryCounts).set({ documentId }).where(and(eq(inventoryCounts.id, countId), eq(inventoryCounts.salonId, salonId), inArray(inventoryCounts.status, ["draft", "counting"]))).returning({ id: inventoryCounts.id });
      if (!rows[0]) throw new Error("COUNT_NOT_FOUND");
    },
    async markDocumentPosted(salonId, documentId, actorUserId) {
      const rows = await executor.update(inventoryDocuments).set({ postedAt: new Date(), postedByUserId: actorUserId, status: "posted", updatedAt: new Date() }).where(and(eq(inventoryDocuments.id, documentId), eq(inventoryDocuments.salonId, salonId), eq(inventoryDocuments.status, "draft"))).returning({ id: inventoryDocuments.id });
      return rows.length === 1;
    },
    async markDocumentReversed(salonId, documentId) {
      const rows = await executor.update(inventoryDocuments).set({ status: "reversed", updatedAt: new Date() }).where(and(eq(inventoryDocuments.id, documentId), eq(inventoryDocuments.salonId, salonId), eq(inventoryDocuments.status, "posted"))).returning({ id: inventoryDocuments.id });
      return rows.length === 1;
    },
    async updateCountLine(salonId, countLineId, changes) {
      const rows = await executor.update(inventoryCountLines).set(changes).where(and(eq(inventoryCountLines.id, countLineId), eq(inventoryCountLines.salonId, salonId))).returning();
      if (!rows[0]) throw new Error("COUNT_LINE_NOT_FOUND");
      return rows[0] as WarehouseCountLineRecord;
    },
    async updateDocumentTotals(salonId, documentId, changes) {
      const rows = await executor.update(inventoryDocuments).set({ ...changes, updatedAt: new Date() }).where(and(eq(inventoryDocuments.id, documentId), eq(inventoryDocuments.salonId, salonId))).returning();
      if (!rows[0]) throw new Error("DOCUMENT_NOT_FOUND");
      return asDocumentRecord(rows[0]);
    },
    async updateLineTotals(salonId, lineId, changes) {
      const rows = await executor.update(inventoryDocumentLines).set(changes).where(and(eq(inventoryDocumentLines.id, lineId), eq(inventoryDocumentLines.salonId, salonId))).returning();
      if (!rows[0]) throw new Error("LINE_NOT_FOUND");
      return asLineRecord(rows[0]);
    },
    async updateProduct(salonId, productId, changes) {
      const rows = await executor.update(inventoryProducts).set({ ...changes, updatedAt: new Date() }).where(and(eq(inventoryProducts.id, productId), eq(inventoryProducts.salonId, salonId))).returning();
      if (!rows[0]) throw new Error("PRODUCT_NOT_FOUND");
      return asProductRecord(rows[0]);
    },
  };
}

/** Adapts the Task 2 Drizzle schema to the transaction boundary used by this service. */
export function createDrizzleWarehouseRepository(db: DrizzleDB): WarehouseRepository {
  return {
    transaction(work) {
      return db.transaction((tx) => work(drizzleTransaction(tx as unknown as DrizzleDB)));
    },
  };
}
