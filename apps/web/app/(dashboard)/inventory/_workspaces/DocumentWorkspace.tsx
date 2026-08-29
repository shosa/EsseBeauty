"use client";

import { FilePlus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppPage, Button, ExpandableAction, InlineError, PageHeader } from "@esse-beauty/ui";
import { useAuth } from "../../../../lib/auth-context";
import { WarehouseDocuments } from "../_components/WarehouseDocuments";
import { WarehouseDocumentViewer } from "../_components/WarehouseDocumentViewer";
import { WarehouseOperationDialog } from "../_components/WarehouseOperationDialog";
import { warehouseApi } from "../warehouse-api";
import type { WarehouseDocument, WarehouseDocumentDetails, WarehouseDocumentInput, WarehouseDocumentKind, WarehouseDocumentStatus, WarehouseProduct, WarehouseSupplier } from "../warehouse-types";

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

  const reverseDocument = async (documentId: string) => {
    if (!salonId || !window.confirm("Stornare questo documento?")) return;
    try {
      await warehouseApi.reverseDocument(salonId, documentId);
      await load();
    } catch {
      setError("Documento non stornato.");
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

  return (
    <AppPage maxWidth="max-w-[1500px]">
      <PageHeader
        actions={
          <>
            <ExpandableAction icon={FilePlus} label="Nuovo documento" onClick={() => setOperationOpen(true)} tone="emerald" />
            <Button disabled={loading} onClick={() => void load()} size="sm" variant="outline"><RefreshCw className="size-4" />Aggiorna</Button>
          </>
        }
        eyebrow="Magazzino"
        subtitle="Registro dei documenti di magazzino, bozze, contabilizzazioni e storni."
        title="Documenti"
      />
      {error && <InlineError className="mb-4">{error}</InlineError>}
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
        onReverse={(id) => void reverseDocument(id)}
        onStatus={setStatus}
        status={status}
        suppliers={suppliers}
      />
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
    </AppPage>
  );
}
