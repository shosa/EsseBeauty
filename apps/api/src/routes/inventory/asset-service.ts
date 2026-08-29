import type { ExpensePaymentMethod } from "./expense-service.js";
import type { WarehouseDocumentKind } from "./warehouse-types.js";

export interface RegisterAssetInput {
  actorUserId: string;
  description: string;
  externalReference?: string | null;
  idempotencyKey: string;
  location?: string | null;
  notes?: string | null;
  paymentMethod: ExpensePaymentMethod;
  purchaseCostCents: number;
  purchaseDate: Date;
  salonId: string;
  serialNumber?: string | null;
  supplierId?: string | null;
  warrantyExpiresAt?: Date | null;
}

export interface AssetCommandResult {
  assetId: string;
  cashMovementId: string;
  documentId: string;
}

export interface DisposeAssetInput {
  actorUserId: string;
  assetId: string;
  disposedAt: Date;
  reason: string;
  salonId: string;
}

export interface AssetCommandRepository {
  transaction<T>(work: (tx: AssetCommandTransaction) => Promise<T>): Promise<T>;
}

export interface AssetCommandTransaction {
  actorBelongsToSalon(salonId: string, actorUserId: string): Promise<boolean>;
  createAsset(input: {
    cashMovementId: string | null;
    description: string;
    documentId: string;
    documentLineId: string;
    idempotencyKey: string;
    location: string | null;
    notes: string | null;
    purchaseCostCents: number;
    purchaseDate: Date;
    salonId: string;
    serialNumber: string | null;
    status: "active";
    supplierId: string | null;
    warrantyExpiresAt: Date | null;
  }): Promise<{ id: string }>;
  createCashMovement(input: {
    amountCents: number;
    category: "Attrezzature";
    createdByUserId: string;
    direction: "out";
    idempotencyKey: string;
    notes: string | null;
    occurredAt: Date;
    paymentMethod: ExpensePaymentMethod;
    reason: string;
    salonId: string;
    sourceId: string;
    sourceType: "inventory_asset";
  }): Promise<{ id: string }>;
  createDocument(input: {
    competenceDate: Date;
    createdByUserId: string;
    documentDate: Date;
    externalReference: string | null;
    internalNumber: string;
    kind: WarehouseDocumentKind;
    netTotalCents: number;
    notes: string | null;
    salonId: string;
    supplierId: string | null;
    taxTotalCents: number;
    totalCents: number;
  }): Promise<{ id: string }>;
  createDocumentLine(input: {
    description: string;
    documentId: string;
    itemType: "equipment";
    lineNumber: number;
    netCents: number;
    productId: null;
    quantity: number;
    salonId: string;
    stockDelta: 0;
    supplierId: string | null;
    taxCents: number;
    taxRateBasisPoints: number;
    totalCents: number;
    unitCostCents: number;
  }): Promise<{ id: string }>;
  disposeAsset(input: DisposeAssetInput): Promise<{ id: string; status: "disposed" }>;
  findAssetByIdempotency(salonId: string, idempotencyKey: string): Promise<AssetCommandResult | undefined>;
  markDocumentPosted(salonId: string, documentId: string, actorUserId: string): Promise<void>;
  nextDocumentNumber(salonId: string, kind: WarehouseDocumentKind, date: Date): Promise<string>;
}

function assertAsset(input: RegisterAssetInput) {
  if (!input.idempotencyKey.trim()) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  if (!input.description.trim()) throw new Error("ASSET_DESCRIPTION_REQUIRED");
  if (input.purchaseCostCents <= 0) throw new Error("INVALID_ASSET_COST");
}

export async function registerAssetPurchase(
  repository: AssetCommandRepository,
  input: RegisterAssetInput,
): Promise<AssetCommandResult> {
  assertAsset(input);
  return repository.transaction(async (tx) => {
    if (!(await tx.actorBelongsToSalon(input.salonId, input.actorUserId))) throw new Error("ACTOR_FORBIDDEN");
    const existing = await tx.findAssetByIdempotency(input.salonId, input.idempotencyKey);
    if (existing) return existing;
    const document = await tx.createDocument({
      competenceDate: input.purchaseDate,
      createdByUserId: input.actorUserId,
      documentDate: input.purchaseDate,
      externalReference: input.externalReference ?? null,
      internalNumber: await tx.nextDocumentNumber(input.salonId, "equipment_purchase", input.purchaseDate),
      kind: "equipment_purchase",
      netTotalCents: input.purchaseCostCents,
      notes: input.notes ?? null,
      salonId: input.salonId,
      supplierId: input.supplierId ?? null,
      taxTotalCents: 0,
      totalCents: input.purchaseCostCents,
    });
    const line = await tx.createDocumentLine({
      description: input.description.trim(),
      documentId: document.id,
      itemType: "equipment",
      lineNumber: 1,
      netCents: input.purchaseCostCents,
      productId: null,
      quantity: 1,
      salonId: input.salonId,
      stockDelta: 0,
      supplierId: input.supplierId ?? null,
      taxCents: 0,
      taxRateBasisPoints: 0,
      totalCents: input.purchaseCostCents,
      unitCostCents: input.purchaseCostCents,
    });
    const cashMovement = await tx.createCashMovement({
      amountCents: input.purchaseCostCents,
      category: "Attrezzature",
      createdByUserId: input.actorUserId,
      direction: "out",
      idempotencyKey: input.idempotencyKey,
      notes: input.notes ?? null,
      occurredAt: input.purchaseDate,
      paymentMethod: input.paymentMethod,
      reason: input.description.trim(),
      salonId: input.salonId,
      sourceId: document.id,
      sourceType: "inventory_asset",
    });
    const asset = await tx.createAsset({
      cashMovementId: cashMovement.id,
      description: input.description.trim(),
      documentId: document.id,
      documentLineId: line.id,
      idempotencyKey: input.idempotencyKey,
      location: input.location ?? null,
      notes: input.notes ?? null,
      purchaseCostCents: input.purchaseCostCents,
      purchaseDate: input.purchaseDate,
      salonId: input.salonId,
      serialNumber: input.serialNumber ?? null,
      status: "active",
      supplierId: input.supplierId ?? null,
      warrantyExpiresAt: input.warrantyExpiresAt ?? null,
    });
    await tx.markDocumentPosted(input.salonId, document.id, input.actorUserId);
    return { assetId: asset.id, cashMovementId: cashMovement.id, documentId: document.id };
  });
}

export async function disposeAsset(
  repository: AssetCommandRepository,
  input: DisposeAssetInput,
): Promise<{ assetId: string; status: "disposed" }> {
  if (!input.reason.trim()) throw new Error("DISPOSAL_REASON_REQUIRED");
  return repository.transaction(async (tx) => {
    if (!(await tx.actorBelongsToSalon(input.salonId, input.actorUserId))) throw new Error("ACTOR_FORBIDDEN");
    const disposed = await tx.disposeAsset(input);
    return { assetId: disposed.id, status: disposed.status };
  });
}
