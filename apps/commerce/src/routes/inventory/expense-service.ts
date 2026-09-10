import type { WarehouseDocumentKind } from "./warehouse-types.js";

export type ExpensePaymentMethod = "cash" | "card" | "bank_transfer" | "other";

export interface RegisterExpenseInput {
  actorUserId: string;
  amountCents: number;
  category: string;
  competenceDate: Date;
  description: string;
  externalDocumentDate?: Date | null;
  externalReference?: string | null;
  idempotencyKey: string;
  netCents: number;
  notes?: string | null;
  paymentMethod: ExpensePaymentMethod;
  salonId: string;
  supplierId?: string | null;
  taxCents: number;
  transactionDate: Date;
}

export interface ReverseExpenseInput {
  actorUserId: string;
  expenseId: string;
  idempotencyKey: string;
  salonId: string;
  transactionDate: Date;
}

export interface ExpenseCommandResult {
  cashMovementId: string;
  documentId: string;
  expenseId: string;
}

export interface ExpenseCommandRepository {
  transaction<T>(work: (tx: ExpenseCommandTransaction) => Promise<T>): Promise<T>;
}

export interface ExpenseCommandTransaction {
  actorBelongsToSalon(salonId: string, actorUserId: string): Promise<boolean>;
  createCashMovement(input: {
    amountCents: number;
    category: string;
    createdByUserId: string;
    direction: "in" | "out";
    idempotencyKey: string;
    notes: string | null;
    occurredAt: Date;
    paymentMethod: ExpensePaymentMethod;
    reason: string;
    salonId: string;
    sourceId: string;
    sourceType: "inventory_expense";
  }): Promise<{ id: string }>;
  createDocument(input: {
    competenceDate: Date;
    createdByUserId: string;
    documentDate: Date;
    externalReference: string | null;
    internalNumber: string;
    kind: WarehouseDocumentKind;
    netTotalCents: number;
    notes: string | null;
    salonId: string;
    supplierId: string | null;
    taxTotalCents: number;
    totalCents: number;
    reversalOfDocumentId?: string | null;
  }): Promise<{ id: string }>;
  createDocumentLine(input: {
    description: string;
    documentId: string;
    itemType: "expense";
    lineNumber: number;
    netCents: number;
    productId: null;
    quantity: number;
    salonId: string;
    stockDelta: 0;
    supplierId: string | null;
    taxCents: number;
    taxRateBasisPoints: number;
    totalCents: number;
    unitCostCents: number;
    reversesDocumentLineId?: string | null;
  }): Promise<{ id: string }>;
  createExpense(input: {
    cashMovementId: string | null;
    category: string;
    competenceDate: Date;
    description: string;
    documentId: string;
    documentLineId: string;
    idempotencyKey: string;
    netCents: number;
    notes: string | null;
    salonId: string;
    supplierId: string | null;
    taxCents: number;
    totalCents: number;
    reversesExpenseId?: string | null;
  }): Promise<{ id: string }>;
  findExpenseByIdempotency(salonId: string, idempotencyKey: string): Promise<ExpenseCommandResult | undefined>;
  findExpenseForReverse(salonId: string, expenseId: string): Promise<{
    category: string;
    documentId: string;
    documentLineId: string | null;
    expenseId: string;
    netCents: number;
    description: string;
    supplierId: string | null;
    taxCents: number;
    totalCents: number;
  } | undefined>;
  markDocumentPosted(salonId: string, documentId: string, actorUserId: string): Promise<void>;
  nextDocumentNumber(salonId: string, kind: WarehouseDocumentKind, date: Date): Promise<string>;
}

function assertExpense(input: RegisterExpenseInput) {
  if (!input.idempotencyKey.trim()) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  if (!input.description.trim() || !input.category.trim()) throw new Error("EXPENSE_DESCRIPTION_REQUIRED");
  if (input.amountCents <= 0 || input.netCents < 0 || input.taxCents < 0) throw new Error("INVALID_EXPENSE_TOTALS");
  if (input.netCents + input.taxCents !== input.amountCents) throw new Error("INVALID_EXPENSE_TOTALS");
}

