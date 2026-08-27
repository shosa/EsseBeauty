"use client";

import {
  Archive,
  ArrowLeftRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  FileUp,
  PackagePlus,
  Plus,
  RotateCcw,
  ReceiptText,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AppPage,
  Button,
  Dialog,
  EmptyState,
  ExpandableAction,
  PageHeaderMetrics,
  SectionCard,
} from "@esse-beauty/ui";
import { useAuth } from "../../../lib/auth-context";
import { WarehouseDocuments } from "./_components/WarehouseDocuments";
import { WarehouseCounts } from "./_components/WarehouseCounts";
import { WarehouseOperationDialog } from "./_components/WarehouseOperationDialog";
import { WarehouseOverview } from "./_components/WarehouseOverview";
import { WarehouseProducts } from "./_components/WarehouseProducts";
import { WarehouseSuppliers } from "./_components/WarehouseSuppliers";
import { warehouseApi } from "./warehouse-api";
import type {
  WarehouseCount,
  WarehouseDocument,
  WarehouseDocumentDetails,
  WarehouseDocumentInput,
  WarehouseDocumentKind,
  WarehouseDocumentStatus,
  WarehouseProduct,
  WarehouseSupplier,
  WarehouseSummary,
  WarehouseTab,
} from "./warehouse-types";

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
const emptySummary: WarehouseSummary = {
  asset_value_cents: 0,
  draft_documents: 0,
  expense_total_cents: 0,
  low_stock_count: 0,
  purchase_total_cents: 0,
  stock_value_cents: 0,
  tracked_items: 0,
};
type OperationMode =
  | "purchase"
  | "adjustment"
  | "waste"
  | "revaluation"
  | "issue";

const money = new Intl.NumberFormat("it-IT", {
  currency: "EUR",
  style: "currency",
});

const documentKindLabels: Record<WarehouseDocumentKind, string> = {
  adjustment: "Rettifica inventariale",
  count: "Inventario",
  credit_note: "Nota di credito",
  equipment_purchase: "Acquisto attrezzatura",
  expense: "Spesa",
  internal_use: "Consumo interno",
  opening: "Giacenza iniziale",
  purchase: "Carico merce",
  supplier_invoice: "Fattura fornitore",
  supplier_return: "Reso a fornitore",
  waste: "Scarto",
};

function WarehouseMovements({ documents, onOpen }: { documents: WarehouseDocument[]; onOpen: (id: string) => void }) {
  const rows = [...documents]
    .filter((document) => document.status === "posted" || document.status === "reversed")
    .sort((a, b) => new Date(b.documentDate).getTime() - new Date(a.documentDate).getTime());
  return (
    <SectionCard title="Registro movimenti" subtitle="Carichi, scarichi, rettifiche e storni in ordine cronologico.">
      {rows.length === 0 ? <EmptyState title="Nessun movimento registrato" description="I documenti contabilizzati compariranno qui automaticamente." /> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-stone-200 text-xs uppercase tracking-wider text-stone-400"><th className="p-3">Data</th><th className="p-3">Operazione</th><th className="p-3">Riferimento</th><th className="p-3 text-right">Valore</th><th className="p-3"><span className="sr-only">Apri</span></th></tr></thead><tbody>{rows.map((document) => <tr className="border-b border-stone-100 last:border-0" key={document.id}><td className="p-3 font-semibold">{new Date(document.documentDate).toLocaleDateString("it-IT")}</td><td className="p-3"><span className="inline-flex items-center gap-2"><ArrowLeftRight className="size-4 text-teal-700" />{documentKindLabels[document.kind]}</span></td><td className="p-3 text-stone-600">{document.externalReference || document.internalNumber}</td><td className="p-3 text-right font-bold">{money.format(document.totalCents / 100)}</td><td className="p-3 text-right"><Button aria-label={`Apri ${document.internalNumber}`} onClick={() => onOpen(document.id)} size="sm" variant="tableAction">Apri</Button></td></tr>)}</tbody></table></div>
      )}
    </SectionCard>
  );
}

