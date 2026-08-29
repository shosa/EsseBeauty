"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppPage, Button, InlineError, PageHeader } from "@esse-beauty/ui";
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
    <AppPage maxWidth="max-w-[1500px]">
      <PageHeader
        actions={<Button disabled={loading} onClick={() => void load()} size="sm" variant="outline"><RefreshCw className="size-4" />Aggiorna</Button>}
        eyebrow="Magazzino"
        subtitle="Sessioni di inventario fisico, salvataggio bozze e rettifiche finali."
        title="Inventario"
      />
      {error && <InlineError className="mb-4">{error}</InlineError>}
      {loading ? <div className="rounded-xl border border-stone-200 bg-white px-4 py-8 text-center text-sm font-semibold text-stone-500">Caricamento inventari...</div> : <WarehouseCounts counts={counts} onRefresh={load} products={products} salonId={salonId} />}
    </AppPage>
  );
}
