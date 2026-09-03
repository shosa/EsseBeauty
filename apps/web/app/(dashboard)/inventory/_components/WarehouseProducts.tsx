"use client";

import { useRouter } from "next/navigation";
import { ChevronRight, MoreHorizontal, PackagePlus, SlidersHorizontal } from "lucide-react";
import { Button, EmptyState, Switch } from "@esse-beauty/ui";
import { Card } from "./EnterpriseCard";
import type { WarehouseItemType, WarehouseProduct } from "../warehouse-types";

const types: Record<WarehouseItemType, string> = { resale: "Rivendita", consumable: "Consumo", equipment: "Attrezzatura", expense: "Spesa" };
const euro = (cents: number) => (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

export function WarehouseProducts({ items, query, lowOnly, itemType, selected, onQuery, onLowOnly, onItemType, onSelect, onSelectAll, onOpenOperation }: { items: WarehouseProduct[]; query: string; lowOnly: boolean; itemType: WarehouseItemType | "all"; selected: string[]; onQuery(value: string): void; onLowOnly(value: boolean): void; onItemType(value: WarehouseItemType | "all"): void; onSelect(id: string): void; onSelectAll(): void; onOpenOperation(mode: "adjustment" | "waste" | "revaluation" | "issue" | "count", product?: WarehouseProduct): void }) {
  const router = useRouter();
  const allSelected = items.length > 0 && items.every((item) => selected.includes(item.id));
  return (
    <Card bodyClassName="p-0">
      <div className="flex flex-wrap items-center gap-2.5 p-4 pb-0">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Cerca articoli</span>
          <input className="w-full" onChange={(event) => onQuery(event.target.value)} placeholder="Cerca articolo, SKU o fornitore" value={query} />
        </label>
        <select aria-label="Tipo articolo" className="w-[170px]" onChange={(event) => onItemType(event.target.value as WarehouseItemType | "all")} value={itemType}>
          <option value="all">Tutti i tipi</option>
          {Object.entries(types).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
        </select>
        <label className="flex h-10 items-center gap-2 rounded-xl border border-[#e8dfe4] bg-white px-3 text-[12.5px] font-bold text-stone-600"><Switch checked={lowOnly} onCheckedChange={onLowOnly} />Solo scorte basse</label>
        <Button className="ml-auto" onClick={() => onOpenOperation("adjustment")} size="sm" variant="outline"><SlidersHorizontal className="size-3.5" />Azione manuale</Button>
      </div>
      {selected.length > 0 && (
        <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-xl border border-[#ead1df] bg-[#fffafd] px-4 py-2.5 text-sm">
          <span><strong>{selected.length}</strong> articoli selezionati</span>
          <div className="flex gap-2"><Button onClick={() => onOpenOperation("waste")} size="sm" variant="tableAction"><PackagePlus className="size-3.5" />Registra scarto</Button><Button onClick={() => onOpenOperation("revaluation")} size="sm" variant="tableAction">Rivaluta costo medio</Button></div>
        </div>
      )}
      {items.length === 0 ? (
        <div className="p-4"><EmptyState description="Modifica i filtri o aggiungi un nuovo articolo." title="Nessun articolo trovato" /></div>
      ) : (
        <div className="mt-3 overflow-x-auto border-t border-[#e8dfe4]">
          <table className="w-full min-w-[1160px] text-left text-sm">
            <thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.12em] text-stone-500">
              <tr>
                <th className="w-10 px-5 py-3"><input aria-label="Seleziona tutti" checked={allSelected} className="accent-[#792f59]" onChange={onSelectAll} onClick={(event) => event.stopPropagation()} type="checkbox" /></th>
                <th>Articolo</th><th>Tipo</th><th>Scorta</th><th className="text-right">Costo</th><th className="text-right">Prezzo</th><th className="text-right">Margine</th><th>Fornitore</th><th className="w-16 pr-5" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const low = item.stockQuantity < item.lowStockThreshold;
                const purchaseCost = item.costCents ?? item.lastCostCents ?? item.averageCostCents;
                const margin = item.unitPriceCents - purchaseCost;
                return (
                  <tr
                    className="group cursor-pointer border-t border-stone-100 transition hover:bg-[#fffafd] focus-visible:bg-[#fffafd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#b85888]"
                    key={item.id}
                    onClick={() => router.push(`/inventory/${item.id}`)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); router.push(`/inventory/${item.id}`); } }}
                    tabIndex={0}
                  >
                    <td className="px-5 py-3"><input aria-label={`Seleziona ${item.name}`} checked={selected.includes(item.id)} className="accent-[#792f59]" onChange={() => onSelect(item.id)} onClick={(event) => event.stopPropagation()} type="checkbox" /></td>
                    <td><div className="font-bold text-stone-900 group-hover:text-[#792f59]">{item.name}</div><div className="text-xs text-stone-500">{[item.brand, item.sku || "SKU non impostato", item.barcode].filter(Boolean).join(" · ")}</div></td>
                    <td><span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-bold text-stone-600">{types[item.itemType]}</span></td>
                    <td><span className={`tnum font-black ${low ? "text-[#b23a2e]" : "text-stone-900"}`}>{item.stockQuantity} {item.unit}</span><div className="text-[11px] text-stone-400">soglia {item.lowStockThreshold}</div></td>
                    <td className="text-right tnum font-semibold text-stone-700">{euro(purchaseCost)}<div className="text-[11px] font-normal text-stone-400">medio {euro(item.averageCostCents)}</div></td>
                    <td className="text-right tnum font-semibold text-stone-700">{euro(item.unitPriceCents)}</td>
                    <td className={`text-right tnum font-bold ${margin < 0 ? "text-[#b23a2e]" : "text-[#1c7a5c]"}`}>{euro(margin)}</td>
                    <td className="text-stone-600">{item.preferredSupplier || item.supplier || "—"}{item.storageLocation && <div className="text-[11px] text-stone-400">{item.storageLocation}</div>}</td>
                    <td className="pr-5 text-right">
                      <button aria-label={`Rettifica ${item.name}`} className="mr-1 grid size-8 place-items-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-700" onClick={(event) => { event.stopPropagation(); onOpenOperation("adjustment", item); }} type="button"><MoreHorizontal className="size-4" /></button>
                      <ChevronRight aria-hidden="true" className="inline-block size-4 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-[#792f59]" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
