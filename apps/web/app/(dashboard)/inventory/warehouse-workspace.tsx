"use client";

import Link from "next/link";
import { Archive, ArrowDownToLine, ArrowUpFromLine, ClipboardList, FileUp, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppPage, Button, EmptyState, PageHeaderMetrics, SectionCard, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";
import { StockMovementModal } from "./_components/StockMovementModal";
import type { WarehouseSummary, WarehouseTab } from "./warehouse-types";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Product {
  id: string;
  lowStockThreshold: number;
  name: string;
  sku?: string;
  stockQuantity: number;
  supplier?: string;
  unitPriceCents: number;
}

const warehouseTabs: Array<{ id: WarehouseTab; label: string }> = [
  { id: "overview", label: "Panoramica" },
  { id: "products", label: "Articoli" },
  { id: "movements", label: "Movimenti" },
  { id: "documents", label: "Documenti" },
  { id: "counts", label: "Inventari" },
  { id: "suppliers", label: "Fornitori" },
  { id: "costs", label: "Spese e attrezzature" },
  { id: "reports", label: "Analisi" },
];

export function WarehouseWorkspace() {
  const { salon } = useAuth();
  const [activeTab, setActiveTab] = useState<WarehouseTab>("products");
  const [items, setItems] = useState<Product[]>([]);
  const [lowOnly, setLowOnly] = useState(false);
  const [movement, setMovement] = useState<Product>();
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const lowStockCount = useMemo(() => items.filter((item) => item.stockQuantity < item.lowStockThreshold).length, [items]);
  const stockValue = useMemo(() => items.reduce((sum, item) => sum + item.stockQuantity * item.unitPriceCents, 0), [items]);
  const summary: WarehouseSummary = { asset_value_cents: 0, draft_documents: 0, expense_total_cents: 0, low_stock_count: lowStockCount, purchase_total_cents: 0, stock_value_cents: stockValue, tracked_items: items.length };
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("it-IT");
    return items.filter((item) => !normalizedQuery || `${item.name} ${item.sku ?? ""} ${item.supplier ?? ""}`.toLocaleLowerCase("it-IT").includes(normalizedQuery));
  }, [items, query]);

  const load = () => salon ? fetch(`${api}/api/salons/${salon.id}/inventory${lowOnly ? "?low_stock=true" : ""}`, { credentials: "include" })
    .then((response) => { if (!response.ok) throw new Error("inventory"); return response.json(); })
    .then((data) => { setError(""); setItems(data); })
    .catch(() => setError("Magazzino non disponibile. Riprova tra poco.")) : Promise.resolve();

  useEffect(() => { void load(); }, [salon, lowOnly]);

  async function addMovement(delta: number, reason: string) {
    const response = await fetch(`${api}/api/salons/${salon?.id}/inventory/${movement?.id}/movements`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ delta, reason }) });
    if (!response.ok) throw new Error("movement");
    setMovement(undefined);
    await load();
  }

  return <AppPage maxWidth="max-w-[1600px]">
    <PageHeaderMetrics
      actions={<div className="flex flex-wrap gap-2"><Link aria-label="Nuovo articolo" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#402334] bg-[linear-gradient(135deg,#402334_0%,#792f59_58%,#b85888_100%)] px-4 py-2.5 font-semibold text-white shadow-[0_16px_36px_rgb(121_47_89_/_0.28)] transition hover:-translate-y-0.5" href="/inventory/new"><Archive className="size-4" />Articolo</Link><Button aria-label="Carico" disabled title="Disponibile nei prossimi incrementi" size="sm" variant="outline"><ArrowDownToLine className="size-4" />Carico</Button><Button aria-label="Scarico" disabled title="Disponibile nei prossimi incrementi" size="sm" variant="outline"><ArrowUpFromLine className="size-4" />Scarico</Button><Button aria-label="Inventario" disabled title="Disponibile nei prossimi incrementi" size="sm" variant="outline"><ClipboardList className="size-4" />Inventario</Button><Button aria-label="Importa" disabled title="Disponibile nei prossimi incrementi" size="sm" variant="outline"><FileUp className="size-4" />Importa</Button></div>}
      eyebrow="Magazzino"
      metrics={[{ detail: "Articoli tracciati", label: "Prodotti", value: summary.tracked_items }, { detail: "Da reintegrare", label: "Scorte basse", value: summary.low_stock_count }, { detail: "Valore stimato", label: "Valore scorte", value: (summary.stock_value_cents / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" }) }]}
      title="Magazzino operativo"
      subtitle="Scorte, acquisti e controlli operativi in un unico spazio."
      status={<StatusBadge status={lowStockCount > 0 ? "waiting" : "active"}>{lowStockCount > 0 ? `${lowStockCount} sotto soglia` : "Scorte ok"}</StatusBadge>}
    />
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between"><div aria-label="Aree del magazzino" className="flex gap-1 overflow-x-auto" role="tablist">{warehouseTabs.map((tab) => { const panelId = `warehouse-panel-${tab.id}`; return <Button active={activeTab === tab.id} aria-controls={panelId} aria-selected={activeTab === tab.id} className="shrink-0" id={`warehouse-tab-${tab.id}`} key={tab.id} onClick={() => setActiveTab(tab.id)} role="tab" size="sm" variant={activeTab === tab.id ? "primary" : "ghost"}>{tab.label}</Button>; })}</div><label className="flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm text-stone-500 lg:w-72"><Search className="size-4" /><span className="sr-only">Cerca nel magazzino</span><input className="min-w-0 flex-1 bg-transparent outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Cerca articoli, SKU o fornitori" value={query} /></label></div>
    <div aria-labelledby={`warehouse-tab-${activeTab}`} id={`warehouse-panel-${activeTab}`} role="tabpanel" tabIndex={0}>
    {activeTab === "products" ? <SectionCard actions={<label className="inline-flex items-center gap-2 rounded-full border border-[#ead1df] bg-[#fffafd] px-4 py-2 text-sm font-bold text-[#792f59]"><input checked={lowOnly} onChange={(event) => setLowOnly(event.target.checked)} type="checkbox" />Solo scorte basse</label>} title="Articoli" subtitle="Apri una scheda prodotto o registra un movimento rapido di magazzino.">{error ? <div aria-live="polite" className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert"><span>{error}</span><Button onClick={() => void load()} size="sm" variant="tableAction">Riprova</Button></div> : visibleItems.length === 0 ? <EmptyState action={<Link className="inline-flex min-h-11 items-center rounded-xl border border-[#402334] bg-[linear-gradient(135deg,#402334_0%,#792f59_58%,#b85888_100%)] px-4 py-2.5 font-semibold text-white" href="/inventory/new">Aggiungi prodotto</Link>} description={lowOnly ? "Nessun prodotto sotto soglia." : "Aggiungi il primo prodotto per iniziare a monitorare le scorte."} title={lowOnly ? "Scorte sotto controllo" : "Nessun prodotto"} /> : <ProductList items={visibleItems} onMovement={setMovement} />}</SectionCard> : <SectionCard title={warehouseTabs.find((tab) => tab.id === activeTab)?.label ?? "Magazzino"} subtitle="Questa area operativa sarà disponibile nei prossimi incrementi."><EmptyState description="Nel frattempo puoi continuare a gestire articoli e movimenti dalla sezione Articoli." title="Area in preparazione" /></SectionCard>}
    </div>
    {movement && <StockMovementModal name={movement.name} onClose={() => setMovement(undefined)} onConfirm={addMovement} />}
  </AppPage>;
}

function ProductList({ items, onMovement }: { items: Product[]; onMovement(product: Product): void }) {
  return <div className="overflow-hidden rounded-2xl border border-[#e8dfe4] bg-white shadow-[0_10px_30px_rgb(45_29_39_/_0.055)]"><div className="grid min-w-[760px] grid-cols-[1.4fr_.8fr_.7fr_.7fr_1fr_auto] bg-[#faf3f7] px-3 py-2 text-[11px] font-black uppercase tracking-[.08em] text-[#792f59]"><span>Prodotto</span><span>SKU</span><span>Scorta</span><span>Soglia</span><span>Fornitore</span><span /></div><div className="overflow-x-auto">{items.map((item) => { const low = item.stockQuantity < item.lowStockThreshold; return <div className="grid min-w-[760px] grid-cols-[1.4fr_.8fr_.7fr_.7fr_1fr_auto] items-center border-t border-stone-100 px-3 py-2.5 text-sm" key={item.id}><Link className="font-bold text-stone-950 hover:text-[#792f59]" href={`/inventory/${item.id}`}>{item.name}</Link><span className="text-stone-500">{item.sku ?? "-"}</span><span className={`font-black ${low ? "text-red-700" : "text-stone-950"}`}>{item.stockQuantity}</span><span className="text-stone-500">{item.lowStockThreshold}</span><span className="text-stone-500">{item.supplier ?? "-"}</span><Button onClick={() => onMovement(item)} size="sm" variant="tableAction">Movimento</Button></div>; })}</div></div>;
}
