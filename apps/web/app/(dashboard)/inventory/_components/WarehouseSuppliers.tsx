"use client";

import { Pencil } from "lucide-react";
import { EmptyState } from "@esse-beauty/ui";
import type { WarehouseSupplier } from "../warehouse-types";

export function WarehouseSuppliers({ suppliers, onEdit }: { suppliers: WarehouseSupplier[]; onEdit(supplier: WarehouseSupplier): void }) {
  if (suppliers.length === 0) {
    return <div className="p-4"><EmptyState description="Crea il primo fornitore o modifica i filtri per consultare quelli archiviati." title="Nessun fornitore trovato" /></div>;
  }
  return (
    <div className="overflow-x-auto border-t border-[#e8dfe4]">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.12em] text-stone-500">
          <tr><th className="px-5 py-3">Fornitore</th><th>Contatto</th><th>P.IVA / C.F.</th><th>Pagamento</th><th>Stato</th><th className="w-12 pr-5" /></tr>
        </thead>
        <tbody>
          {suppliers.map((supplier) => (
            <tr className="group cursor-pointer border-t border-stone-100 transition hover:bg-[#fffafd]" key={supplier.id} onClick={() => onEdit(supplier)}>
              <td className="px-5 py-3.5">
                <div className="font-bold text-stone-900 group-hover:text-[#792f59]">{supplier.name}</div>
                <div className="text-[11px] text-stone-400">{supplier.email || supplier.phone || "nessun contatto"}</div>
              </td>
              <td className="text-stone-600">{supplier.contactName || "—"}</td>
              <td className="tnum text-stone-600">{supplier.vatNumber || supplier.taxCode || "—"}</td>
              <td className="text-stone-600">{supplier.paymentTerms || "—"}</td>
              <td><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${supplier.active ? "bg-[#e5f3ec] text-[#1c7a5c]" : "bg-stone-100 text-stone-500"}`}>{supplier.active ? "Attivo" : "Archiviato"}</span></td>
              <td className="pr-5 text-right">
                <button aria-label={`Modifica ${supplier.name}`} className="grid size-8 place-items-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-[#792f59]" onClick={(event) => { event.stopPropagation(); onEdit(supplier); }} type="button"><Pencil className="size-4" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