function WarehouseCosts({ documents, onOpen }: { documents: WarehouseDocument[]; onOpen: (id: string) => void }) {
  const rows = documents.filter((document) => document.status === "posted" && ["expense", "equipment_purchase"].includes(document.kind));
  const expenseTotal = rows.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.totalCents, 0);
  const assetTotal = rows.filter((item) => item.kind === "equipment_purchase").reduce((sum, item) => sum + item.totalCents, 0);
  return (
    <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-5"><ReceiptText className="size-5 text-orange-700" /><p className="mt-3 text-sm font-bold text-stone-600">Spese operative</p><p className="text-2xl font-black">{money.format(expenseTotal / 100)}</p></div><div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5"><Archive className="size-5 text-indigo-700" /><p className="mt-3 text-sm font-bold text-stone-600">Attrezzature acquistate</p><p className="text-2xl font-black">{money.format(assetTotal / 100)}</p></div></div><SectionCard title="Registro costi" subtitle="Spese e beni durevoli separati dalla giacenza destinata alla vendita.">{rows.length === 0 ? <EmptyState title="Nessun costo registrato" description="Registra una spesa o un acquisto attrezzatura dalle operazioni rapide." /> : <div className="grid gap-2">{rows.map((document) => <button className="flex w-full items-center justify-between gap-4 rounded-xl border border-stone-200 p-4 text-left transition hover:border-teal-400 hover:bg-cyan-50/40" key={document.id} onClick={() => onOpen(document.id)} type="button"><span><b className="block">{documentKindLabels[document.kind]}</b><span className="text-xs text-stone-500">{new Date(document.documentDate).toLocaleDateString("it-IT")} · {document.externalReference || document.internalNumber}</span></span><b>{money.format(document.totalCents / 100)}</b></button>)}</div>}</SectionCard></div>
  );
}

function WarehouseReports({ products, summary }: { products: WarehouseProduct[]; summary: WarehouseSummary }) {
  const valued = products.filter((product) => product.trackStock).map((product) => ({ ...product, value: product.stockQuantity * product.averageCostCents })).sort((a, b) => b.value - a.value);
  const total = valued.reduce((sum, product) => sum + product.value, 0);
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]"><SectionCard title="Indicatori economici" subtitle="Valori aggiornati in base ai documenti contabilizzati."><dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><div className="rounded-xl bg-stone-50 p-4"><dt className="text-sm text-stone-500">Valore scorte</dt><dd className="mt-1 text-2xl font-black">{money.format(summary.stock_value_cents / 100)}</dd></div><div className="rounded-xl bg-stone-50 p-4"><dt className="text-sm text-stone-500">Acquisti</dt><dd className="mt-1 text-2xl font-black">{money.format(summary.purchase_total_cents / 100)}</dd></div><div className="rounded-xl bg-stone-50 p-4"><dt className="text-sm text-stone-500">Spese</dt><dd className="mt-1 text-2xl font-black">{money.format(summary.expense_total_cents / 100)}</dd></div></dl></SectionCard><SectionCard title="Valorizzazione articoli" subtitle="Giacenza per costo medio, dal valore più alto.">{valued.length === 0 ? <EmptyState title="Nessuna scorta valorizzata" description="Aggiungi articoli tracciati e contabilizza un carico." /> : <div className="space-y-3">{valued.slice(0, 12).map((product) => { const width = total > 0 ? Math.max(4, Math.round((product.value / total) * 100)) : 4; return <div key={product.id}><div className="flex justify-between gap-3 text-sm"><span className="font-bold">{product.name}</span><span>{money.format(product.value / 100)}</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-gradient-to-r from-teal-700 to-cyan-400" style={{ width: `${width}%` }} /></div></div>; })}</div>}</SectionCard></div>
  );
}

