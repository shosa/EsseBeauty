"use client";

import { ArchiveX, PackagePlus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppPage, Button, EmptyState, ExpandableAction, InlineError, PageHeader, SectionCard, StatCard, StatGrid } from "@esse-beauty/ui";
import { useAuth } from "../../../../lib/auth-context";
import { AssetDisposalDialog } from "../_components/AssetDisposalDialog";
import { AssetPurchaseDialog } from "../_components/AssetPurchaseDialog";
import { warehouseApi } from "../warehouse-api";
import type { WarehouseAsset, WarehouseSupplier } from "../warehouse-types";

const euro = (cents: number) => (cents / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" });

export function AssetWorkspace() {
  const { salon } = useAuth();
  const salonId = salon?.id;
  const [items, setItems] = useState<WarehouseAsset[]>([]);
  const [suppliers, setSuppliers] = useState<WarehouseSupplier[]>([]);
  const [total, setTotal] = useState(0);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [disposing, setDisposing] = useState<WarehouseAsset>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!salonId) return;
    setLoading(true);
    setError("");
    try {
      const [assets, supplierRows] = await Promise.all([
        warehouseApi.getAssets(salonId),
        warehouseApi.getSuppliers(salonId, { active: true }),
      ]);
      setItems(assets.items);
      setTotal(assets.total_cents);
      setSuppliers(supplierRows);
    } catch {
      setError("Attrezzature non disponibili.");
    } finally {
      setLoading(false);
    }
  }, [salonId]);

  useEffect(() => { void load(); }, [load]);

  const savePurchase = async (input: unknown) => {
    if (!salonId) return;
    await warehouseApi.registerAsset(salonId, input);
    setPurchaseOpen(false);
    await load();
  };

  const saveDisposal = async (input: { disposed_at: string; reason: string }) => {
    if (!salonId || !disposing) return;
    await warehouseApi.disposeAsset(salonId, disposing.id, input);
    setDisposing(undefined);
    await load();
  };

  return (
    <AppPage maxWidth="max-w-[1400px]">
      <PageHeader
        actions={<><ExpandableAction icon={PackagePlus} label="Inserisci attrezzatura" onClick={() => setPurchaseOpen(true)} tone="indigo" /><Button disabled={loading} onClick={() => void load()} size="sm" variant="outline"><RefreshCw className="size-4" />Aggiorna</Button></>}
        eyebrow="Magazzino"
        subtitle="Acquisti, posizione, garanzia e dismissione delle attrezzature durevoli."
        title="Attrezzature"
      />
      {error && <InlineError className="mb-4">{error}</InlineError>}
      <StatGrid className="mb-4"><StatCard detail="Costo storico" label="Attrezzature" value={euro(total)} /></StatGrid>
      <SectionCard title="Registro attrezzature" subtitle="Beni durevoli separati da articoli, giacenze e movimenti stock.">
        {loading ? <div className="px-4 py-8 text-center text-sm text-stone-500">Caricamento attrezzature...</div> : items.length === 0 ? <EmptyState description="Inserisci un'attrezzatura per seguirne posizione, garanzia e stato." title="Nessuna attrezzatura inserita" /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-sm"><thead className="bg-[#faf3f7] text-left text-[10px] font-black uppercase tracking-[.11em] text-[#792f59]"><tr><th className="px-3 py-2">Attrezzatura</th><th className="px-3 py-2">Matricola</th><th className="px-3 py-2">Posizione</th><th className="px-3 py-2">Garanzia</th><th className="px-3 py-2">Documento</th><th className="px-3 py-2 text-right">Costo</th><th className="px-3 py-2" /></tr></thead><tbody>{items.map((asset) => <tr className="border-t border-stone-100" key={asset.id}><td className="px-3 py-2 font-bold">{asset.description}<div className="text-xs font-normal text-stone-500">{asset.status === "disposed" ? "Dismessa" : "Attiva"}</div></td><td className="px-3 py-2">{asset.serialNumber ?? "-"}</td><td className="px-3 py-2">{asset.location ?? "-"}</td><td className="px-3 py-2">{asset.warrantyExpiresAt ? new Date(asset.warrantyExpiresAt).toLocaleDateString("it-IT") : "-"}</td><td className="px-3 py-2">{asset.source_document_number ?? "-"}</td><td className="px-3 py-2 text-right font-bold">{euro(asset.purchaseCostCents)}</td><td className="px-3 py-2 text-right">{asset.status === "active" && <Button aria-label={`Dismetti ${asset.description}`} onClick={() => setDisposing(asset)} size="sm" variant="icon"><ArchiveX className="size-4" /></Button>}</td></tr>)}</tbody></table></div>
        )}
      </SectionCard>
      <AssetPurchaseDialog onClose={() => setPurchaseOpen(false)} onSave={savePurchase} open={purchaseOpen} suppliers={suppliers} />
      <AssetDisposalDialog asset={disposing} onClose={() => setDisposing(undefined)} onSave={saveDisposal} />
    </AppPage>
  );
}
