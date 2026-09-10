import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import {
  cashMovements,
  inventoryAssets,
  inventoryDocumentLines,
  inventoryDocuments,
  type paymentMethodEnum,
  users,
} from "@esse-beauty/db/schema";
import { MODULE_KEYS, requireModule } from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { authenticate, requirePermission } from "../../middleware/auth.js";
import { nextInventoryDocumentNumber } from "./document-number.js";
import {
  disposeAsset,
  registerAssetPurchase,
  type AssetCommandRepository,
  type AssetCommandTransaction,
  type RegisterAssetInput,
} from "./asset-service.js";
import type { ExpensePaymentMethod } from "./expense-service.js";

const guard = [authenticate, requireModule(MODULE_KEYS.INVENTORY), requirePermission(PERMISSION_KEYS.INVENTORY_MANAGE)];
const paymentMethods = new Set(["cash", "card", "bank_transfer", "other"]);
type PaymentMethod = typeof paymentMethodEnum.enumValues[number];

function ownsSalon(request: { params: { id: string }; salonId: string }, reply: { code(status: number): { send(body: unknown): unknown } }) {
  return request.params.id === request.salonId || reply.code(403).send({ error: "FORBIDDEN" });
}

function parseDate(value: unknown, fallback?: Date) {
  if (typeof value !== "string" || !value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

function input(body: AssetBody, salonId: string, actorUserId: string): RegisterAssetInput | undefined {
  const purchaseDate = parseDate(body.purchase_date);
  const warrantyExpiresAt = body.warranty_expires_at ? parseDate(body.warranty_expires_at) : null;
  if (!purchaseDate || warrantyExpiresAt === undefined || !paymentMethods.has(body.payment_method)) return undefined;
  return {
    actorUserId,
    description: body.description,
    externalReference: body.external_reference ?? null,
    idempotencyKey: body.idempotency_key,
    location: body.location ?? null,
    notes: body.notes ?? null,
    paymentMethod: body.payment_method as ExpensePaymentMethod,
    purchaseCostCents: body.purchase_cost_cents,
    purchaseDate,
    salonId,
    serialNumber: body.serial_number ?? null,
    supplierId: body.supplier_id ?? null,
    warrantyExpiresAt,
  };
}

function drizzleAssetRepository(executor: DrizzleDB): AssetCommandRepository {
  function tx(db: DrizzleDB): AssetCommandTransaction {
    return {
      async actorBelongsToSalon(salonId, actorUserId) {
        const rows = await db.select({ id: users.id }).from(users).where(and(eq(users.id, actorUserId), eq(users.salonId, salonId), eq(users.active, true)));
        return Boolean(rows[0]);
      },
      async createAsset(value) {
        const rows = await db.insert(inventoryAssets).values(value).returning({ id: inventoryAssets.id });
        return rows[0]!;
      },
      async createCashMovement(value) {
        const rows = await db.insert(cashMovements).values({ ...value, paymentMethod: value.paymentMethod as PaymentMethod }).returning({ id: cashMovements.id });
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
      async disposeAsset(value) {
        const rows = await db.update(inventoryAssets).set({
          disposalNotes: value.reason,
          disposedAt: value.disposedAt,
          disposedByUserId: value.actorUserId,
          status: "disposed",
        }).where(and(eq(inventoryAssets.id, value.assetId), eq(inventoryAssets.salonId, value.salonId), eq(inventoryAssets.status, "active"))).returning({ id: inventoryAssets.id, status: inventoryAssets.status });
        if (!rows[0]) throw new Error("ASSET_ALREADY_DISPOSED");
        return { id: rows[0].id, status: "disposed" };
      },
      async findAssetByIdempotency(salonId, idempotencyKey) {
        const rows = await db.select({
          assetId: inventoryAssets.id,
          cashMovementId: inventoryAssets.cashMovementId,
          documentId: inventoryAssets.documentId,
        }).from(inventoryAssets).where(and(eq(inventoryAssets.salonId, salonId), eq(inventoryAssets.idempotencyKey, idempotencyKey)));
        const row = rows[0];
        return row?.cashMovementId ? { assetId: row.assetId, cashMovementId: row.cashMovementId, documentId: row.documentId } : undefined;
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

export async function registerInventoryAssetRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string }; Body: AssetBody }>("/api/salons/:id/inventory/assets", { preHandler: guard }, async (request, reply) => {
    if (ownsSalon(request, reply) !== true) return;
    const command = input(request.body, request.salonId, request.user.id);
    if (!command) return reply.code(422).send({ error: "INVALID_ASSET" });
    try {
      return reply.code(201).send(await registerAssetPurchase(drizzleAssetRepository(app.db), command));
    } catch (error) {
      return reply.code(error instanceof Error && error.message === "ACTOR_FORBIDDEN" ? 403 : 422).send({ error: error instanceof Error ? error.message : "ASSET_NOT_CREATED" });
    }
  });

  app.post<{ Params: { id: string; assetId: string }; Body: { disposed_at?: string; reason: string } }>("/api/salons/:id/inventory/assets/:assetId/dispose", { preHandler: guard }, async (request, reply) => {
    if (ownsSalon(request, reply) !== true) return;
    const disposedAt = parseDate(request.body.disposed_at, new Date());
    if (!disposedAt) return reply.code(422).send({ error: "INVALID_DISPOSAL_DATE" });
    try {
      return await disposeAsset(drizzleAssetRepository(app.db), {
        actorUserId: request.user.id,
        assetId: request.params.assetId,
        disposedAt,
        reason: request.body.reason,
        salonId: request.salonId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "ASSET_NOT_DISPOSED";
      return reply.code(message === "ASSET_ALREADY_DISPOSED" ? 409 : 422).send({ error: message });
    }
  });
}

interface AssetBody {
  description: string;
  external_reference?: string | null;
  idempotency_key: string;
  location?: string | null;
  notes?: string | null;
  payment_method: string;
  purchase_cost_cents: number;
  purchase_date?: string;
  serial_number?: string | null;
  supplier_id?: string | null;
  warranty_expires_at?: string | null;
}
