"use client";

import { ExternalLink, RotateCcw } from "lucide-react";
import { DateField, EmptyState } from "@esse-beauty/ui";
import { Card } from "./EnterpriseCard";
import type { WarehouseDocument, WarehouseDocumentKind, WarehouseDocumentStatus, WarehouseSupplier } from "../warehouse-types";
import { documentKindBadgeClass, documentKindLabels, warehouseDocumentLabel } from "../document-label";

const euro = (cents: number) => (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
const statusBadge: Record<WarehouseDocumentStatus, string> = {
  cancelled: "bg-stone-100 text-stone-500",
  draft: "bg-[#f7ecdc] text-[#a5691a]",
  posted: "bg-[#e5f3ec] text-[#1c7a5c]",
  reversed: "bg-stone-100 text-stone-500",
};
const statusLabels: Record<WarehouseDocumentStatus, string> = { cancelled: "Annullato", draft: "Bozza", posted: "Registrato", reversed: "Stornato" };

export function WarehouseDocuments({ documents, suppliers, status, kind, dateFrom, dateTo, loading, error, onStatus, onKind, onDateFrom, onDateTo, onOpen, onReverse }: { documents: WarehouseDocument[]; suppliers: WarehouseSupplier[]; status: WarehouseDocumentStatus | "all"; kind: WarehouseDocumentKind | "all"; dateFrom: string; dateTo: string; loading: boolean; error: string; onStatus(value: WarehouseDocumentStatus | "all"): void; onKind(value: WarehouseDocumentKind | "all"): void; onDateFrom(value: string): void; onDateTo(value: string): void; onOpen(documentId: string): void; onReverse(documentId: string): void }) {
  const supplierName = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
  return (
    <Card bodyClassName="p-0" title="Registro documenti" subtitle="Acquisti, rettifiche, scarti, note credito e tutti i movimenti formali di magazzino.">
      <div className="flex flex-wrap items-center gap-2.5 p-4 pb-0">
        <select aria-label="Stato documento" className="w-[160px]" onChange={(event) => onStatus(event.target.value as WarehouseDocumentStatus | "all")} value={status}>
          <option value="all">Tutti gli stati</option><option value="draft">Bozze</option><option value="posted">Registrati</option><option value="reversed">Stornati</option><option value="cancelled">Annullati</option>
        </select>
        <select aria-label="Tipo documento" className="w-[190px]" onChange={(event) => onKind(event.target.value as WarehouseDocumentKind | "all")} value={kind}>
          <option value="all">Tutti i tipi</option>{Object.entries(documentKindLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <DateField aria-label="Data documento da" onChange={onDateFrom} value={dateFrom} />
        <span className="text-xs font-bold text-stone-400">→</span>
        <DateField aria-label="Data documento a" min={dateFrom} onChange={onDateTo} value={dateTo} />
        <span className="ml-auto text-xs font-semibold text-stone-500">{loading ? "Caricamento…" : `${documents.length} documenti`}</span>
      </div>
      {error && <div aria-live="polite" className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</div>}
      {loading ? (
        <div className="p-4 text-center text-sm text-stone-500">Caricamento documenti…</div>
      ) : documents.length === 0 ? (
        <div className="p-4"><EmptyState description="Non ci sono documenti per i filtri scelti." title="Nessun documento" /></div>
      ) : (
        <div className="mt-3 overflow-x-auto border-t border-[#e8dfe4]">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.12em] text-stone-500">
              <tr><th className="px-5 py-3">Riferimento</th><th>Tipo</th><th>Data</th><th>Fornitore</th><th className="text-right">Totale</th><th>Stato</th><th className="w-20 pr-5" /></tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr className="border-t border-stone-100 transition hover:bg-[#fffafd]" key={doc.id}>
                  <td className="px-5 py-3.5">
                    <div className="font-bold text-stone-900">{warehouseDocumentLabel(doc)}</div>
                    <div className="text-[11px] text-stone-400">{doc.externalReference ? `Rif. interno ${warehouseDocumentLabel({ ...doc, externalReference: null })}` : "nessun riferimento esterno"}</div>
                  </td>
                  <td><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${documentKindBadgeClass[doc.kind]}`}>{documentKindLabels[doc.kind]}</span></td>
                  <td className="text-stone-500">{new Date(doc.documentDate).toLocaleDateString("it-IT")}</td>
                  <td className="text-stone-600">{doc.supplierId ? supplierName.get(doc.supplierId) || "—" : "—"}</td>
                  <td className="text-right font-black tnum text-[#402334]">{euro(doc.totalCents)}</td>
                  <td><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusBadge[doc.status]}`}>{statusLabels[doc.status]}</span></td>
                  <td className="pr-5">
                    <div className="flex justify-end gap-1">
                      <button aria-label={`Apri ${warehouseDocumentLabel(doc)}`} className="grid size-8 place-items-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-[#792f59]" onClick={() => onOpen(doc.id)} title="Apri documento" type="button"><ExternalLink className="size-4" /></button>
                      {doc.status === "posted" && <button aria-label={`Storna ${warehouseDocumentLabel(doc)}`} className="grid size-8 place-items-center rounded-lg text-stone-400 transition hover:bg-red-50 hover:text-red-700" onClick={() => onReverse(doc.id)} title="Storna documento" type="button"><RotateCcw className="size-4" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
