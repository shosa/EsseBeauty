export type WarehouseDocumentKind =
  | "adjustment"
  | "count"
  | "credit_note"
  | "equipment_purchase"
  | "expense"
  | "internal_use"
  | "opening"
  | "purchase"
  | "supplier_invoice"
  | "supplier_return"
  | "waste";

export type WarehouseDocumentStatus = "cancelled" | "draft" | "posted" | "reversed";
export type WarehouseItemType = "consumable" | "equipment" | "expense" | "resale";

export interface WarehouseProductRecord {
  allowNegativeStock: boolean;
  averageCostCents: number;
  id: string;
  lastCostCents: number;
  salonId: string;
  stockQuantity: number;
  trackStock: boolean;
}

export interface WarehouseDocumentRecord {
  competenceDate: Date | null;
  createdByUserId: string | null;
  documentDate: Date;
  id: string;
  internalNumber: string;
  kind: WarehouseDocumentKind;
  netTotalCents: number;
  notes: string | null;
  postedAt: Date | null;
  postedByUserId: string | null;
  reversalOfDocumentId: string | null;
  salonId: string;
  status: WarehouseDocumentStatus;
  supplierId: string | null;
  taxTotalCents: number;
  totalCents: number;
}

export interface WarehouseDocumentLineRecord {
  description: string;
  discountCents: number;
  documentId: string;
  id: string;
  itemType: WarehouseItemType;
  lineNumber: number;
  netCents: number;
  productId: string | null;
  quantity: number;
  salonId: string;
  stockDelta: number;
  supplierId: string | null;
  taxCents: number;
  taxRateBasisPoints: number;
  totalCents: number;
  unitCostCents: number;
  reversesDocumentLineId: string | null;
}

export interface WarehouseMovementRecord {
  createdByUserId: string;
  delta: number;
  documentId: string | null;
  documentLineId: string | null;
  id: string;
  movementType: string;
  note: string | null;
  productId: string;
  reason: string;
  reversesMovementId: string | null;
  salonId: string;
  stockAfter: number;
  stockBefore: number;
  unitCostCents: number;
  valueCents: number;
}

export interface WarehouseExpenseRecord {
  category: string;
  competenceDate: Date;
  description: string;
  documentId: string;
  documentLineId: string | null;
  id: string;
  netCents: number;
  notes: string | null;
  salonId: string;
  supplierId: string | null;
  taxCents: number;
  totalCents: number;
  reversesExpenseId: string | null;
}

export interface WarehouseAssetRecord {
  description: string;
  documentId: string;
  documentLineId: string | null;
  id: string;
  notes: string | null;
  purchaseCostCents: number;
  purchaseDate: Date;
  salonId: string;
  status: "active" | "disposed";
  supplierId: string | null;
  reversesAssetId: string | null;
}

export interface WarehouseCountRecord {
  documentId: string | null;
  id: string;
  postedAt: Date | null;
  postedByUserId: string | null;
  salonId: string;
  status: "cancelled" | "counting" | "draft" | "posted";
}

export interface WarehouseCountLineRecord {
  countId: string;
  countedQuantity: number | null;
  differenceQuantity: number | null;
  differenceValueCents: number;
  id: string;
  productId: string;
  salonId: string;
  theoreticalQuantity: number;
}

export interface WarehouseState {
  assets: WarehouseAssetRecord[];
  countLines: WarehouseCountLineRecord[];
  counts: WarehouseCountRecord[];
  documents: WarehouseDocumentRecord[];
  expenses: WarehouseExpenseRecord[];
  lines: WarehouseDocumentLineRecord[];
  movements: WarehouseMovementRecord[];
  nextId: number;
  products: WarehouseProductRecord[];
}

export interface WarehouseTransaction {
  actorBelongsToSalon(salonId: string, actorUserId: string): Promise<boolean>;
  createAsset(input: Omit<WarehouseAssetRecord, "id">): Promise<WarehouseAssetRecord>;
  createDocument(
    input: Omit<WarehouseDocumentRecord, "id" | "postedAt" | "postedByUserId" | "status">,
  ): Promise<WarehouseDocumentRecord>;
  createDocumentLine(input: Omit<WarehouseDocumentLineRecord, "id">): Promise<WarehouseDocumentLineRecord>;
  createExpense(input: Omit<WarehouseExpenseRecord, "id">): Promise<WarehouseExpenseRecord>;
  createMovement(input: Omit<WarehouseMovementRecord, "id">): Promise<WarehouseMovementRecord>;
  findCountForUpdate(salonId: string, countId: string): Promise<WarehouseCountRecord | undefined>;
  findCountLinesForUpdate(salonId: string, countId: string): Promise<WarehouseCountLineRecord[]>;
  findDocumentForUpdate(salonId: string, documentId: string): Promise<WarehouseDocumentRecord | undefined>;
  findDocumentLinesForUpdate(salonId: string, documentId: string): Promise<WarehouseDocumentLineRecord[]>;
  findExpensesForDocument(salonId: string, documentId: string): Promise<WarehouseExpenseRecord[]>;
  findAssetsForDocument(salonId: string, documentId: string): Promise<WarehouseAssetRecord[]>;
  findMovementsForDocument(salonId: string, documentId: string): Promise<WarehouseMovementRecord[]>;
  findProductForUpdate(salonId: string, productId: string): Promise<WarehouseProductRecord | undefined>;
  markCountPosted(salonId: string, countId: string, actorUserId: string): Promise<boolean>;
  markDocumentPosted(salonId: string, documentId: string, actorUserId: string): Promise<boolean>;
  markDocumentReversed(salonId: string, documentId: string): Promise<boolean>;
  updateCountLine(
    salonId: string,
    countLineId: string,
    changes: Pick<WarehouseCountLineRecord, "differenceQuantity" | "differenceValueCents">,
  ): Promise<WarehouseCountLineRecord>;
  updateDocumentTotals(
    salonId: string,
    documentId: string,
    changes: Pick<WarehouseDocumentRecord, "netTotalCents" | "taxTotalCents" | "totalCents">,
  ): Promise<WarehouseDocumentRecord>;
  updateLineTotals(
    salonId: string,
    lineId: string,
    changes: Pick<WarehouseDocumentLineRecord, "netCents" | "taxCents" | "totalCents">,
  ): Promise<WarehouseDocumentLineRecord>;
  updateProduct(
    salonId: string,
    productId: string,
    changes: Pick<WarehouseProductRecord, "averageCostCents" | "lastCostCents" | "stockQuantity">,
  ): Promise<WarehouseProductRecord>;
}

export interface WarehouseRepository {
  transaction<T>(work: (tx: WarehouseTransaction) => Promise<T>): Promise<T>;
}

export interface PostWarehouseDocumentInput {
  actorUserId: string;
  documentId: string;
  salonId: string;
}

export interface PostWarehouseDocumentResult {
  assetIds: string[];
  documentId: string;
  expenseIds: string[];
  movementIds: string[];
  status: "posted";
}

export interface ReverseWarehouseDocumentInput extends PostWarehouseDocumentInput {}

export interface ReconcileInventoryCountInput {
  actorUserId: string;
  countId: string;
  salonId: string;
}

export interface ReconcileInventoryCountResult {
  countId: string;
  movementIds: string[];
  status: "posted";
}
