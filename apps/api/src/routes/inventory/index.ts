import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { and, desc, eq, lt } from "drizzle-orm";

import {
  appointments,
  customers,
  inventoryDocumentLines,
  inventoryDocuments,
  inventoryMovements,
  inventoryProducts,
  sales,
} from "@esse-beauty/db/schema";
import { MODULE_KEYS, requireModule } from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { authenticate, requirePermission } from "../../middleware/auth.js";
import { registerInventoryCatalogRoutes } from "./catalog.js";
import { registerInventoryDocumentRoutes } from "./documents.js";
import {
  createDrizzleWarehouseRepository,
  WarehouseConflictError,
  WarehouseValidationError,
  postWarehouseDocument,
} from "./warehouse-service.js";

const guard = [
  authenticate,
  requireModule(MODULE_KEYS.INVENTORY),
  requirePermission(PERMISSION_KEYS.INVENTORY_MANAGE),
];

export async function registerInventoryRoutes(app: FastifyInstance) {
  await registerInventoryCatalogRoutes(app);
  await registerInventoryDocumentRoutes(app);
  app.get<{
    Params: { id: string };
    Querystring: { low_stock?: string };
  }>("/api/salons/:id/inventory", { preHandler: guard }, async (request, reply) => {
    if (request.params.id !== request.salonId) {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }
    return app.db
      .select()
      .from(inventoryProducts)
      .where(
        and(
          eq(inventoryProducts.salonId, request.salonId),
          eq(inventoryProducts.active, true),
          ...(request.query.low_stock === "true"
            ? [
                lt(
                  inventoryProducts.stockQuantity,
                  inventoryProducts.lowStockThreshold,
                ),
              ]
            : []),
        ),
      );
  });

  app.post<{
    Params: { id: string };
    Body: {
      name: string;
      sku?: string;
      stock_quantity: number;
      low_stock_threshold: number;
      unit_price_cents: number;
      supplier?: string;
      active: boolean;
    };
  }>("/api/salons/:id/inventory", { preHandler: guard }, async (request, reply) => {
    if (request.params.id !== request.salonId) {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }
    const rows = await app.db
      .insert(inventoryProducts)
      .values({
        salonId: request.salonId,
        name: request.body.name,
        sku: request.body.sku,
        stockQuantity: request.body.stock_quantity,
        lowStockThreshold: request.body.low_stock_threshold,
        unitPriceCents: request.body.unit_price_cents,
        supplier: request.body.supplier,
        active: request.body.active,
        itemType: "resale",
        trackStock: true,
        sellable: true,
      })
      .returning();
    return reply.code(201).send(rows[0]);
  });

  app.patch<{
    Params: { id: string; productId: string };
    Body: Partial<{
      name: string;
      sku: string | null;
      stock_quantity: number;
      low_stock_threshold: number;
      unit_price_cents: number;
      supplier: string | null;
      active: boolean;
    }>;
  }>("/api/salons/:id/inventory/:productId", { preHandler: guard }, async (request, reply) => {
    if (request.params.id !== request.salonId) {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }
    const rows = await app.db
      .update(inventoryProducts)
      .set({
        ...(request.body.name !== undefined && { name: request.body.name }),
        ...(request.body.sku !== undefined && { sku: request.body.sku }),
        ...(request.body.stock_quantity !== undefined && {
          stockQuantity: request.body.stock_quantity,
        }),
        ...(request.body.low_stock_threshold !== undefined && {
          lowStockThreshold: request.body.low_stock_threshold,
        }),
        ...(request.body.unit_price_cents !== undefined && {
          unitPriceCents: request.body.unit_price_cents,
        }),
        ...(request.body.supplier !== undefined && {
          supplier: request.body.supplier,
        }),
        ...(request.body.active !== undefined && { active: request.body.active }),
      })
      .where(
        and(
          eq(inventoryProducts.id, request.params.productId),
          eq(inventoryProducts.salonId, request.salonId),
        ),
      )
      .returning();
    return rows[0] ?? reply.code(404).send({ error: "PRODUCT_NOT_FOUND" });
  });

  app.delete<{ Params: { id: string; productId: string } }>(
    "/api/salons/:id/inventory/:productId",
    { preHandler: guard },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
      const rows = await app.db
        .update(inventoryProducts)
        .set({ active: false })
        .where(
          and(
            eq(inventoryProducts.id, request.params.productId),
            eq(inventoryProducts.salonId, request.salonId),
          ),
        )
        .returning();
      return rows[0] ?? reply.code(404).send({ error: "PRODUCT_NOT_FOUND" });
    },
  );

  app.post<{
    Params: { id: string; productId: string };
    Body: { delta: number; reason: string; unit_cost_cents?: number };
  }>(
    "/api/salons/:id/inventory/:productId/movements",
    { preHandler: guard },
    async (request, reply) => {
      if (request.params.id !== request.salonId || request.body.delta === 0) {
        return reply.code(400).send({ error: "INVALID_MOVEMENT" });
      }
      const products = await app.db
        .select()
        .from(inventoryProducts)
        .where(
          and(
            eq(inventoryProducts.id, request.params.productId),
            eq(inventoryProducts.salonId, request.salonId),
          ),
        );
      if (!products[0]) {
        return reply.code(404).send({ error: "PRODUCT_NOT_FOUND" });
      }
      const product = products[0];
      const unitCostCents = request.body.unit_cost_cents ?? product.lastCostCents ?? product.averageCostCents;
      if (request.body.delta > 0 && unitCostCents <= 0) {
        return reply.code(422).send({
          error: "INVALID_DOCUMENT_LINES",
          line_errors: [{ line: 1, field: "unit_cost_cents", message: "A positive adjustment requires a unit cost" }],
        });
      }
      const document = await app.db.transaction(async (tx) => {
        const documents = await tx.insert(inventoryDocuments).values({
          createdByUserId: request.user.id,
          documentDate: new Date(),
          internalNumber: `ADJ-${randomUUID()}`,
          kind: "adjustment",
          notes: request.body.reason,
          salonId: request.salonId,
        }).returning();
        const created = documents[0]!;
        await tx.insert(inventoryDocumentLines).values({
          description: request.body.reason,
          documentId: created.id,
          itemType: product.itemType,
          lineNumber: 1,
          productId: product.id,
          quantity: Math.abs(request.body.delta),
          salonId: request.salonId,
          stockDelta: request.body.delta,
          taxRateBasisPoints: 0,
          unitCostCents,
        });
        return created;
      });
      try {
        const result = await postWarehouseDocument(createDrizzleWarehouseRepository(app.db), {
          actorUserId: request.user.id,
          documentId: document.id,
          salonId: request.salonId,
        });
        return reply.code(201).send(result);
      } catch (error) {
        if (error instanceof WarehouseConflictError) return reply.code(409).send({ error: error.code });
        if (error instanceof WarehouseValidationError) return reply.code(error.code === "LINE_INVALID" ? 422 : error.statusCode).send({ error: error.code, ...(error.code === "LINE_INVALID" && { line_errors: [] }) });
        throw error;
      }
    },
  );

  app.get<{ Params: { id: string; productId: string } }>(
    "/api/salons/:id/inventory/:productId/movements",
    { preHandler: guard },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
      return app.db
        .select({
          appointment_id: inventoryMovements.appointmentId,
          created_at: inventoryMovements.createdAt,
          customer_name: customers.fullName,
          delta: inventoryMovements.delta,
          id: inventoryMovements.id,
          reason: inventoryMovements.reason,
          sale_id: sales.id,
        })
        .from(inventoryMovements)
        .leftJoin(appointments, eq(appointments.id, inventoryMovements.appointmentId))
        .leftJoin(customers, eq(customers.id, appointments.customerId))
        .leftJoin(sales, eq(sales.appointmentId, appointments.id))
        .where(
          and(
            eq(inventoryMovements.productId, request.params.productId),
            eq(inventoryMovements.salonId, request.salonId),
          ),
        )
        .orderBy(desc(inventoryMovements.createdAt));
    },
  );
}
