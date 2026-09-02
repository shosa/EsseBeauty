"use client";

import { ChevronDown, FileUp, Plus, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppPage, Button, EmptyState } from "@esse-beauty/ui";
import { useAuth } from "../../../lib/auth-context";
import { Card } from "./_components/EnterpriseCard";
import { WarehouseDocumentViewer } from "./_components/WarehouseDocumentViewer";
import { WarehouseOperationDialog } from "./_components/WarehouseOperationDialog";
import { WarehouseOverview } from "./_components/WarehouseOverview";
import { WarehouseProducts } from "./_components/WarehouseProducts";
import { warehouseApi } from "./warehouse-api";
import { documentKindBadgeClass, documentKindLabels, warehouseDocumentLabel } from "./document-label";
import type {
  WarehouseDocument,
  WarehouseDocumentDetails,
  WarehouseDocumentInput,
  WarehouseDocumentKind,
  WarehouseProduct,
  WarehouseSupplier,
  WarehouseSummary,
  WarehouseTab,
} from "./warehouse-types";

const warehouseTabs: Array<{ id: WarehouseTab; label: string }> = [
  { id: "overview", label: "Panoramica" },
  { id: "products", label: "Articoli" },
  { id: "movements", label: "Movimenti" },
];

const emptySummary: WarehouseSummary = {
  asset_value_cents: 0,
  draft_documents: 0,
  expense_total_cents: 0,
  low_stock_count: 0,
  purchase_total_cents: 0,
  stock_value_cents: 0,
  tracked_items: 0,
};

type OperationMode = "purchase" | "adjustment" | "waste" | "revaluation" | "issue";

const money = new Intl.NumberFormat("it-IT", {
  currency: "EUR",
  style: "currency",
});

const stockDocumentKinds = new Set<WarehouseDocumentKind>([
  "adjustment",
  "count",
  "internal_use",
  "opening",
  "purchase",
  "supplier_invoice",
  "supplier_return",
  "waste",
]);

