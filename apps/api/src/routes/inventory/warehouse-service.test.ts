import { describe, expect, it } from "vitest";

import type {
  WarehouseDocumentRecord,
  WarehouseDocumentLineRecord,
  WarehouseRepository,
  WarehouseState,
  WarehouseTransaction,
} from "./warehouse-types.js";
import {
  WarehouseConflictError,
  postWarehouseDocument,
  reconcileInventoryCount,
  reverseWarehouseDocument,
} from "./warehouse-service.js";

const now = new Date("2026-08-26T10:00:00.000Z");

function document(overrides: Partial<WarehouseDocumentRecord> = {}): WarehouseDocumentRecord {
  return {
    competenceDate: now,
    createdByUserId: "owner-1",
    documentDate: now,
    id: "document-1",
    internalNumber: "PUR-1",
    kind: "purchase",
    netTotalCents: 0,
    notes: null,
    postedAt: null,
    postedByUserId: null,
    reversalOfDocumentId: null,
    salonId: "salon-1",
    status: "draft",
    supplierId: null,
    taxTotalCents: 0,
    totalCents: 0,
    ...overrides,
  };
}

function line(overrides: Partial<WarehouseDocumentLineRecord> = {}): WarehouseDocumentLineRecord {
  return {
    description: "Prodotto",
    discountCents: 0,
    documentId: "document-1",
    id: "line-1",
    itemType: "resale",
    lineNumber: 1,
    netCents: 0,
    productId: "product-1",
    quantity: 1,
    salonId: "salon-1",
    stockDelta: 1,
    supplierId: null,
    taxCents: 0,
    taxRateBasisPoints: 0,
    totalCents: 0,
    unitCostCents: 1_000,
    reversesDocumentLineId: null,
    ...overrides,
  };
}

function movement(overrides: Partial<WarehouseState["movements"][number]> = {}): WarehouseState["movements"][number] {
  return {
    createdByUserId: "owner-1",
    delta: 1,
    documentId: "document-1",
    documentLineId: null,
    id: "movement-1",
    movementType: "document_posting",
    note: null,
    productId: "product-1",
    reason: "purchase",
    reversesMovementId: null,
    salonId: "salon-1",
    stockAfter: 1,
    stockBefore: 0,
    unitCostCents: 1_000,
    valueCents: 1_000,
    ...overrides,
  };
}

function state(overrides: Partial<WarehouseState> = {}): WarehouseState {
  return {
    assets: [],
    counts: [],
    countLines: [],
    documents: [document()],
    expenses: [],
    lines: [line()],
    movements: [],
    nextId: 1,
    products: [{
      allowNegativeStock: false,
      averageCostCents: 900,
      id: "product-1",
      lastCostCents: 900,
      salonId: "salon-1",
      stockQuantity: 0,
      trackStock: true,
    }],
    ...overrides,
  };
}

