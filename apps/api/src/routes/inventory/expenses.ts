import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import {
  cashMovements,
  inventoryDocumentLines,
  inventoryDocuments,
  inventoryExpenses,
  type paymentMethodEnum,
  users,
} from "@esse-beauty/db/schema";
import { MODULE_KEYS, requireModule } from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { authenticate, requirePermission } from "../../middleware/auth.js";
import { nextInventoryDocumentNumber } from "./document-number.js";
import {
  registerExpense,
  reverseExpense,
  type ExpenseCommandRepository,
  type ExpenseCommandTransaction,
  type ExpensePaymentMethod,
  type RegisterExpenseInput,
} from "./expense-service.js";

const guard = [authenticate, requireModule(MODULE_KEYS.INVENTORY), requirePermission(PERMISSION_KEYS.INVENTORY_MANAGE)];
const paymentMethods = new Set(["cash", "card", "bank_transfer", "other"]);

type PaymentMethod = typeof paymentMethodEnum.enumValues[number];

function ownsSalon(request: { params: { id: string }; salonId: string }, reply: { code(status: number): { send(body: unknown): unknown } }) {
  return request.params.id === request.salonId || reply.code(403).send({ error: "FORBIDDEN" });
}

function parseDate(value: unknown, fallback = new Date()) {
  if (typeof value !== "string" || !value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

function input(body: ExpenseBody, salonId: string, actorUserId: string): RegisterExpenseInput | undefined {
  const transactionDate = parseDate(body.transaction_date);
  const competenceDate = parseDate(body.competence_date, transactionDate ?? new Date());
  const externalDocumentDate = body.external_document_date ? parseDate(body.external_document_date) : null;
  if (!transactionDate || !competenceDate || externalDocumentDate === undefined) return undefined;
  if (!paymentMethods.has(body.payment_method)) return undefined;
  return {
    actorUserId,
    amountCents: body.amount_cents,
    category: body.category,
    competenceDate,
    description: body.description,
    externalDocumentDate,
    externalReference: body.external_reference ?? null,
    idempotencyKey: body.idempotency_key,
    netCents: body.net_cents,
    notes: body.notes ?? null,
    paymentMethod: body.payment_method as ExpensePaymentMethod,
    salonId,
    supplierId: body.supplier_id ?? null,
    taxCents: body.tax_cents,
    transactionDate,
  };
}

function drizzleExpenseRepository(executor: DrizzleDB): ExpenseCommandRepository {
  function tx(db: DrizzleDB): ExpenseCommandTransaction {
    return {
      async actorBelongsToSalon(salonId, actorUserId) {
        const rows = await db.select({ id: users.id }).from(users).where(and(eq(users.id, actorUserId), eq(users.salonId, salonId), eq(users.active, true)));
        return Boolean(rows[0]);
      },
      async createCashMovement(value) {
        const rows = await db.insert(cashMovements).values({
          amountCents: value.amountCents,
          category: value.category,
          createdByUserId: value.createdByUserId,
          direction: value.direction,
          idempotencyKey: value.idempotencyKey,
          notes: value.notes,
          occurredAt: value.occurredAt,
          paymentMethod: value.paymentMethod as PaymentMethod,
          reason: value.reason,
          salonId: value.salonId,
          sourceId: value.sourceId,
          sourceType: value.sourceType,
        }).returning({ id: cashMovements.id });
        return rows[0]!;
      },
      async createDocument(value) {
        const rows = await db.insert(inventoryDocuments).values({ ...value, status: "draft" }).returning({ id: inventoryDocuments.id });
        return rows[0]!;
      },
      async createDocumentLine(value) {
        const rows = await db.insert(inventoryDocumentLines).values(value).returning({ id: inventoryDocumentLines.id });
        return rows[0]!;
      },
      async createExpense(value) {
        const rows = await db.insert(inventoryExpenses).values(value).returning({ id: inventoryExpenses.id });
        return rows[0]!;
      },
      async findExpenseByIdempotency(salonId, idempotencyKey) {
        const rows = await db.select({
          cashMovementId: inventoryExpenses.cashMovementId,
          documentId: inventoryExpenses.documentId,
          expenseId: inventoryExpenses.id,
        }).from(inventoryExpenses).where(and(eq(inventoryExpenses.salonId, salonId), eq(inventoryExpenses.idempotencyKey, idempotencyKey)));
        const row = rows[0];
        return row?.cashMovementId ? { cashMovementId: row.cashMovementId, documentId: row.documentId, expenseId: row.expenseId } : undefined;
      },
      async findExpenseForReverse(salonId, expenseId) {
        const rows = await db.select({
          category: inventoryExpenses.category,
          description: inventoryExpenses.description,
          documentId: inventoryExpenses.documentId,
          documentLineId: inventoryExpenses.documentLineId,
          expenseId: inventoryExpenses.id,
          netCents: inventoryExpenses.netCents,
          supplierId: inventoryExpenses.supplierId,
          taxCents: inventoryExpenses.taxCents,
          totalCents: inventoryExpenses.totalCents,
        }).from(inventoryExpenses).where(and(eq(inventoryExpenses.id, expenseId), eq(inventoryExpenses.salonId, salonId)));
        return rows[0];
      },
      async markDocumentPosted(salonId, documentId, actorUserId) {
        await db.update(inventoryDocuments).set({ postedAt: new Date(), postedByUserId: actorUserId, status: "posted", updatedAt: new Date() }).where(and(eq(inventoryDocuments.id, documentId), eq(inventoryDocuments.salonId, salonId)));
      },
      nextDocumentNumber(salonId, kind, date) {
        return nextInventoryDocumentNumber(db, { date, kind, salonId });
      },
    };
  }
  return { transaction: (work) => executor.transaction((inner) => work(tx(inner as unknown as DrizzleDB))) };
}

export async function registerInventoryExpenseRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string }; Body: ExpenseBody }>("/api/salons/:id/inventory/expenses", { preHandler: guard }, async (request, reply) => {
    if (ownsSalon(request, reply) !== true) return;
    const command = input(request.body, request.salonId, request.user.id);
    if (!command) return reply.code(422).send({ error: "INVALID_EXPENSE" });
    try {
      return reply.code(201).send(await registerExpense(drizzleExpenseRepository(app.db), command));
    } catch (error) {
      return reply.code(error instanceof Error && error.message === "ACTOR_FORBIDDEN" ? 403 : 422).send({ error: error instanceof Error ? error.message : "EXPENSE_NOT_CREATED" });
    }
  });

  app.post<{ Params: { id: string; expenseId: string } }>("/api/salons/:id/inventory/expenses/:expenseId/reverse", { preHandler: guard }, async (request, reply) => {
    if (ownsSalon(request, reply) !== true) return;
    try {
      const result = await reverseExpense(drizzleExpenseRepository(app.db), {
        actorUserId: request.user.id,
        expenseId: request.params.expenseId,
        idempotencyKey: `reverse:${request.params.expenseId}`,
        salonId: request.salonId,
        transactionDate: new Date(),
      });
      return reply.code(201).send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "EXPENSE_NOT_REVERSED";
      return reply.code(message === "EXPENSE_NOT_FOUND" ? 404 : 422).send({ error: message });
    }
  });
}

interface ExpenseBody {
  amount_cents: number;
  category: string;
  competence_date?: string;
  description: string;
  external_document_date?: string | null;
  external_reference?: string | null;
  idempotency_key: string;
  net_cents: number;
  notes?: string | null;
  payment_method: string;
  supplier_id?: string | null;
  tax_cents: number;
  transaction_date?: string;
}
