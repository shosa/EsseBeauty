import type { FastifyInstance } from "fastify";
import { and, desc, eq, ilike, or } from "drizzle-orm";

import {
  customers,
  purchaseVoucherMovements,
  purchaseVouchers,
  sales,
  users,
} from "@esse-beauty/db/schema";
import { hasPermission, PERMISSION_KEYS } from "@esse-beauty/shared";

import { authenticate } from "../../middleware/auth.js";

async function canView(request: any) {
  return (
    await hasPermission(request.user.id, PERMISSION_KEYS.CLIENTS_VIEW, request.server.db) ||
    await hasPermission(request.user.id, PERMISSION_KEYS.REPORTS_VIEW_ALL, request.server.db) ||
    await hasPermission(request.user.id, PERMISSION_KEYS.CALENDAR_MANAGE_OTHERS, request.server.db) ||
    await hasPermission(request.user.id, PERMISSION_KEYS.INVENTORY_MANAGE, request.server.db)
  );
}

export async function registerVoucherRoutes(app: FastifyInstance) {
  app.get<{
    Params: { id: string };
    Querystring: { customer_id?: string; search?: string; status?: string };
  }>("/api/salons/:id/vouchers", { preHandler: [authenticate] }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    if (!(await canView(request))) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const rawSearch = request.query.search?.trim();
    const numericSearch = rawSearch?.replace(/\D/g, "");
    return app.db.select({
      balance_cents: purchaseVouchers.balanceCents,
      code: purchaseVouchers.code,
      created_at: purchaseVouchers.createdAt,
      customer_id: purchaseVouchers.customerId,
      customer_name: customers.fullName,
      id: purchaseVouchers.id,
      message: purchaseVouchers.message,
      original_amount_cents: purchaseVouchers.originalAmountCents,
      status: purchaseVouchers.status,
    }).from(purchaseVouchers)
      .innerJoin(customers, eq(customers.id, purchaseVouchers.customerId))
      .where(and(
        eq(purchaseVouchers.salonId, request.salonId),
        ...(request.query.customer_id ? [eq(purchaseVouchers.customerId, request.query.customer_id)] : []),
        ...(request.query.status ? [eq(purchaseVouchers.status, request.query.status)] : []),
        ...(rawSearch ? [or(
          ...(numericSearch ? [ilike(purchaseVouchers.code, `%${numericSearch}%`)] : []),
          ilike(customers.fullName, `%${rawSearch}%`),
        )!] : []),
      ))
      .orderBy(desc(purchaseVouchers.createdAt))
      .limit(100);
  });

  app.get<{ Params: { id: string; voucherId: string } }>(
    "/api/salons/:id/vouchers/:voucherId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
      if (!(await canView(request))) return reply.code(403).send({ error: "PERMISSION_DENIED" });
      const rows = await app.db.select({
        balance_cents: purchaseVouchers.balanceCents,
        code: purchaseVouchers.code,
        created_at: purchaseVouchers.createdAt,
        customer_id: purchaseVouchers.customerId,
        customer_name: customers.fullName,
        id: purchaseVouchers.id,
        message: purchaseVouchers.message,
        original_amount_cents: purchaseVouchers.originalAmountCents,
        status: purchaseVouchers.status,
      }).from(purchaseVouchers)
        .innerJoin(customers, eq(customers.id, purchaseVouchers.customerId))
        .where(and(
          eq(purchaseVouchers.id, request.params.voucherId),
          eq(purchaseVouchers.salonId, request.salonId),
        ));
      const voucher = rows[0];
      if (!voucher) return reply.code(404).send({ error: "VOUCHER_NOT_FOUND" });
      const movements = await app.db.select({
        balance_after_cents: purchaseVoucherMovements.balanceAfterCents,
        cashier_name: users.fullName,
        created_at: purchaseVoucherMovements.createdAt,
        delta_cents: purchaseVoucherMovements.deltaCents,
        id: purchaseVoucherMovements.id,
        reason: purchaseVoucherMovements.reason,
        sale_id: sales.id,
      }).from(purchaseVoucherMovements)
        .leftJoin(users, eq(users.id, purchaseVoucherMovements.createdByUserId))
        .leftJoin(sales, eq(sales.id, purchaseVoucherMovements.saleId))
        .where(eq(purchaseVoucherMovements.voucherId, voucher.id))
        .orderBy(desc(purchaseVoucherMovements.createdAt));
      return { ...voucher, movements };
    },
  );
}