export async function registerExpense(
  repository: ExpenseCommandRepository,
  input: RegisterExpenseInput,
): Promise<ExpenseCommandResult> {
  assertExpense(input);
  return repository.transaction(async (tx) => {
    if (!(await tx.actorBelongsToSalon(input.salonId, input.actorUserId))) throw new Error("ACTOR_FORBIDDEN");
    const existing = await tx.findExpenseByIdempotency(input.salonId, input.idempotencyKey);
    if (existing) return existing;
    const document = await tx.createDocument({
      competenceDate: input.competenceDate,
      createdByUserId: input.actorUserId,
      documentDate: input.externalDocumentDate ?? input.transactionDate,
      externalReference: input.externalReference ?? null,
      internalNumber: await tx.nextDocumentNumber(input.salonId, "expense", input.transactionDate),
      kind: "expense",
      netTotalCents: input.netCents,
      notes: input.notes ?? null,
      salonId: input.salonId,
      supplierId: input.supplierId ?? null,
      taxTotalCents: input.taxCents,
      totalCents: input.amountCents,
    });
    const line = await tx.createDocumentLine({
      description: input.description.trim(),
      documentId: document.id,
      itemType: "expense",
      lineNumber: 1,
      netCents: input.netCents,
      productId: null,
      quantity: 1,
      salonId: input.salonId,
      stockDelta: 0,
      supplierId: input.supplierId ?? null,
      taxCents: input.taxCents,
      taxRateBasisPoints: input.netCents > 0 ? Math.round((input.taxCents / input.netCents) * 10_000) : 0,
      totalCents: input.amountCents,
      unitCostCents: input.netCents,
    });
    const cashMovement = await tx.createCashMovement({
      amountCents: input.amountCents,
      category: input.category.trim(),
      createdByUserId: input.actorUserId,
      direction: "out",
      idempotencyKey: input.idempotencyKey,
      notes: input.notes ?? null,
      occurredAt: input.transactionDate,
      paymentMethod: input.paymentMethod,
      reason: input.description.trim(),
      salonId: input.salonId,
      sourceId: document.id,
      sourceType: "inventory_expense",
    });
    const expense = await tx.createExpense({
      cashMovementId: cashMovement.id,
      category: input.category.trim(),
      competenceDate: input.competenceDate,
      description: input.description.trim(),
      documentId: document.id,
      documentLineId: line.id,
      idempotencyKey: input.idempotencyKey,
      netCents: input.netCents,
      notes: input.notes ?? null,
      salonId: input.salonId,
      supplierId: input.supplierId ?? null,
      taxCents: input.taxCents,
      totalCents: input.amountCents,
    });
    await tx.markDocumentPosted(input.salonId, document.id, input.actorUserId);
    return { cashMovementId: cashMovement.id, documentId: document.id, expenseId: expense.id };
  });
}

export async function reverseExpense(
  repository: ExpenseCommandRepository,
  input: ReverseExpenseInput,
): Promise<ExpenseCommandResult> {
  if (!input.idempotencyKey.trim()) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  return repository.transaction(async (tx) => {
    if (!(await tx.actorBelongsToSalon(input.salonId, input.actorUserId))) throw new Error("ACTOR_FORBIDDEN");
    const existing = await tx.findExpenseByIdempotency(input.salonId, input.idempotencyKey);
    if (existing) return existing;
    const source = await tx.findExpenseForReverse(input.salonId, input.expenseId);
    if (!source) throw new Error("EXPENSE_NOT_FOUND");
    if (source.totalCents <= 0) throw new Error("EXPENSE_ALREADY_REVERSED");
    const document = await tx.createDocument({
      competenceDate: input.transactionDate,
      createdByUserId: input.actorUserId,
      documentDate: input.transactionDate,
      externalReference: null,
      internalNumber: await tx.nextDocumentNumber(input.salonId, "credit_note", input.transactionDate),
      kind: "credit_note",
      netTotalCents: -source.netCents,
      notes: `Storno spesa ${source.expenseId}`,
      reversalOfDocumentId: source.documentId,
      salonId: input.salonId,
      supplierId: source.supplierId,
      taxTotalCents: -source.taxCents,
      totalCents: -source.totalCents,
    });
    const line = await tx.createDocumentLine({
      description: `Storno ${source.description}`,
      documentId: document.id,
      itemType: "expense",
      lineNumber: 1,
      netCents: -source.netCents,
      productId: null,
      quantity: 1,
      reversesDocumentLineId: source.documentLineId,
      salonId: input.salonId,
      stockDelta: 0,
      supplierId: source.supplierId,
      taxCents: -source.taxCents,
      taxRateBasisPoints: source.netCents > 0 ? Math.round((source.taxCents / source.netCents) * 10_000) : 0,
      totalCents: -source.totalCents,
      unitCostCents: source.netCents,
    });
    const cashMovement = await tx.createCashMovement({
      amountCents: source.totalCents,
      category: source.category,
      createdByUserId: input.actorUserId,
      direction: "in",
      idempotencyKey: input.idempotencyKey,
      notes: `Storno spesa ${source.expenseId}`,
      occurredAt: input.transactionDate,
      paymentMethod: "cash",
      reason: `Storno ${source.description}`,
      salonId: input.salonId,
      sourceId: document.id,
      sourceType: "inventory_expense",
    });
    const expense = await tx.createExpense({
      cashMovementId: cashMovement.id,
      category: source.category,
      competenceDate: input.transactionDate,
      description: `Storno ${source.description}`,
      documentId: document.id,
      documentLineId: line.id,
      idempotencyKey: input.idempotencyKey,
      netCents: -source.netCents,
      notes: `Storno spesa ${source.expenseId}`,
      reversesExpenseId: source.expenseId,
      salonId: input.salonId,
      supplierId: source.supplierId,
      taxCents: -source.taxCents,
      totalCents: -source.totalCents,
    });
    await tx.markDocumentPosted(input.salonId, document.id, input.actorUserId);
    return { cashMovementId: cashMovement.id, documentId: document.id, expenseId: expense.id };
  });
}