function readDocumentFilter<T extends string>(
  key: string,
  fallback: T,
  allowed: readonly T[],
): T {
  if (typeof window === "undefined") return fallback;
  const stored =
    new URLSearchParams(window.location.search).get(key) ??
    (() => {
      try {
        return JSON.parse(
          window.localStorage.getItem("warehouse-document-filters") ?? "null",
        )?.[key] as string | null;
      } catch {
        return null;
      }
    })();
  return stored && allowed.includes(stored as T) ? (stored as T) : fallback;
}
function readDocumentDate(key: string) {
  if (typeof window === "undefined") return "";
  const fromUrl = new URLSearchParams(window.location.search).get(key);
  if (fromUrl) return fromUrl;
  try {
    return (
      JSON.parse(
        window.localStorage.getItem("warehouse-document-filters") ?? "null",
      )?.[key] ?? ""
    );
  } catch {
    return "";
  }
}

export function WarehouseWorkspace() {
  const { salon } = useAuth();
  const salonId = salon?.id;
  const [activeTab, setActiveTab] = useState<WarehouseTab>("overview");
  const [summary, setSummary] = useState(emptySummary);
  const [products, setProducts] = useState<WarehouseProduct[]>([]);
  const [suppliers, setSuppliers] = useState<WarehouseSupplier[]>([]);
  const [documents, setDocuments] = useState<WarehouseDocument[]>([]);
  const [counts, setCounts] = useState<WarehouseCount[]>([]);
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [itemType, setItemType] = useState<
    WarehouseProduct["itemType"] | "all"
  >("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [operation, setOperation] = useState<OperationMode>();
  const [operationProducts, setOperationProducts] = useState<
    WarehouseProduct[]
  >([]);
  const [editingDocument, setEditingDocument] =
    useState<WarehouseDocumentDetails>();
  const [importMode, setImportMode] = useState(false);
  const [supplierForm, setSupplierForm] = useState<WarehouseSupplier>();
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [error, setError] = useState("");
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const [documentStatus, setDocumentStatus] = useState<
    WarehouseDocumentStatus | "all"
  >(() =>
    readDocumentFilter("status", "all", [
      "all",
      "draft",
      "posted",
      "reversed",
      "cancelled",
    ] as const),
  );
  const [documentKind, setDocumentKind] = useState<
    WarehouseDocumentKind | "all"
  >(() =>
    readDocumentFilter("kind", "all", [
      "all",
      "adjustment",
      "count",
      "credit_note",
      "equipment_purchase",
      "expense",
      "internal_use",
      "opening",
      "purchase",
      "supplier_invoice",
      "supplier_return",
      "waste",
    ] as const),
  );
  const [documentDateFrom, setDocumentDateFrom] = useState(() =>
    readDocumentDate("date_from"),
  );
  const [documentDateTo, setDocumentDateTo] = useState(() =>
    readDocumentDate("date_to"),
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "warehouse-document-filters",
        JSON.stringify({
          status: documentStatus,
          kind: documentKind,
          date_from: documentDateFrom,
          date_to: documentDateTo,
        }),
      );
    } catch {
      /* storage can be unavailable */
    }
  }, [documentStatus, documentKind, documentDateFrom, documentDateTo]);
  async function loadDocuments(
    overrides: Partial<{
      status: WarehouseDocumentStatus | "all";
      kind: WarehouseDocumentKind | "all";
      dateFrom: string;
      dateTo: string;
    }> = {},
  ) {
    if (!salonId) return;
    const next = {
      status: overrides.status ?? documentStatus,
      kind: overrides.kind ?? documentKind,
      dateFrom: overrides.dateFrom ?? documentDateFrom,
      dateTo: overrides.dateTo ?? documentDateTo,
    };
    setDocumentsLoading(true);
    setDocumentError("");
    try {
      setDocuments(
        await warehouseApi.getDocuments(salonId, {
          ...(next.status !== "all" && { status: next.status }),
          ...(next.kind !== "all" && { kind: next.kind }),
          ...(next.dateFrom && { date_from: next.dateFrom }),
          ...(next.dateTo && { date_to: next.dateTo }),
        }),
      );
    } catch {
      setDocumentError("Documenti non disponibili. Riprova tra poco.");
    } finally {
      setDocumentsLoading(false);
    }
  }
  async function load() {
    if (!salonId) return;
    try {
      const [nextSummary, nextProducts, nextSuppliers, nextCounts] =
        await Promise.all([
          warehouseApi.getSummary(salonId),
          warehouseApi.getProducts(salonId, { active: true }),
          warehouseApi.getSuppliers(salonId, { active: true }),
          warehouseApi.getCounts(salonId),
        ]);
      setSummary({
        ...emptySummary,
        ...nextSummary,
        tracked_items:
          nextSummary.tracked_items ??
          nextSummary.products ??
          nextProducts.length,
      });
      setProducts(nextProducts);
      setSuppliers(nextSuppliers);
      setCounts(nextCounts);
      await loadDocuments();
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
  const openOperation = (
    mode: OperationMode,
    product?: WarehouseProduct | WarehouseProduct[],
  ) => {
    const selectedProducts = Array.isArray(product)
      ? product
      : product
        ? [product]
        : products.filter((item) => selected.includes(item.id));
    setOperationProducts(selectedProducts);
    setOperation(mode);
    setImportMode(false);
  };
  const saveOperation = async (
    input: WarehouseDocumentInput,
    post: boolean,
    documentId?: string,
  ) => {
    if (!salonId) return;
    const saved = await warehouseApi.saveDocument(salonId, input, documentId);
    if (post) await warehouseApi.postDocument(salonId, saved.id);
    setOperation(undefined);
    setEditingDocument(undefined);
    await load();
  };
  const setFilter = (
    field: "status" | "kind" | "dateFrom" | "dateTo",
    value: string,
  ) => {
    if (field === "status") {
      setDocumentStatus(value as WarehouseDocumentStatus | "all");
      void loadDocuments({ status: value as WarehouseDocumentStatus | "all" });
    }
    if (field === "kind") {
      setDocumentKind(value as WarehouseDocumentKind | "all");
      void loadDocuments({ kind: value as WarehouseDocumentKind | "all" });
    }
    if (field === "dateFrom") {
      setDocumentDateFrom(value);
      void loadDocuments({ dateFrom: value });
    }
    if (field === "dateTo") {
      setDocumentDateTo(value);
      void loadDocuments({ dateTo: value });
    }
  };
  const openDocument = async (documentId: string) => {
    if (!salonId) return;
    try {
      const details = await warehouseApi.getDocument(salonId, documentId);
      if (details.status === "draft") {
        setEditingDocument(details);
        setOperation("purchase");
        setImportMode(false);
      }
    } catch {
      setDocumentError("Documento non disponibile.");
    }
  };
  const reverseDocument = async (documentId: string) => {
    if (!salonId || !window.confirm("Stornare questo documento?")) return;
    try {
      await warehouseApi.reverseDocument(salonId, documentId);
      await loadDocuments();
    } catch {
      setDocumentError("Documento non stornato.");
    }
  };
  const saveSupplier = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!salonId || !supplierForm?.name.trim()) return;
    try {
      if (supplierForm.id)
        await warehouseApi.updateSupplier(
          salonId,
          supplierForm.id,
          supplierForm,
        );
      else await warehouseApi.createSupplier(salonId, supplierForm);
      setSupplierOpen(false);
      setSupplierForm(undefined);
      await load();
    } catch {
      setError("Fornitore non salvato.");
    }
  };

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageHeaderMetrics
        actions={
          <div className="flex flex-wrap gap-2">
            <ExpandableAction
              icon={Plus}
              label="Nuovo documento"
              onClick={() => openOperation("purchase")}
              tone="fuchsia"
            />
            <ExpandableAction
              icon={ArrowDownToLine}
              label="Carico"
              onClick={() => openOperation("purchase")}
              tone="emerald"
            />
            <ExpandableAction
              icon={ArrowUpFromLine}
              label="Scarico"
              onClick={() => openOperation("issue")}
              tone="sky"
            />
            <ExpandableAction
              icon={ClipboardList}
              label="Inventario"
              onClick={() => setActiveTab("counts")}
              tone="amber"
            />
            <ExpandableAction
              icon={FileUp}
              label="Importa"
              onClick={() => {
                openOperation("purchase");
                setImportMode(true);
              }}
              tone="indigo"
            />
            <ExpandableAction
              icon={ArrowDownToLine}
              label="Rettifica scorte"
              onClick={() => openOperation("adjustment")}
              tone="violet"
            />
            <ExpandableAction
              icon={PackagePlus}
              label="Registra scarto"
              onClick={() => openOperation("waste")}
              tone="rose"
            />
            <ExpandableAction
              icon={RotateCcw}
              label="Rivaluta costi"
              onClick={() => openOperation("revaluation")}
              tone="orange"
            />
            <ExpandableAction
              icon={Archive}
              label="Articolo"
              onClick={() => window.location.assign("/inventory/new")}
              tone="teal"
            />
          </div>
        }
        eyebrow="Magazzino"
        metrics={[
          {
            detail: "Articoli tracciati",
            label: "Prodotti",
            value: summary.tracked_items,
          },
          {
            detail: "Da reintegrare",
            label: "Scorte basse",
            value: summary.low_stock_count,
          },
          {
            detail: "Valore stimato",
            label: "Valore scorte",
            value: (summary.stock_value_cents / 100).toLocaleString("it-IT", {
              currency: "EUR",
              style: "currency",
            }),
          },
        ]}
        title="Magazzino operativo"
        subtitle="Scorte, acquisti e controlli operativi in un unico spazio."
      />
      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-2 shadow-sm">
        <div
          aria-label="Aree del magazzino"
          className="flex gap-1 overflow-x-auto"
          role="tablist"
        >
          {warehouseTabs.map((tab) => {
            const panelId = `warehouse-panel-${tab.id}`;
            return (
              <Button
                active={activeTab === tab.id}
                aria-controls={panelId}
                aria-selected={activeTab === tab.id}
                className="shrink-0"
                id={`warehouse-tab-${tab.id}`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                size="sm"
                variant={activeTab === tab.id ? "primary" : "ghost"}
              >
                {tab.label}
              </Button>
            );
          })}
        </div>
      </div>
      {error && (
        <div
          aria-live="polite"
          className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {error}
          <Button onClick={() => void load()} size="sm" variant="tableAction">
            Riprova
          </Button>
        </div>
      )}
      <div
        aria-labelledby={`warehouse-tab-${activeTab}`}
        aria-live="polite"
        id={`warehouse-panel-${activeTab}`}
        role="tabpanel"
        tabIndex={0}
      >
        {activeTab === "overview" && (
          <WarehouseOverview
            documents={documents}
            onNewDocument={() => openOperation("purchase")}
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
            onOpenOperation={(mode, product) =>
              mode === "count"
                ? setActiveTab("counts")
                : openOperation(mode, product)
            }
            onQuery={setQuery}
            onSelect={(id) =>
              setSelected((current) =>
                current.includes(id)
                  ? current.filter((item) => item !== id)
                  : [...current, id],
              )
            }
            onSelectAll={() =>
              setSelected((current) =>
                current.length === visibleProducts.length
                  ? []
                  : visibleProducts.map((item) => item.id),
              )
            }
            query={query}
            selected={selected}
          />
        )}
        {activeTab === "documents" && (
          <WarehouseDocuments
            dateFrom={documentDateFrom}
            dateTo={documentDateTo}
            documents={documents}
            error={documentError}
            kind={documentKind}
            loading={documentsLoading}
            onDateFrom={(value) => setFilter("dateFrom", value)}
            onDateTo={(value) => setFilter("dateTo", value)}
            onKind={(value) => setFilter("kind", value)}
            onOpen={(id) => void openDocument(id)}
            onReverse={(id) => void reverseDocument(id)}
            onStatus={(value) => setFilter("status", value)}
            status={documentStatus}
            suppliers={suppliers}
          />
        )}
        {activeTab === "movements" && (
          <WarehouseMovements documents={documents} onOpen={(id) => void openDocument(id)} />
        )}
        {activeTab === "counts" && (
          <WarehouseCounts
            counts={counts}
            onRefresh={load}
            products={products}
            salonId={salonId}
          />
        )}
        {activeTab === "suppliers" && (
          <WarehouseSuppliers
            onCreate={() => {
              setSupplierForm({
                id: "",
                name: "",
                contactName: null,
                vatNumber: null,
                taxCode: null,
                email: null,
                phone: null,
                address: null,
                city: null,
                postalCode: null,
                country: "Italia",
                paymentTerms: null,
                notes: null,
                active: true,
              });
              setSupplierOpen(true);
            }}
            onEdit={(supplier) => {
              setSupplierForm(supplier);
              setSupplierOpen(true);
            }}
            suppliers={suppliers}
          />
        )}
        {activeTab === "costs" && (
          <WarehouseCosts documents={documents} onOpen={(id) => void openDocument(id)} />
        )}
        {activeTab === "reports" && (
          <WarehouseReports products={products} summary={summary} />
        )}
      </div>
      {operation && (
        <WarehouseOperationDialog
          initialDocument={editingDocument}
          initialLines={operationProducts}
          mode={operation}
          onClose={() => {
            setOperation(undefined);
            setEditingDocument(undefined);
          }}
          onSave={saveOperation}
          open={Boolean(operation)}
          products={products}
          startWithPaste={importMode}
          suppliers={suppliers}
        />
      )}
      <Dialog
        onClose={() => {
          setSupplierOpen(false);
          setSupplierForm(undefined);
        }}
        open={supplierOpen}
        title={supplierForm?.id ? "Modifica fornitore" : "Nuovo fornitore"}
      >
        <form
          className="grid gap-3"
          onSubmit={(event) => void saveSupplier(event)}
        >
          <label className="text-sm font-semibold">
            Nome
            <input
              autoFocus
              className="mt-1 min-h-11 w-full rounded-lg border border-stone-200 px-3"
              onChange={(event) =>
                setSupplierForm((current) =>
                  current ? { ...current, name: event.target.value } : current,
                )
              }
              required
              value={supplierForm?.name ?? ""}
            />
          </label>
          <label className="text-sm font-semibold">
            Email
            <input
              className="mt-1 min-h-11 w-full rounded-lg border border-stone-200 px-3"
              onChange={(event) =>
                setSupplierForm((current) =>
                  current ? { ...current, email: event.target.value } : current,
                )
              }
              type="email"
              value={supplierForm?.email ?? ""}
            />
          </label>
          <label className="text-sm font-semibold">
            Telefono
            <input
              className="mt-1 min-h-11 w-full rounded-lg border border-stone-200 px-3"
              onChange={(event) =>
                setSupplierForm((current) =>
                  current ? { ...current, phone: event.target.value } : current,
                )
              }
              value={supplierForm?.phone ?? ""}
            />
          </label>
          <div className="mt-2 flex justify-end gap-2">
            <Button onClick={() => setSupplierOpen(false)} variant="outline">
              Annulla
            </Button>
            <Button type="submit" variant="primary">
              Salva fornitore
            </Button>
          </div>
        </form>
      </Dialog>
    </AppPage>
  );
}
