"use client";

import { Archive, ArrowDownToLine, ArrowUpFromLine, ClipboardList, FileUp, PackagePlus, Plus, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppPage, Button, Dialog, EmptyState, PageHeaderMetrics, SectionCard, StatusBadge } from "@esse-beauty/ui";
import { useAuth } from "../../../lib/auth-context";
import { WarehouseDocuments } from "./_components/WarehouseDocuments";
import { WarehouseOperationDialog } from "./_components/WarehouseOperationDialog";
import { WarehouseOverview } from "./_components/WarehouseOverview";
import { WarehouseProducts } from "./_components/WarehouseProducts";
import { WarehouseSuppliers } from "./_components/WarehouseSuppliers";
import { warehouseApi } from "./warehouse-api";
import type { WarehouseDocument, WarehouseDocumentDetails, WarehouseDocumentInput, WarehouseDocumentKind, WarehouseDocumentStatus, WarehouseProduct, WarehouseSupplier, WarehouseSummary, WarehouseTab } from "./warehouse-types";

const warehouseTabs: Array<{ id: WarehouseTab; label: string }> = [{ id: "overview", label: "Panoramica" }, { id: "products", label: "Articoli" }, { id: "movements", label: "Movimenti" }, { id: "documents", label: "Documenti" }, { id: "counts", label: "Inventari" }, { id: "suppliers", label: "Fornitori" }, { id: "costs", label: "Spese e attrezzature" }, { id: "reports", label: "Analisi" }];
const emptySummary: WarehouseSummary = { asset_value_cents: 0, draft_documents: 0, expense_total_cents: 0, low_stock_count: 0, purchase_total_cents: 0, stock_value_cents: 0, tracked_items: 0 };

