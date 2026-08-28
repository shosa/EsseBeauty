import type { WarehouseDocument, WarehouseDocumentKind } from "./warehouse-types";

const prefixes: Record<WarehouseDocumentKind, string> = {
  adjustment: "RET",
  count: "INV",
  credit_note: "NDC",
  equipment_purchase: "ATT",
  expense: "SPE",
  internal_use: "CON",
  opening: "INI",
  purchase: "CAR",
  supplier_invoice: "FAT",
  supplier_return: "RES",
  waste: "SCA",
};

const uuidReference = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

export function warehouseDocumentLabel(document: Pick<WarehouseDocument, "documentDate" | "externalReference" | "id" | "internalNumber" | "kind">) {
  if (document.externalReference?.trim()) return document.externalReference.trim();
  if (!uuidReference.test(document.internalNumber)) return document.internalNumber;
  const year = new Date(document.documentDate).getFullYear();
  return `${prefixes[document.kind]}-${year}-${document.id.replaceAll("-", "").slice(0, 6).toUpperCase()}`;
}
