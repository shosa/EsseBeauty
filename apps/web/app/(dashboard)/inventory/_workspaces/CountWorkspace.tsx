"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppPage, InlineError } from "@esse-beauty/ui";
import { useAuth } from "../../../../lib/auth-context";
import { WarehouseCounts } from "../_components/WarehouseCounts";
import { warehouseApi } from "../warehouse-api";
import type { WarehouseCount, WarehouseProduct } from "../warehouse-types";

export function CountWorkspace() {
  const { salon } = useAuth();
  const salonId = salon?.id;
  const [counts, setCounts] = useState<WarehouseCount[]>([]);
  const [products, setProducts] = useState<WarehouseProduct[]>([]);
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
      const [nextCounts, nextProducts] = await Promise.all([
        warehouseApi.getCounts(salonId),
        warehouseApi.getProducts(salonId, { active: true }),
      ]);
      setCounts(nextCounts);
      setProducts(nextProducts);
    } catch {
      setError("Inventari non disponibili.");
    } finally {
      setLoading(false);
    }
  }, [salonId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e8dfe4] pb-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#792f59]">Magazzino</p>
          <h1 className="mt-1 text-[26px] font-bold tracking-[-.02em] text-stone-950">Inventario</h1>
          <p className="mt-1 text-[13px] text-stone-500">Sessioni di conteggio fisico, salvataggio bozze e riconciliazione delle giacenze.</p>
        </div>
        <button aria-label="Aggiorna inventari" className="grid size-9 place-items-center rounded-xl border border-[#e8dfe4] bg-white text-stone-600 transition hover:border-[#792f59] hover:text-[#792f59] disabled:opacity-50" disabled={loading} onClick={() => void load()} title="Aggiorna" type="button"><RefreshCw size={15} /></button>
      </header>
      {error && <InlineError className="mt-4">{error}</InlineError>}
      {loading ? (
        <div className="mt-4 rounded-2xl border border-[#e8dfe4] bg-white px-4 py-8 text-center text-sm font-semibold text-stone-500">Caricamento inventari…</div>
      ) : (
        <div className="mt-4"><WarehouseCounts counts={counts} onRefresh={load} products={products} salonId={salonId} /></div>
      )}
    </AppPage>
  );
}
