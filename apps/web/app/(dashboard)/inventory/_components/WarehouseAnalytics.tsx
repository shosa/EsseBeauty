"use client";

import { useState } from "react";
import { EmptyState } from "@esse-beauty/ui";
import { Card } from "./EnterpriseCard";
import type { WarehouseAnalyticsSummary, WarehouseReports } from "../warehouse-types";

const euro = (cents: number) => (cents / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" });

type ReportTab = "valorizzazione" | "consumi" | "acquisti" | "scarti";
const tabs: Array<{ key: ReportTab; label: string }> = [
  { key: "valorizzazione", label: "Valorizzazione" },
  { key: "consumi", label: "Consumi" },
  { key: "acquisti", label: "Acquisti" },
  { key: "scarti", label: "Scarti" },
];

export function WarehouseAnalytics({
  reports,
  summary,
}: {
  reports?: WarehouseReports;
  summary: WarehouseAnalyticsSummary;
}) {
  const [tab, setTab] = useState<ReportTab>("valorizzazione");
  const valuationRows = reports?.valuation.rows ?? [];
  const supplierRows = reports?.suppliers.rows ?? [];
  const consumptionRows = [...(reports?.consumption.rows ?? [])].sort((a, b) => b.value_cents - a.value_cents);
  const purchaseRows = [...(reports?.purchases.rows ?? [])].sort((a, b) => b.total_cents - a.total_cents);
  const wasteRows = [...(reports?.waste.rows ?? [])].sort((a, b) => b.value_cents - a.value_cents);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[#e8dfe4] bg-[#e8dfe4] sm:grid-cols-3 xl:grid-cols-6">
        <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Valore scorte</span><strong className="mt-1 block text-xl font-bold tnum text-stone-950">{euro(summary.stock_value_cents)}</strong><span className="text-[11px] font-medium text-stone-400">{summary.tracked_items} articoli</span></div>
        <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Consumi</span><strong className="mt-1 block text-xl font-bold tnum text-stone-950">{euro(reports?.consumption.total_cents ?? 0)}</strong><span className="text-[11px] font-medium text-stone-400">vendite + interno</span></div>
        <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Acquisti</span><strong className="mt-1 block text-xl font-bold tnum text-stone-950">{euro(summary.purchase_total_cents)}</strong><span className="text-[11px] font-medium text-stone-400">documenti registrati</span></div>
        <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Scarti</span><strong className="mt-1 block text-xl font-bold tnum text-[#b23a2e]">{euro(reports?.waste.total_cents ?? 0)}</strong><span className="text-[11px] font-medium text-stone-400">documenti registrati</span></div>
        <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Spese</span><strong className="mt-1 block text-xl font-bold tnum text-stone-950">{euro(summary.expense_total_cents)}</strong><span className="text-[11px] font-medium text-stone-400">costi operativi</span></div>
        <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Attrezzature</span><strong className="mt-1 block text-xl font-bold tnum text-stone-950">{euro(summary.asset_value_cents)}</strong><span className="text-[11px] font-medium text-stone-400">beni durevoli</span></div>
      </div>

      <nav className="inline-flex flex-wrap gap-0.5 rounded-xl border border-[#e8dfe4] bg-[#faf7f9] p-1">
        {tabs.map((item) => (
          <button className={`h-8 rounded-lg px-3.5 text-[12px] font-bold transition ${tab === item.key ? "bg-white text-[#792f59] shadow-sm" : "text-stone-500 hover:text-[#792f59]"}`} key={item.key} onClick={() => setTab(item.key)} type="button">{item.label}</button>
        ))}
      </nav>

      {tab === "valorizzazione" && (
        <Card bodyClassName="p-0" title="Valorizzazione articoli" subtitle="Giacenza per costo medio, calcolata dal server.">
          {valuationRows.length === 0 ? (
            <div className="p-4"><EmptyState description="I prodotti tracciati compariranno qui dopo la prima contabilizzazione." title="Nessuna scorta valorizzata" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.12em] text-stone-500">
                  <tr><th className="px-5 py-3">Articolo</th><th>Categoria</th><th className="text-right">Giacenza</th><th className="text-right">Costo medio</th><th className="text-right">Valore</th></tr>
                </thead>
                <tbody>{valuationRows.map((row) => <tr className="border-t border-stone-100" key={row.product_id}><td className="px-5 py-3.5 font-bold text-stone-900">{row.name}</td><td className="text-stone-600">{row.category ?? "—"}</td><td className="text-right tnum text-stone-600">{row.stock_quantity}</td><td className="text-right tnum text-stone-600">{euro(row.average_cost_cents)}</td><td className="text-right tnum font-black text-[#402334]">{euro(row.value_cents)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "consumi" && (
        <Card bodyClassName="p-0" title="Consumi — vendite e uso interno" subtitle="Include le vendite da cassa (e i relativi storni) e i documenti di consumo interno, non solo i movimenti di magazzino.">
          {consumptionRows.length === 0 ? (
            <div className="p-4"><EmptyState description="I consumi compariranno qui dopo le prime vendite o consumi interni del periodo." title="Nessun consumo registrato" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.12em] text-stone-500">
                  <tr><th className="px-5 py-3">Articolo</th><th className="text-right">Quantità</th><th className="text-right">Valore</th></tr>
                </thead>
                <tbody>{consumptionRows.map((row) => <tr className="border-t border-stone-100" key={row.product_id}><td className="px-5 py-3.5 font-bold text-stone-900">{row.name}</td><td className="text-right tnum text-stone-600">{row.quantity}</td><td className="text-right tnum font-black text-[#402334]">{euro(row.value_cents)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "acquisti" && (
        <div className="grid gap-3 xl:grid-cols-[1.2fr_.8fr]">
          <Card bodyClassName="p-0" title="Acquisti per articolo" subtitle="Righe dei documenti di acquisto registrati nel periodo.">
            {purchaseRows.length === 0 ? (
              <div className="p-4"><EmptyState description="Gli acquisti compariranno qui dopo la prima contabilizzazione." title="Nessun acquisto registrato" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.12em] text-stone-500">
                    <tr><th className="px-5 py-3">Articolo</th><th>Documento</th><th className="text-right">Quantità</th><th className="text-right">Totale</th></tr>
                  </thead>
                  <tbody>{purchaseRows.map((row, index) => <tr className="border-t border-stone-100" key={`${row.document_id}-${row.product_id ?? index}`}><td className="px-5 py-3.5 font-bold text-stone-900">{row.name}</td><td className="text-stone-500">{row.document_number}</td><td className="text-right tnum text-stone-600">{row.quantity}</td><td className="text-right tnum font-black text-[#402334]">{euro(row.total_cents)}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </Card>
          <Card bodyClassName="p-0" title="Fornitori" subtitle="Totale acquisti nel periodo filtrato.">
            {supplierRows.length === 0 ? (
              <div className="p-4"><EmptyState description="I totali fornitore saranno disponibili dopo i documenti di acquisto." title="Nessun totale fornitore" /></div>
            ) : (
              <div className="p-4">
                {supplierRows.map((row, index) => (
                  <div className="grid grid-cols-[8px_1fr_auto] items-center gap-2.5 border-t border-stone-100 py-2.5 text-sm first:border-t-0" key={row.supplier_id ?? "none"}>
                    <i className="size-2 rounded-full" style={{ background: ["#792f59", "#b8578a", "#c98a3f", "#3f7d6f", "#7a4fa0", "#57534e"][index % 6] }} />
                    <span className="font-semibold text-stone-600">{row.supplier_name}</span>
                    <strong className="tnum font-bold text-stone-800">{euro(row.total_cents)}</strong>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "scarti" && (
        <Card bodyClassName="p-0" title="Scarti registrati" subtitle="Prodotti dismessi per scadenza, danneggiamento o rottura.">
          {wasteRows.length === 0 ? (
            <div className="p-4"><EmptyState description="Gli scarti compariranno qui dopo la prima registrazione." title="Nessuno scarto registrato" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.12em] text-stone-500">
                  <tr><th className="px-5 py-3">Articolo</th><th className="text-right">Quantità</th><th className="text-right">Valore</th></tr>
                </thead>
                <tbody>{wasteRows.map((row) => <tr className="border-t border-stone-100" key={row.product_id}><td className="px-5 py-3.5 font-bold text-stone-900">{row.name}</td><td className="text-right tnum text-stone-600">{row.quantity}</td><td className="text-right tnum font-black text-[#b23a2e]">{euro(row.value_cents)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