function memoryRepository(initial: WarehouseState): { productLocks: string[]; repository: WarehouseRepository; state: WarehouseState } {
  let current = structuredClone(initial);
  const productLocks: string[] = [];

  function transactionView(draft: WarehouseState) {
    const findDocument = (salonId: string, documentId: string) =>
      draft.documents.find((item) => item.id === documentId && item.salonId === salonId);
    const nextId = (prefix: string) => `${prefix}-${draft.nextId++}`;

    return {
      async actorBelongsToSalon(salonId: string, actorUserId: string) {
        return salonId === "salon-1" && actorUserId === "owner-1";
      },
      async createAsset(input: Omit<WarehouseState["assets"][number], "id">) {
        const created = { ...input, id: nextId("asset") };
        draft.assets.push(created);
        return created;
      },
      async createDocument(input: Omit<WarehouseDocumentRecord, "id" | "status" | "postedAt" | "postedByUserId">) {
        const created = {
          ...input,
          id: nextId("document"),
          postedAt: null,
          postedByUserId: null,
          status: "draft" as const,
        };
        draft.documents.push(created);
        return created;
      },
      async createDocumentLine(input: Omit<WarehouseDocumentLineRecord, "id">) {
        const created = { ...input, id: nextId("line") };
        draft.lines.push(created);
        return created;
      },
      async createExpense(input: Omit<WarehouseState["expenses"][number], "id">) {
        const created = { ...input, id: nextId("expense") };
        draft.expenses.push(created);
        return created;
      },
      async createMovement(input: Omit<WarehouseState["movements"][number], "id">) {
        const created = { ...input, id: nextId("movement") };
        draft.movements.push(created);
        return created;
      },
      async findCountForUpdate(salonId: string, countId: string) {
        return draft.counts.find((item) => item.id === countId && item.salonId === salonId);
      },
      async findCountLinesForUpdate(salonId: string, countId: string) {
        return draft.countLines.filter((item) => item.countId === countId && item.salonId === salonId);
      },
      async findDocumentForUpdate(salonId: string, documentId: string) {
        return findDocument(salonId, documentId);
      },
      async findDocumentLinesForUpdate(salonId: string, documentId: string) {
        return draft.lines.filter((item) => item.documentId === documentId && item.salonId === salonId);
      },
      async findExpensesForDocument(salonId: string, documentId: string) {
        return draft.expenses.filter((item) => item.documentId === documentId && item.salonId === salonId);
      },
      async findAssetsForDocument(salonId: string, documentId: string) {
        return draft.assets.filter((item) => item.documentId === documentId && item.salonId === salonId);
      },
      async findMovementsForDocument(salonId: string, documentId: string) {
        return draft.movements.filter((item) => item.documentId === documentId && item.salonId === salonId);
      },
      async findProductForUpdate(salonId: string, productId: string) {
        productLocks.push(productId);
        return draft.products.find((item) => item.id === productId && item.salonId === salonId);
      },
      async markCountPosted(salonId: string, countId: string, actorUserId: string) {
        const item = draft.counts.find((count) => count.id === countId && count.salonId === salonId && count.status !== "posted");
        if (!item) return false;
        item.postedAt = now;
        item.postedByUserId = actorUserId;
        item.status = "posted";
        return true;
      },
      async markDocumentPosted(salonId: string, documentId: string, actorUserId: string) {
        const item = draft.documents.find((doc) => doc.id === documentId && doc.salonId === salonId && doc.status === "draft");
        if (!item) return false;
        item.postedAt = now;
        item.postedByUserId = actorUserId;
        item.status = "posted";
        return true;
      },
      async markDocumentReversed(salonId: string, documentId: string) {
        const item = findDocument(salonId, documentId);
        if (!item || item.status !== "posted") return false;
        item.status = "reversed";
        return true;
      },
      async updateCountLine(salonId: string, countLineId: string, changes: Pick<WarehouseState["countLines"][number], "differenceQuantity" | "differenceValueCents">) {
        const item = draft.countLines.find((countLine) => countLine.id === countLineId && countLine.salonId === salonId);
        if (!item) throw new Error("COUNT_LINE_NOT_FOUND");
        Object.assign(item, changes);
        return item;
      },
      async updateDocumentTotals(salonId: string, documentId: string, changes: Pick<WarehouseDocumentRecord, "netTotalCents" | "taxTotalCents" | "totalCents">) {
        const item = findDocument(salonId, documentId);
        if (!item) throw new Error("DOCUMENT_NOT_FOUND");
        Object.assign(item, changes);
        return item;
      },
      async updateLineTotals(salonId: string, lineId: string, changes: Pick<WarehouseDocumentLineRecord, "netCents" | "taxCents" | "totalCents">) {
        const item = draft.lines.find((warehouseLine) => warehouseLine.id === lineId && warehouseLine.salonId === salonId);
        if (!item) throw new Error("LINE_NOT_FOUND");
        Object.assign(item, changes);
        return item;
      },
      async updateProduct(salonId: string, productId: string, changes: Pick<WarehouseState["products"][number], "averageCostCents" | "lastCostCents" | "stockQuantity">) {
        const item = draft.products.find((product) => product.id === productId && product.salonId === salonId);
        if (!item) throw new Error("PRODUCT_NOT_FOUND");
        Object.assign(item, changes);
        return item;
      },
    };
  }

  return {
    productLocks,
    get state() { return current; },
    repository: {
      async transaction<T>(work: (tx: WarehouseTransaction) => Promise<T>): Promise<T> {
        const draft = structuredClone(current);
        const result = await work(transactionView(draft));
        current = draft;
        return result;
      },
    },
  };
}

