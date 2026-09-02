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

export const documentKindLabels: Record<WarehouseDocumentKind, string> = {
  adjustment: "Rettifica",
  count: "Inventario",
  credit_note: "Nota credito",
  equipment_purchase: "Acquisto attrezzatura",
  expense: "Spesa",
  internal_use: "Consumo interno",
  opening: "Giacenza iniziale",
  purchase: "Carico",
  supplier_invoice: "Fattura fornitore",
  supplier_return: "Reso fornitore",
  waste: "Scarto",
};

export const documentKindBadgeClass: Record<WarehouseDocumentKind, string> = {
  adjustment: "bg-[#f7ecdc] text-[#a5691a]",
  count: "bg-[#f7ecdc] text-[#a5691a]",
  credit_note: "bg-[#eee2f7] text-[#7a4fa0]",
  equipment_purchase: "bg-[#e5f3ec] text-[#1c7a5c]",
  expense: "bg-stone-100 text-stone-600",
  internal_use: "bg-stone-100 text-stone-600",
  opening: "bg-[#e5f3ec] text-[#1c7a5c]",
  purchase: "bg-[#e5f3ec] text-[#1c7a5c]",
  supplier_invoice: "bg-[#e5f3ec] text-[#1c7a5c]",
  supplier_return: "bg-[#faeae8] text-[#b23a2e]",
  waste: "bg-[#faeae8] text-[#b23a2e]",
};

const uuidReference = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

export function warehouseDocumentLabel(document: Pick<WarehouseDocument, "documentDate" | "externalReference" | "id" | "internalNumber" | "kind">) {
  if (document.externalReference?.trim()) return document.externalReference.trim();
  if (!uuidReference.test(document.internalNumber)) return document.internalNumber;
  const year = new Date(document.documentDate).getFullYear();
  return `${prefixes[document.kind]}-${year}-${document.id.replaceAll("-", "").slice(0, 6).toUpperCase()}`;
}
