"use client";

import { EmptyState, SectionCard, StatCard, StatGrid } from "@esse-beauty/ui";
import type { WarehouseAnalyticsSummary, WarehouseReports } from "../warehouse-types";

const euro = (cents: number) => (cents / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" });

export function WarehouseAnalytics({
  reports,
  summary,
}: {
  reports?: WarehouseReports;
  summary: WarehouseAnalyticsSummary;
}) {
  const valuationRows = reports?.valuation.rows ?? [];
  const supplierRows = reports?.suppliers.rows ?? [];

  return (
    <div className="space-y-4">
      <StatGrid>
        <StatCard detail="Articoli tracciati" label="Valore scorte" value={euro(summary.stock_value_cents)} />
        <StatCard detail="Documenti contabilizzati" label="Acquisti" value={euro(summary.purchase_total_cents)} />
        <StatCard detail="Costi operativi" label="Spese" value={euro(summary.expense_total_cents)} />
        <StatCard detail="Beni durevoli" label="Attrezzature" value={euro(summary.asset_value_cents)} />
      </StatGrid>
      <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <SectionCard title="Valorizzazione articoli" subtitle="Giacenza per costo medio, calcolata dal server.">
          {valuationRows.length === 0 ? (
            <EmptyState description="I prodotti tracciati compariranno qui dopo la prima contabilizzazione." title="Nessuna scorta valorizzata" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-[#faf3f7] text-left text-[10px] font-black uppercase tracking-[.11em] text-[#792f59]">
                  <tr><th className="px-3 py-2">Articolo</th><th className="px-3 py-2">Categoria</th><th className="px-3 py-2 text-right">Giacenza</th><th className="px-3 py-2 text-right">Costo medio</th><th className="px-3 py-2 text-right">Valore</th></tr>
                </thead>
                <tbody>{valuationRows.map((row) => <tr className="border-t border-stone-100" key={row.product_id}><td className="px-3 py-2 font-bold">{row.name}</td><td className="px-3 py-2 text-stone-600">{row.category ?? "-"}</td><td className="px-3 py-2 text-right">{row.stock_quantity}</td><td className="px-3 py-2 text-right">{euro(row.average_cost_cents)}</td><td className="px-3 py-2 text-right font-bold">{euro(row.value_cents)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </SectionCard>
        <SectionCard title="Fornitori" subtitle="Totale acquisti nel periodo filtrato.">
          {supplierRows.length === 0 ? (
            <EmptyState description="I totali fornitore saranno disponibili dopo i documenti di acquisto." title="Nessun totale fornitore" />
          ) : (
            <div className="space-y-2">
              {supplierRows.map((row) => <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 px-3 py-2" key={row.supplier_id ?? "none"}><span className="text-sm font-bold">{row.supplier_name}</span><span className="text-sm font-black">{euro(row.total_cents)}</span></div>)}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
