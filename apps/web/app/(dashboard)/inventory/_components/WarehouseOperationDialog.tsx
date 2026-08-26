"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Copy,
  PackageX,
  Plus,
  Scale,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@esse-beauty/ui";
import { useEffect, useMemo, useState } from "react";
import { mapWarehouseLineErrors, WarehouseApiError } from "../warehouse-api";
import type {
  EditableWarehouseLine,
  WarehouseDocumentDetails,
  WarehouseDocumentInput,
  WarehouseDocumentKind,
  WarehouseProduct,
  WarehouseSupplier,
} from "../warehouse-types";

export type WarehouseOperationMode =
  | "purchase"
  | "adjustment"
  | "waste"
  | "revaluation"
  | "issue";

const operationPresentations = {
  purchase: {
    title: "Carico merce",
    eyebrow: "Entrata e acquisto",
    description:
      "Documento fornitore, costi e quantità che entreranno in giacenza.",
    accent: "bg-emerald-50 text-emerald-700",
    fields: [
      "document",
      "supplier",
      "quantity",
      "unit_cost",
      "discount",
      "tax",
    ],
    confirmation:
      "Le quantità saranno aggiunte alla giacenza e i costi aggiorneranno il valore del magazzino.",
  },
  issue: {
    title: "Scarico per utilizzo",
    eyebrow: "Uscita interna",
    description:
      "Preleva prodotti per uso cabina, tester o altra attività interna.",
    accent: "bg-sky-50 text-sky-700",
    fields: ["reason", "quantity", "availability"],
    confirmation:
      "Le quantità indicate saranno sottratte dalla giacenza disponibile.",
  },
  waste: {
    title: "Registra scarto",
    eyebrow: "Perdita inventariale",
    description:
      "Documenta prodotti scaduti, danneggiati o persi e il loro valore.",
    accent: "bg-rose-50 text-rose-700",
    fields: ["cause", "quantity", "availability", "cost_impact"],
    confirmation:
      "Lo scarto ridurrà la giacenza e resterà tracciato con causa e impatto economico.",
  },
  revaluation: {
    title: "Rivaluta costo medio",
    eyebrow: "Valore di magazzino",
    description: "Correggi il costo medio senza modificare la quantità fisica.",
    accent: "bg-amber-50 text-amber-700",
    fields: ["current_cost", "new_cost", "value_impact"],
    confirmation:
      "Cambierà solo il costo medio e il valore contabile; la giacenza resterà invariata.",
  },
  adjustment: {
    title: "Rettifica manuale",
    eyebrow: "Correzione controllata",
    description:
      "Allinea una giacenza indicando direzione, quantità e motivazione.",
    accent: "bg-violet-50 text-violet-700",
    fields: ["reason", "direction", "quantity", "unit_cost"],
    confirmation:
      "La rettifica applicherà la variazione e ne conserverà la motivazione.",
  },
} satisfies Record<
  WarehouseOperationMode,
  {
    title: string;
    eyebrow: string;
    description: string;
    accent: string;
    fields: string[];
    confirmation: string;
  }
>;

export function getOperationPresentation(mode: WarehouseOperationMode) {
  return operationPresentations[mode];
}

