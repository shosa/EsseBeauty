import { and, eq, sql } from "drizzle-orm";

import {
  customerPackageItemBalances,
  customerServicePackages,
  inventoryMovements,
  inventoryProducts,
  loyaltyPoints,
  purchaseVoucherMovements,
  purchaseVouchers,
  salePayments,
  sales,
  servicePackageItems,
  servicePackageUsages,
  servicePackages,
  services,
} from "@esse-beauty/db/schema";

export interface SaleVoidRestoreProduct { product_id: string; product_name: string; quantity: number; }
export interface SaleVoidRestoreVoucherIssued { amount_cents: number; blocked: boolean; blocked_reason?: string; code: string; }
export interface SaleVoidRestoreVoucherRedeemed { amount_cents: number; code: string; }
export interface SaleVoidRestorePackagePurchased { blocked: boolean; blocked_reason?: string; package_name: string; }
export interface SaleVoidRestorePackageConsumed { item_name: string; package_name: string; quantity: number; }

export interface SaleVoidPlan {
  blocking_reasons: string[];
  can_void: boolean;
  loyalty_points: number;
  packages_consumed: SaleVoidRestorePackageConsumed[];
  packages_purchased: SaleVoidRestorePackagePurchased[];
  products: SaleVoidRestoreProduct[];
  vouchers_issued: SaleVoidRestoreVoucherIssued[];
  vouchers_redeemed: SaleVoidRestoreVoucherRedeemed[];
}

function itemLabel(row: { productName: string | null; serviceName: string | null }) {
  return row.serviceName ?? row.productName ?? "Voce del pacchetto";
}

export async function buildSaleVoidPlan(db: any, salonId: string, saleId: string): Promise<SaleVoidPlan> {
  const blockingReasons: string[] = [];

  const movementRows = await db.select({
    delta: inventoryMovements.delta,
    productId: inventoryMovements.productId,
    productName: inventoryProducts.name,
  }).from(inventoryMovements)
    .innerJoin(inventoryProducts, eq(inventoryProducts.id, inventoryMovements.productId))
    .where(and(eq(inventoryMovements.salonId, salonId), eq(inventoryMovements.reason, `Vendita ${saleId}`)));
  const products: SaleVoidRestoreProduct[] = movementRows
    .filter((row: any) => row.delta < 0)
    .map((row: any) => ({ product_id: row.productId, product_name: row.productName, quantity: -row.delta }));

  const issuedVoucherRows = await db.select().from(purchaseVouchers).where(and(
    eq(purchaseVouchers.salonId, salonId),
    eq(purchaseVouchers.issuedSaleId, saleId),
  ));
  const vouchersIssued: SaleVoidRestoreVoucherIssued[] = issuedVoucherRows.map((voucher: any) => {
    const alreadyUsed = voucher.balanceCents < voucher.originalAmountCents;
    const alreadyVoid = voucher.status === "void";
    const blockedReason = alreadyVoid ? "Il buono è già stato stornato." : alreadyUsed ? "Il buono è già stato in parte utilizzato." : undefined;
    return { amount_cents: voucher.originalAmountCents, blocked: Boolean(blockedReason), blocked_reason: blockedReason, code: voucher.code };
  });
  for (const voucher of vouchersIssued) if (voucher.blocked_reason) blockingReasons.push(`Buono ${voucher.code}: ${voucher.blocked_reason}`);

  const redeemedPaymentRows = await db.select({
    amountCents: salePayments.amountCents,
    code: purchaseVouchers.code,
  }).from(salePayments)
    .innerJoin(purchaseVouchers, eq(purchaseVouchers.id, salePayments.voucherId))
    .where(and(eq(salePayments.salonId, salonId), eq(salePayments.saleId, saleId)));
  const vouchersRedeemed: SaleVoidRestoreVoucherRedeemed[] = redeemedPaymentRows.map((row: any) => ({ amount_cents: row.amountCents, code: row.code }));

  const purchasedPackageRows = await db.select({
    name: servicePackages.name,
    usedSessions: customerServicePackages.usedSessions,
  }).from(customerServicePackages)
    .innerJoin(servicePackages, eq(servicePackages.id, customerServicePackages.packageId))
    .where(and(eq(customerServicePackages.salonId, salonId), eq(customerServicePackages.purchaseSaleId, saleId)));
  const packagesPurchased: SaleVoidRestorePackagePurchased[] = purchasedPackageRows.map((row: any) => {
    const used = row.usedSessions > 0;
    const blockedReason = used ? "Il pacchetto è già stato in parte utilizzato." : undefined;
    return { blocked: used, blocked_reason: blockedReason, package_name: row.name };
  });
  for (const pkg of packagesPurchased) if (pkg.blocked_reason) blockingReasons.push(`Pacchetto ${pkg.package_name}: ${pkg.blocked_reason}`);

  const usageRows = await db.select({
    packageName: servicePackages.name,
    productName: inventoryProducts.name,
    quantityUsed: servicePackageUsages.quantityUsed,
    serviceName: services.name,
  }).from(servicePackageUsages)
    .innerJoin(customerServicePackages, eq(customerServicePackages.id, servicePackageUsages.customerPackageId))
    .innerJoin(servicePackages, eq(servicePackages.id, customerServicePackages.packageId))
    .leftJoin(servicePackageItems, eq(servicePackageItems.id, servicePackageUsages.packageItemId))
    .leftJoin(services, eq(services.id, servicePackageItems.serviceId))
    .leftJoin(inventoryProducts, eq(inventoryProducts.id, servicePackageItems.productId))
    .where(and(eq(servicePackageUsages.salonId, salonId), eq(servicePackageUsages.saleId, saleId)));
  const packagesConsumed: SaleVoidRestorePackageConsumed[] = usageRows.map((row: any) => ({
    item_name: itemLabel(row),
    package_name: row.packageName,
    quantity: row.quantityUsed,
  }));

  const loyaltyRows = await db.select({
    total: sql<number>`coalesce(sum(${loyaltyPoints.delta}), 0)::int`,
  }).from(loyaltyPoints).where(and(
    eq(loyaltyPoints.salonId, salonId),
    eq(loyaltyPoints.saleId, saleId),
    sql`${loyaltyPoints.expiredAt} is null`,
  ));
  const loyaltyPointsTotal = Number(loyaltyRows[0]?.total ?? 0);

  return {
    blocking_reasons: blockingReasons,
    can_void: blockingReasons.length === 0,
    loyalty_points: loyaltyPointsTotal,
    packages_consumed: packagesConsumed,
    packages_purchased: packagesPurchased,
    products,
    vouchers_issued: vouchersIssued,
    vouchers_redeemed: vouchersRedeemed,
  };
}

