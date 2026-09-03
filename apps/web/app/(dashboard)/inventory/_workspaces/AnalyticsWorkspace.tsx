"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppPage, DateField, InlineError, PageHeader } from "@esse-beauty/ui";
import { useAuth } from "../../../../lib/auth-context";
import { WarehouseAnalytics } from "../_components/WarehouseAnalytics";
import { warehouseApi } from "../warehouse-api";
import type { WarehouseAnalyticsSummary, WarehouseReports } from "../warehouse-types";

const emptySummary: WarehouseAnalyticsSummary = {
  asset_value_cents: 0,
  draft_documents: 0,
  expense_total_cents: 0,
  low_stock_count: 0,
  purchase_total_cents: 0,
  stock_value_cents: 0,
  tracked_items: 0,
};

export function AnalyticsWorkspace() {
  const { salon } = useAuth();
  const salonId = salon?.id;
  const [reports, setReports] = useState<WarehouseReports>();
  const [summary, setSummary] = useState<WarehouseAnalyticsSummary>(emptySummary);
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
      const filters = { ...(dateFrom && { date_from: dateFrom }), ...(dateTo && { date_to: dateTo }) };
      const [nextSummary, nextReports] = await Promise.all([
        warehouseApi.getAnalyticsSummary(salonId, filters),
        warehouseApi.getReports(salonId, filters),
      ]);
      setSummary({ ...emptySummary, ...nextSummary });
      setReports(nextReports);
    } catch {
      setError("Analisi non disponibili.");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, salonId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageHeader
        actionsAlign="right"
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <DateField aria-label="Data iniziale analisi" onChange={setDateFrom} value={dateFrom} />
            <span className="text-xs font-bold text-stone-400">→</span>
            <DateField aria-label="Data finale analisi" min={dateFrom} onChange={setDateTo} value={dateTo} />
            <button aria-label="Aggiorna analisi" className="grid size-9 place-items-center rounded-xl border border-[#e8dfe4] bg-white text-stone-600 transition hover:border-[#792f59] hover:text-[#792f59] disabled:opacity-50" disabled={loading} onClick={() => void load()} title="Aggiorna" type="button"><RefreshCw size={15} /></button>
          </div>
        }
        eyebrow="Magazzino"
        subtitle="Valorizzazione, consumi, acquisti e scarti in un'unica vista analitica."
        title="Analisi"
      />
      {error && <InlineError className="mt-4">{error}</InlineError>}
      <div className="mt-4">
        {loading ? <div className="rounded-2xl border border-[#e8dfe4] bg-white px-4 py-8 text-center text-sm font-semibold text-stone-500">Caricamento analisi…</div> : <WarehouseAnalytics reports={reports} summary={summary} />}
      </div>
    </AppPage>
  );
}