describe("warehouse document posting", () => {
  it("posts a mixed purchase with tracked stock, expense and equipment records", async () => {
    const memory = memoryRepository(state({
      lines: [
        line({ discountCents: 200, quantity: 2, stockDelta: 2, taxRateBasisPoints: 1_000 }),
        line({ description: "Materiali", id: "line-2", itemType: "expense", lineNumber: 2, productId: null, stockDelta: 0, unitCostCents: 2_000 }),
        line({ description: "Lampada", id: "line-3", itemType: "equipment", lineNumber: 3, productId: null, stockDelta: 0, unitCostCents: 5_000 }),
      ],
    }));

    const result = await postWarehouseDocument(memory.repository, {
      actorUserId: "owner-1",
      documentId: "document-1",
      salonId: "salon-1",
    });

    expect(result).toMatchObject({ assetIds: ["asset-3"], expenseIds: ["expense-2"], movementIds: ["movement-1"], status: "posted" });
    expect(memory.state.products[0]).toMatchObject({ averageCostCents: 900, lastCostCents: 900, stockQuantity: 2 });
    expect(memory.state.documents[0]).toMatchObject({ netTotalCents: 8_800, taxTotalCents: 180, totalCents: 8_980, status: "posted" });
    expect(memory.state.expenses[0]).toMatchObject({ documentLineId: "line-2", totalCents: 2_000 });
    expect(memory.state.assets[0]).toMatchObject({ documentLineId: "line-3", purchaseCostCents: 5_000 });
  });

  it("posts a draft only once and preserves the first state", async () => {
    const memory = memoryRepository(state());
    await postWarehouseDocument(memory.repository, { actorUserId: "owner-1", documentId: "document-1", salonId: "salon-1" });

    await expect(postWarehouseDocument(memory.repository, {
      actorUserId: "owner-1",
      documentId: "document-1",
      salonId: "salon-1",
    })).rejects.toMatchObject({ code: "DOCUMENT_ALREADY_POSTED" } satisfies Partial<WarehouseConflictError>);
    expect(memory.state.movements).toHaveLength(1);
    expect(memory.state.products[0]?.stockQuantity).toBe(1);
  });

  it("uses net cost for inbound valuation while preserving valuation for an outbound issue", async () => {
    const inbound = memoryRepository(state({
      lines: [line({ quantity: 2, stockDelta: 2, unitCostCents: 1_000 })],
      products: [{ allowNegativeStock: false, averageCostCents: 500, id: "product-1", lastCostCents: 500, salonId: "salon-1", stockQuantity: 4, trackStock: true }],
    }));
    await postWarehouseDocument(inbound.repository, { actorUserId: "owner-1", documentId: "document-1", salonId: "salon-1" });
    expect(inbound.state.products[0]).toMatchObject({ averageCostCents: 667, lastCostCents: 1_000, stockQuantity: 6 });
    expect(inbound.state.movements[0]).toMatchObject({ unitCostCents: 1_000, valueCents: 2_000 });

    const outbound = memoryRepository(state({
      lines: [line({ stockDelta: -1, unitCostCents: 50 })],
      products: [{ allowNegativeStock: false, averageCostCents: 700, id: "product-1", lastCostCents: 650, salonId: "salon-1", stockQuantity: 3, trackStock: true }],
    }));
    await postWarehouseDocument(outbound.repository, { actorUserId: "owner-1", documentId: "document-1", salonId: "salon-1" });
    expect(outbound.state.products[0]).toMatchObject({ averageCostCents: 700, lastCostCents: 650, stockQuantity: 2 });
    expect(outbound.state.movements[0]).toMatchObject({ unitCostCents: 700, valueCents: -700 });
  });

  it("rejects a positive adjustment without an explicit usable cost", async () => {
    const memory = memoryRepository(state({
      documents: [document({ kind: "adjustment" })],
      lines: [line({ stockDelta: 1, unitCostCents: 0 })],
    }));

    await expect(postWarehouseDocument(memory.repository, {
      actorUserId: "owner-1",
      documentId: "document-1",
      salonId: "salon-1",
    })).rejects.toMatchObject({ code: "MISSING_POSITIVE_ADJUSTMENT_COST" });
  });

  it("rolls back every effect when a tracked line would violate the negative-stock policy", async () => {
    const memory = memoryRepository(state({
      lines: [line({ itemType: "consumable", stockDelta: -2 })],
      products: [{ allowNegativeStock: false, averageCostCents: 900, id: "product-1", lastCostCents: 900, salonId: "salon-1", stockQuantity: 1, trackStock: true }],
    }));
    const before = structuredClone(memory.state);

    await expect(postWarehouseDocument(memory.repository, {
      actorUserId: "owner-1",
      documentId: "document-1",
      salonId: "salon-1",
    })).rejects.toMatchObject({ code: "NEGATIVE_STOCK_FORBIDDEN" } satisfies Partial<WarehouseConflictError>);
    expect(memory.state).toEqual(before);
  });

  it("reverses stock and monetary rows with immutable signed compensation links", async () => {
    const memory = memoryRepository(state({
      lines: [
        line(),
        line({ description: "Materiali", id: "line-2", itemType: "expense", lineNumber: 2, productId: null, stockDelta: 0, unitCostCents: 2_000 }),
        line({ description: "Lampada", id: "line-3", itemType: "equipment", lineNumber: 3, productId: null, stockDelta: 0, unitCostCents: 5_000 }),
      ],
    }));
    await postWarehouseDocument(memory.repository, { actorUserId: "owner-1", documentId: "document-1", salonId: "salon-1" });

    const reversal = await reverseWarehouseDocument(memory.repository, {
      actorUserId: "owner-1",
      documentId: "document-1",
      salonId: "salon-1",
    });

    expect(reversal).toMatchObject({ status: "posted" });
    expect(reversal.assetIds).toHaveLength(1);
    expect(reversal.expenseIds).toHaveLength(1);
    expect(memory.state.documents.find((item) => item.id === "document-1")?.status).toBe("reversed");
    expect(memory.state.documents.find((item) => item.id === reversal.documentId)).toMatchObject({ netTotalCents: -8_000, reversalOfDocumentId: "document-1", status: "posted", totalCents: -8_000 });
    expect(memory.state.products[0]?.stockQuantity).toBe(0);
    expect(memory.state.movements).toHaveLength(2);
    expect(memory.state.movements[1]).toMatchObject({ delta: -1, reversesMovementId: memory.state.movements[0]?.id, valueCents: -1_000 });
    expect(memory.state.lines.find((item) => item.reversesDocumentLineId === "line-1")).toMatchObject({ netCents: -1_000, totalCents: -1_000 });
    expect(memory.state.expenses.find((item) => item.reversesExpenseId === "expense-2")).toMatchObject({ netCents: -2_000, totalCents: -2_000 });
    expect(memory.state.assets.find((item) => item.reversesAssetId === "asset-3")).toMatchObject({ purchaseCostCents: -5_000 });
  });

  it("locks reversal products once in lexical order before replaying source movements", async () => {
    const memory = memoryRepository(state({
      documents: [document({ status: "posted" })],
      lines: [],
      movements: [
        movement({ id: "movement-z-1", productId: "product-z" }),
        movement({ id: "movement-a-1", productId: "product-a" }),
        movement({ id: "movement-z-2", productId: "product-z" }),
      ],
      products: [
        { allowNegativeStock: false, averageCostCents: 100, id: "product-a", lastCostCents: 100, salonId: "salon-1", stockQuantity: 1, trackStock: true },
        { allowNegativeStock: false, averageCostCents: 100, id: "product-z", lastCostCents: 100, salonId: "salon-1", stockQuantity: 2, trackStock: true },
      ],
    }));

    await reverseWarehouseDocument(memory.repository, { actorUserId: "owner-1", documentId: "document-1", salonId: "salon-1" });

    expect(memory.productLocks).toEqual(["product-a", "product-z"]);
  });
});

