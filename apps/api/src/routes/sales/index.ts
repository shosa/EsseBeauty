import type { FastifyInstance } from "fastify";
import { and, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";

import {
  appointments,
  customerPackageItemBalances,
  customerServicePackages,
  customers,
  inventoryDocuments,
  inventoryExpenses,
  inventoryMovements,
  inventoryProducts,
  inventorySuppliers,
  notifications,
  saleItems,
  salePayments,
  sales,
  salons,
  serviceCategories,
  services,
  servicePackageItems,
  servicePackageUsages,
  servicePackages,
  staff,
  users,
} from "@esse-beauty/db/schema";
import { isModuleEnabled, MODULE_KEYS } from "@esse-beauty/feature-flags";
import { hasPermission, PERMISSION_KEYS } from "@esse-beauty/shared";

import { authenticate } from "../../middleware/auth.js";
import { awardSaleLoyalty } from "../../lib/loyalty-engine.js";
import { issuePurchaseVoucher, redeemPurchaseVoucher } from "../../lib/purchase-vouchers.js";
import { createWorkbook, excelContentType, styleWorksheet, workbookBuffer } from "../../lib/excel-workbook.js";

type PaymentMethod = "cash" | "card" | "bank_transfer" | "voucher" | "other";
type ItemType = "service" | "product" | "custom";

interface CheckoutItem {
  customer_package_id?: string;
  description: string;
  discount_cents?: number;
  item_type: ItemType;
  product_id?: string;
  package_item_id?: string;
  package_quantity?: number;
  quantity: number;
  service_id?: string;
  staff_id?: string;
  unit_price_cents: number;
}

interface CheckoutPayment {
  amount_cents: number;
  method: PaymentMethod;
  reference?: string;
  voucher_code?: string;
}

interface IssuedVoucher {
  amount_cents: number;
  message?: string;
  recipient_customer_id: string;
}
interface AssignedPackage { package_id: string; }

interface AccountingQuery { from?: string; to?: string }

function dateRangeConditions(column: any, query: AccountingQuery) {
  return [
    ...(query.from ? [gte(column, new Date(query.from))] : []),
    ...(query.to ? [lte(column, new Date(query.to))] : []),
  ];
}

function cents(value: number | null | undefined) {
  return value ?? 0;
}

function euro(value: number) {
  return (value / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" });
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

async function accountingSnapshot(app: FastifyInstance, salonId: string, query: AccountingQuery) {
  const saleConditions = [
    eq(sales.salonId, salonId),
    eq(sales.status, "paid"),
    ...dateRangeConditions(sales.closedAt, query),
  ];
  const expenseConditions = [
    eq(inventoryExpenses.salonId, salonId),
    ...dateRangeConditions(inventoryExpenses.competenceDate, query),
  ];
  const [salonRows, saleRows, paymentRows, expenseRows] = await Promise.all([
    app.db.select({ name: salons.name }).from(salons).where(eq(salons.id, salonId)).limit(1),
    app.db.select({
      cashier: users.fullName,
      closed_at: sales.closedAt,
      customer: customers.fullName,
      discount_cents: sales.discountCents,
      id: sales.id,
      staff: staff.displayName,
      subtotal_cents: sales.subtotalCents,
      total_cents: sales.totalCents,
    }).from(sales)
      .leftJoin(customers, eq(customers.id, sales.customerId))
      .leftJoin(staff, eq(staff.id, sales.staffId))
      .leftJoin(users, eq(users.id, sales.closedByUserId))
      .where(and(...saleConditions)).orderBy(desc(sales.closedAt)),
    app.db.select({
      amount_cents: sql<number>`sum(${salePayments.amountCents})::int`,
      method: salePayments.method,
    }).from(salePayments)
      .innerJoin(sales, eq(sales.id, salePayments.saleId))
      .where(and(...saleConditions))
      .groupBy(salePayments.method),
    app.db.select({
      category: inventoryExpenses.category,
      competence_date: inventoryExpenses.competenceDate,
      description: inventoryExpenses.description,
      document_number: inventoryDocuments.internalNumber,
      id: inventoryExpenses.id,
      net_cents: inventoryExpenses.netCents,
      supplier_name: inventorySuppliers.name,
      tax_cents: inventoryExpenses.taxCents,
      total_cents: inventoryExpenses.totalCents,
    }).from(inventoryExpenses)
      .leftJoin(inventoryDocuments, eq(inventoryDocuments.id, inventoryExpenses.documentId))
      .leftJoin(inventorySuppliers, eq(inventorySuppliers.id, inventoryExpenses.supplierId))
      .where(and(...expenseConditions))
      .orderBy(desc(inventoryExpenses.competenceDate)),
  ]);
  const revenueCents = saleRows.reduce((total, row) => total + cents(row.total_cents), 0);
  const discountCents = saleRows.reduce((total, row) => total + cents(row.discount_cents), 0);
  const expenseTotalCents = expenseRows.reduce((total, row) => total + cents(row.total_cents), 0);
  const expenseNetCents = expenseRows.reduce((total, row) => total + cents(row.net_cents), 0);
  const expenseTaxCents = expenseRows.reduce((total, row) => total + cents(row.tax_cents), 0);
  const categoryTotals = new Map<string, { count: number; total_cents: number }>();
  for (const row of expenseRows) {
    const current = categoryTotals.get(row.category) ?? { count: 0, total_cents: 0 };
    categoryTotals.set(row.category, { count: current.count + 1, total_cents: current.total_cents + cents(row.total_cents) });
  }
  return {
    expenses: {
      categories: [...categoryTotals.entries()].map(([category, value]) => ({ category, ...value })).sort((a, b) => b.total_cents - a.total_cents),
      rows: expenseRows,
      summary: {
        count: expenseRows.length,
        net_cents: expenseNetCents,
        tax_cents: expenseTaxCents,
        total_cents: expenseTotalCents,
      },
    },
    payments: paymentRows,
    period: { from: query.from ?? null, to: query.to ?? null },
    sales: {
      rows: saleRows,
      summary: {
        average_cents: saleRows.length ? Math.round(revenueCents / saleRows.length) : 0,
        count: saleRows.length,
        discount_cents: discountCents,
        total_cents: revenueCents,
      },
    },
    salon_name: salonRows[0]?.name ?? "EsseBeauty",
    summary: {
      expense_total_cents: expenseTotalCents,
      gross_margin_cents: revenueCents - expenseTotalCents,
      revenue_cents: revenueCents,
    },
  };
}

function accountingPdf(snapshot: Awaited<ReturnType<typeof accountingSnapshot>>) {
  const period = `${snapshot.period.from ? formatDate(snapshot.period.from) : "inizio"} - ${snapshot.period.to ? formatDate(snapshot.period.to) : "fine"}`;
  const lines = [
    `Report contabile - ${snapshot.salon_name}`,
    `Periodo: ${period}`,
    `Generato: ${formatDate(new Date())}`,
    "",
    "Riepilogo",
    `Incassi: ${euro(snapshot.summary.revenue_cents)}`,
    `Spese: ${euro(snapshot.summary.expense_total_cents)}`,
    `Margine lordo: ${euro(snapshot.summary.gross_margin_cents)}`,
    `Vendite: ${snapshot.sales.summary.count}`,
    `Spese registrate: ${snapshot.expenses.summary.count}`,
    "",
    "Spese per categoria",
    ...snapshot.expenses.categories.map((row) => `${row.category}: ${euro(row.total_cents)} (${row.count})`),
    "",
    "Vendite",
    ...snapshot.sales.rows.slice(0, 35).map((row) => `${formatDate(row.closed_at)} | ${row.customer ?? "Cliente occasionale"} | ${euro(row.total_cents)}`),
    "",
    "Spese",
    ...snapshot.expenses.rows.slice(0, 35).map((row) => `${formatDate(row.competence_date)} | ${row.category} | ${row.description} | ${euro(row.total_cents)}`),
  ];
  return simplePdf(lines);
}

function simplePdf(lines: string[]) {
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += 42) pages.push(lines.slice(index, index + 42));
  const objects: string[] = [];
  const addObject = (value: string) => {
    objects.push(value);
    return objects.length;
  };
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const pageIds: number[] = [];
  const contentIds: number[] = [];
  for (const page of pages) {
    const stream = page.map((line, index) => `BT /F1 ${index === 0 ? 17 : 10} Tf 48 ${790 - index * 17} Td (${pdfText(line)}) Tj ET`).join("\n");
    const contentId = addObject(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    contentIds.push(contentId);
    pageIds.push(0);
  }
  const pagesId = objects.length + pages.length + 1;
  for (let index = 0; index < pages.length; index += 1) {
    pageIds[index] = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentIds[index]} 0 R >>`);
  }
  addObject(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

function pdfText(value: string) {
  return value
    .replace(/[^\x20-\x7e\xa0-\xff]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
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
  const packageQuantity = Math.min(quantity, Math.max(0, Math.trunc(item.package_quantity ?? 0)));
  const unitPriceCents = Math.max(0, Math.trunc(item.unit_price_cents));
  const gross = (quantity - packageQuantity) * unitPriceCents;
  const discountCents = Math.min(gross, Math.max(0, Math.trunc(item.discount_cents ?? 0)));
  return {
    ...item,
    description: item.description.trim(),
    discountCents,
    packageQuantity,
    quantity,
    totalCents: gross - discountCents,
    unitPriceCents,
  };
}

async function consumePackageItems(
  tx: any,
  input: {
    appointmentId?: string;
    customerId?: string | null;
    lines: ReturnType<typeof normalizedLine>[];
    saleId: string;
    saleItemIds: string[];
    salonId: string;
    userId: string;
  },
) {
  for (let index = 0; index < input.lines.length; index += 1) {
    const line = input.lines[index]!;
    if (!line.packageQuantity) continue;
    if (!input.customerId || !line.customer_package_id || !line.package_item_id) throw new Error("PACKAGE_COVERAGE_INVALID");
    const balances = await tx.select({
      active: customerServicePackages.active,
      customerId: customerServicePackages.customerId,
      expiresAt: customerServicePackages.expiresAt,
      itemType: servicePackageItems.itemType,
      productId: servicePackageItems.productId,
      remaining: sql<number>`${customerPackageItemBalances.totalQuantity} - ${customerPackageItemBalances.usedQuantity}`,
      serviceId: servicePackageItems.serviceId,
    }).from(customerPackageItemBalances)
      .innerJoin(customerServicePackages, eq(customerServicePackages.id, customerPackageItemBalances.customerPackageId))
      .innerJoin(servicePackageItems, eq(servicePackageItems.id, customerPackageItemBalances.packageItemId))
      .where(and(
        eq(customerPackageItemBalances.customerPackageId, line.customer_package_id),
        eq(customerPackageItemBalances.packageItemId, line.package_item_id),
        eq(customerPackageItemBalances.salonId, input.salonId),
      )).for("update");
    const balance = balances[0];
    if (
      !balance ||
      !balance.active ||
      balance.customerId !== input.customerId ||
      (balance.expiresAt && balance.expiresAt < new Date()) ||
      balance.remaining < line.packageQuantity ||
      (line.item_type === "service" && balance.serviceId !== line.service_id) ||
      (line.item_type === "product" && balance.productId !== line.product_id)
    ) throw new Error("PACKAGE_COVERAGE_INVALID");
    await tx.update(customerPackageItemBalances).set({
      usedQuantity: sql`${customerPackageItemBalances.usedQuantity} + ${line.packageQuantity}`,
    }).where(and(
      eq(customerPackageItemBalances.customerPackageId, line.customer_package_id),
      eq(customerPackageItemBalances.packageItemId, line.package_item_id),
    ));
    await tx.insert(servicePackageUsages).values({
      appointmentId: input.appointmentId,
      createdByUserId: input.userId,
      customerPackageId: line.customer_package_id,
      note: `${line.description} coperto dal pacchetto`,
      packageItemId: line.package_item_id,
      quantityUsed: line.packageQuantity,
      saleId: input.saleId,
      saleItemId: input.saleItemIds[index],
      salonId: input.salonId,
      sessionsUsed: line.packageQuantity,
    });
    await tx.update(customerServicePackages).set({
      usedSessions: sql`${customerServicePackages.usedSessions} + ${line.packageQuantity}`,
    }).where(eq(customerServicePackages.id, line.customer_package_id));
    const remainingRows = await tx.select({
      remaining: sql<number>`sum(${customerPackageItemBalances.totalQuantity} - ${customerPackageItemBalances.usedQuantity})`,
    }).from(customerPackageItemBalances).where(eq(customerPackageItemBalances.customerPackageId, line.customer_package_id));
    if (Number(remainingRows[0]?.remaining ?? 0) <= 0) {
      await tx.update(customerServicePackages).set({ active: false }).where(eq(customerServicePackages.id, line.customer_package_id));
    }
  }
}

function validateIssuedVouchers(lines: ReturnType<typeof normalizedLine>[], vouchers: IssuedVoucher[] = []) {
  const issuedTotal = vouchers.reduce((total, voucher) => total + Math.max(0, Math.trunc(voucher.amount_cents)), 0);
  const voucherLineTotal = lines
    .filter((line) => line.item_type === "custom" && line.description.toLowerCase().startsWith("buono acquisto"))
    .reduce((total, line) => total + line.totalCents, 0);
  if (vouchers.some((voucher) => !voucher.recipient_customer_id || voucher.amount_cents <= 0)) return false;
  return issuedTotal === voucherLineTotal;
}

function normalizedPayments(payments: CheckoutPayment[]) {
  return payments
    .map((payment) => ({ ...payment, amount_cents: Math.max(0, Math.trunc(payment.amount_cents)) }))
    .filter((payment) => payment.amount_cents > 0);
}

function paymentTotals(payments: CheckoutPayment[]) {
  return payments.reduce(
    (totals, payment) => payment.method === "voucher"
      ? { ...totals, voucherCents: totals.voucherCents + payment.amount_cents }
      : { ...totals, cashCents: totals.cashCents + payment.amount_cents },
    { cashCents: 0, voucherCents: 0 },
  );
}

async function savePayments(
  tx: any,
  input: {
    customerId?: string | null;
    payments: CheckoutPayment[];
    saleId: string;
    salonId: string;
    userId: string;
  },
) {
  const rows = [];
  for (const payment of input.payments) {
    if (payment.method === "voucher") {
      const code = payment.voucher_code?.replace(/\D/g, "") || payment.reference?.replace(/\D/g, "");
      if (!code) throw new Error("VOUCHER_CODE_REQUIRED");
      await redeemPurchaseVoucher(tx, {
        amountCents: payment.amount_cents,
        code,
        createdByUserId: input.userId,
        customerId: input.customerId,
        saleId: input.saleId,
        salonId: input.salonId,
      });
    } else {
      rows.push({
        amountCents: payment.amount_cents,
        method: payment.method,
        reference: payment.reference?.trim() || null,
        saleId: input.saleId,
        salonId: input.salonId,
      });
    }
  }
  if (rows.length) await tx.insert(salePayments).values(rows);
}

async function issueVouchers(
  tx: any,
  input: {
    issuedVouchers?: IssuedVoucher[];
    purchaserCustomerId?: string | null;
    saleId: string;
    salonId: string;
    userId: string;
  },
) {
  const issued = [];
  for (const voucher of input.issuedVouchers ?? []) {
    const customerRows = await tx.select({ id: customers.id }).from(customers).where(and(
      eq(customers.id, voucher.recipient_customer_id),
      eq(customers.salonId, input.salonId),
      eq(customers.blocked, false),
    ));
    if (!customerRows[0]) throw new Error("VOUCHER_RECIPIENT_NOT_FOUND");
    issued.push(await issuePurchaseVoucher(tx, {
      amountCents: Math.trunc(voucher.amount_cents),
      customerId: voucher.recipient_customer_id,
      issuedByUserId: input.userId,
      issuedSaleId: input.saleId,
      message: voucher.message,
      purchaserCustomerId: input.purchaserCustomerId || undefined,
      salonId: input.salonId,
    }));
  }
  return issued;
}

async function assignPurchasedPackages(
  tx: any,
  input: {
    assignedPackages?: AssignedPackage[];
    customerId?: string | null;
    saleId: string;
    salonId: string;
  },
) {
  if (!input.assignedPackages?.length) return [];
  if (!input.customerId) throw new Error("PACKAGE_CUSTOMER_REQUIRED");
  const assigned = [];
  for (const entry of input.assignedPackages) {
    const packageRows = await tx.select().from(servicePackages).where(and(
      eq(servicePackages.id, entry.package_id),
      eq(servicePackages.salonId, input.salonId),
      eq(servicePackages.active, true),
    ));
    const packageItem = packageRows[0];
    if (!packageItem) throw new Error("PACKAGE_NOT_FOUND");
    const items = await tx.select().from(servicePackageItems).where(eq(servicePackageItems.packageId, packageItem.id)) as Array<typeof servicePackageItems.$inferSelect>;
    if (!items.length) throw new Error("PACKAGE_EMPTY");
    const expiresAt = packageItem.validityDays ? new Date(Date.now() + packageItem.validityDays * 86400000) : null;
    const rows = await tx.insert(customerServicePackages).values({
      customerId: input.customerId,
      expiresAt,
      packageId: packageItem.id,
      purchaseSaleId: input.saleId,
      salonId: input.salonId,
      totalSessions: items.reduce((sum, item) => sum + item.quantity, 0),
    }).returning();
    await tx.insert(customerPackageItemBalances).values(items.map((item) => ({
      customerPackageId: rows[0]!.id,
      packageItemId: item.id,
      salonId: input.salonId,
      totalQuantity: item.quantity,
    })));
    assigned.push(rows[0]!);
  }
  return assigned;
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
    const packagesEnabled = await isModuleEnabled(request.salonId, MODULE_KEYS.PACKAGES, app.db);
    const [serviceRows, productRows, staffRows, packageRows] = await Promise.all([
      app.db.select({
        category: services.category,
        category_icon: serviceCategories.icon,
        category_id: services.categoryId,
        id: services.id,
        name: services.name,
        price_cents: services.priceCents,
      }).from(services)
        .leftJoin(serviceCategories, eq(serviceCategories.id, services.categoryId))
        .where(and(eq(services.salonId, request.salonId), eq(services.active, true))),
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
      packagesEnabled
        ? app.db.select({
            id: servicePackages.id,
            name: servicePackages.name,
            price_cents: servicePackages.priceCents,
          }).from(servicePackages).where(and(eq(servicePackages.salonId, request.salonId), eq(servicePackages.active, true)))
        : Promise.resolve([]),
    ]);
    return { packages: packageRows, products: productRows, services: serviceRows, staff: staffRows };
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
      assigned_packages?: AssignedPackage[];
      discount_cents?: number;
      issued_vouchers?: IssuedVoucher[];
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
    if (!validateIssuedVouchers(lines, request.body.issued_vouchers)) {
      return reply.code(400).send({ error: "VOUCHER_ISSUE_TOTAL_MISMATCH" });
    }
    const packageLineIds = lines.filter((line) => line.item_type === "custom" && line.description.toLowerCase().startsWith("pacchetto ·")).map((line) => line.description.split("·")[1]?.trim());
    if ((request.body.assigned_packages?.length ?? 0) !== packageLineIds.length) {
      return reply.code(400).send({ error: "PACKAGE_ASSIGNMENT_MISMATCH" });
    }
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
    const manualDiscountCents = Math.min(subtotalCents, Math.max(0, Math.trunc(request.body.discount_cents ?? 0)));
    const saleValueCents = subtotalCents - manualDiscountCents;
    const payments = normalizedPayments(request.body.payments);
    const { cashCents, voucherCents } = paymentTotals(payments);
    if ((request.body.issued_vouchers?.length ?? 0) > 0 && (manualDiscountCents > 0 || voucherCents > 0)) {
      return reply.code(400).send({ error: "VOUCHER_CANNOT_BE_DISCOUNTED" });
    }
    if (voucherCents > saleValueCents) return reply.code(400).send({ error: "PAYMENT_TOTAL_MISMATCH" });
    const discountCents = manualDiscountCents + voucherCents;
    const totalCents = saleValueCents - voucherCents;
    if (cashCents !== totalCents) return reply.code(400).send({ error: "PAYMENT_TOTAL_MISMATCH" });
    const loyaltyEnabled = Boolean(request.body.customer_id) &&
      await isModuleEnabled(request.salonId, MODULE_KEYS.LOYALTY, app.db);

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
      const insertedItems = await tx.insert(saleItems).values(lines.map((item) => ({
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
      }))).returning({ id: saleItems.id });
      await consumePackageItems(tx, {
        customerId: request.body.customer_id,
        lines,
        saleId: sale.id,
        saleItemIds: insertedItems.map((item) => item.id),
        salonId: request.salonId,
        userId: request.user.id,
      });
      await savePayments(tx, {
        customerId: request.body.customer_id,
        payments,
        saleId: sale.id,
        salonId: request.salonId,
        userId: request.user.id,
      });
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
      const issuedVouchers = await issueVouchers(tx, {
        issuedVouchers: request.body.issued_vouchers,
        purchaserCustomerId: request.body.customer_id,
        saleId: sale.id,
        salonId: request.salonId,
        userId: request.user.id,
      });
      const assignedPackages = await assignPurchasedPackages(tx, {
        assignedPackages: request.body.assigned_packages,
        customerId: request.body.customer_id,
        saleId: sale.id,
        salonId: request.salonId,
      });
      if (loyaltyEnabled) {
        await awardSaleLoyalty(tx, {
          customerId: request.body.customer_id,
          discountCents,
          items: lines,
          saleId: sale.id,
          salonId: request.salonId,
        });
      }
      return { assigned_packages: assignedPackages, issued_vouchers: issuedVouchers, sale };
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
      issued_vouchers?: IssuedVoucher[];
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
      if (!validateIssuedVouchers(lines, request.body.issued_vouchers)) {
        return reply.code(400).send({ error: "VOUCHER_ISSUE_TOTAL_MISMATCH" });
      }
      const subtotalCents = lines.reduce((total, item) => total + item.totalCents, 0);
      const manualDiscountCents = Math.min(subtotalCents, Math.max(0, Math.trunc(request.body.discount_cents ?? 0)));
      const saleValueCents = subtotalCents - manualDiscountCents;
      const payments = normalizedPayments(request.body.payments);
      const { cashCents, voucherCents } = paymentTotals(payments);
      if ((request.body.issued_vouchers?.length ?? 0) > 0 && (manualDiscountCents > 0 || voucherCents > 0)) {
        return reply.code(400).send({ error: "VOUCHER_CANNOT_BE_DISCOUNTED" });
      }
      if (voucherCents > saleValueCents) {
        return reply.code(400).send({ error: "PAYMENT_TOTAL_MISMATCH", expected_cents: saleValueCents, paid_cents: voucherCents });
      }
      const discountCents = manualDiscountCents + voucherCents;
      const totalCents = saleValueCents - voucherCents;
      if (cashCents !== totalCents) {
        return reply.code(400).send({ error: "PAYMENT_TOTAL_MISMATCH", expected_cents: totalCents, paid_cents: cashCents });
      }
      const loyaltyEnabled = await isModuleEnabled(request.salonId, MODULE_KEYS.LOYALTY, app.db);

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
        const insertedItems = await tx.insert(saleItems).values(lines.map((item) => ({
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
        }))).returning({ id: saleItems.id });
        await consumePackageItems(tx, {
          appointmentId: appointment.id,
          customerId: appointment.customerId,
          lines,
          saleId: sale.id,
          saleItemIds: insertedItems.map((item) => item.id),
          salonId: request.salonId,
          userId: request.user.id,
        });
        await savePayments(tx, {
          customerId: appointment.customerId,
          payments,
          saleId: sale.id,
          salonId: request.salonId,
          userId: request.user.id,
        });

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
        if (loyaltyEnabled) {
          await awardSaleLoyalty(tx, {
            appointmentId: appointment.id,
            customerId: appointment.customerId,
            discountCents,
            items: lines,
            saleId: sale.id,
            salonId: request.salonId,
          });
        }
        const issuedVouchers = await issueVouchers(tx, {
          issuedVouchers: request.body.issued_vouchers,
          purchaserCustomerId: appointment.customerId,
          saleId: sale.id,
          salonId: request.salonId,
          userId: request.user.id,
        });
        return { conflict: false as const, issuedVouchers, sale };
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
    const paymentRows = rows.length ? await app.db
      .select({ method: salePayments.method, sale_id: salePayments.saleId })
      .from(salePayments)
      .where(and(eq(salePayments.salonId, request.salonId), inArray(salePayments.saleId, rows.map((row) => row.id)))) : [];
    const methodsBySale = new Map<string, PaymentMethod[]>();
    for (const payment of paymentRows) methodsBySale.set(payment.sale_id, [...(methodsBySale.get(payment.sale_id) ?? []), payment.method]);
    return {
      payments,
      rows: rows.map((row) => ({ ...row, payment_methods: methodsBySale.get(row.id) ?? [] })),
      summary: {
        average_cents: rows.length ? Math.round(rows.reduce((total, row) => total + row.total_cents, 0) / rows.length) : 0,
        count: rows.length,
        discount_cents: rows.reduce((total, row) => total + row.discount_cents, 0),
        total_cents: rows.reduce((total, row) => total + row.total_cents, 0),
      },
    };
  });

  app.get<{
    Params: { id: string };
    Querystring: AccountingQuery;
  }>("/api/salons/:id/accounting/overview", { preHandler: [authenticate] }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    if (!(await canUsePos(request))) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    return accountingSnapshot(app, request.salonId, request.query);
  });

  app.get<{
    Params: { id: string };
    Querystring: AccountingQuery;
  }>("/api/salons/:id/accounting/report.pdf", { preHandler: [authenticate] }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    if (!(await canUsePos(request))) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const snapshot = await accountingSnapshot(app, request.salonId, request.query);
    return reply
      .header("content-type", "application/pdf")
      .header("content-disposition", 'attachment; filename="contabilita.pdf"')
      .send(accountingPdf(snapshot));
  });

  app.get<{
    Params: { id: string };
    Querystring: { from?: string; to?: string };
  }>("/api/salons/:id/sales/export", { preHandler: [authenticate] }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    if (!(await canUsePos(request))) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const conditions = [
      eq(sales.salonId, request.salonId),
      eq(sales.status, "paid"),
      ...(request.query.from ? [gte(sales.closedAt, new Date(request.query.from))] : []),
      ...(request.query.to ? [lte(sales.closedAt, new Date(request.query.to))] : []),
    ];
    const rows = await app.db.select({
      cashier: users.fullName,
      closed_at: sales.closedAt,
      customer: customers.fullName,
      discount_cents: sales.discountCents,
      id: sales.id,
      staff: staff.displayName,
      subtotal_cents: sales.subtotalCents,
      total_cents: sales.totalCents,
    }).from(sales)
      .leftJoin(customers, eq(customers.id, sales.customerId))
      .leftJoin(staff, eq(staff.id, sales.staffId))
      .leftJoin(users, eq(users.id, sales.closedByUserId))
      .where(and(...conditions)).orderBy(desc(sales.closedAt));
    const paymentRows = await app.db.select({
      amount_cents: salePayments.amountCents,
      method: salePayments.method,
      paid_at: salePayments.paidAt,
      reference: salePayments.reference,
      sale_id: salePayments.saleId,
    }).from(salePayments).innerJoin(sales, eq(sales.id, salePayments.saleId)).where(and(...conditions));

    const workbook = createWorkbook("Contabilita EsseBeauty");
    const summary = workbook.addWorksheet("Riepilogo");
    const total = rows.reduce((sum, row) => sum + row.total_cents, 0);
    const discounts = rows.reduce((sum, row) => sum + row.discount_cents, 0);
    summary.addRow(["Indicatore", "Valore"]);
    summary.addRows([["Incassato", total / 100], ["Vendite", rows.length], ["Scontrino medio", rows.length ? total / rows.length / 100 : 0], ["Sconti", discounts / 100]]);
    styleWorksheet(summary, [2]);
    const salesSheet = workbook.addWorksheet("Vendite");
    salesSheet.addRow(["ID", "Data", "Cliente", "Operatore", "Cassiere", "Subtotale", "Sconto", "Totale"]);
    rows.forEach((row) => salesSheet.addRow([row.id, row.closed_at, row.customer ?? "Cliente occasionale", row.staff ?? "", row.cashier ?? "", row.subtotal_cents / 100, row.discount_cents / 100, row.total_cents / 100]));
    salesSheet.getColumn(2).numFmt = "dd/mm/yyyy hh:mm";
    styleWorksheet(salesSheet, [6, 7, 8]);
    const paymentsSheet = workbook.addWorksheet("Pagamenti");
    paymentsSheet.addRow(["Vendita", "Data", "Metodo", "Importo", "Riferimento"]);
    paymentRows.forEach((row) => paymentsSheet.addRow([row.sale_id, row.paid_at, row.method, row.amount_cents / 100, row.reference ?? ""]));
    paymentsSheet.getColumn(2).numFmt = "dd/mm/yyyy hh:mm";
    styleWorksheet(paymentsSheet, [4]);
    return reply.header("content-type", excelContentType)
      .header("content-disposition", 'attachment; filename="contabilita.xlsx"')
      .send(await workbookBuffer(workbook));
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
