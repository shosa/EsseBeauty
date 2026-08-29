import type { WarehousePaymentMethod } from "./warehouse-types";

function cents(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function buildExpensePayload(input: {
  amount: string;
  category: string;
  date: string;
  description: string;
  idempotencyKey?: string;
  notes?: string;
  paymentMethod: WarehousePaymentMethod;
  supplierId?: string;
  vat: string;
}) {
  const amountCents = cents(input.amount);
  const taxCents = cents(input.vat);
  return {
    amount_cents: amountCents,
    category: input.category.trim(),
    competence_date: input.date,
    description: input.description.trim(),
    idempotency_key: input.idempotencyKey ?? crypto.randomUUID(),
    net_cents: amountCents - taxCents,
    notes: input.notes?.trim() || null,
    payment_method: input.paymentMethod,
    supplier_id: input.supplierId || null,
    tax_cents: taxCents,
    transaction_date: input.date,
  };
}

export function buildAssetPayload(input: {
  cost: string;
  date: string;
  description: string;
  externalReference?: string;
  idempotencyKey?: string;
  location?: string;
  notes?: string;
  paymentMethod: WarehousePaymentMethod;
  serialNumber?: string;
  supplierId?: string;
  warrantyExpiresAt?: string;
}) {
  return {
    description: input.description.trim(),
    external_reference: input.externalReference?.trim() || null,
    idempotency_key: input.idempotencyKey ?? crypto.randomUUID(),
    location: input.location?.trim() || null,
    notes: input.notes?.trim() || null,
    payment_method: input.paymentMethod,
    purchase_cost_cents: cents(input.cost),
    purchase_date: input.date,
    serial_number: input.serialNumber?.trim() || null,
    supplier_id: input.supplierId || null,
    warranty_expires_at: input.warrantyExpiresAt || null,
  };
}
