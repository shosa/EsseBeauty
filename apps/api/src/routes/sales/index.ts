import type { FastifyInstance } from "fastify";
import { and, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";

import {
  appointments,
  customers,
  inventoryMovements,
  inventoryProducts,
  loyaltyPoints,
  loyaltySettings,
  notifications,
  saleItems,
  salePayments,
  sales,
  services,
  staff,
  users,
} from "@esse-beauty/db/schema";
import { isModuleEnabled, MODULE_KEYS } from "@esse-beauty/feature-flags";
import { hasPermission, PERMISSION_KEYS } from "@esse-beauty/shared";

import { authenticate } from "../../middleware/auth.js";

type PaymentMethod = "cash" | "card" | "bank_transfer" | "voucher" | "other";
type ItemType = "service" | "product" | "custom";

interface CheckoutItem {
  description: string;
  discount_cents?: number;
  item_type: ItemType;
  product_id?: string;
  quantity: number;
  service_id?: string;
  staff_id?: string;
  unit_price_cents: number;
}

interface CheckoutPayment {
  amount_cents: number;
  method: PaymentMethod;
  reference?: string;
}

async function ownStaffId(request: any) {
  const rows = await request.server.db
    .select({ id: staff.id })
    .from(staff)
    .where(and(eq(staff.userId, request.user.id), eq(staff.salonId, request.salonId)));
  return rows[0]?.id as string | undefined;
}

async function canViewAppointment(request: any, staffId: string) {
  const own = await ownStaffId(request);
  return hasPermission(
    request.user.id,
    own === staffId ? PERMISSION_KEYS.CALENDAR_VIEW_OWN : PERMISSION_KEYS.CALENDAR_VIEW_OTHERS,
    request.server.db,
  );
}

async function canCheckoutAppointment(request: any, staffId: string) {
  const own = await ownStaffId(request);
  return hasPermission(
    request.user.id,
    own === staffId ? PERMISSION_KEYS.CALENDAR_MANAGE_OWN : PERMISSION_KEYS.CALENDAR_MANAGE_OTHERS,
    request.server.db,
  );
}

async function canUsePos(request: any) {
  return (
    await hasPermission(request.user.id, PERMISSION_KEYS.REPORTS_VIEW_ALL, request.server.db) ||
    await hasPermission(request.user.id, PERMISSION_KEYS.CALENDAR_MANAGE_OTHERS, request.server.db) ||
    await hasPermission(request.user.id, PERMISSION_KEYS.INVENTORY_MANAGE, request.server.db)
  );
}

function normalizedLine(item: CheckoutItem) {
  const quantity = Math.max(1, Math.trunc(item.quantity));
  const unitPriceCents = Math.max(0, Math.trunc(item.unit_price_cents));
  const gross = quantity * unitPriceCents;
  const discountCents = Math.min(gross, Math.max(0, Math.trunc(item.discount_cents ?? 0)));
  return {
    ...item,
    description: item.description.trim(),
    discountCents,
    quantity,
    totalCents: gross - discountCents,
    unitPriceCents,
  };
}

async function notifyNegativeStock(
  tx: any,
  input: { productId: string; productName: string; salonId: string; saleId: string; stockAfter: number },
) {
  if (input.stockAfter >= 0) return;
  for (const targetRole of ["owner", "manager"] as const) {
    await tx.insert(notifications).values({
      body: `${input.productName} è stato venduto oltre la disponibilità. Giacenza attuale: ${input.stockAfter}.`,
      category: "inventory",
      entityId: input.productId,
      entityType: "inventory_product",
      payload: { href: `/inventory/${input.productId}`, sale_id: input.saleId, stock_after: input.stockAfter },
      priority: "high",
      salonId: input.salonId,
      targetRole,
      title: "Prodotto con giacenza negativa",
      type: "inventory_negative_stock",
    }).onConflictDoUpdate({
      target: [notifications.salonId, notifications.entityId, notifications.targetRole, notifications.type],
      set: {
        archivedAt: null,
        body: `${input.productName} è stato venduto oltre la disponibilità. Giacenza attuale: ${input.stockAfter}.`,
        payload: { href: `/inventory/${input.productId}`, sale_id: input.saleId, stock_after: input.stockAfter },
        priority: "high",
        readAt: null,
        title: "Prodotto con giacenza negativa",
        updatedAt: new Date(),
      },
    });
  }
}

export async function registerSalesRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>("/api/salons/:id/pos-catalog", { preHandler: [authenticate] }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    if (!(await canUsePos(request))) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const [serviceRows, productRows, staffRows] = await Promise.all([
      app.db.select({
        category: services.category,
        id: services.id,
        name: services.name,
        price_cents: services.priceCents,
      }).from(services).where(and(eq(services.salonId, request.salonId), eq(services.active, true))),
      app.db.select({
        id: inventoryProducts.id,
        name: inventoryProducts.name,
        price_cents: inventoryProducts.unitPriceCents,
        stock_quantity: inventoryProducts.stockQuantity,
      }).from(inventoryProducts).where(and(eq(inventoryProducts.salonId, request.salonId), eq(inventoryProducts.active, true))),
      app.db.select({
        color: staff.color,
        id: staff.id,
        name: staff.displayName,
      }).from(staff).where(and(eq(staff.salonId, request.salonId), eq(staff.active, true))),
    ]);
    return { products: productRows, services: serviceRows, staff: staffRows };
  });

  app.get<{
    Params: { id: string };
    Querystring: { search?: string };
  }>("/api/salons/:id/pos-customers", { preHandler: [authenticate] }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    if (!(await canUsePos(request))) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const search = request.query.search?.trim();
    if (!search || search.length < 2) return { items: [] };
    const rows = await app.db.select({
      email: customers.email,
      id: customers.id,
      name: customers.fullName,
      phone: customers.phone,
    }).from(customers).where(and(
      eq(customers.salonId, request.salonId),
      eq(customers.blocked, false),
      or(
        ilike(customers.fullName, `%${search}%`),
        ilike(customers.email, `%${search}%`),
        ilike(customers.phone, `%${search}%`),
      ),
    )).orderBy(customers.fullName).limit(20);
    return { items: rows };
  });

  app.post<{
    Body: {
      customer_id?: string;
      discount_cents?: number;
      items: CheckoutItem[];
      notes?: string;
      payments: CheckoutPayment[];
      staff_id?: string;
    };
    Params: { id: string };
  }>("/api/salons/:id/pos-checkout", { preHandler: [authenticate] }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    if (!(await canUsePos(request))) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const lines = request.body.items.map(normalizedLine).filter((item) => item.description && item.totalCents >= 0);
    if (lines.length === 0) return reply.code(400).send({ error: "EMPTY_CHECKOUT" });
    const serviceIds = [...new Set(lines.flatMap((item) => item.item_type === "service" && item.service_id ? [item.service_id] : []))];
    const productIds = [...new Set(lines.flatMap((item) => item.item_type === "product" && item.product_id ? [item.product_id] : []))];
    if (lines.some((item) => item.item_type === "service" && !item.service_id) || lines.some((item) => item.item_type === "product" && !item.product_id)) {
      return reply.code(400).send({ error: "INVALID_CHECKOUT_ITEM" });
    }
    const [customerRows, staffRows, serviceRows, productRows] = await Promise.all([
      request.body.customer_id
        ? app.db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, request.body.customer_id), eq(customers.salonId, request.salonId)))
        : Promise.resolve([]),
      request.body.staff_id
        ? app.db.select({ id: staff.id }).from(staff).where(and(eq(staff.id, request.body.staff_id), eq(staff.salonId, request.salonId), eq(staff.active, true)))
        : Promise.resolve([]),
      serviceIds.length
        ? app.db.select({ id: services.id }).from(services).where(and(inArray(services.id, serviceIds), eq(services.salonId, request.salonId), eq(services.active, true)))
        : Promise.resolve([]),
      productIds.length
        ? app.db.select({ id: inventoryProducts.id }).from(inventoryProducts).where(and(inArray(inventoryProducts.id, productIds), eq(inventoryProducts.salonId, request.salonId), eq(inventoryProducts.active, true)))
        : Promise.resolve([]),
    ]);
    if (request.body.customer_id && customerRows.length !== 1) return reply.code(400).send({ error: "CUSTOMER_NOT_FOUND" });
    if (request.body.staff_id && staffRows.length !== 1) return reply.code(400).send({ error: "STAFF_NOT_FOUND" });
    if (serviceRows.length !== serviceIds.length || productRows.length !== productIds.length) {
      return reply.code(400).send({ error: "CATALOG_ITEM_NOT_FOUND" });
    }
    const subtotalCents = lines.reduce((total, item) => total + item.totalCents, 0);
    const discountCents = Math.min(subtotalCents, Math.max(0, Math.trunc(request.body.discount_cents ?? 0)));
    const totalCents = subtotalCents - discountCents;
    const payments = request.body.payments
      .map((payment) => ({ ...payment, amount_cents: Math.max(0, Math.trunc(payment.amount_cents)) }))
      .filter((payment) => payment.amount_cents > 0);
    const paidCents = payments.reduce((total, payment) => total + payment.amount_cents, 0);
    if (paidCents !== totalCents) return reply.code(400).send({ error: "PAYMENT_TOTAL_MISMATCH" });

    const result = await app.db.transaction(async (tx) => {
      const saleRows = await tx.insert(sales).values({
        customerId: request.body.customer_id || null,
        discountCents,
        notes: request.body.notes?.trim() || null,
        salonId: request.salonId,
        staffId: request.body.staff_id || null,
        status: "paid",
        subtotalCents,
        totalCents,
        closedAt: new Date(),
        closedByUserId: request.user.id,
      }).returning();
      const sale = saleRows[0]!;
      await tx.insert(saleItems).values(lines.map((item) => ({
        description: item.description,
        discountCents: item.discountCents,
        itemType: item.item_type,
        productId: item.product_id,
        quantity: item.quantity,
        saleId: sale.id,
        salonId: request.salonId,
        serviceId: item.service_id,
        staffId: item.staff_id ?? request.body.staff_id,
        totalCents: item.totalCents,
        unitPriceCents: item.unitPriceCents,
      })));
      if (payments.length) {
        await tx.insert(salePayments).values(payments.map((payment) => ({
          amountCents: payment.amount_cents,
          method: payment.method,
          reference: payment.reference?.trim() || null,
          saleId: sale.id,
          salonId: request.salonId,
        })));
      }
      for (const line of lines.filter((item) => item.item_type === "product" && item.product_id)) {
        const productRows = await tx.select().from(inventoryProducts).where(and(
          eq(inventoryProducts.id, line.product_id!),
          eq(inventoryProducts.salonId, request.salonId),
        ));
        const product = productRows[0];
        if (!product) throw new Error("PRODUCT_NOT_FOUND");
        const stockAfter = product.stockQuantity - line.quantity;
        await tx.update(inventoryProducts).set({ stockQuantity: stockAfter, updatedAt: new Date() }).where(eq(inventoryProducts.id, product.id));
        await tx.insert(inventoryMovements).values({
          createdByUserId: request.user.id,
          delta: -line.quantity,
          productId: product.id,
          reason: `Vendita ${sale.id}`,
          salonId: request.salonId,
          stockAfter,
        });
        await notifyNegativeStock(tx, {
          productId: product.id,
          productName: product.name,
          salonId: request.salonId,
          saleId: sale.id,
          stockAfter,
        });
      }
      return sale;
    }).catch((error: unknown) => ({ error: error instanceof Error ? error.message : "CHECKOUT_FAILED" }));
    if ("error" in result) return reply.code(400).send({ error: result.error });
    return reply.code(201).send(result);
  });

  app.get<{ Params: { id: string; appointmentId: string } }>(
    "/api/salons/:id/appointments/:appointmentId/checkout",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
      const appointmentRows = await app.db
        .select({
          customer_email: customers.email,
          customer_id: appointments.customerId,
          customer_name: customers.fullName,
          customer_phone: customers.phone,
          ends_at: appointments.endsAt,
          id: appointments.id,
          service_id: appointments.serviceId,
          service_name: services.name,
          service_price_cents: services.priceCents,
          staff_id: appointments.staffId,
          staff_name: staff.displayName,
          starts_at: appointments.startsAt,
          status: appointments.status,
        })
        .from(appointments)
        .innerJoin(customers, eq(customers.id, appointments.customerId))
        .innerJoin(services, eq(services.id, appointments.serviceId))
        .innerJoin(staff, eq(staff.id, appointments.staffId))
        .where(and(eq(appointments.id, request.params.appointmentId), eq(appointments.salonId, request.salonId)));
      const appointment = appointmentRows[0];
      if (!appointment) return reply.code(404).send({ error: "APPOINTMENT_NOT_FOUND" });
      if (!(await canViewAppointment(request, appointment.staff_id))) {
        return reply.code(403).send({ error: "PERMISSION_DENIED" });
      }

      const saleRows = await app.db.select().from(sales).where(and(
        eq(sales.salonId, request.salonId),
        eq(sales.appointmentId, appointment.id),
      ));
      const sale = saleRows[0];
      const [items, payments, serviceCatalog, productCatalog] = await Promise.all([
        sale ? app.db.select().from(saleItems).where(eq(saleItems.saleId, sale.id)) : Promise.resolve([]),
        sale ? app.db.select().from(salePayments).where(eq(salePayments.saleId, sale.id)) : Promise.resolve([]),
        app.db.select({
          category: services.category,
          id: services.id,
          name: services.name,
          price_cents: services.priceCents,
        }).from(services).where(and(eq(services.salonId, request.salonId), eq(services.active, true))),
        app.db.select({
          id: inventoryProducts.id,
          name: inventoryProducts.name,
          price_cents: inventoryProducts.unitPriceCents,
          stock_quantity: inventoryProducts.stockQuantity,
        }).from(inventoryProducts).where(and(eq(inventoryProducts.salonId, request.salonId), eq(inventoryProducts.active, true))),
      ]);
      return {
        appointment,
        catalog: { products: productCatalog, services: serviceCatalog },
        sale: sale ? { ...sale, items, payments } : null,
      };
    },
  );

  app.post<{
    Body: {
      discount_cents?: number;
      items: CheckoutItem[];
      notes?: string;
      payments: CheckoutPayment[];
    };
    Params: { id: string; appointmentId: string };
  }>(
    "/api/salons/:id/appointments/:appointmentId/checkout",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
      const appointmentRows = await app.db.select().from(appointments).where(and(
        eq(appointments.id, request.params.appointmentId),
        eq(appointments.salonId, request.salonId),
      ));
      const appointment = appointmentRows[0];
      if (!appointment) return reply.code(404).send({ error: "APPOINTMENT_NOT_FOUND" });
      if (!(await canCheckoutAppointment(request, appointment.staffId))) {
        return reply.code(403).send({ error: "PERMISSION_DENIED" });
      }
      if (appointment.status !== "confirmed") {
        return reply.code(409).send({ error: "APPOINTMENT_NOT_CONFIRMED" });
      }

      const lines = request.body.items.map(normalizedLine).filter((item) => item.description && item.totalCents >= 0);
      if (lines.length === 0) return reply.code(400).send({ error: "EMPTY_CHECKOUT" });
      const subtotalCents = lines.reduce((total, item) => total + item.totalCents, 0);
      const discountCents = Math.min(subtotalCents, Math.max(0, Math.trunc(request.body.discount_cents ?? 0)));
      const totalCents = subtotalCents - discountCents;
      const payments = request.body.payments
        .map((payment) => ({ ...payment, amount_cents: Math.max(0, Math.trunc(payment.amount_cents)) }))
        .filter((payment) => payment.amount_cents > 0);
      const paidCents = payments.reduce((total, payment) => total + payment.amount_cents, 0);
      if (paidCents !== totalCents) {
        return reply.code(400).send({ error: "PAYMENT_TOTAL_MISMATCH", expected_cents: totalCents, paid_cents: paidCents });
      }
      const loyaltyEnabled = await isModuleEnabled(request.salonId, MODULE_KEYS.LOYALTY, app.db);
      const loyaltyRows = loyaltyEnabled
        ? await app.db.select().from(loyaltySettings).where(eq(loyaltySettings.salonId, request.salonId))
        : [];
      const loyaltyPointsPerAppointment = loyaltyRows[0]?.pointsPerAppointment ?? 10;

      const result = await app.db.transaction(async (tx) => {
        const existingRows = await tx.select().from(sales).where(and(
          eq(sales.salonId, request.salonId),
          eq(sales.appointmentId, appointment.id),
        ));
        if (existingRows[0]?.status === "paid") {
          return { conflict: true as const };
        }

        const saleRows = existingRows[0]
          ? await tx.update(sales).set({
              discountCents,
              notes: request.body.notes?.trim() || null,
              status: "paid",
              subtotalCents,
              totalCents,
              closedAt: new Date(),
              closedByUserId: request.user.id,
              updatedAt: new Date(),
            }).where(eq(sales.id, existingRows[0].id)).returning()
          : await tx.insert(sales).values({
              appointmentId: appointment.id,
              customerId: appointment.customerId,
              discountCents,
              notes: request.body.notes?.trim() || null,
              salonId: request.salonId,
              staffId: appointment.staffId,
              status: "paid",
              subtotalCents,
              totalCents,
              closedAt: new Date(),
              closedByUserId: request.user.id,
            }).returning();
        const sale = saleRows[0]!;
        await tx.delete(saleItems).where(eq(saleItems.saleId, sale.id));
        await tx.delete(salePayments).where(eq(salePayments.saleId, sale.id));
        await tx.insert(saleItems).values(lines.map((item) => ({
          description: item.description,
          discountCents: item.discountCents,
          itemType: item.item_type,
          productId: item.product_id,
          quantity: item.quantity,
          saleId: sale.id,
          salonId: request.salonId,
          serviceId: item.service_id,
          staffId: item.staff_id ?? appointment.staffId,
          totalCents: item.totalCents,
          unitPriceCents: item.unitPriceCents,
        })));
        if (payments.length > 0) {
          await tx.insert(salePayments).values(payments.map((payment) => ({
            amountCents: payment.amount_cents,
            method: payment.method,
            reference: payment.reference?.trim() || null,
            saleId: sale.id,
            salonId: request.salonId,
          })));
        }

        for (const line of lines.filter((item) => item.item_type === "product" && item.product_id)) {
          const productRows = await tx.select().from(inventoryProducts).where(and(
            eq(inventoryProducts.id, line.product_id!),
            eq(inventoryProducts.salonId, request.salonId),
          ));
          const product = productRows[0];
          if (!product) throw new Error("PRODUCT_NOT_FOUND");
          const stockAfter = product.stockQuantity - line.quantity;
          await tx.update(inventoryProducts).set({
            stockQuantity: stockAfter,
            updatedAt: new Date(),
          }).where(eq(inventoryProducts.id, product.id));
          await tx.insert(inventoryMovements).values({
            appointmentId: appointment.id,
            createdByUserId: request.user.id,
            delta: -line.quantity,
            productId: product.id,
            reason: `Vendita ${sale.id}`,
            salonId: request.salonId,
            stockAfter,
          });
          await notifyNegativeStock(tx, {
            productId: product.id,
            productName: product.name,
            salonId: request.salonId,
            saleId: sale.id,
            stockAfter,
          });
        }
        await tx.update(appointments).set({ status: "completed", updatedAt: new Date() }).where(eq(appointments.id, appointment.id));
        await tx.update(notifications).set({
          archivedAt: new Date(),
          readAt: new Date(),
        }).where(and(
          eq(notifications.salonId, request.salonId),
          eq(notifications.entityType, "appointment"),
          eq(notifications.entityId, appointment.id),
          eq(notifications.type, "online_booking_received"),
        ));
        if (loyaltyEnabled && loyaltyPointsPerAppointment > 0) {
          await tx.insert(loyaltyPoints).values({
            appointmentId: appointment.id,
            customerId: appointment.customerId,
            delta: loyaltyPointsPerAppointment,
            reason: "Appuntamento completato",
            salonId: request.salonId,
          }).onConflictDoNothing();
        }
        return { conflict: false as const, sale };
      }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "CHECKOUT_FAILED";
        return { conflict: false as const, error: message };
      });

      if ("error" in result) {
        return reply.code(400).send({ error: result.error });
      }
      if (result.conflict) return reply.code(409).send({ error: "SALE_ALREADY_CLOSED" });
      return reply.code(201).send(result.sale);
    },
  );

  app.get<{
    Params: { id: string };
    Querystring: { from?: string; to?: string };
  }>("/api/salons/:id/sales", { preHandler: [authenticate] }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    if (!(await canUsePos(request))) {
      return reply.code(403).send({ error: "PERMISSION_DENIED" });
    }
    const conditions = [
      eq(sales.salonId, request.salonId),
      eq(sales.status, "paid"),
      ...(request.query.from ? [gte(sales.closedAt, new Date(request.query.from))] : []),
      ...(request.query.to ? [lte(sales.closedAt, new Date(request.query.to))] : []),
    ];
    const rows = await app.db
      .select({
        appointment_id: sales.appointmentId,
        closed_at: sales.closedAt,
        customer_name: customers.fullName,
        discount_cents: sales.discountCents,
        id: sales.id,
        staff_name: staff.displayName,
        total_cents: sales.totalCents,
      })
      .from(sales)
      .leftJoin(customers, eq(customers.id, sales.customerId))
      .leftJoin(staff, eq(staff.id, sales.staffId))
      .where(and(...conditions))
      .orderBy(desc(sales.closedAt));
    const payments = await app.db
      .select({
        amount_cents: sql<number>`sum(${salePayments.amountCents})::int`,
        method: salePayments.method,
      })
      .from(salePayments)
      .innerJoin(sales, eq(sales.id, salePayments.saleId))
      .where(and(...conditions))
      .groupBy(salePayments.method);
    return {
      payments,
      rows,
      summary: {
        average_cents: rows.length ? Math.round(rows.reduce((total, row) => total + row.total_cents, 0) / rows.length) : 0,
        count: rows.length,
        discount_cents: rows.reduce((total, row) => total + row.discount_cents, 0),
        total_cents: rows.reduce((total, row) => total + row.total_cents, 0),
      },
    };
  });

  app.get<{
    Params: { id: string; saleId: string };
  }>("/api/salons/:id/sales/:saleId", { preHandler: [authenticate] }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    if (!(await canUsePos(request))) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const rows = await app.db.select({
      appointment_id: sales.appointmentId,
      cashier_name: users.fullName,
      closed_at: sales.closedAt,
      customer_email: customers.email,
      customer_id: sales.customerId,
      customer_name: customers.fullName,
      customer_phone: customers.phone,
      discount_cents: sales.discountCents,
      id: sales.id,
      notes: sales.notes,
      staff_name: staff.displayName,
      status: sales.status,
      subtotal_cents: sales.subtotalCents,
      total_cents: sales.totalCents,
    }).from(sales)
      .leftJoin(customers, eq(customers.id, sales.customerId))
      .leftJoin(staff, eq(staff.id, sales.staffId))
      .leftJoin(users, eq(users.id, sales.closedByUserId))
      .where(and(eq(sales.id, request.params.saleId), eq(sales.salonId, request.salonId)));
    const sale = rows[0];
    if (!sale) return reply.code(404).send({ error: "SALE_NOT_FOUND" });
    const [items, payments] = await Promise.all([
      app.db.select({
        description: saleItems.description,
        discount_cents: saleItems.discountCents,
        id: saleItems.id,
        item_type: saleItems.itemType,
        quantity: saleItems.quantity,
        total_cents: saleItems.totalCents,
        unit_price_cents: saleItems.unitPriceCents,
      }).from(saleItems).where(and(eq(saleItems.saleId, sale.id), eq(saleItems.salonId, request.salonId))),
      app.db.select({
        amount_cents: salePayments.amountCents,
        id: salePayments.id,
        method: salePayments.method,
        paid_at: salePayments.paidAt,
        reference: salePayments.reference,
      }).from(salePayments).where(and(eq(salePayments.saleId, sale.id), eq(salePayments.salonId, request.salonId))),
    ]);
    return { ...sale, items, payments };
  });
}