export function WarehouseWorkspace() {
  const { salon } = useAuth();
  const salonId = salon?.id;
  const [activeTab, setActiveTab] = useState<WarehouseTab>("overview");
  const [summary, setSummary] = useState(emptySummary);
  const [products, setProducts] = useState<WarehouseProduct[]>([]);
  const [suppliers, setSuppliers] = useState<WarehouseSupplier[]>([]);
  const [documents, setDocuments] = useState<WarehouseDocument[]>([]);
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [itemType, setItemType] = useState<WarehouseProduct["itemType"] | "all">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [operation, setOperation] = useState<"purchase" | "adjustment" | "waste" | "revaluation">();
  const [operationProducts, setOperationProducts] = useState<WarehouseProduct[]>([]);
  const [editingDocument, setEditingDocument] = useState<WarehouseDocumentDetails>();
  const [supplierForm, setSupplierForm] = useState<WarehouseSupplier>();
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [error, setError] = useState("");
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const [documentStatus, setDocumentStatus] = useState<WarehouseDocumentStatus | "all">("all");
  const [documentKind, setDocumentKind] = useState<WarehouseDocumentKind | "all">("all");
  const [documentDateFrom, setDocumentDateFrom] = useState("");
  const [documentDateTo, setDocumentDateTo] = useState("");

  async function loadDocuments(overrides: Partial<{ status: WarehouseDocumentStatus | "all"; kind: WarehouseDocumentKind | "all"; dateFrom: string; dateTo: string }> = {}) {
    if (!salonId) return;
    const next = { status: overrides.status ?? documentStatus, kind: overrides.kind ?? documentKind, dateFrom: overrides.dateFrom ?? documentDateFrom, dateTo: overrides.dateTo ?? documentDateTo };
    setDocumentsLoading(true); setDocumentError("");
    try { setDocuments(await warehouseApi.getDocuments(salonId, { ...(next.status !== "all" && { status: next.status }), ...(next.kind !== "all" && { kind: next.kind }), ...(next.dateFrom && { date_from: next.dateFrom }), ...(next.dateTo && { date_to: next.dateTo }) })); } catch { setDocumentError("Documenti non disponibili. Riprova tra poco."); } finally { setDocumentsLoading(false); }
  }
  async function load() {
    if (!salonId) return;
    try { const [nextSummary, nextProducts, nextSuppliers] = await Promise.all([warehouseApi.getSummary(salonId), warehouseApi.getProducts(salonId, { active: true }), warehouseApi.getSuppliers(salonId, { active: true })]); setSummary({ ...emptySummary, ...nextSummary, tracked_items: nextSummary.tracked_items ?? nextSummary.products ?? nextProducts.length }); setProducts(nextProducts); setSuppliers(nextSuppliers); await loadDocuments(); setError(""); } catch { setError("Magazzino non disponibile. Riprova tra poco."); }
  }
  useEffect(() => { void load(); }, [salonId]);

  const visibleProducts = useMemo(() => products.filter((item) => (!query.trim() || `${item.name} ${item.sku ?? ""} ${item.supplier ?? ""}`.toLocaleLowerCase("it-IT").includes(query.trim().toLocaleLowerCase("it-IT"))) && (!lowOnly || item.stockQuantity < item.lowStockThreshold) && (itemType === "all" || item.itemType === itemType)), [products, query, lowOnly, itemType]);
  const openOperation = (mode: "adjustment" | "waste" | "revaluation", product?: WarehouseProduct) => { setOperationProducts(product ? [product] : products.filter((item) => selected.includes(item.id))); setOperation(mode); };
  const saveOperation = async (input: WarehouseDocumentInput, post: boolean, documentId?: string) => { if (!salonId) return; const saved = await warehouseApi.saveDocument(salonId, input, documentId); if (post) await warehouseApi.postDocument(salonId, saved.id); setOperation(undefined); setEditingDocument(undefined); await load(); };
  const openDocument = async (documentId: string) => { if (!salonId) return; try { const details = await warehouseApi.getDocument(salonId, documentId); setEditingDocument(details); setOperation("purchase"); } catch { setDocumentError("Documento non disponibile."); } };
  const reverseDocument = async (documentId: string) => { if (!salonId || !window.confirm("Stornare questo documento?")) return; try { await warehouseApi.reverseDocument(salonId, documentId); await loadDocuments(); } catch { setDocumentError("Documento non stornato."); } };
  const saveSupplier = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!salonId || !supplierForm?.name.trim()) return; try { if (supplierForm.id) await warehouseApi.updateSupplier(salonId, supplierForm.id, supplierForm); else await warehouseApi.createSupplier(salonId, supplierForm); setSupplierOpen(false); setSupplierForm(undefined); await load(); } catch { setError("Fornitore non salvato."); } };
  const setStatus = (value: WarehouseDocumentStatus | "all") => { setDocumentStatus(value); void loadDocuments({ status: value }); };
  const setKind = (value: WarehouseDocumentKind | "all") => { setDocumentKind(value); void loadDocuments({ kind: value }); };
  const setDateFrom = (value: string) => { setDocumentDateFrom(value); void loadDocuments({ dateFrom: value }); };
  const setDateTo = (value: string) => { setDocumentDateTo(value); void loadDocuments({ dateTo: value }); };

  return <AppPage maxWidth="max-w-[1600px]"><PageHeaderMetrics actions={<div className="flex flex-wrap gap-2"><Button aria-label="Nuovo documento" onClick={() => { setEditingDocument(undefined); setOperation("purchase"); }} size="sm" variant="primary"><Plus className="size-4" />Nuovo documento</Button><Button aria-label="Carico" onClick={() => { setEditingDocument(undefined); setOperation("purchase"); }} size="sm" variant="outline"><ArrowDownToLine className="size-4" />Carico</Button><Button aria-label="Scarico" onClick={() => openOperation("adjustment")} size="sm" variant="outline"><ArrowUpFromLine className="size-4" />Scarico</Button><Button aria-label="Inventario" onClick={() => setActiveTab("counts")} size="sm" variant="outline"><ClipboardList className="size-4" />Inventario</Button><Button aria-label="Importa" onClick={() => { setEditingDocument(undefined); setOperation("purchase"); }} size="sm" variant="outline"><FileUp className="size-4" />Importa</Button><Button aria-label="Rettifica scorte" onClick={() => openOperation("adjustment")} size="sm" variant="outline"><ArrowDownToLine className="size-4" />Rettifica scorte</Button><Button aria-label="Registra scarto" onClick={() => openOperation("waste")} size="sm" variant="outline"><PackagePlus className="size-4" />Registra scarto</Button><Button aria-label="Rivaluta costi" onClick={() => openOperation("revaluation")} size="sm" variant="outline"><RotateCcw className="size-4" />Rivaluta costi</Button><Button aria-label="Nuovo articolo" onClick={() => window.location.assign("/inventory/new")} size="sm" variant="secondary"><Archive className="size-4" />Articolo</Button></div>} eyebrow="Magazzino" metrics={[{ detail: "Articoli tracciati", label: "Prodotti", value: summary.tracked_items }, { detail: "Da reintegrare", label: "Scorte basse", value: summary.low_stock_count }, { detail: "Valore stimato", label: "Valore scorte", value: (summary.stock_value_cents / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" }) }]} title="Magazzino operativo" subtitle="Scorte, acquisti e controlli operativi in un unico spazio." status={<StatusBadge status={summary.low_stock_count > 0 ? "waiting" : "active"}>{summary.low_stock_count > 0 ? `${summary.low_stock_count} sotto soglia` : "Scorte ok"}</StatusBadge>} />
    <div className="mb-5 flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-2 shadow-sm lg:flex-row lg:items-center lg:justify-between"><div aria-label="Aree del magazzino" className="flex gap-1 overflow-x-auto" role="tablist">{warehouseTabs.map((tab) => { const panelId = `warehouse-panel-${tab.id}`; return <Button active={activeTab === tab.id} aria-controls={panelId} aria-selected={activeTab === tab.id} className="shrink-0" id={`warehouse-tab-${tab.id}`} key={tab.id} onClick={() => setActiveTab(tab.id)} role="tab" size="sm" variant={activeTab === tab.id ? "primary" : "ghost"}>{tab.label}</Button>; })}</div></div>
    {error && <div aria-live="polite" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}<Button onClick={() => void load()} size="sm" variant="tableAction">Riprova</Button></div>}
    <div aria-labelledby={`warehouse-tab-${activeTab}`} aria-live="polite" id={`warehouse-panel-${activeTab}`} role="tabpanel" tabIndex={0}>{activeTab === "overview" && <WarehouseOverview documents={documents} onNewDocument={() => setOperation("purchase")} onRefresh={() => void load()} products={products} summary={summary} />}{activeTab === "products" && <WarehouseProducts itemType={itemType} items={visibleProducts} lowOnly={lowOnly} onItemType={setItemType} onLowOnly={setLowOnly} onOpenOperation={openOperation} onQuery={setQuery} onSelect={(id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onSelectAll={() => setSelected((current) => current.length === visibleProducts.length ? [] : visibleProducts.map((item) => item.id))} query={query} selected={selected} />}{activeTab === "documents" && <WarehouseDocuments dateFrom={documentDateFrom} dateTo={documentDateTo} documents={documents} error={documentError} kind={documentKind} loading={documentsLoading} onDateFrom={setDateFrom} onDateTo={setDateTo} onKind={setKind} onOpen={(id) => void openDocument(id)} onReverse={(id) => void reverseDocument(id)} onStatus={setStatus} status={documentStatus} suppliers={suppliers} />}{activeTab === "suppliers" && <WarehouseSuppliers onCreate={() => { setSupplierForm({ id: "", name: "", contactName: null, vatNumber: null, taxCode: null, email: null, phone: null, address: null, city: null, postalCode: null, country: "Italia", paymentTerms: null, notes: null, active: true }); setSupplierOpen(true); }} onEdit={(supplier) => { setSupplierForm(supplier); setSupplierOpen(true); }} suppliers={suppliers} />}{!( ["overview", "products", "documents", "suppliers"] as WarehouseTab[]).includes(activeTab) && <SectionCard title={warehouseTabs.find((tab) => tab.id === activeTab)?.label ?? "Magazzino"} subtitle="Questa area operativa sarà disponibile nei prossimi incrementi."><EmptyState description="Continua a gestire scorte, documenti e fornitori dalle aree attive." title="Area in preparazione" /></SectionCard>}</div>
    {operation && <WarehouseOperationDialog initialDocument={editingDocument} initialLines={operationProducts} mode={operation} onClose={() => { setOperation(undefined); setEditingDocument(undefined); }} onSave={saveOperation} open={Boolean(operation)} products={products} suppliers={suppliers} />}
    <Dialog onClose={() => { setSupplierOpen(false); setSupplierForm(undefined); }} open={supplierOpen} title={supplierForm?.id ? "Modifica fornitore" : "Nuovo fornitore"}><form className="grid gap-3" onSubmit={(event) => void saveSupplier(event)}><label className="text-sm font-semibold">Nome<input autoFocus className="mt-1 min-h-11 w-full rounded-lg border border-stone-200 px-3" onChange={(event) => setSupplierForm((current) => current ? { ...current, name: event.target.value } : current)} required value={supplierForm?.name ?? ""} /></label><label className="text-sm font-semibold">Email<input className="mt-1 min-h-11 w-full rounded-lg border border-stone-200 px-3" onChange={(event) => setSupplierForm((current) => current ? { ...current, email: event.target.value } : current)} type="email" value={supplierForm?.email ?? ""} /></label><label className="text-sm font-semibold">Telefono<input className="mt-1 min-h-11 w-full rounded-lg border border-stone-200 px-3" onChange={(event) => setSupplierForm((current) => current ? { ...current, phone: event.target.value } : current)} value={supplierForm?.phone ?? ""} /></label><div className="mt-2 flex justify-end gap-2"><Button onClick={() => setSupplierOpen(false)} variant="outline">Annulla</Button><Button type="submit" variant="primary">Salva fornitore</Button></div></form></Dialog>
  </AppPage>;
}