function WarehouseMovements({
  documents,
  onOpen,
}: {
  documents: WarehouseDocument[];
  onOpen: (id: string) => void;
}) {
  const rows = [...documents]
    .filter((document) => stockDocumentKinds.has(document.kind))
    .filter((document) => document.status === "posted" || document.status === "reversed")
    .sort((a, b) => new Date(b.documentDate).getTime() - new Date(a.documentDate).getTime());

  return (
    <Card title="Registro movimenti" subtitle="Carichi, scarichi, rettifiche e storni in ordine cronologico." bodyClassName="p-0">
      {rows.length === 0 ? (
        <div className="p-4"><EmptyState title="Nessun movimento registrato" description="I documenti contabilizzati compariranno qui automaticamente." /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.12em] text-stone-500">
              <tr><th className="px-5 py-3">Data</th><th>Operazione</th><th>Riferimento</th><th className="text-right">Valore</th><th className="w-16 pr-5" /></tr>
            </thead>
            <tbody>
              {rows.map((document) => (
                <tr className="border-t border-stone-100 transition hover:bg-[#fffafd]" key={document.id}>
                  <td className="px-5 py-3 text-stone-500">{new Date(document.documentDate).toLocaleDateString("it-IT")}</td>
                  <td><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${documentKindBadgeClass[document.kind]}`}>{document.status === "reversed" ? "↩ Storno" : documentKindLabels[document.kind]}</span></td>
                  <td className="font-bold text-stone-900">{warehouseDocumentLabel(document)}</td>
                  <td className="text-right font-black tnum text-[#402334]">{money.format(document.totalCents / 100)}</td>
                  <td className="pr-5 text-right"><button className="text-[11px] font-bold text-[#792f59]" onClick={() => onOpen(document.id)} type="button">Apri</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function NewMovementMenu({ onSelect }: { onSelect(mode: OperationMode): void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);
  const options: Array<{ icon: string; label: string; mode: OperationMode; tone: string }> = [
    { icon: "↓", label: "Carico merce", mode: "purchase", tone: "bg-[#e5f3ec] text-[#1c7a5c]" },
    { icon: "↑", label: "Scarico per utilizzo", mode: "issue", tone: "bg-[#f3e2eb] text-[#792f59]" },
    { icon: "⚑", label: "Registra scarto", mode: "waste", tone: "bg-[#faeae8] text-[#b23a2e]" },
    { icon: "≈", label: "Rivaluta costo medio", mode: "revaluation", tone: "bg-[#eee2f7] text-[#7a4fa0]" },
    { icon: "±", label: "Rettifica manuale", mode: "adjustment", tone: "bg-[#f7ecdc] text-[#a5691a]" },
  ];
  return (
    <div className="relative" ref={ref}>
      <div className="inline-flex">
        <button className="flex h-9 items-center gap-1.5 rounded-l-xl bg-[#792f59] px-3.5 text-[12.5px] font-bold text-white transition hover:bg-[#5f2447]" onClick={() => onSelect("purchase")} type="button"><Plus size={14} />Nuovo movimento</button>
        <button aria-label="Altre operazioni di movimento" className="flex h-9 w-8 items-center justify-center rounded-r-xl border-l border-white/25 bg-[#792f59] text-white transition hover:bg-[#5f2447]" onClick={() => setOpen((value) => !value)} type="button"><ChevronDown size={14} /></button>
      </div>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-56 rounded-xl border border-[#e8dfe4] bg-white p-1.5 shadow-[0_18px_44px_rgb(45_29_39_/_0.16)]">
          {options.map((option) => (
            <button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-bold text-stone-700 transition hover:bg-[#f7eef3] hover:text-[#43223a]" key={option.mode} onClick={() => { onSelect(option.mode); setOpen(false); }} type="button">
              <span className={`grid size-6 shrink-0 place-items-center rounded-md text-xs font-black ${option.tone}`}>{option.icon}</span>{option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function WarehouseWorkspace() {
  const router = useRouter();
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
  const [operation, setOperation] = useState<OperationMode>();
  const [operationProducts, setOperationProducts] = useState<WarehouseProduct[]>([]);
  const [viewingDocument, setViewingDocument] = useState<WarehouseDocumentDetails>();
  const [importMode, setImportMode] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!salonId) return;
    try {
      const [nextSummary, nextProducts, nextDocuments] = await Promise.all([
        warehouseApi.getSummary(salonId),
        warehouseApi.getProducts(salonId, { active: true }),
        warehouseApi.getDocuments(salonId, { status: "posted" }),
      ]);
      setSummary({
        ...emptySummary,
        ...nextSummary,
        tracked_items: nextSummary.tracked_items ?? nextSummary.products ?? nextProducts.length,
      });
      setProducts(nextProducts);
      setDocuments(nextDocuments);
      setError("");
    } catch {
      setError("Magazzino non disponibile. Riprova tra poco.");
    }
  }

  useEffect(() => {
    void load();
  }, [salonId]);

  const visibleProducts = useMemo(
    () =>
      products.filter(
        (item) =>
          (!query.trim() ||
            `${item.name} ${item.sku ?? ""} ${item.supplier ?? ""}`
              .toLocaleLowerCase("it-IT")
              .includes(query.trim().toLocaleLowerCase("it-IT"))) &&
          (!lowOnly || item.stockQuantity < item.lowStockThreshold) &&
          (itemType === "all" || item.itemType === itemType),
      ),
    [products, query, lowOnly, itemType],
  );

  const openOperation = async (
    mode: OperationMode,
    product?: WarehouseProduct | WarehouseProduct[],
  ) => {
    if (salonId && suppliers.length === 0) {
      try {
        setSuppliers(await warehouseApi.getSuppliers(salonId, { active: true }));
      } catch {
        setSuppliers([]);
      }
    }
    const selectedProducts = Array.isArray(product)
      ? product
      : product
        ? [product]
        : products.filter((item) => selected.includes(item.id));
    setOperationProducts(selectedProducts);
    setOperation(mode);
    setImportMode(false);
  };

  const saveOperation = async (input: WarehouseDocumentInput, post: boolean, documentId?: string) => {
    if (!salonId) return;
    const saved = await warehouseApi.saveDocument(salonId, input, documentId);
    if (post) await warehouseApi.postDocument(salonId, saved.id);
    setOperation(undefined);
    await load();
  };

  const openDocument = async (documentId: string) => {
    if (!salonId) return;
    try {
      setViewingDocument(await warehouseApi.getDocument(salonId, documentId));
    } catch {
      setError("Documento non disponibile.");
    }
  };

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e8dfe4] pb-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#792f59]">Magazzino</p>
          <h1 className="mt-1 text-[26px] font-bold tracking-[-.02em] text-stone-950">Magazzino</h1>
          <p className="mt-1 text-[13px] text-stone-500">Catalogo articoli, giacenze, costi e margini in un&apos;unica vista operativa.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button aria-label="Aggiorna magazzino" className="grid size-9 place-items-center rounded-xl border border-[#e8dfe4] bg-white text-stone-600 transition hover:border-[#792f59] hover:text-[#792f59]" onClick={() => void load()} title="Aggiorna" type="button"><RefreshCw size={15} /></button>
          <button className="flex h-9 items-center gap-1.5 rounded-xl border border-[#e8dfe4] bg-white px-3.5 text-[12.5px] font-bold text-stone-600 transition hover:border-[#792f59] hover:text-[#792f59]" onClick={() => { void openOperation("purchase"); setImportMode(true); }} type="button"><FileUp size={14} />Importa</button>
          <button className="flex h-9 items-center gap-1.5 rounded-xl border border-[#792f59] bg-white px-3.5 text-[12.5px] font-bold text-[#792f59] transition hover:bg-[#f7eef3]" onClick={() => router.push("/inventory/new")} type="button">+ Articolo</button>
          <NewMovementMenu onSelect={(mode) => void openOperation(mode)} />
        </div>
      </header>

      <nav className="inline-flex flex-wrap gap-0.5 rounded-xl border border-[#e8dfe4] bg-[#faf7f9] p-1" role="tablist" aria-label="Aree del magazzino">
        {warehouseTabs.map((tab) => {
          const panelId = `warehouse-panel-${tab.id}`;
          return (
          <button
            aria-controls={panelId}
            aria-selected={activeTab === tab.id}
            className={`h-8 rounded-lg px-3.5 text-[12px] font-bold transition ${activeTab === tab.id ? "bg-white text-[#792f59] shadow-sm" : "text-stone-500 hover:text-[#792f59]"}`}
            id={`warehouse-tab-${tab.id}`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
            {tab.id === "products" && <span className={`ml-1.5 text-[10px] ${activeTab === tab.id ? "text-[#792f59]/70" : "text-stone-400"}`}>{visibleProducts.length}</span>}
          </button>
          );
        })}
      </nav>

      {error && (
        <div aria-live="polite" className="mt-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
          <Button onClick={() => void load()} size="sm" variant="tableAction">Riprova</Button>
        </div>
      )}

      <div aria-labelledby={`warehouse-tab-${activeTab}`} aria-live="polite" className="mt-4" id={`warehouse-panel-${activeTab}`} role="tabpanel" tabIndex={0}>
        {activeTab === "overview" && (
          <WarehouseOverview
            documents={documents}
            onNewDocument={() => void openOperation("purchase")}
            onRefresh={() => void load()}
            products={products}
            summary={summary}
          />
        )}
        {activeTab === "products" && (
          <WarehouseProducts
            itemType={itemType}
            items={visibleProducts}
            lowOnly={lowOnly}
            onItemType={setItemType}
            onLowOnly={setLowOnly}
            onOpenOperation={(mode, product) => mode === "count" ? router.push("/inventory/counts") : void openOperation(mode, product)}
            onQuery={setQuery}
            onSelect={(id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
            onSelectAll={() => setSelected((current) => current.length === visibleProducts.length ? [] : visibleProducts.map((item) => item.id))}
            query={query}
            selected={selected}
          />
        )}
        {activeTab === "movements" && <WarehouseMovements documents={documents} onOpen={(id) => void openDocument(id)} />}
      </div>
      {operation && (
        <WarehouseOperationDialog
          initialLines={operationProducts}
          mode={operation}
          onClose={() => setOperation(undefined)}
          onSave={saveOperation}
          open={Boolean(operation)}
          products={products}
          startWithPaste={importMode}
          suppliers={suppliers}
        />
      )}
      <WarehouseDocumentViewer
        document={viewingDocument}
        onClose={() => setViewingDocument(undefined)}
        onEdit={() => setViewingDocument(undefined)}
        suppliers={suppliers}
      />
    </AppPage>
  );
}
