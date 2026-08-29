"use client";

import {
  Archive,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  ClipboardList,
  FileUp,
  PackagePlus,
  RotateCcw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AppPage,
  Button,
  EmptyState,
  ExpandableAction,
  PageHeaderMetrics,
  SectionCard,
} from "@esse-beauty/ui";
import { useAuth } from "../../../lib/auth-context";
import { WarehouseDocumentViewer } from "./_components/WarehouseDocumentViewer";
import { WarehouseOperationDialog } from "./_components/WarehouseOperationDialog";
import { WarehouseOverview } from "./_components/WarehouseOverview";
import { WarehouseProducts } from "./_components/WarehouseProducts";
import { warehouseApi } from "./warehouse-api";
import { warehouseDocumentLabel } from "./document-label";
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
    <SectionCard title="Registro movimenti" subtitle="Carichi, scarichi, rettifiche e storni in ordine cronologico.">
      {rows.length === 0 ? (
        <EmptyState title="Nessun movimento registrato" description="I documenti contabilizzati compariranno qui automaticamente." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-xs uppercase tracking-wider text-stone-400">
                <th className="p-3">Data</th>
                <th className="p-3">Operazione</th>
                <th className="p-3">Riferimento</th>
                <th className="p-3 text-right">Valore</th>
                <th className="p-3"><span className="sr-only">Apri</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((document) => (
                <tr className="border-b border-stone-100 last:border-0" key={document.id}>
                  <td className="p-3 font-semibold">{new Date(document.documentDate).toLocaleDateString("it-IT")}</td>
                  <td className="p-3"><span className="inline-flex items-center gap-2"><ArrowLeftRight className="size-4 text-teal-700" />{documentKindLabels[document.kind]}</span></td>
                  <td className="p-3 text-stone-600">{warehouseDocumentLabel(document)}</td>
                  <td className="p-3 text-right font-bold">{money.format(document.totalCents / 100)}</td>
                  <td className="p-3 text-right"><Button aria-label={`Apri ${warehouseDocumentLabel(document)}`} onClick={() => onOpen(document.id)} size="sm" variant="tableAction">Apri</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

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
      <PageHeaderMetrics
        actions={
          <div className="flex flex-wrap gap-2">
            <ExpandableAction icon={ArrowDownToLine} label="Carico" onClick={() => void openOperation("purchase")} tone="emerald" />
            <ExpandableAction icon={ArrowUpFromLine} label="Scarico" onClick={() => void openOperation("issue")} tone="sky" />
            <ExpandableAction icon={ClipboardList} label="Inventario" onClick={() => window.location.assign("/inventory/counts")} tone="amber" />
            <ExpandableAction icon={FileUp} label="Importa" onClick={() => { void openOperation("purchase"); setImportMode(true); }} tone="indigo" />
            <ExpandableAction icon={ArrowDownToLine} label="Rettifica scorte" onClick={() => void openOperation("adjustment")} tone="violet" />
            <ExpandableAction icon={PackagePlus} label="Registra scarto" onClick={() => void openOperation("waste")} tone="rose" />
            <ExpandableAction icon={RotateCcw} label="Rivaluta costi" onClick={() => void openOperation("revaluation")} tone="orange" />
            <ExpandableAction icon={Archive} label="Articolo" onClick={() => window.location.assign("/inventory/new")} tone="teal" />
          </div>
        }
        eyebrow="Magazzino"
        metrics={[
          { detail: "Articoli tracciati", label: "Prodotti", value: summary.tracked_items },
          { detail: "Da reintegrare", label: "Scorte basse", value: summary.low_stock_count },
          { detail: "Valore stimato", label: "Valore scorte", value: money.format(summary.stock_value_cents / 100) },
        ]}
        subtitle="Panoramica, articoli e movimenti stock del salone."
        title="Magazzino operativo"
      />
      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-2 shadow-sm">
        <div aria-label="Aree del magazzino" className="flex gap-1 overflow-x-auto" role="tablist">
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
        <div aria-live="polite" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
          <Button onClick={() => void load()} size="sm" variant="tableAction">Riprova</Button>
        </div>
      )}
      <div aria-labelledby={`warehouse-tab-${activeTab}`} aria-live="polite" id={`warehouse-panel-${activeTab}`} role="tabpanel" tabIndex={0}>
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
            onOpenOperation={(mode, product) => mode === "count" ? window.location.assign("/inventory/counts") : void openOperation(mode, product)}
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
