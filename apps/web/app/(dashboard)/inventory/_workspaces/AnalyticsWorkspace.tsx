"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppPage, Button, DateField, FormField, InlineError, PageHeader } from "@esse-beauty/ui";
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
    <AppPage maxWidth="max-w-[1500px]">
      <PageHeader
        actions={<Button disabled={loading} onClick={() => void load()} size="sm" variant="outline"><RefreshCw className="size-4" />Aggiorna</Button>}
        eyebrow="Magazzino"
        subtitle="Valorizzazione scorte, acquisti, consumi, scarti e riepiloghi fornitori."
        title="Analisi"
      />
      <div className="mb-4 grid gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm sm:grid-cols-2 lg:max-w-2xl">
        <FormField label="Da">
          <DateField aria-label="Data iniziale analisi" onChange={setDateFrom} value={dateFrom} />
        </FormField>
        <FormField label="A">
          <DateField aria-label="Data finale analisi" min={dateFrom} onChange={setDateTo} value={dateTo} />
        </FormField>
      </div>
      {error && <InlineError className="mb-4">{error}</InlineError>}
      {loading ? <div className="rounded-xl border border-stone-200 bg-white px-4 py-8 text-center text-sm font-semibold text-stone-500">Caricamento analisi...</div> : <WarehouseAnalytics reports={reports} summary={summary} />}
    </AppPage>
  );
}