function localizedNumber(value: string | number) {
  return typeof value === "number"
    ? value
    : Number(value.trim().replace(",", "."));
}
export function euroToCents(value: string | number) {
  const amount = localizedNumber(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : Number.NaN;
}
export function percentToBasisPoints(value: string | number) {
  const percent = localizedNumber(value);
  return Number.isFinite(percent) ? Math.round(percent * 100) : Number.NaN;
}

function OperationIcon({ mode }: { mode: WarehouseOperationMode }) {
  if (mode === "purchase") return <ArrowDownToLine className="size-5" />;
  if (mode === "issue") return <ArrowUpFromLine className="size-5" />;
  if (mode === "waste") return <PackageX className="size-5" />;
  if (mode === "revaluation") return <Scale className="size-5" />;
  return <SlidersHorizontal className="size-5" />;
}

let lineSequence = 0;
function lineKey() {
  lineSequence += 1;
  return `warehouse-line-${lineSequence}`;
}

export function resolveProductReference(
  products: WarehouseProduct[],
  reference: string,
) {
  const normalized = reference.trim().toLocaleLowerCase("it-IT");
  if (!normalized) return undefined;
  return products.find((product) =>
    [product.id, product.sku ?? "", product.name, productReferenceLabel(product)].some(
      (value) => value.trim().toLocaleLowerCase("it-IT") === normalized,
    ),
  );
}

export function productReferenceLabel(product: Pick<WarehouseProduct, "name" | "sku">) {
  return product.sku ? `${product.name} · ${product.sku}` : product.name;
}

function dateInputValue(value: string | Date = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function normalizeLineForItemType(
  line: EditableWarehouseLine,
  itemType: EditableWarehouseLine["item_type"],
): EditableWarehouseLine {
  if (itemType === "expense" || itemType === "equipment")
    return {
      ...line,
      item_type: itemType,
      product_id: null,
      stock_delta: 0,
      destination: itemType,
    };
  return { ...line, item_type: itemType };
}

export function createLine(
  product?: WarehouseProduct,
  mode: WarehouseOperationMode = "purchase",
): EditableWarehouseLine {
  const revaluation = mode === "revaluation";
  const line = {
    key: lineKey(),
    product_id: product?.id ?? null,
    description: product?.name ?? "",
    item_type: product?.itemType ?? "resale",
    quantity: revaluation ? 0 : 1,
    unit_cost_cents: revaluation
      ? (product?.averageCostCents ?? 0)
      : (product?.lastCostCents ?? 0),
    discount_cents: 0,
    tax_rate_basis_points: revaluation ? 0 : 2200,
    stock_delta:
      mode === "waste" || mode === "issue"
        ? -1
        : mode === "adjustment"
          ? 1
          : mode === "purchase"
            ? 1
            : 0,
    destination: revaluation
      ? "revaluation"
      : mode === "waste"
        ? "waste"
        : mode === "issue"
          ? "internal_use"
          : "stock",
  } satisfies EditableWarehouseLine;
  return normalizeLineForItemType(line, line.item_type);
}

export function parsePastedRows(
  text: string,
  products: WarehouseProduct[],
  mode: WarehouseOperationMode,
) {
  const lines: EditableWarehouseLine[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const cells = raw.split("\t").map((cell) => cell.trim());
    if (!cells.some(Boolean)) return;
    const product = resolveProductReference(products, cells[0] ?? "");
    const quantity = Number(cells[1]);
    const cost = euroToCents(cells[2] ?? "");
    const tax =
      cells[3] === undefined || cells[3] === ""
        ? mode === "purchase"
          ? 2200
          : 0
        : percentToBasisPoints(cells[3]);
    if (!product) {
      errors.push({
        row: index + 1,
        message: "Articolo non trovato: usa SKU o nome esatto",
      });
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 0) {
      errors.push({ row: index + 1, message: "Quantità non valida" });
      return;
    }
    if (!Number.isInteger(cost) || cost < 0) {
      errors.push({ row: index + 1, message: "Costo non valido" });
      return;
    }
    if (!Number.isInteger(tax) || tax < 0 || tax > 10000) {
      errors.push({ row: index + 1, message: "IVA non valida" });
      return;
    }
    const line = createLine(product, mode);
    const sign = mode === "waste" || mode === "issue" ? -1 : 1;
    lines.push({
      ...line,
      quantity: mode === "revaluation" ? 0 : quantity,
      stock_delta: mode === "revaluation" ? 0 : sign * quantity,
      unit_cost_cents: cost,
      tax_rate_basis_points: mode === "purchase" ? tax : 0,
    });
  });
  return { lines, errors };
}

export function WarehouseOperationDialog({
  open,
  mode,
  products,
  suppliers,
  initialDocument,
  initialLines,
  startWithPaste = false,
  onClose,
  onSave,
}: {
  open: boolean;
  mode: WarehouseOperationMode;
  products: WarehouseProduct[];
  suppliers: WarehouseSupplier[];
  initialDocument?: WarehouseDocumentDetails;
  initialLines?: WarehouseProduct[];
  startWithPaste?: boolean;
  onClose(): void;
  onSave(
    input: WarehouseDocumentInput,
    post: boolean,
    documentId?: string,
  ): Promise<void>;
}) {
  const presentation = getOperationPresentation(mode);
  const [lines, setLines] = useState<EditableWarehouseLine[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [reference, setReference] = useState("");
  const [documentDate, setDocumentDate] = useState(() => dateInputValue());
  const [competenceDate, setCompetenceDate] = useState("");
  const [kind, setKind] = useState<WarehouseDocumentKind>(
    mode === "purchase" || mode === "issue"
      ? mode === "issue"
        ? "internal_use"
        : "purchase"
      : mode === "waste"
        ? "waste"
        : "adjustment",
  );
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [paste, setPaste] = useState("");
  const [pasteErrors, setPasteErrors] = useState<
    Array<{ row: number; message: string }>
  >([]);
  const [confirmPost, setConfirmPost] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lineErrors, setLineErrors] = useState<
    Record<string, Record<string, string>>
  >({});

  useEffect(() => {
    if (!open) return;
    const documentLines = initialDocument?.lines.map((line) => ({
      key: lineKey(),
      product_id: line.productId,
      description: line.description,
      item_type: line.itemType,
      quantity: line.quantity,
      unit_cost_cents: line.unitCostCents,
      discount_cents: line.discountCents,
      tax_rate_basis_points: line.taxRateBasisPoints,
      stock_delta: line.stockDelta,
      destination: line.destination ?? "",
    }));
    const selectedLines = initialLines?.map((product) =>
      createLine(product, mode),
    );
    setLines(
      documentLines?.length
        ? documentLines
        : selectedLines?.length
          ? selectedLines
          : [createLine(undefined, mode)],
    );
    setSupplierId(initialDocument?.supplierId ?? "");
    setReference(initialDocument?.externalReference ?? "");
    setDocumentDate(dateInputValue(initialDocument?.documentDate ?? new Date()));
    setCompetenceDate(initialDocument?.competenceDate ? dateInputValue(initialDocument.competenceDate) : "");
    setNotes(initialDocument?.notes ?? "");
    setReason("");
    setKind(
      initialDocument?.kind ??
        (mode === "purchase"
          ? "purchase"
          : mode === "issue"
            ? "internal_use"
            : mode === "waste"
              ? "waste"
              : "adjustment"),
    );
    setConfirmPost(false);
    setError("");
    setLineErrors({});
    setPasteErrors([]);
  }, [open, initialDocument, initialLines, mode]);

  const totals = useMemo(
    () =>
      lines.reduce(
        (result, line) => {
          const net = Math.max(
            0,
            line.quantity * line.unit_cost_cents - line.discount_cents,
          );
          result.net += net;
          result.tax += Math.round((net * line.tax_rate_basis_points) / 10000);
          return result;
        },
        { net: 0, tax: 0 },
      ),
    [lines],
  );
  const updateLine = (key: string, changes: Partial<EditableWarehouseLine>) =>
    setLines((current) =>
      current.map((line) =>
        line.key === key ? { ...line, ...changes } : line,
      ),
    );
  const updateQuantity = (line: EditableWarehouseLine, quantity: number) => {
    const sign =
      mode === "issue" || mode === "waste" || line.stock_delta < 0 ? -1 : 1;
    updateLine(line.key, {
      quantity,
      stock_delta:
        mode === "revaluation" ||
        line.item_type === "expense" ||
        line.item_type === "equipment"
          ? 0
          : sign * quantity,
    });
  };
  const selectProduct = (line: EditableWarehouseLine, value: string) => {
    const product = resolveProductReference(products, value);
    if (!product) {
      updateLine(line.key, { product_id: null, description: value });
      return;
    }
    const normalized = normalizeLineForItemType(
      {
        ...line,
        product_id: product.id,
        description: product.name,
        item_type: product.itemType,
        unit_cost_cents:
          mode === "revaluation"
            ? product.averageCostCents
            : product.lastCostCents,
      },
      product.itemType,
    );
    updateLine(line.key, normalized);
  };
  const addRowsFromPaste = () => {
    const result = parsePastedRows(paste, products, mode);
    setPasteErrors(result.errors);
    if (result.lines.length) {
      setLines((current) => [...current, ...result.lines]);
      setPaste("");
    }
  };
  const removeLine = (key: string) =>
    setLines((current) =>
      current.length > 1 ? current.filter((line) => line.key !== key) : current,
    );
  const save = async (post: boolean) => {
    const errors: Record<string, Record<string, string>> = {};
    if (
      (mode === "issue" || mode === "waste" || mode === "adjustment") &&
      !reason.trim()
    ) {
      setError(
        mode === "waste"
          ? "Seleziona la causa dello scarto."
          : "Indica la motivazione dell’operazione.",
      );
      setConfirmPost(false);
      return;
    }
    for (const line of lines) {
      if (!line.description.trim())
        errors[line.key] = { description: "Descrizione obbligatoria" };
      else if (mode === "revaluation" && !line.product_id)
        errors[line.key] = { product_id: "Seleziona un articolo" };
      else if (mode === "revaluation" && line.unit_cost_cents <= 0)
        errors[line.key] = {
          unit_cost_cents: "Inserisci il nuovo costo medio",
        };
      else if (line.stock_delta !== 0 && !line.product_id)
        errors[line.key] = {
          product_id: "Seleziona un articolo per modificare la scorta",
        };
    }
    if (Object.keys(errors).length) {
      setLineErrors(errors);
      setError("Controlla gli errori nelle righe.");
      setConfirmPost(false);
      return;
    }
    setSaving(true);
    setError("");
    setLineErrors({});
    try {
      const input: WarehouseDocumentInput = {
        kind,
        external_reference: reference || null,
        document_date: documentDate,
        competence_date: competenceDate || null,
        supplier_id: mode === "purchase" ? supplierId || null : null,
        notes: [reason, notes].filter(Boolean).join(" · ") || null,
        lines: lines.map((line) => ({
          description: line.description,
          item_type: line.item_type,
          product_id: line.product_id,
          quantity: mode === "revaluation" ? 0 : line.quantity,
          unit_cost_cents: line.unit_cost_cents,
          discount_cents: mode === "purchase" ? line.discount_cents : 0,
          tax_rate_basis_points:
            mode === "purchase" ? line.tax_rate_basis_points : 0,
          stock_delta: mode === "revaluation" ? 0 : line.stock_delta,
          destination:
            mode === "revaluation"
              ? "revaluation"
              : mode === "waste"
                ? `waste:${reason}`
                : mode === "issue"
                  ? `internal_use:${reason}`
                  : line.destination,
        })),
      };
      await onSave(input, post, initialDocument?.id);
    } catch (caught) {
      if (caught instanceof WarehouseApiError) {
        const body = caught.body as { error?: string };
        setLineErrors(mapWarehouseLineErrors(caught.body, lines));
        setError(
          body.error === "INVALID_DOCUMENT_LINES"
            ? "Documento non valido: correggi le righe."
            : "Documento non salvato. Riprova.",
        );
      } else setError("Documento non salvato. Controlla le righe e riprova.");
    } finally {
      setSaving(false);
      setConfirmPost(false);
    }
  };

  if (!open) return null;
  const units = lines.reduce((sum, line) => sum + Math.abs(line.quantity), 0);
  const valueImpact = lines.reduce((sum, line) => {
    const product = line.product_id
      ? products.find((item) => item.id === line.product_id)
      : undefined;
    return (
      sum +
      (mode === "revaluation" && product
        ? (line.unit_cost_cents - product.averageCostCents) *
          product.stockQuantity
        : mode === "waste"
          ? line.quantity * (product?.averageCostCents ?? 0)
          : 0)
    );
  }, 0);
  const effectSummary =
    mode === "purchase"
      ? `${units} unità in entrata · ${((totals.net + totals.tax) / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}`
      : mode === "issue"
        ? `${units} unità saranno sottratte dalla disponibilità`
        : mode === "waste"
          ? `${units} unità scartate · impatto ${(valueImpact / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}`
          : mode === "revaluation"
            ? `Giacenza invariata · valore ${valueImpact >= 0 ? "+" : "−"}${(Math.abs(valueImpact) / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}`
            : `Variazione netta ${lines.reduce((sum, line) => sum + line.stock_delta, 0)} unità`;
  const primaryLabel =
    mode === "purchase"
      ? "Registra carico"
      : mode === "issue"
        ? "Conferma scarico"
        : mode === "waste"
          ? "Registra scarto"
          : mode === "revaluation"
            ? "Applica rivalutazione"
            : "Applica rettifica";
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#2d1d27]/45 p-5 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <section
        aria-modal="true"
        className="relative flex h-[min(900px,calc(100vh-40px))] w-[min(1480px,calc(100vw-40px))] flex-col overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_30px_90px_rgb(45_29_39_/_0.28)]"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-4 border-b border-stone-200 bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className={`grid size-11 place-items-center rounded-xl ${presentation.accent}`}
            >
              {startWithPaste ? (
                <Upload className="size-5" />
              ) : (
                <OperationIcon mode={mode} />
              )}
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#8f3a68]">
                {startWithPaste ? "Importazione guidata" : presentation.eyebrow}
              </p>
              <h2 className="text-xl font-black text-[#402334]">
                {startWithPaste
                  ? "Importa carico da tabella"
                  : initialDocument
                    ? `Modifica · ${presentation.title}`
                    : presentation.title}
              </h2>
              <p className="mt-0.5 text-xs text-stone-500">
                {startWithPaste
                  ? "Prepara le righe, controlla gli abbinamenti e poi registra."
                  : presentation.description}
              </p>
            </div>
          </div>
          <button
            aria-label="Chiudi"
            className="grid size-9 place-items-center rounded-full text-stone-500 hover:bg-stone-100"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#fbfaf9] p-5">
          <div className={`mb-5 rounded-xl px-4 py-3 ${presentation.accent}`}>
            <p className="text-sm font-bold">{presentation.confirmation}</p>
          </div>
          {startWithPaste && (
            <div className="mb-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-[#ead1df] bg-white p-4">
                <h3 className="font-black text-[#792f59]">1. Incolla i dati</h3>
                <p className="mt-1 text-xs text-stone-500">
                  SKU o nome · quantità · costo in euro · IVA in percentuale
                </p>
                <textarea
                  aria-label="Righe da importare"
                  className="mt-3 min-h-36 w-full rounded-lg border border-stone-200 p-3 font-mono text-xs"
                  onChange={(event) => setPaste(event.target.value)}
                  placeholder={"CRM-01\t12\t4,50\t22"}
                  value={paste}
                />
                <Button
                  className="mt-3"
                  onClick={addRowsFromPaste}
                  size="sm"
                  variant="primary"
                >
                  <Upload className="size-4" />
                  Prepara anteprima
                </Button>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <h3 className="font-black text-[#402334]">
                  2. Verifica il carico
                </h3>
                <p className="mt-1 text-sm text-stone-500">
                  {lines.filter((line) => line.product_id).length} articoli
                  abbinati ·{" "}
                  {lines.reduce((sum, line) => sum + line.quantity, 0)} unità
                </p>
                {pasteErrors.length > 0 ? (
                  <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700">
                    {pasteErrors.map((item) => (
                      <p key={`${item.row}-${item.message}`}>
                        Riga {item.row}: {item.message}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-6 rounded-lg border border-dashed border-stone-300 p-5 text-center text-xs text-stone-500">
                    L’anteprima non modifica ancora il magazzino.
                  </p>
                )}
              </div>
            </div>
          )}
          <div
            className={`grid gap-3 ${mode === "purchase" ? "md:grid-cols-3 xl:grid-cols-6" : "md:grid-cols-3"}`}
          >
            {mode === "purchase" && (
              <>
                <label className="text-xs font-bold text-stone-600">
                  Tipo documento
                  <select
                    className="mt-1 min-h-10 w-full rounded-lg border border-stone-200 bg-white px-2 text-sm"
                    onChange={(event) =>
                      setKind(event.target.value as WarehouseDocumentKind)
                    }
                    value={kind}
                  >
                    <option value="purchase">Acquisto</option>
                    <option value="supplier_invoice">Fattura fornitore</option>
                    <option value="expense">Spesa</option>
                    <option value="equipment_purchase">Attrezzatura</option>
                  </select>
                </label>
                <label className="text-xs font-bold text-stone-600">
                  Riferimento documento
                  <input
                    className="mt-1 min-h-10 w-full rounded-lg border border-stone-200 px-2 text-sm"
                    onChange={(event) => setReference(event.target.value)}
                    placeholder="Fattura, DDT..."
                    value={reference}
                  />
                </label>
                <label className="text-xs font-bold text-stone-600">
                  Data documento
                  <input
                    className="mt-1 min-h-10 w-full rounded-lg border border-stone-200 px-2 text-sm"
                    onChange={(event) => setDocumentDate(event.target.value)}
                    required
                    type="date"
                    value={documentDate}
                  />
                </label>
                <label className="text-xs font-bold text-stone-600">
                  Data competenza
                  <input
                    className="mt-1 min-h-10 w-full rounded-lg border border-stone-200 px-2 text-sm"
                    onChange={(event) => setCompetenceDate(event.target.value)}
                    type="date"
                    value={competenceDate}
                  />
                </label>
                <label className="text-xs font-bold text-stone-600">
                  Fornitore
                  <select
                    className="mt-1 min-h-10 w-full rounded-lg border border-stone-200 bg-white px-2 text-sm"
                    onChange={(event) => setSupplierId(event.target.value)}
                    value={supplierId}
                  >
                    <option value="">Nessun fornitore</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {(mode === "issue" || mode === "adjustment") && (
              <label className="text-xs font-bold text-stone-600">
                Motivazione *
                <input
                  className="mt-1 min-h-10 w-full rounded-lg border border-stone-200 px-2 text-sm"
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={
                    mode === "issue"
                      ? "Uso cabina, tester, manutenzione..."
                      : "Correzione inventariale..."
                  }
                  value={reason}
                />
              </label>
            )}
            {mode === "waste" && (
              <label className="text-xs font-bold text-stone-600">
                Causa dello scarto *
                <select
                  className="mt-1 min-h-10 w-full rounded-lg border border-stone-200 bg-white px-2 text-sm"
                  onChange={(event) => setReason(event.target.value)}
                  value={reason}
                >
                  <option value="">Seleziona causa</option>
                  <option value="scadenza">Scadenza</option>
                  <option value="danneggiamento">Danneggiamento</option>
                  <option value="rottura">Rottura</option>
                  <option value="smarrimento">Smarrimento</option>
                  <option value="altro">Altro</option>
                </select>
              </label>
            )}
            <label className="text-xs font-bold text-stone-600">
              Nota operativa
              <input
                className="mt-1 min-h-10 w-full rounded-lg border border-stone-200 px-2 text-sm"
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Dettagli utili per lo storico"
                value={notes}
              />
            </label>
          </div>
          <datalist id="warehouse-products">
            {products.map((product) => (
              <option
                key={product.id}
                value={productReferenceLabel(product)}
              />
            ))}
          </datalist>
          <div className="mt-5 overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-[#faf3f7] text-left text-[10px] font-black uppercase tracking-[.1em] text-[#792f59]">
                <tr>
                  <th className="px-3 py-3">Articolo</th>
                  {mode === "purchase" && (
                    <>
                      <th className="w-32 px-3 py-3">Tipo</th>
                      <th className="w-24 px-3 py-3">Quantità</th>
                      <th className="w-28 px-3 py-3">Costo unit.</th>
                      <th className="w-24 px-3 py-3">Sconto</th>
                      <th className="w-24 px-3 py-3">IVA</th>
                    </>
                  )}
                  {(mode === "issue" || mode === "waste") && (
                    <>
                      <th className="w-28 px-3 py-3">Disponibile</th>
                      <th className="w-32 px-3 py-3">
                        Da {mode === "waste" ? "scartare" : "prelevare"}
                      </th>
                      {mode === "waste" && (
                        <th className="w-36 px-3 py-3">Impatto costo</th>
                      )}
                    </>
                  )}
                  {mode === "adjustment" && (
                    <>
                      <th className="w-28 px-3 py-3">Giacenza</th>
                      <th className="w-32 px-3 py-3">Direzione</th>
                      <th className="w-28 px-3 py-3">Quantità</th>
                      <th className="w-32 px-3 py-3">Costo unit.</th>
                    </>
                  )}
                  {mode === "revaluation" && (
                    <>
                      <th className="w-28 px-3 py-3">Giacenza</th>
                      <th className="w-32 px-3 py-3">Costo attuale</th>
                      <th className="w-32 px-3 py-3">Nuovo costo</th>
                      <th className="w-36 px-3 py-3">Impatto valore</th>
                    </>
                  )}
                  <th className="w-24 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const product = line.product_id
                    ? products.find((item) => item.id === line.product_id)
                    : undefined;
                  const impact =
                    mode === "revaluation" && product
                      ? (line.unit_cost_cents - product.averageCostCents) *
                        product.stockQuantity
                      : line.quantity * (product?.averageCostCents ?? 0);
                  return (
                    <tr
                      className="border-t border-stone-100 align-top"
                      key={line.key}
                    >
                      <td className="px-3 py-2">
                        <input
                          aria-invalid={Boolean(
                            lineErrors[line.key]?.description ||
                              lineErrors[line.key]?.product_id,
                          )}
                          list="warehouse-products"
                          className="min-h-10 w-full rounded-lg border border-stone-200 px-2"
                          onChange={(event) =>
                            selectProduct(line, event.target.value)
                          }
                          placeholder="Cerca per nome o SKU"
                          value={
                            line.product_id
                              ? (product?.name ?? line.description)
                              : line.description
                          }
                        />
                        {product?.sku && (
                          <p className="mt-1 text-xs text-stone-500">
                            {product.sku}
                          </p>
                        )}
                        {(lineErrors[line.key]?.description ||
                          lineErrors[line.key]?.product_id) && (
                          <p className="mt-1 text-xs font-semibold text-red-700">
                            {lineErrors[line.key]?.description ||
                              lineErrors[line.key]?.product_id}
                          </p>
                        )}
                      </td>
                      {mode === "purchase" && (
                        <>
                          <td className="px-3 py-2">
                            <select
                              className="min-h-10 w-full rounded-lg border border-stone-200 bg-white px-2"
                              disabled={Boolean(line.product_id)}
                              onChange={(event) =>
                                updateLine(
                                  line.key,
                                  normalizeLineForItemType(
                                    line,
                                    event.target
                                      .value as EditableWarehouseLine["item_type"],
                                  ),
                                )
                              }
                              value={line.item_type}
                            >
                              <option value="resale">Rivendita</option>
                              <option value="consumable">Consumo</option>
                              <option value="equipment">Attrezzatura</option>
                              <option value="expense">Spesa</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="min-h-10 w-full rounded-lg border border-stone-200 px-2"
                              min="0"
                              onChange={(event) =>
                                updateQuantity(
                                  line,
                                  Number(event.target.value) || 0,
                                )
                              }
                              type="number"
                              value={line.quantity}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="min-h-10 w-full rounded-lg border border-stone-200 px-2"
                              min="0"
                              step="0.01"
                              onChange={(event) =>
                                updateLine(line.key, {
                                  unit_cost_cents:
                                    euroToCents(event.target.value) || 0,
                                })
                              }
                              type="number"
                              value={line.unit_cost_cents / 100}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="min-h-10 w-full rounded-lg border border-stone-200 px-2"
                              min="0"
                              step="0.01"
                              onChange={(event) =>
                                updateLine(line.key, {
                                  discount_cents:
                                    euroToCents(event.target.value) || 0,
                                })
                              }
                              type="number"
                              value={line.discount_cents / 100}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="min-h-10 w-full rounded-lg border border-stone-200 px-2"
                              max="100"
                              min="0"
                              step="0.01"
                              onChange={(event) =>
                                updateLine(line.key, {
                                  tax_rate_basis_points:
                                    percentToBasisPoints(event.target.value) ||
                                    0,
                                })
                              }
                              type="number"
                              value={line.tax_rate_basis_points / 100}
                            />
                          </td>
                        </>
                      )}
                      {(mode === "issue" || mode === "waste") && (
                        <>
                          <td className="px-3 py-3">
                            <strong>{product?.stockQuantity ?? "—"}</strong>{" "}
                            {product?.unit ?? ""}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="min-h-10 w-full rounded-lg border border-stone-200 px-2"
                              max={product?.stockQuantity}
                              min="0"
                              onChange={(event) =>
                                updateQuantity(
                                  line,
                                  Number(event.target.value) || 0,
                                )
                              }
                              type="number"
                              value={line.quantity}
                            />
                          </td>
                          {mode === "waste" && (
                            <td className="px-3 py-3 font-bold text-rose-700">
                              {(impact / 100).toLocaleString("it-IT", {
                                style: "currency",
                                currency: "EUR",
                              })}
                            </td>
                          )}
                        </>
                      )}
                      {mode === "adjustment" && (
                        <>
                          <td className="px-3 py-3 font-bold">
                            {product?.stockQuantity ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              className="min-h-10 w-full rounded-lg border border-stone-200 bg-white px-2"
                              onChange={(event) =>
                                updateLine(line.key, {
                                  stock_delta:
                                    (event.target.value === "out" ? -1 : 1) *
                                    line.quantity,
                                })
                              }
                              value={line.stock_delta < 0 ? "out" : "in"}
                            >
                              <option value="in">Aumenta</option>
                              <option value="out">Diminuisci</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="min-h-10 w-full rounded-lg border border-stone-200 px-2"
                              min="0"
                              onChange={(event) =>
                                updateQuantity(
                                  line,
                                  Number(event.target.value) || 0,
                                )
                              }
                              type="number"
                              value={line.quantity}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="min-h-10 w-full rounded-lg border border-stone-200 px-2"
                              min="0"
                              step="0.01"
                              onChange={(event) =>
                                updateLine(line.key, {
                                  unit_cost_cents:
                                    euroToCents(event.target.value) || 0,
                                })
                              }
                              type="number"
                              value={line.unit_cost_cents / 100}
                            />
                          </td>
                        </>
                      )}
                      {mode === "revaluation" && (
                        <>
                          <td className="px-3 py-3 font-bold">
                            {product?.stockQuantity ?? "—"}
                          </td>
                          <td className="px-3 py-3">
                            {product
                              ? (product.averageCostCents / 100).toLocaleString(
                                  "it-IT",
                                  { style: "currency", currency: "EUR" },
                                )
                              : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              aria-invalid={Boolean(
                                lineErrors[line.key]?.unit_cost_cents,
                              )}
                              className="min-h-10 w-full rounded-lg border border-stone-200 px-2"
                              min="0"
                              step="0.01"
                              onChange={(event) =>
                                updateLine(line.key, {
                                  unit_cost_cents:
                                    euroToCents(event.target.value) || 0,
                                })
                              }
                              type="number"
                              value={line.unit_cost_cents / 100}
                            />
                          </td>
                          <td
                            className={`px-3 py-3 font-bold ${impact < 0 ? "text-rose-700" : "text-emerald-700"}`}
                          >
                            {product
                              ? `${impact >= 0 ? "+" : "−"}${(Math.abs(impact) / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}`
                              : "—"}
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <Button
                            aria-label="Duplica riga"
                            onClick={() =>
                              setLines((current) => [
                                ...current,
                                { ...line, key: lineKey() },
                              ])
                            }
                            size="sm"
                            variant="icon"
                          >
                            <Copy className="size-4" />
                          </Button>
                          <Button
                            aria-label="Rimuovi riga"
                            onClick={() => removeLine(line.key)}
                            size="sm"
                            variant="icon"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-start gap-3">
            <Button
              onClick={() =>
                setLines((current) => [...current, createLine(undefined, mode)])
              }
              size="sm"
              variant="secondary"
            >
              <Plus className="size-3.5" />
              Aggiungi articolo
            </Button>
            {mode === "purchase" && !startWithPaste && (
              <details className="rounded-lg border border-stone-200 bg-white px-3 py-2">
                <summary className="cursor-pointer text-sm font-bold text-[#792f59]">
                  Inserimento rapido righe
                </summary>
                <div className="mt-2 flex gap-2">
                  <textarea
                    className="min-h-20 min-w-[320px] rounded-md border border-stone-200 p-2 text-xs"
                    onChange={(event) => setPaste(event.target.value)}
                    placeholder="SKU o nome\tQuantità\tCosto €\tIVA %"
                    value={paste}
                  />
                  <Button
                    onClick={addRowsFromPaste}
                    size="sm"
                    variant="tableAction"
                  >
                    Inserisci
                  </Button>
                </div>
                {pasteErrors.length > 0 && (
                  <div
                    aria-live="polite"
                    className="mt-2 text-xs font-semibold text-red-700"
                  >
                    {pasteErrors.map((item) => (
                      <p key={`${item.row}-${item.message}`}>
                        Riga {item.row}: {item.message}
                      </p>
                    ))}
                  </div>
                )}
              </details>
            )}
          </div>
          {Object.entries(lineErrors).length > 0 && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              <p className="font-bold">Errori nelle righe</p>
              {Object.entries(lineErrors).map(([key, fields]) => (
                <ul className="mt-1 list-disc pl-4" key={key}>
                  {Object.entries(fields).map(([field, message]) => (
                    <li key={field}>
                      <span className="font-semibold">
                        {key} · {field}:
                      </span>{" "}
                      {message}
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          )}
          {error && (
            <div
              aria-live="polite"
              className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              role="alert"
            >
              <p>{error}</p>
            </div>
          )}
        </div>
        <footer className="sticky bottom-0 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-stone-200 bg-white px-5 py-3">
          <div className="text-sm">
            <span className="text-stone-500">Effetto previsto</span>
            <strong className="ml-2 text-[#402334]">{effectSummary}</strong>
          </div>
          <div className="flex gap-2">
            <Button
              disabled={saving}
              onClick={() => void save(false)}
              variant="outline"
            >
              Salva bozza
            </Button>
            <Button
              disabled={saving}
              onClick={() => setConfirmPost(true)}
              variant="primary"
            >
              {primaryLabel}
            </Button>
          </div>
        </footer>
        {confirmPost && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-[#2d1d27]/25 p-5">
            <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-xl">
              <div
                className={`mb-4 grid size-11 place-items-center rounded-xl ${presentation.accent}`}
              >
                <OperationIcon mode={mode} />
              </div>
              <h3 className="text-lg font-black text-[#402334]">
                Confermi: {presentation.title.toLocaleLowerCase("it-IT")}?
              </h3>
              <p className="mt-2 text-sm font-bold text-[#402334]">
                {effectSummary}
              </p>
              <p className="mt-2 text-xs text-stone-500">
                {presentation.confirmation}
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <Button onClick={() => setConfirmPost(false)} variant="outline">
                  Torna ai dati
                </Button>
                <Button
                  disabled={saving}
                  onClick={() => void save(true)}
                  variant="primary"
                >
                  Conferma operazione
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
