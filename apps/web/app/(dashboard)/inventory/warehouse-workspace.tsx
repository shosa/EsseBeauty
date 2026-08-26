"use client";

import {
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  FileUp,
  PackagePlus,
  Plus,
  RotateCcw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AppPage,
  Button,
  Dialog,
  EmptyState,
  PageHeaderMetrics,
  SectionCard,
  StatusBadge,
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

const quickActionTones = {
  fuchsia:
    "border-fuchsia-300 text-fuchsia-700 hover:border-fuchsia-600 hover:bg-fuchsia-600 focus-visible:border-fuchsia-600 focus-visible:bg-fuchsia-600",
  emerald:
    "border-emerald-300 text-emerald-700 hover:border-emerald-600 hover:bg-emerald-600 focus-visible:border-emerald-600 focus-visible:bg-emerald-600",
  sky: "border-sky-300 text-sky-700 hover:border-sky-600 hover:bg-sky-600 focus-visible:border-sky-600 focus-visible:bg-sky-600",
  amber:
    "border-amber-300 text-amber-700 hover:border-amber-500 hover:bg-amber-500 focus-visible:border-amber-500 focus-visible:bg-amber-500",
  indigo:
    "border-indigo-300 text-indigo-700 hover:border-indigo-600 hover:bg-indigo-600 focus-visible:border-indigo-600 focus-visible:bg-indigo-600",
  violet:
    "border-violet-300 text-violet-700 hover:border-violet-600 hover:bg-violet-600 focus-visible:border-violet-600 focus-visible:bg-violet-600",
  rose: "border-rose-300 text-rose-700 hover:border-rose-600 hover:bg-rose-600 focus-visible:border-rose-600 focus-visible:bg-rose-600",
  orange:
    "border-orange-300 text-orange-700 hover:border-orange-600 hover:bg-orange-600 focus-visible:border-orange-600 focus-visible:bg-orange-600",
  teal: "border-teal-300 text-teal-700 hover:border-teal-600 hover:bg-teal-600 focus-visible:border-teal-600 focus-visible:bg-teal-600",
} as const;

function WarehouseQuickAction({
  icon: Icon,
  label,
  onClick,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  onClick(): void;
  tone: keyof typeof quickActionTones;
}) {
  return (
    <button
      aria-label={label}
      className={`group inline-flex h-9 shrink-0 items-center overflow-hidden rounded-lg border bg-white px-2.5 font-bold shadow-sm transition-all duration-300 ease-out hover:text-white hover:shadow-md focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${quickActionTones[tone]}`}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon className="size-4 shrink-0" />
      <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover:ml-2 group-hover:max-w-40 group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-40 group-focus-visible:opacity-100">
        {label}
      </span>
    </button>
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
            <WarehouseQuickAction
              icon={Plus}
              label="Nuovo documento"
              onClick={() => openOperation("purchase")}
              tone="fuchsia"
            />
            <WarehouseQuickAction
              icon={ArrowDownToLine}
              label="Carico"
              onClick={() => openOperation("purchase")}
              tone="emerald"
            />
            <WarehouseQuickAction
              icon={ArrowUpFromLine}
              label="Scarico"
              onClick={() => openOperation("issue")}
              tone="sky"
            />
            <WarehouseQuickAction
              icon={ClipboardList}
              label="Inventario"
              onClick={() => setActiveTab("counts")}
              tone="amber"
            />
            <WarehouseQuickAction
              icon={FileUp}
              label="Importa"
              onClick={() => {
                openOperation("purchase");
                setImportMode(true);
              }}
              tone="indigo"
            />
            <WarehouseQuickAction
              icon={ArrowDownToLine}
              label="Rettifica scorte"
              onClick={() => openOperation("adjustment")}
              tone="violet"
            />
            <WarehouseQuickAction
              icon={PackagePlus}
              label="Registra scarto"
              onClick={() => openOperation("waste")}
              tone="rose"
            />
            <WarehouseQuickAction
              icon={RotateCcw}
              label="Rivaluta costi"
              onClick={() => openOperation("revaluation")}
              tone="orange"
            />
            <WarehouseQuickAction
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
        status={
          <StatusBadge
            status={summary.low_stock_count > 0 ? "waiting" : "active"}
          >
            {summary.low_stock_count > 0
              ? `${summary.low_stock_count} sotto soglia`
              : "Scorte ok"}
          </StatusBadge>
        }
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
        {!(
          [
            "overview",
            "products",
            "documents",
            "counts",
            "suppliers",
          ] as WarehouseTab[]
        ).includes(activeTab) && (
          <SectionCard
            title={
              warehouseTabs.find((tab) => tab.id === activeTab)?.label ??
              "Magazzino"
            }
            subtitle="Questa area operativa sarà disponibile nei prossimi incrementi."
          >
            <EmptyState
              description="Continua a gestire scorte, documenti e fornitori dalle aree attive."
              title="Area in preparazione"
            />
          </SectionCard>
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
