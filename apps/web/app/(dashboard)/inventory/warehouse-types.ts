export type WarehouseTab = "overview" | "products" | "movements" | "documents" | "counts" | "suppliers" | "costs" | "reports";

export interface WarehouseSummary {
  asset_value_cents: number;
  draft_documents: number;
  expense_total_cents: number;
  low_stock_count: number;
  purchase_total_cents: number;
  stock_value_cents: number;
  tracked_items: number;
}
