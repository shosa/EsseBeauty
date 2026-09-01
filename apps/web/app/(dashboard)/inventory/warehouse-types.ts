export type WarehouseTab = "overview" | "products" | "movements";
export type WarehouseItemType = "resale" | "consumable" | "equipment" | "expense";
export type WarehouseDocumentKind = "adjustment" | "count" | "credit_note" | "equipment_purchase" | "expense" | "internal_use" | "opening" | "purchase" | "supplier_invoice" | "supplier_return" | "waste";
export type WarehouseDocumentStatus = "cancelled" | "draft" | "posted" | "reversed";

export interface WarehouseSummary { asset_value_cents: number; draft_documents: number; expense_total_cents: number; low_stock_count: number; purchase_total_cents: number; stock_value_cents: number; tracked_items: number; products?: number; suppliers?: number; }
export interface WarehouseProduct { id: string; name: string; description: string | null; brand: string | null; sku: string | null; manufacturerCode: string | null; barcode?: string | null; category: string | null; itemType: WarehouseItemType; unit: string; stockQuantity: number; lowStockThreshold: number; reorderQuantity: number; unitPriceCents: number; costCents: number | null; averageCostCents: number; lastCostCents: number; vatRateBasisPoints: number; supplier: string | null; preferredSupplier: string | null; preferredSupplierId: string | null; storageLocation: string | null; notes: string | null; trackStock: boolean; sellable: boolean; internallyConsumable: boolean; active: boolean; }
export interface WarehouseCountLine { id: string; productId: string; theoreticalQuantity: number; countedQuantity: number | null; differenceQuantity: number | null; differenceValueCents: number; note: string | null; }
export interface WarehouseCount { id: string; status: "draft" | "counting" | "posted" | "cancelled"; category: string | null; notes: string | null; openedAt: string; postedAt: string | null; documentId: string | null; lines?: WarehouseCountLine[]; }
export interface WarehouseImportPreview { rows: EditableWarehouseLine[]; errors: Array<{ line: number; field: string; message: string }>; matched: number; unmatched: number; }
export interface WarehouseSupplier { id: string; name: string; contactName: string | null; vatNumber: string | null; taxCode: string | null; email: string | null; phone: string | null; address: string | null; city: string | null; postalCode: string | null; country: string | null; paymentTerms: string | null; notes: string | null; active: boolean; }
export interface WarehouseDocument { id: string; internalNumber: string; kind: WarehouseDocumentKind; status: WarehouseDocumentStatus; supplierId: string | null; externalReference: string | null; documentDate: string; competenceDate: string | null; notes: string | null; netTotalCents: number; taxTotalCents: number; totalCents: number; reversalOfDocumentId: string | null; }
export interface WarehouseDocumentLine { id?: string; key?: string; productId: string | null; supplierId?: string | null; description: string; itemType: WarehouseItemType; quantity: number; unitCostCents: number; discountCents: number; taxRateBasisPoints: number; stockDelta: number; destination: string | null; unit?: string; unitScale?: number; netCents?: number; taxCents?: number; totalCents?: number; }
export interface WarehouseDocumentDetails extends WarehouseDocument { lines: WarehouseDocumentLine[]; }
export interface EditableWarehouseLine { key: string; product_id: string | null; description: string; item_type: WarehouseItemType; quantity: number; unit_cost_cents: number; discount_cents: number; tax_rate_basis_points: number; stock_delta: number; destination: string; }
export interface WarehouseDocumentInput { kind: WarehouseDocumentKind; internal_number?: string; external_reference?: string | null; document_date?: string; competence_date?: string | null; supplier_id?: string | null; notes?: string | null; lines: Array<{ description: string; item_type: WarehouseItemType; product_id: string | null; quantity: number; unit_cost_cents: number; discount_cents: number; tax_rate_basis_points: number; stock_delta: number; destination: string | null; unit?: string; unit_scale?: number; }>; }
export interface WarehouseListFilters { q?: string; active?: boolean; low_stock?: boolean; item_type?: WarehouseItemType; supplier_id?: string; status?: WarehouseDocumentStatus; kind?: WarehouseDocumentKind; date_from?: string; date_to?: string; }
export interface WarehouseReportingFilters { category?: string; date_from?: string; date_to?: string; item_type?: WarehouseItemType; supplier_id?: string; }
export interface WarehouseAnalyticsSummary extends WarehouseSummary {}
export interface WarehouseReports {
  consumption: { rows: Array<{ name: string; product_id: string; quantity: number; value_cents: number }>; total_cents: number };
  purchases: { rows: Array<{ document_id: string; document_number: string; name: string; product_id: string | null; quantity: number; supplier_id: string | null; total_cents: number }>; total_cents: number };
  reports: string[];
  suppliers: { rows: Array<{ supplier_id: string | null; supplier_name: string; total_cents: number }>; total_cents: number };
  valuation: { rows: Array<{ average_cost_cents: number; category: string | null; item_type: WarehouseItemType; name: string; product_id: string; stock_quantity: number; value_cents: number }>; total_cents: number };
  waste: { rows: Array<{ name: string; product_id: string; quantity: number; value_cents: number }>; total_cents: number };
}
export type WarehousePaymentMethod = "cash" | "card" | "bank_transfer" | "other";
export interface WarehouseExpense {
  cashMovementId?: string | null;
  cash_movement_id?: string | null;
  category: string;
  competenceDate?: string;
  description: string;
  documentId?: string;
  id: string;
  netCents: number;
  notes: string | null;
  source_document_id?: string;
  source_document_number?: string;
  supplierId: string | null;
  supplier_name?: string | null;
  taxCents: number;
  totalCents: number;
}
export interface WarehouseExpenseList {
  items: WarehouseExpense[];
  net_total_cents: number;
  tax_total_cents: number;
  total_cents: number;
}
export interface WarehouseAsset {
  cashMovementId?: string | null;
  description: string;
  documentId?: string;
  id: string;
  location?: string | null;
  notes: string | null;
  purchaseCostCents: number;
  purchaseDate: string;
  serialNumber?: string | null;
  source_document_id?: string;
  source_document_number?: string;
  status: "active" | "disposed";
  supplierId: string | null;
  supplier_name?: string | null;
  warrantyExpiresAt?: string | null;
}
export interface WarehouseAssetList {
  items: WarehouseAsset[];
  total_cents: number;
}
