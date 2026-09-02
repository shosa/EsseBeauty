"use client";

import { AlertTriangle, FileText, Plus, RefreshCw, Truck } from "lucide-react";
import { Button, StatusBadge } from "@esse-beauty/ui";
import { Card } from "./EnterpriseCard";
import type { WarehouseDocument, WarehouseProduct, WarehouseSummary } from "../warehouse-types";
import { warehouseDocumentLabel } from "../document-label";

const euro = (cents: number) => (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

export function WarehouseOverview({ summary, products, documents, onNewDocument, onRefresh }: { summary: WarehouseSummary; products: WarehouseProduct[]; documents: WarehouseDocument[]; onNewDocument(): void; onRefresh(): void }) {
  const low = products.filter((item) => item.stockQuantity < item.lowStockThreshold);
  const metrics: Array<[string, string | number, string]> = [
    ["Articoli tracciati", summary.tracked_items || summary.products || products.length, "catalogo attivo"],
    ["Sotto soglia", summary.low_stock_count || low.length, "richiedono attenzione"],
    ["Valore scorte", euro(summary.stock_value_cents), "costo medio"],
    ["Acquisti periodo", euro(summary.purchase_total_cents), "documenti registrati"],
    ["Spese periodo", euro(summary.expense_total_cents), "costi operativi"],
    ["Documenti in bozza", summary.draft_documents, "da registrare"],
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[#e8dfe4] bg-[#e8dfe4] sm:grid-cols-3 xl:grid-cols-6">
        {metrics.map(([label, value, detail]) => (
          <div className="bg-white px-4 py-3.5" key={label}>
            <span className="text-[10px] font-black uppercase tracking-wider text-stone-500">{label}</span>
            <strong className={`mt-1 block text-xl font-bold tnum ${label === "Sotto soglia" && Number(value) > 0 ? "text-[#b23a2e]" : "text-stone-950"}`}>{value}</strong>
            <span className="text-[11px] font-medium text-stone-400">{detail}</span>
          </div>
        ))}
      </div>
      <div className="grid gap-3 xl:grid-cols-[1.1fr_.9fr]">
        <Card actions={<Button onClick={onRefresh} size="sm" variant="tableAction"><RefreshCw className="size-3.5" />Aggiorna</Button>} title="Coda operativa" subtitle="Le eccezioni che meritano un intervento oggi.">
          <div className="divide-y divide-stone-100">
            {low.slice(0, 6).map((item) => (
              <div className="flex items-center justify-between gap-3 py-2.5" key={item.id}>
                <div className="flex min-w-0 items-center gap-2"><AlertTriangle className="size-4 shrink-0 text-amber-600" /><span className="truncate text-sm font-semibold text-stone-800">{item.name}</span></div>
                <span className="shrink-0 text-xs font-bold tnum text-[#b23a2e]">{item.stockQuantity} / {item.lowStockThreshold}</span>
              </div>
            ))}
            {summary.draft_documents > 0 && <div className="flex items-center gap-2 py-2.5 text-sm font-semibold text-stone-700"><FileText className="size-4 text-[#792f59]" />{summary.draft_documents} documenti in bozza</div>}
            {low.length === 0 && summary.draft_documents === 0 && <p className="py-5 text-sm text-stone-500">Nessuna eccezione aperta.</p>}
          </div>
        </Card>
        <Card actions={<Button onClick={onNewDocument} size="sm" variant="primary"><Plus className="size-3.5" />Nuovo</Button>} title="Documenti recenti" subtitle="Ultime registrazioni del magazzino.">
          <div className="divide-y divide-stone-100">
            {documents.slice(0, 6).map((doc) => (
              <div className="flex items-center justify-between gap-3 py-2.5" key={doc.id}>
                <div className="flex min-w-0 items-center gap-2"><Truck className="size-4 shrink-0 text-stone-400" /><span className="truncate text-sm font-semibold text-stone-800">{warehouseDocumentLabel(doc)}</span></div>
                <div className="flex shrink-0 items-center gap-2"><StatusBadge status={doc.status === "posted" ? "active" : doc.status === "draft" ? "waiting" : "inactive"}>{doc.status}</StatusBadge><span className="text-xs font-black tnum text-[#402334]">{euro(doc.totalCents)}</span></div>
              </div>
            ))}
            {documents.length === 0 && <p className="py-5 text-sm text-stone-500">Nessun documento ancora.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
