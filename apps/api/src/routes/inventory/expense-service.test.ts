import { describe, expect, it } from "vitest";

import { registerExpense, reverseExpense, type ExpenseCommandRepository, type ExpenseCommandTransaction } from "./expense-service.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function repo(): ExpenseCommandRepository & { failCashMovement: boolean; state: { cashMovements: unknown[]; documents: unknown[]; expenses: unknown[]; lines: unknown[]; stockMovements: unknown[] } } {
  const state = { cashMovements: [] as unknown[], documents: [] as unknown[], expenses: [] as unknown[], lines: [] as unknown[], stockMovements: [] as unknown[] };
  let nextId = 1;
  const target = {
    failCashMovement: false,
    state,
    async transaction<T>(work: (tx: ExpenseCommandTransaction) => Promise<T>): Promise<T> {
      const snapshot = clone(state);
      try {
        return await work({
          async actorBelongsToSalon() { return true; },
          async createCashMovement(input) {
            if (target.failCashMovement) throw new Error("CASH_MOVEMENT_FAILED");
            const row = { ...input, id: `cash-${nextId++}` };
            state.cashMovements.push(row);
            return row;
          },
          async createDocument(input) {
            const row = { ...input, id: `doc-${nextId++}` };
            state.documents.push(row);
            return row;
          },
          async createDocumentLine(input) {
            const row = { ...input, id: `line-${nextId++}` };
            state.lines.push(row);
            return row;
          },
          async createExpense(input) {
            const row = { ...input, id: `expense-${nextId++}` };
            state.expenses.push(row);
            return row;
          },
          async findExpenseByIdempotency(_salonId, idempotencyKey) {
            const expense = state.expenses.find((item) => (item as { idempotencyKey?: string }).idempotencyKey === idempotencyKey) as { cashMovementId: string; documentId: string; id: string } | undefined;
            return expense ? { cashMovementId: expense.cashMovementId, documentId: expense.documentId, expenseId: expense.id } : undefined;
          },
          async findExpenseForReverse(_salonId, expenseId) {
            const expense = state.expenses.find((item) => (item as { id: string }).id === expenseId) as {
              category: string;
              description: string;
              documentId: string;
              documentLineId: string | null;
              id: string;
              netCents: number;
              supplierId: string | null;
              taxCents: number;
              totalCents: number;
            } | undefined;
            return expense ? { ...expense, expenseId: expense.id } : undefined;
          },
          async markDocumentPosted() {},
          async nextDocumentNumber() { return `EXP-${nextId}`; },
        });
      } catch (error) {
        state.cashMovements = snapshot.cashMovements;
        state.documents = snapshot.documents;
        state.expenses = snapshot.expenses;
        state.lines = snapshot.lines;
        throw error;
      }
    },
  };
  return target;
}

const input = {
  actorUserId: "user-1",
  amountCents: 2000,
  category: "Varie",
  competenceDate: new Date("2026-08-28"),
  description: "Piccola spesa",
  idempotencyKey: "idem-1",
  netCents: 2000,
  paymentMethod: "cash" as const,
  salonId: "salon-1",
  taxCents: 0,
  transactionDate: new Date("2026-08-28"),
};

describe("registerExpense", () => {
  it("creates one posted expense and one cash outflow for the same idempotency key", async () => {
    const repository = repo();
    const first = await registerExpense(repository, input);
    const second = await registerExpense(repository, input);

    expect(second.expenseId).toBe(first.expenseId);
    expect(repository.state.expenses).toHaveLength(1);
    expect(repository.state.cashMovements).toHaveLength(1);
    expect(repository.state.stockMovements).toHaveLength(0);
  });

  it("rolls back the expense when cash movement creation fails", async () => {
    const repository = repo();
    repository.failCashMovement = true;

    await expect(registerExpense(repository, input)).rejects.toThrow("CASH_MOVEMENT_FAILED");
    expect(repository.state.expenses).toHaveLength(0);
    expect(repository.state.documents).toHaveLength(0);
  });

  it("reverses an expense with signed rows and a cash inflow", async () => {
    const repository = repo();
    const created = await registerExpense(repository, input);
    const reversed = await reverseExpense(repository, {
      actorUserId: input.actorUserId,
      expenseId: created.expenseId,
      idempotencyKey: `reverse:${created.expenseId}`,
      salonId: input.salonId,
      transactionDate: input.transactionDate,
    });

    expect(reversed.expenseId).not.toBe(created.expenseId);
    expect(repository.state.expenses).toHaveLength(2);
    expect(repository.state.cashMovements).toHaveLength(2);
    expect(repository.state.documents[1]).toMatchObject({ kind: "credit_note", netTotalCents: -2000, reversalOfDocumentId: created.documentId, totalCents: -2000 });
    expect(repository.state.lines[1]).toMatchObject({ netCents: -2000, reversesDocumentLineId: "line-2", totalCents: -2000 });
    expect(repository.state.cashMovements[1]).toMatchObject({ amountCents: 2000, direction: "in", idempotencyKey: `reverse:${created.expenseId}` });
    expect(repository.state.expenses[1]).toMatchObject({ netCents: -2000, reversesExpenseId: created.expenseId, totalCents: -2000 });
  });
});
