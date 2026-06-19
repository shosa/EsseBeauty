import type { FastifyInstance } from "fastify";
import { and, desc, eq, lt, sql } from "drizzle-orm";

import {
  appointments,
  customers,
  inventoryMovements,
  inventoryProducts,
  sales,
} from "@esse-beauty/db/schema";
import { MODULE_KEYS, requireModule } from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { authenticate, requirePermission } from "../../middleware/auth.js";

const guard = [
  authenticate,
  requireModule(MODULE_KEYS.INVENTORY),
  requirePermission(PERMISSION_KEYS.INVENTORY_MANAGE),
];

export async function registerInventoryRoutes(app: FastifyInstance) {
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
    Body: { delta: number; reason: string };
  }>(
    "/api/salons/:id/inventory/:productId/movements",
    { preHandler: guard },
    async (request, reply) => {
      if (request.params.id !== request.salonId || request.body.delta === 0) {
        return reply.code(400).send({ error: "INVALID_MOVEMENT" });
      }
      const products = await app.db
        .update(inventoryProducts)
        .set({
          stockQuantity: sql`${inventoryProducts.stockQuantity} + ${request.body.delta}`,
        })
        .where(
          and(
            eq(inventoryProducts.id, request.params.productId),
            eq(inventoryProducts.salonId, request.salonId),
          ),
        )
        .returning();
      if (!products[0]) {
        return reply.code(404).send({ error: "PRODUCT_NOT_FOUND" });
      }
      const rows = await app.db
        .insert(inventoryMovements)
        .values({
          salonId: request.salonId,
          productId: request.params.productId,
          delta: request.body.delta,
          reason: request.body.reason,
        })
        .returning();
      return reply.code(201).send(rows[0]);
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
