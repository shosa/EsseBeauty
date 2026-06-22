import { randomInt } from "node:crypto";
import { and, eq } from "drizzle-orm";

import {
  purchaseVoucherMovements,
  purchaseVouchers,
} from "@esse-beauty/db/schema";

function luhnDigit(value: string) {
  const sum = value.split("").reverse().reduce((total, digit, index) => {
    let number = Number(digit);
    if (index % 2 === 0) {
      number *= 2;
      if (number > 9) number -= 9;
    }
    return total + number;
  }, 0);
  return String((10 - (sum % 10)) % 10);
}

export function generateVoucherCode() {
  const base = Array.from({ length: 11 }, () => randomInt(0, 10)).join("");
  return `${base}${luhnDigit(base)}`;
}

export async function issuePurchaseVoucher(
  tx: any,
  input: {
    amountCents: number;
    customerId: string;
    issuedByUserId: string;
    issuedSaleId: string;
    message?: string;
    purchaserCustomerId?: string;
    salonId: string;
  },
) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateVoucherCode();
    const existing = await tx.select({ id: purchaseVouchers.id }).from(purchaseVouchers).where(and(
      eq(purchaseVouchers.salonId, input.salonId),
      eq(purchaseVouchers.code, code),
    ));
    if (existing.length) continue;
    const rows = await tx.insert(purchaseVouchers).values({
      balanceCents: input.amountCents,
      code,
      customerId: input.customerId,
      issuedByUserId: input.issuedByUserId,
      issuedSaleId: input.issuedSaleId,
      message: input.message?.trim() || null,
      originalAmountCents: input.amountCents,
      purchaserCustomerId: input.purchaserCustomerId || null,
      salonId: input.salonId,
      status: "active",
    }).returning();
    const voucher = rows[0]!;
    await tx.insert(purchaseVoucherMovements).values({
      balanceAfterCents: input.amountCents,
      createdByUserId: input.issuedByUserId,
      deltaCents: input.amountCents,
      reason: "Emissione buono acquisto",
      saleId: input.issuedSaleId,
      salonId: input.salonId,
      voucherId: voucher.id,
    });
    return voucher;
  }
  throw new Error("VOUCHER_CODE_GENERATION_FAILED");
}

export async function redeemPurchaseVoucher(
  tx: any,
  input: {
    amountCents: number;
    code: string;
    createdByUserId: string;
    customerId?: string | null;
    saleId: string;
    salonId: string;
  },
) {
  const rows = await tx.select().from(purchaseVouchers).where(and(
    eq(purchaseVouchers.salonId, input.salonId),
    eq(purchaseVouchers.code, input.code.replace(/\D/g, "")),
  )).for("update");
  const voucher = rows[0];
  if (!voucher) throw new Error("VOUCHER_NOT_FOUND");
  if (voucher.status !== "active" || voucher.balanceCents <= 0) throw new Error("VOUCHER_EXHAUSTED");
  if (!input.customerId || voucher.customerId !== input.customerId) throw new Error("VOUCHER_CUSTOMER_MISMATCH");
  if (input.amountCents > voucher.balanceCents) throw new Error("VOUCHER_INSUFFICIENT_BALANCE");
  const balanceAfter = voucher.balanceCents - input.amountCents;
  await tx.update(purchaseVouchers).set({
    balanceCents: balanceAfter,
    exhaustedAt: balanceAfter === 0 ? new Date() : null,
    status: balanceAfter === 0 ? "exhausted" : "active",
    updatedAt: new Date(),
  }).where(eq(purchaseVouchers.id, voucher.id));
  await tx.insert(purchaseVoucherMovements).values({
    balanceAfterCents: balanceAfter,
    createdByUserId: input.createdByUserId,
    deltaCents: -input.amountCents,
    reason: "Utilizzo in cassa",
    saleId: input.saleId,
    salonId: input.salonId,
    voucherId: voucher.id,
  });
  return { ...voucher, balanceAfter };
}