export async function voidSale(
  tx: any,
  input: { reason?: string; saleId: string; salonId: string; userId: string },
): Promise<SaleVoidPlan> {
  const saleRows = await tx.select().from(sales).where(and(
    eq(sales.id, input.saleId),
    eq(sales.salonId, input.salonId),
  )).for("update");
  const sale = saleRows[0];
  if (!sale) throw new Error("SALE_NOT_FOUND");
  if (sale.status !== "paid") throw new Error("SALE_NOT_VOIDABLE");

  const plan = await buildSaleVoidPlan(tx, input.salonId, input.saleId);
  if (!plan.can_void) throw new Error("SALE_VOID_BLOCKED");

  const movementRows = await tx.select().from(inventoryMovements).where(and(
    eq(inventoryMovements.salonId, input.salonId),
    eq(inventoryMovements.reason, `Vendita ${input.saleId}`),
  ));
  for (const movement of movementRows) {
    if (movement.delta >= 0) continue;
    const restore = -movement.delta;
    const productRows = await tx.select().from(inventoryProducts).where(eq(inventoryProducts.id, movement.productId)).for("update");
    const product = productRows[0];
    if (!product) continue;
    const stockAfter = product.stockQuantity + restore;
    await tx.update(inventoryProducts).set({ stockQuantity: stockAfter, updatedAt: new Date() }).where(eq(inventoryProducts.id, product.id));
    await tx.insert(inventoryMovements).values({
      createdByUserId: input.userId,
      delta: restore,
      productId: product.id,
      reason: `Storno vendita ${input.saleId}`,
      reversesMovementId: movement.id,
      salonId: input.salonId,
      stockAfter,
    });
  }

  for (const voucher of plan.vouchers_issued) {
    const voucherRows = await tx.select().from(purchaseVouchers).where(and(
      eq(purchaseVouchers.salonId, input.salonId),
      eq(purchaseVouchers.code, voucher.code),
    )).for("update");
    const current = voucherRows[0];
    if (!current) continue;
    await tx.update(purchaseVouchers).set({
      balanceCents: 0,
      exhaustedAt: new Date(),
      status: "void",
      updatedAt: new Date(),
    }).where(eq(purchaseVouchers.id, current.id));
    if (current.balanceCents > 0) {
      await tx.insert(purchaseVoucherMovements).values({
        balanceAfterCents: 0,
        createdByUserId: input.userId,
        deltaCents: -current.balanceCents,
        reason: "Storno vendita",
        saleId: input.saleId,
        salonId: input.salonId,
        voucherId: current.id,
      });
    }
  }

  for (const redeemed of plan.vouchers_redeemed) {
    const voucherRows = await tx.select().from(purchaseVouchers).where(and(
      eq(purchaseVouchers.salonId, input.salonId),
      eq(purchaseVouchers.code, redeemed.code),
    )).for("update");
    const current = voucherRows[0];
    if (!current) continue;
    const balanceAfter = Math.min(current.originalAmountCents, current.balanceCents + redeemed.amount_cents);
    await tx.update(purchaseVouchers).set({
      balanceCents: balanceAfter,
      exhaustedAt: balanceAfter > 0 ? null : current.exhaustedAt,
      status: current.status === "exhausted" && balanceAfter > 0 ? "active" : current.status,
      updatedAt: new Date(),
    }).where(eq(purchaseVouchers.id, current.id));
    await tx.insert(purchaseVoucherMovements).values({
      balanceAfterCents: balanceAfter,
      createdByUserId: input.userId,
      deltaCents: redeemed.amount_cents,
      reason: "Storno vendita",
      saleId: input.saleId,
      salonId: input.salonId,
      voucherId: current.id,
    });
  }

  const purchasedPackageRows = await tx.select({ id: customerServicePackages.id }).from(customerServicePackages).where(and(
    eq(customerServicePackages.salonId, input.salonId),
    eq(customerServicePackages.purchaseSaleId, input.saleId),
  ));
  for (const row of purchasedPackageRows) {
    await tx.delete(customerServicePackages).where(eq(customerServicePackages.id, row.id));
  }

  const usageRows = await tx.select().from(servicePackageUsages).where(and(
    eq(servicePackageUsages.salonId, input.salonId),
    eq(servicePackageUsages.saleId, input.saleId),
  ));
  for (const usage of usageRows) {
    if (usage.packageItemId) {
      await tx.update(customerPackageItemBalances).set({
        usedQuantity: sql`greatest(0, ${customerPackageItemBalances.usedQuantity} - ${usage.quantityUsed})`,
      }).where(and(
        eq(customerPackageItemBalances.customerPackageId, usage.customerPackageId),
        eq(customerPackageItemBalances.packageItemId, usage.packageItemId),
      ));
    }
    const packageRows = await tx.select().from(customerServicePackages).where(eq(customerServicePackages.id, usage.customerPackageId)).for("update");
    const customerPackage = packageRows[0];
    if (customerPackage) {
      const notExpired = !customerPackage.expiresAt || customerPackage.expiresAt >= new Date();
      await tx.update(customerServicePackages).set({
        active: notExpired ? true : customerPackage.active,
        usedSessions: sql`greatest(0, ${customerServicePackages.usedSessions} - ${usage.sessionsUsed})`,
      }).where(eq(customerServicePackages.id, customerPackage.id));
    }
    await tx.delete(servicePackageUsages).where(eq(servicePackageUsages.id, usage.id));
  }

  await tx.update(loyaltyPoints).set({ expiredAt: new Date() }).where(and(
    eq(loyaltyPoints.salonId, input.salonId),
    eq(loyaltyPoints.saleId, input.saleId),
    sql`${loyaltyPoints.expiredAt} is null`,
  ));

  await tx.update(sales).set({
    status: "void",
    updatedAt: new Date(),
    voidReason: input.reason?.trim() || null,
    voidedAt: new Date(),
    voidedByUserId: input.userId,
  }).where(eq(sales.id, input.saleId));

  return plan;
}
