"use client";

import { Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppPage, Button, ConfirmDialog, InlineError } from "@esse-beauty/ui";
import { useAuth } from "../../../../lib/auth-context";
import { WarehouseDocuments } from "../_components/WarehouseDocuments";
import { WarehouseDocumentViewer } from "../_components/WarehouseDocumentViewer";
import { WarehouseOperationDialog } from "../_components/WarehouseOperationDialog";
import { warehouseApi } from "../warehouse-api";
import { warehouseDocumentLabel } from "../document-label";
import type { WarehouseDocument, WarehouseDocumentDetails, WarehouseDocumentInput, WarehouseDocumentKind, WarehouseDocumentStatus, WarehouseProduct, WarehouseSupplier } from "../warehouse-types";

const euro = (cents: number) => (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

export function DocumentWorkspace() {
  const { salon } = useAuth();
  const salonId = salon?.id;
  const [documents, setDocuments] = useState<WarehouseDocument[]>([]);
  const [products, setProducts] = useState<WarehouseProduct[]>([]);
  const [suppliers, setSuppliers] = useState<WarehouseSupplier[]>([]);
  const [viewingDocument, setViewingDocument] = useState<WarehouseDocumentDetails>();
  const [editingDocument, setEditingDocument] = useState<WarehouseDocumentDetails>();
  const [operationOpen, setOperationOpen] = useState(false);
  const [status, setStatus] = useState<WarehouseDocumentStatus | "all">("all");
  const [kind, setKind] = useState<WarehouseDocumentKind | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmReverse, setConfirmReverse] = useState<WarehouseDocument>();
  const [reversing, setReversing] = useState(false);

  const load = useCallback(async () => {
    if (!salonId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [nextDocuments, nextProducts, nextSuppliers] = await Promise.all([
        warehouseApi.getDocuments(salonId, {
          ...(status !== "all" && { status }),
          ...(kind !== "all" && { kind }),
          ...(dateFrom && { date_from: dateFrom }),
          ...(dateTo && { date_to: dateTo }),
        }),
        warehouseApi.getProducts(salonId, { active: true }),
        warehouseApi.getSuppliers(salonId, { active: true }),
      ]);
      setDocuments(nextDocuments);
      setProducts(nextProducts);
      setSuppliers(nextSuppliers);
    } catch {
      setError("Documenti non disponibili.");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, kind, salonId, status]);

  useEffect(() => { void load(); }, [load]);

  const openDocument = async (documentId: string) => {
    if (!salonId) return;
    try {
      setViewingDocument(await warehouseApi.getDocument(salonId, documentId));
    } catch {
      setError("Documento non disponibile.");
    }
  };

  const reverseDocument = async () => {
    if (!salonId || !confirmReverse) return;
    setReversing(true);
    try {
      await warehouseApi.reverseDocument(salonId, confirmReverse.id);
      setConfirmReverse(undefined);
      await load();
    } catch {
      setError("Documento non stornato.");
    } finally {
      setReversing(false);
    }
  };

  const saveDocument = async (input: WarehouseDocumentInput, post: boolean, documentId?: string) => {
    if (!salonId) return;
    const saved = await warehouseApi.saveDocument(salonId, input, documentId);
    if (post) await warehouseApi.postDocument(salonId, saved.id);
    setOperationOpen(false);
    setEditingDocument(undefined);
    await load();
  };

  const kpis = useMemo(() => {
    const drafts = documents.filter((doc) => doc.status === "draft").length;
    const posted = documents.filter((doc) => doc.status === "posted");
    const reversed = documents.filter((doc) => doc.status === "reversed");
    const supplierIds = new Set(documents.map((doc) => doc.supplierId).filter(Boolean));
    return {
      drafts,
      posted: posted.length,
      postedTotal: posted.reduce((sum, doc) => sum + doc.totalCents, 0),
      reversed: reversed.length,
      reversedTotal: reversed.reduce((sum, doc) => sum + doc.totalCents, 0),
      suppliers: supplierIds.size,
    };
  }, [documents]);

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e8dfe4] pb-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#792f59]">Magazzino</p>
          <h1 className="mt-1 text-[26px] font-bold tracking-[-.02em] text-stone-950">Documenti</h1>
          <p className="mt-1 text-[13px] text-stone-500">Acquisti, rettifiche, scarti e note credito: il registro formale di tutti i movimenti.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button aria-label="Aggiorna documenti" className="grid size-9 place-items-center rounded-xl border border-[#e8dfe4] bg-white text-stone-600 transition hover:border-[#792f59] hover:text-[#792f59] disabled:opacity-50" disabled={loading} onClick={() => void load()} title="Aggiorna" type="button"><RefreshCw size={15} /></button>
          <Button onClick={() => setOperationOpen(true)} variant="primary"><Plus className="size-4" />Nuovo documento</Button>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[#e8dfe4] bg-[#e8dfe4] sm:grid-cols-4">
        <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Bozze</span><strong className="mt-1 block text-xl font-bold tnum text-stone-950">{kpis.drafts}</strong><span className="text-[11px] font-medium text-stone-400">da registrare</span></div>
        <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Registrati</span><strong className="mt-1 block text-xl font-bold tnum text-stone-950">{kpis.posted}</strong><span className="text-[11px] font-medium text-stone-400">{euro(kpis.postedTotal)} totali</span></div>
        <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Storni</span><strong className="mt-1 block text-xl font-bold tnum text-stone-950">{kpis.reversed}</strong><span className="text-[11px] font-medium text-stone-400">{euro(kpis.reversedTotal)} totali</span></div>
        <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Fornitori coinvolti</span><strong className="mt-1 block text-xl font-bold tnum text-stone-950">{kpis.suppliers}</strong><span className="text-[11px] font-medium text-stone-400">nel periodo</span></div>
      </div>

      {error && <InlineError className="mt-4">{error}</InlineError>}
      <div className="mt-4">
        <WarehouseDocuments
          dateFrom={dateFrom}
          dateTo={dateTo}
          documents={documents}
          error=""
          kind={kind}
          loading={loading}
          onDateFrom={setDateFrom}
          onDateTo={setDateTo}
          onKind={setKind}
          onOpen={(id) => void openDocument(id)}
          onReverse={(id) => setConfirmReverse(documents.find((doc) => doc.id === id))}
          onStatus={setStatus}
          status={status}
          suppliers={suppliers}
        />
      </div>
      <WarehouseOperationDialog
        initialDocument={editingDocument}
        initialLines={[]}
        mode="purchase"
        onClose={() => {
          setOperationOpen(false);
          setEditingDocument(undefined);
        }}
        onSave={saveDocument}
        open={operationOpen}
        products={products}
        suppliers={suppliers}
      />
      <WarehouseDocumentViewer
        document={viewingDocument}
        onClose={() => setViewingDocument(undefined)}
        onEdit={(document) => {
          setViewingDocument(undefined);
          setEditingDocument(document);
          setOperationOpen(true);
        }}
        suppliers={suppliers}
      />
      <ConfirmDialog
        confirmLabel={reversing ? "Storno in corso…" : "Storna"}
        destructive
        description="Verranno generati i movimenti di magazzino compensativi. L'operazione non è reversibile."
        onCancel={() => setConfirmReverse(undefined)}
        onConfirm={() => void reverseDocument()}
        open={Boolean(confirmReverse)}
        title={`Stornare ${confirmReverse ? warehouseDocumentLabel(confirmReverse) : "questo documento"}?`}
      />
    </AppPage>
  );
}