describe("inventory count reconciliation", () => {
  it("creates an immutable count adjustment from counted quantity", async () => {
    const memory = memoryRepository(state({
      counts: [{ documentId: "document-1", id: "count-1", postedAt: null, postedByUserId: null, salonId: "salon-1", status: "counting" }],
      countLines: [{ countId: "count-1", countedQuantity: 5, differenceQuantity: null, differenceValueCents: 0, id: "count-line-1", productId: "product-1", salonId: "salon-1", theoreticalQuantity: 2 }],
      products: [{ allowNegativeStock: false, averageCostCents: 1_000, id: "product-1", lastCostCents: 1_000, salonId: "salon-1", stockQuantity: 2, trackStock: true }],
    }));

    const result = await reconcileInventoryCount(memory.repository, {
      actorUserId: "owner-1",
      countId: "count-1",
      salonId: "salon-1",
    });

    expect(result).toMatchObject({ countId: "count-1", movementIds: ["movement-1"], status: "posted" });
    expect(memory.state.counts[0]).toMatchObject({ status: "posted" });
    expect(memory.state.countLines[0]).toMatchObject({ differenceQuantity: 3, differenceValueCents: 3_000 });
    expect(memory.state.products[0]?.stockQuantity).toBe(5);
    expect(memory.state.movements[0]).toMatchObject({ documentId: "document-1" });
  });

  it("locks count products once in lexical order before reconciling count lines", async () => {
    const memory = memoryRepository(state({
      counts: [{ documentId: null, id: "count-1", postedAt: null, postedByUserId: null, salonId: "salon-1", status: "counting" }],
      countLines: [
        { countId: "count-1", countedQuantity: 1, differenceQuantity: null, differenceValueCents: 0, id: "count-line-z", productId: "product-z", salonId: "salon-1", theoreticalQuantity: 1 },
        { countId: "count-1", countedQuantity: 1, differenceQuantity: null, differenceValueCents: 0, id: "count-line-a", productId: "product-a", salonId: "salon-1", theoreticalQuantity: 1 },
      ],
      products: [
        { allowNegativeStock: false, averageCostCents: 100, id: "product-a", lastCostCents: 100, salonId: "salon-1", stockQuantity: 1, trackStock: true },
        { allowNegativeStock: false, averageCostCents: 100, id: "product-z", lastCostCents: 100, salonId: "salon-1", stockQuantity: 1, trackStock: true },
      ],
    }));

    await reconcileInventoryCount(memory.repository, { actorUserId: "owner-1", countId: "count-1", salonId: "salon-1" });

    expect(memory.productLocks).toEqual(["product-a", "product-z"]);
  });
});
