"use client";

import { ArchiveX, PackagePlus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppPage, Button, EmptyState, InlineError } from "@esse-beauty/ui";
import { useAuth } from "../../../../lib/auth-context";
import { Card } from "../_components/EnterpriseCard";
import { AssetDisposalDialog } from "../_components/AssetDisposalDialog";
import { AssetPurchaseDialog } from "../_components/AssetPurchaseDialog";
import { warehouseApi } from "../warehouse-api";
import type { WarehouseAsset, WarehouseSupplier } from "../warehouse-types";

const euro = (cents: number) => (cents / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" });
const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;

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

  const stats = useMemo(() => {
    const now = Date.now();
    const active = items.filter((asset) => asset.status === "active");
    const disposed = items.length - active.length;
    const expiringSoon = active.filter((asset) => {
      if (!asset.warrantyExpiresAt) return false;
      const delta = new Date(asset.warrantyExpiresAt).getTime() - now;
      return delta > 0 && delta <= SIX_MONTHS_MS;
    }).length;
    const inWarranty = active.filter((asset) => asset.warrantyExpiresAt && new Date(asset.warrantyExpiresAt).getTime() > now).length;
    return { active: active.length, disposed, expiringSoon, inWarranty };
  }, [items]);

  return (
    <AppPage maxWidth="max-w-[1400px]">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e8dfe4] pb-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#792f59]">Magazzino</p>
          <h1 className="mt-1 text-[26px] font-bold tracking-[-.02em] text-stone-950">Attrezzature</h1>
          <p className="mt-1 text-[13px] text-stone-500">Acquisti, posizione, garanzia e dismissione dei beni durevoli in dotazione al salone.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button aria-label="Aggiorna attrezzature" className="grid size-9 place-items-center rounded-xl border border-[#e8dfe4] bg-white text-stone-600 transition hover:border-[#792f59] hover:text-[#792f59] disabled:opacity-50" disabled={loading} onClick={() => void load()} title="Aggiorna" type="button"><RefreshCw size={15} /></button>
          <Button onClick={() => setPurchaseOpen(true)} variant="primary"><PackagePlus className="size-4" />Inserisci attrezzatura</Button>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-[#e8dfe4] bg-[#e8dfe4] sm:grid-cols-3">
        <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Attrezzature attive</span><strong className="mt-1 block text-xl font-bold tnum text-stone-950">{stats.active}</strong><span className="text-[11px] font-medium text-stone-400">{stats.disposed} dismesse</span></div>
        <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Valore storico</span><strong className="mt-1 block text-xl font-bold tnum text-stone-950">{euro(total)}</strong><span className="text-[11px] font-medium text-stone-400">costo d&apos;acquisto</span></div>
        <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">In garanzia</span><strong className="mt-1 block text-xl font-bold tnum text-stone-950">{stats.inWarranty}</strong><span className="text-[11px] font-medium text-stone-400">{stats.expiringSoon > 0 ? `${stats.expiringSoon} in scadenza entro 6 mesi` : "nessuna scadenza imminente"}</span></div>
      </div>

      <Card bodyClassName="p-0" className="mt-4" title="Registro attrezzature" subtitle="Beni durevoli separati da articoli, giacenze e movimenti stock.">
        {loading ? (
          <div className="p-8 text-center text-sm font-semibold text-stone-500">Caricamento attrezzature…</div>
        ) : items.length === 0 ? (
          <div className="p-4"><EmptyState description="Inserisci un'attrezzatura per seguirne posizione, garanzia e stato." title="Nessuna attrezzatura inserita" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.12em] text-stone-500">
                <tr><th className="px-5 py-3">Attrezzatura</th><th>Matricola</th><th>Posizione</th><th>Garanzia</th><th>Documento</th><th className="text-right">Costo</th><th className="w-12 pr-5" /></tr>
              </thead>
              <tbody>
                {items.map((asset) => {
                  const warrantyDate = asset.warrantyExpiresAt ? new Date(asset.warrantyExpiresAt) : null;
                  const warrantyExpired = warrantyDate ? warrantyDate.getTime() < Date.now() : false;
                  const warrantySoon = warrantyDate ? !warrantyExpired && warrantyDate.getTime() - Date.now() <= SIX_MONTHS_MS : false;
                  return (
                    <tr className="border-t border-stone-100 transition hover:bg-[#fffafd]" key={asset.id}>
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-stone-900">{asset.description}</div>
                        <div className="text-[11px] text-stone-400">{asset.status === "disposed" ? "Dismessa" : "Attiva"}</div>
                      </td>
                      <td className="tnum text-stone-600">{asset.serialNumber ?? "—"}</td>
                      <td className="text-stone-600">{asset.location ?? "—"}</td>
                      <td className={warrantyExpired ? "text-stone-400" : warrantySoon ? "font-bold text-[#a5691a]" : "text-stone-600"}>{warrantyDate ? (warrantyExpired ? "Scaduta" : `Scade ${warrantyDate.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}`) : "—"}</td>
                      <td className="text-stone-500">{asset.source_document_number ?? "—"}</td>
                      <td className="text-right font-black tnum text-[#402334]">{euro(asset.purchaseCostCents)}</td>
                      <td className="pr-5 text-right">
                        {asset.status === "active" && <button aria-label={`Dismetti ${asset.description}`} className="grid size-8 place-items-center rounded-lg text-stone-400 transition hover:bg-red-50 hover:text-red-700" onClick={() => setDisposing(asset)} title="Dismetti attrezzatura" type="button"><ArchiveX className="size-4" /></button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {error && <InlineError className="mt-4">{error}</InlineError>}
      <AssetPurchaseDialog onClose={() => setPurchaseOpen(false)} onSave={savePurchase} open={purchaseOpen} suppliers={suppliers} />
      <AssetDisposalDialog asset={disposing} onClose={() => setDisposing(undefined)} onSave={saveDisposal} />
    </AppPage>
  );
}
