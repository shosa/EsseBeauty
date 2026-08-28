"use client";

import { AlertTriangle, FileText, Package, Plus, RefreshCcw, Truck } from "lucide-react";
import { Button, SectionCard, StatusBadge } from "@esse-beauty/ui";
import type { WarehouseDocument, WarehouseProduct, WarehouseSummary } from "../warehouse-types";
import { warehouseDocumentLabel } from "../document-label";

const euro = (cents: number) => (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

export function WarehouseOverview({ summary, products, documents, onNewDocument, onRefresh }: { summary: WarehouseSummary; products: WarehouseProduct[]; documents: WarehouseDocument[]; onNewDocument(): void; onRefresh(): void }) {
  const low = products.filter((item) => item.stockQuantity < item.lowStockThreshold);
  const metrics = [
    ["Articoli tracciati", summary.tracked_items || summary.products || products.length, "catalogo attivo"],
    ["Scorte sotto soglia", summary.low_stock_count || low.length, "richiedono attenzione"],
    ["Valore scorte", euro(summary.stock_value_cents), "costo medio"],
    ["Acquisti periodo", euro(summary.purchase_total_cents), "documenti registrati"],
    ["Spese", euro(summary.expense_total_cents), "costi operativi"],
    ["Bozze", summary.draft_documents, "da completare"],
  ];
  return <div className="grid gap-4">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{metrics.map(([label, value, detail]) => <div className="border border-stone-200 bg-white px-3 py-3 shadow-sm" key={label}><p className="text-[10px] font-black uppercase tracking-[.12em] text-stone-500">{label}</p><p className="mt-1 text-xl font-black tracking-tight text-[#402334]">{value}</p><p className="text-xs text-stone-500">{detail}</p></div>)}</div>
    <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
      <SectionCard actions={<Button onClick={onRefresh} size="sm" variant="tableAction"><RefreshCcw className="size-3.5" />Aggiorna</Button>} title="Coda operativa" subtitle="Le eccezioni che meritano un intervento oggi.">
        <div className="divide-y divide-stone-100 border-y border-stone-100">{low.slice(0, 6).map((item) => <div className="flex items-center justify-between gap-3 py-2.5" key={item.id}><div className="flex min-w-0 items-center gap-2"><AlertTriangle className="size-4 shrink-0 text-amber-600" /><span className="truncate text-sm font-semibold">{item.name}</span></div><span className="shrink-0 text-xs font-bold text-red-700">{item.stockQuantity} / {item.lowStockThreshold}</span></div>)}{summary.draft_documents > 0 && <div className="flex items-center gap-2 py-2.5 text-sm font-semibold"><FileText className="size-4 text-[#792f59]" />{summary.draft_documents} documenti in bozza</div>}{low.length === 0 && summary.draft_documents === 0 && <p className="py-5 text-sm text-stone-500">Nessuna eccezione aperta.</p>}</div>
      </SectionCard>
      <SectionCard actions={<Button onClick={onNewDocument} size="sm" variant="primary"><Plus className="size-3.5" />Nuovo</Button>} title="Documenti recenti" subtitle="Ultime registrazioni del magazzino.">
        <div className="divide-y divide-stone-100">{documents.slice(0, 6).map((doc) => <div className="flex items-center justify-between gap-3 py-2.5" key={doc.id}><div className="flex min-w-0 items-center gap-2"><Truck className="size-4 shrink-0 text-stone-400" /><span className="truncate text-sm font-semibold">{warehouseDocumentLabel(doc)}</span></div><div className="flex shrink-0 items-center gap-2"><StatusBadge status={doc.status === "posted" ? "active" : doc.status === "draft" ? "waiting" : "inactive"}>{doc.status}</StatusBadge><span className="text-xs font-bold">{euro(doc.totalCents)}</span></div></div>)}{documents.length === 0 && <p className="py-5 text-sm text-stone-500">Nessun documento ancora.</p>}</div>
      </SectionCard>
    </div>
  </div>;
}
