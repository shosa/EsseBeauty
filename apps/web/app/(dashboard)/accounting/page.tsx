"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download, FileText, RefreshCw, Search } from "lucide-react";
import { AppPage, Button, DateField, Drawer, EmptyState, FormField, InlineError, SectionCard } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
type Preset = "today" | "week" | "month" | "last";
type PaymentMethod = "cash" | "card" | "bank_transfer" | "voucher" | "other";
type CartItemType = "service" | "product" | "package" | "custom";
type Section = "overview" | "sales" | "expenses";

interface SaleRow { appointment_id?: string | null; closed_at: string; customer_name?: string | null; discount_cents: number; id: string; payment_methods: PaymentMethod[]; staff_name?: string | null; total_cents: number; }
interface SaleDetail {
  appointment_id?: string | null;
  cashier_name?: string | null;
  closed_at: string;
  customer_email?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  discount_cents: number;
  id: string;
  items: Array<{ description: string; discount_cents: number; id: string; item_type: CartItemType; quantity: number; total_cents: number; unit_price_cents: number }>;
  notes?: string | null;
  payments: Array<{ amount_cents: number; id: string; method: PaymentMethod; paid_at: string; reference?: string | null }>;
  staff_name?: string | null;
  subtotal_cents: number;
  total_cents: number;
}
interface SalesResponse {
  payments: Array<{ amount_cents: number; method: string }>;
  rows: SaleRow[];
  summary: { average_cents: number; count: number; discount_cents: number; total_cents: number; };
}
interface AccountingOverview {
  expenses: {
    categories: Array<{ category: string; count: number; total_cents: number }>;
    rows: Array<{ category: string; competence_date: string; description: string; document_number?: string | null; id: string; supplier_name?: string | null; total_cents: number }>;
    summary: { count: number; net_cents: number; tax_cents: number; total_cents: number };
  };
  summary: { expense_total_cents: number; gross_margin_cents: number; revenue_cents: number };
}

const methodLabels: Record<PaymentMethod, string> = {
  bank_transfer: "Bonifico",
  card: "Carta",
  cash: "Contanti",
  other: "Altro",
  voucher: "Voucher",
};
const presetLabels: Array<[Preset, string]> = [["today", "Oggi"], ["week", "Settimana"], ["month", "Mese"], ["last", "Mese scorso"]];
const paletteColors = ["#792f59", "#b8578a", "#c98a3f", "#3f7d6f", "#7a4fa0", "#57534e"];

function euro(cents: number) {
  return (cents / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" });
}

function inputDate(date: Date) { return date.toLocaleDateString("en-CA"); }

function presetRange(preset: Preset) {
  const now = new Date(); const from = new Date(now); const to = new Date(now);
  if (preset === "today") from.setHours(0, 0, 0, 0);
  if (preset === "week") { from.setDate(now.getDate() - ((now.getDay() + 6) % 7)); from.setHours(0, 0, 0, 0); }
  if (preset === "month") { from.setDate(1); from.setHours(0, 0, 0, 0); }
  if (preset === "last") { from.setMonth(now.getMonth() - 1, 1); from.setHours(0, 0, 0, 0); to.setDate(0); to.setHours(23, 59, 59, 999); }
  return { from: inputDate(from), to: inputDate(to) };
}

function requestRange(from: string, to: string) {
  return { from: new Date(`${from}T00:00:00`).toISOString(), to: new Date(`${to}T23:59:59.999`).toISOString() };
}

function periodLabel(preset: Preset | "custom", from: string, to: string) {
  if (preset === "today") return "Oggi";
  if (preset === "week") return "Questa settimana";
  if (preset === "month") return "Questo mese";
  if (preset === "last") return "Il mese scorso";
  return `${new Date(`${from}T00:00:00`).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })} – ${new Date(`${to}T00:00:00`).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}`;
}

const sections: Array<{ key: Section; label: string }> = [
  { key: "overview", label: "Panoramica" },
  { key: "sales", label: "Registro vendite" },
  { key: "expenses", label: "Spese" },
];

export default function AccountingPage() {
  const { salon } = useAuth();
  const [section, setSection] = useState<Section>("overview");
  const [preset, setPreset] = useState<Preset | "custom">("today");
  const initialRange = useMemo(() => presetRange("today"), []);
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"date" | "total">("date");
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | "all">("all");
  const [data, setData] = useState<SalesResponse>();
  const [overview, setOverview] = useState<AccountingOverview>();
  const [error, setError] = useState("");
  const [selectedSale, setSelectedSale] = useState<SaleDetail>();
  const [saleLoading, setSaleLoading] = useState(false);

  async function loadSales() {
    if (!salon) return;
    setError("");
    const query = new URLSearchParams(requestRange(fromDate, toDate));
    const [salesResponse, overviewResponse] = await Promise.all([
      fetch(`${api}/api/salons/${salon.id}/sales?${query}`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/accounting/overview?${query}`, { credentials: "include" }),
    ]);
    if (!salesResponse.ok || !overviewResponse.ok) return setError(salesResponse.status === 403 || overviewResponse.status === 403 ? "Non hai accesso alla contabilita gestionale." : "Movimenti non disponibili.");
    setData(await salesResponse.json() as SalesResponse);
    setOverview(await overviewResponse.json() as AccountingOverview);
  }

  async function openSale(saleId: string) {
    if (!salon) return;
    setSaleLoading(true);
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/sales/${saleId}`, { credentials: "include" });
    if (!response.ok) {
      setError("Dettaglio vendita non disponibile.");
      setSaleLoading(false);
      return;
    }
    setSelectedSale(await response.json() as SaleDetail);
    setSaleLoading(false);
  }

  useEffect(() => { void loadSales(); }, [fromDate, salon?.id, toDate]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("it-IT");
    return [...(data?.rows ?? [])]
      .filter((row) => !needle || `${row.customer_name ?? ""} ${row.staff_name ?? ""}`.toLocaleLowerCase("it-IT").includes(needle))
      .filter((row) => paymentFilter === "all" || row.payment_methods.includes(paymentFilter))
      .sort((a, b) => sort === "total" ? b.total_cents - a.total_cents : new Date(b.closed_at).getTime() - new Date(a.closed_at).getTime());
  }, [data?.rows, paymentFilter, search, sort]);
  const dailyTotals = useMemo(() => {
    const values = new Map<string, number>();
    for (const row of data?.rows ?? []) {
      const key = new Date(row.closed_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
      values.set(key, (values.get(key) ?? 0) + row.total_cents);
    }
    return [...values.entries()].slice(-10);
  }, [data?.rows]);
  const maxDaily = Math.max(1, ...dailyTotals.map(([, value]) => value));
  const activeDays = Math.max(1, dailyTotals.length);
  const bestDay = [...dailyTotals].sort((a, b) => b[1] - a[1])[0];
  const discountRate = data?.summary.total_cents ? Math.round(data.summary.discount_cents / (data.summary.total_cents + data.summary.discount_cents) * 100) : 0;
  const operatorTotals = useMemo(() => {
    const totals = new Map<string, { count: number; total: number }>();
    for (const row of data?.rows ?? []) { const name = row.staff_name || "Non assegnato"; const current = totals.get(name) ?? { count: 0, total: 0 }; totals.set(name, { count: current.count + 1, total: current.total + row.total_cents }); }
    return [...totals.entries()].map(([name, value]) => ({ name, ...value })).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [data?.rows]);
  const customerTotals = useMemo(() => {
    const totals = new Map<string, { count: number; total: number }>();
    for (const row of data?.rows ?? []) { const name = row.customer_name || "Cliente occasionale"; const current = totals.get(name) ?? { count: 0, total: 0 }; totals.set(name, { count: current.count + 1, total: current.total + row.total_cents }); }
    return [...totals.entries()].map(([name, value]) => ({ name, ...value })).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [data?.rows]);
  const paymentTotal = (data?.payments ?? []).reduce((sum, item) => sum + item.amount_cents, 0);
  let paymentCursor = 0;
  const paymentSegments = (data?.payments ?? []).map((item, index) => { const start = paymentCursor; paymentCursor += paymentTotal ? item.amount_cents / paymentTotal * 100 : 0; return `${paletteColors[index % paletteColors.length]} ${start}% ${paymentCursor}%`; });
  const paymentDonut = paymentSegments.length ? `conic-gradient(${paymentSegments.join(",")})` : "#f1e9ee";

  function exportRegister() {
    if (!salon) return;
    window.location.href = `${api}/api/salons/${salon.id}/sales/export?${new URLSearchParams(requestRange(fromDate, toDate))}`;
  }

  function exportPdf() {
    if (!salon) return;
    window.location.href = `${api}/api/salons/${salon.id}/accounting/report.pdf?${new URLSearchParams(requestRange(fromDate, toDate))}`;
  }

  function selectPreset(value: Preset) {
    const next = presetRange(value);
    setPreset(value);
    setFromDate(next.from);
    setToDate(next.to);
  }

  const filtersActive = Boolean(search || paymentFilter !== "all");

  function resetFilters() {
    setSearch("");
    setPaymentFilter("all");
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      {/* Hero: the report cover — headline figure, quick range, at-a-glance secondary metrics. */}
      <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#3a1830,#5f2447_58%,#792f59)] p-6 text-white shadow-[0_20px_50px_rgb(45_29_39_/_0.28)] md:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-white/[.05]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/3 size-72 rounded-full bg-white/[.04]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.22em] text-[#e8bfd4]">Amministrazione · Contabilità</p>
            <p className="mt-2 text-sm font-semibold text-[#d9c3d0]">{periodLabel(preset, fromDate, toDate)}</p>
            <strong className="font-display mt-1 block text-5xl leading-none tracking-[-.02em] md:text-6xl">{euro(data?.summary.total_cents ?? 0)}</strong>
            <p className="mt-2 text-sm text-[#d9c3d0]">Incassato · {data?.summary.count ?? 0} vendite su {activeDays} giorni attivi</p>
          </div>
          <div className="flex items-center gap-2">
            <button aria-label="Aggiorna contabilità" className="grid size-10 place-items-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20" onClick={() => void loadSales()} title="Aggiorna"><RefreshCw size={16} /></button>
            <button className="flex h-10 items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 text-sm font-bold text-white transition hover:bg-white/20" onClick={exportPdf} type="button"><FileText size={16} />PDF</button>
            <button className="flex h-10 items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 text-sm font-bold text-white transition hover:bg-white/20" onClick={exportRegister} type="button"><Download size={16} />Excel</button>
          </div>
        </div>

        <div className="relative mt-6 flex flex-wrap gap-1.5">
          {presetLabels.map(([value, label]) => (
            <button className={`h-9 rounded-full px-4 text-sm font-bold transition ${preset === value ? "bg-white text-[#5f2447]" : "border border-white/20 bg-white/5 text-white hover:bg-white/15"}`} key={value} onClick={() => selectPreset(value)} type="button">{label}</button>
          ))}
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            ["Margine", euro(overview?.summary.gross_margin_cents ?? 0)],
            ["Spese", euro(overview?.summary.expense_total_cents ?? 0)],
            ["Scontrino medio", euro(data?.summary.average_cents ?? 0)],
            ["Sconti", `${euro(data?.summary.discount_cents ?? 0)} · ${discountRate}%`],
            ["Vendite/giorno", String(Math.round((data?.summary.count ?? 0) / activeDays))],
          ].map(([label, value]) => (
            <div className="rounded-xl border border-white/10 bg-white/[.07] px-4 py-3" key={label}>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#e8bfd4]">{label}</span>
              <strong className="mt-1 block text-lg font-bold tracking-[-.01em]">{value}</strong>
            </div>
          ))}
        </div>
      </section>

      {error && <InlineError className="mt-4">{error}</InlineError>}
      {saleLoading && <div className="mt-4 rounded-xl border border-[#e8dfe4] bg-[#fffafd] px-4 py-3 text-sm font-bold text-[#792f59]">Caricamento dettaglio vendita…</div>}

      {/* Toolbar: precise range, per-section navigation — the workspace switches focus instead of stacking everything. */}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[#e8dfe4] bg-white p-2 shadow-[0_10px_30px_rgb(45_29_39_/_0.05)]">
        <nav aria-label="Sezione contabilità" className="inline-flex flex-wrap gap-1 rounded-xl bg-[#faf3f7] p-1">
          {sections.map((item) => (
            <button aria-current={section === item.key ? "page" : undefined} className={`h-9 rounded-lg px-4 text-sm font-bold transition ${section === item.key ? "bg-[#792f59] text-white shadow-sm" : "text-stone-600 hover:bg-white hover:text-[#792f59]"}`} key={item.key} onClick={() => setSection(item.key)} type="button">
              {item.label}
              {item.key === "sales" && <span className={`ml-1.5 text-xs ${section === item.key ? "text-[#ead1df]" : "text-stone-400"}`}>{filteredRows.length}</span>}
              {item.key === "expenses" && <span className={`ml-1.5 text-xs ${section === item.key ? "text-[#ead1df]" : "text-stone-400"}`}>{overview?.expenses.rows.length ?? 0}</span>}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex flex-wrap items-end gap-3">
          <FormField className="w-36" label="Dal"><DateField aria-label="Data iniziale" max={toDate} onChange={(value) => { if (value) { setPreset("custom"); setFromDate(value); } }} value={fromDate} /></FormField>
          <FormField className="w-36" label="Al"><DateField aria-label="Data finale" min={fromDate} onChange={(value) => { if (value) { setPreset("custom"); setToDate(value); } }} value={toDate} /></FormField>
        </div>
      </div>

      {section === "overview" && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 xl:grid-cols-[1.45fr_.75fr]">
            <SectionCard title="Andamento incassi" subtitle="Totale giornaliero delle vendite concluse nel periodo.">
              {!dailyTotals.length ? <EmptyState title="Nessun incasso" description="Non ci sono movimenti nel periodo." /> : (
                <div className="flex h-56 items-end gap-2 border-b border-[#e8dfe4] px-2 pt-6">
                  {dailyTotals.map(([day, value]) => (
                    <div className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5" key={day}>
                      <strong className="text-[10px] font-bold text-stone-500 group-hover:text-[#792f59]">{euro(value)}</strong>
                      <div className="w-3/5 min-w-5 max-w-12 rounded-t-md bg-[linear-gradient(180deg,#b8578a,#792f59)] transition group-hover:opacity-90" style={{ height: `${Math.max(8, value / maxDaily * 155)}px` }} />
                      <span className="text-[10px] font-semibold text-stone-400">{day}</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
            <SectionCard title="Metodi di pagamento" subtitle="Distribuzione degli incassi registrati.">
              {data?.payments.length ? (
                <div className="grid grid-cols-[110px_1fr] items-center gap-4">
                  <div className="relative aspect-square rounded-full" style={{ background: paymentDonut }}>
                    <div className="absolute inset-[26%] grid place-items-center rounded-full bg-white text-center shadow-[inset_0_0_0_1px_rgb(232_223_228)]"><strong className="text-sm font-bold text-[#402334]">{euro(paymentTotal)}</strong></div>
                  </div>
                  <div className="space-y-2.5">
                    {data.payments.map((item, index) => (
                      <div className="grid grid-cols-[8px_1fr_auto] items-center gap-2.5 text-xs" key={item.method}>
                        <i className="size-2 rounded-full" style={{ background: paletteColors[index % paletteColors.length] }} />
                        <span className="font-semibold text-stone-600">{methodLabels[item.method as PaymentMethod] ?? item.method}</span>
                        <strong className="font-bold text-[#402334]">{euro(item.amount_cents)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <EmptyState title="Nessun incasso" description="Non ci sono pagamenti nel periodo." />}
            </SectionCard>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <SectionCard title="Migliori operatori" subtitle={`Giornata migliore: ${bestDay?.[0] ?? "—"}${bestDay ? ` · ${euro(bestDay[1])}` : ""}`}>
              {!operatorTotals.length ? <EmptyState title="Nessun dato" description="Non ci sono vendite nel periodo." /> : (
                <div className="overflow-hidden rounded-xl border border-[#e8dfe4]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.12em] text-stone-500"><tr><th className="px-4 py-2.5">#</th><th>Operatore</th><th>Vendite</th><th className="pr-4 text-right">Incassato</th></tr></thead>
                    <tbody>{operatorTotals.map((item, index) => <tr className="border-t border-stone-100" key={item.name}><td className="px-4 py-2.5"><span className="grid size-6 place-items-center rounded-full bg-[#f8edf3] text-[11px] font-black text-[#792f59]">{index + 1}</span></td><td className="font-bold text-stone-800">{item.name}</td><td className="text-stone-500">{item.count}</td><td className="pr-4 text-right font-bold text-[#402334]">{euro(item.total)}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </SectionCard>
            <SectionCard title="Clienti per valore" subtitle="Classifica per incasso nel periodo selezionato.">
              {!customerTotals.length ? <EmptyState title="Nessun dato" description="Non ci sono vendite nel periodo." /> : (
                <div className="overflow-hidden rounded-xl border border-[#e8dfe4]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.12em] text-stone-500"><tr><th className="px-4 py-2.5">#</th><th>Cliente</th><th>Acquisti</th><th className="pr-4 text-right">Valore</th></tr></thead>
                    <tbody>{customerTotals.map((item, index) => <tr className="border-t border-stone-100" key={item.name}><td className="px-4 py-2.5"><span className="grid size-6 place-items-center rounded-full bg-[#f8edf3] text-[11px] font-black text-[#792f59]">{index + 1}</span></td><td className="font-bold text-stone-800">{item.name}</td><td className="text-stone-500">{item.count}</td><td className="pr-4 text-right font-bold text-[#402334]">{euro(item.total)}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {section === "sales" && (
        <SectionCard className="mt-4" title="Registro vendite" subtitle={`${filteredRows.length} movimenti visibili nel periodo selezionato.`}>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="relative min-w-[240px] flex-1">
              <span className="sr-only">Cerca cliente o operatore</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
              <input className="w-full pl-10" onChange={(event) => setSearch(event.target.value)} placeholder="Cerca cliente o operatore" value={search} />
            </label>
            <select className="w-[190px]" onChange={(event) => setPaymentFilter(event.target.value as PaymentMethod | "all")} value={paymentFilter}><option value="all">Tutti i pagamenti</option>{Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select className="w-[190px]" onChange={(event) => setSort(event.target.value as "date" | "total")} value={sort}><option value="date">Più recenti</option><option value="total">Totale più alto</option></select>
            {filtersActive && <Button onClick={resetFilters} size="sm" variant="outline">Azzera filtri</Button>}
          </div>
          {!filteredRows.length ? <EmptyState title="Nessun movimento" description="Modifica la ricerca, i filtri o il periodo selezionato." /> : (
            <div className="overflow-x-auto rounded-2xl border border-[#e8dfe4]">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.14em] text-stone-500"><tr><th className="px-5 py-3">Data</th><th>Cliente</th><th>Operatore</th><th>Pagamento</th><th>Sconto</th><th className="text-right">Totale</th><th className="w-8 pr-5" /></tr></thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr
                      className="group cursor-pointer border-t border-stone-100 transition hover:bg-[#fffafd] focus-visible:bg-[#fffafd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#b85888]"
                      key={row.id}
                      onClick={() => void openSale(row.id)}
                      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void openSale(row.id); } }}
                      tabIndex={0}
                    >
                      <td className="px-5 py-3.5 text-stone-500">{new Date(row.closed_at).toLocaleString("it-IT")}</td>
                      <td className="font-bold text-stone-900 group-hover:text-[#792f59]">{row.customer_name || "Cliente occasionale"}</td>
                      <td className="text-stone-600">{row.staff_name || "—"}</td>
                      <td><div className="flex flex-wrap gap-1">{row.payment_methods.map((method) => <span className="rounded-full bg-[#f8edf3] px-2 py-1 text-[10px] font-bold text-[#792f59]" key={method}>{methodLabels[method]}</span>)}</div></td>
                      <td className="text-stone-500">{euro(row.discount_cents)}</td>
                      <td className="text-right text-base font-black text-[#402334]">{euro(row.total_cents)}</td>
                      <td className="pr-5 text-right text-[11px] font-bold text-[#792f59]">Dettaglio</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {section === "expenses" && (
        <div className="mt-4 grid gap-3 xl:grid-cols-[.8fr_1.2fr]">
          <SectionCard title="Spese per categoria" subtitle="Uscite operative registrate dal magazzino nel periodo.">
            {!overview?.expenses.categories.length ? <EmptyState title="Nessuna spesa" description="Non ci sono uscite operative nel periodo selezionato." /> : (
              <div className="space-y-3.5">
                {overview.expenses.categories.map((item, index) => {
                  const width = overview.expenses.summary.total_cents ? Math.max(6, item.total_cents / overview.expenses.summary.total_cents * 100) : 0;
                  return (
                    <div key={item.category}>
                      <div className="flex justify-between gap-3 text-xs"><strong className="font-bold text-stone-700">{item.category}</strong><span className="font-semibold text-stone-500">{euro(item.total_cents)} · {item.count}</span></div>
                      <div className="mt-1.5 h-2 rounded-full bg-[#f1e9ee]"><div className="h-full rounded-full" style={{ background: paletteColors[index % paletteColors.length], width: `${width}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
          <SectionCard title="Registro spese" subtitle={`${overview?.expenses.rows.length ?? 0} uscite nel periodo selezionato.`}>
            {!overview?.expenses.rows.length ? <EmptyState title="Nessuna uscita" description="Le spese registrate compariranno qui insieme al documento sorgente." /> : (
              <div className="overflow-x-auto rounded-xl border border-[#e8dfe4]">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.12em] text-stone-500"><tr><th className="px-4 py-3">Data</th><th>Descrizione</th><th>Categoria</th><th>Fornitore</th><th>Documento</th><th className="pr-4 text-right">Totale</th></tr></thead>
                  <tbody>{overview.expenses.rows.slice(0, 12).map((expense) => <tr className="border-t border-stone-100" key={expense.id}><td className="px-4 py-3 text-stone-500">{new Date(expense.competence_date).toLocaleDateString("it-IT")}</td><td className="font-bold text-stone-800">{expense.description}</td><td className="text-stone-600">{expense.category}</td><td className="text-stone-600">{expense.supplier_name ?? "—"}</td><td className="text-stone-500">{expense.document_number ?? "—"}</td><td className="pr-4 text-right font-black text-[#402334]">{euro(expense.total_cents)}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      <Drawer onClose={() => setSelectedSale(undefined)} open={Boolean(selectedSale)} title="Dettaglio vendita">
        {selectedSale && <div className="space-y-5">
          <section className="rounded-2xl bg-[#402334] p-5 text-white">
            <p className="text-xs font-black uppercase tracking-[.16em] text-[#e8bfd4]">Incasso registrato</p>
            <strong className="mt-2 block text-4xl">{euro(selectedSale.total_cents)}</strong>
            <p className="mt-2 text-sm text-[#d9c3d0]">{new Date(selectedSale.closed_at).toLocaleString("it-IT")}</p>
          </section>
          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#e8dfe4] p-3"><span className="text-[10px] font-black uppercase text-stone-400">Cliente</span><strong className="mt-1 block text-stone-900">{selectedSale.customer_name || "Cliente occasionale"}</strong></div>
            <div className="rounded-xl border border-[#e8dfe4] p-3"><span className="text-[10px] font-black uppercase text-stone-400">Operatore</span><strong className="mt-1 block text-stone-900">{selectedSale.staff_name || "Non assegnato"}</strong></div>
            <div className="rounded-xl border border-[#e8dfe4] p-3"><span className="text-[10px] font-black uppercase text-stone-400">Registrata da</span><strong className="mt-1 block text-stone-900">{selectedSale.cashier_name || "Sistema"}</strong></div>
            <div className="rounded-xl border border-[#e8dfe4] p-3"><span className="text-[10px] font-black uppercase text-stone-400">Origine</span><strong className="mt-1 block text-stone-900">{selectedSale.appointment_id ? "Appuntamento" : "Vendita libera"}</strong></div>
          </section>
          <section>
            <h3 className="font-black text-stone-900">Cosa è stato venduto</h3>
            <div className="mt-3 space-y-2">
              {selectedSale.items.map((item) => <article className="rounded-2xl border border-[#e8dfe4] p-4" key={item.id}>
                <div className="flex items-start justify-between gap-3"><div><strong className="text-stone-900">{item.description}</strong><p className="mt-1 text-xs font-semibold uppercase tracking-wide text-stone-400">{item.item_type === "service" ? "Servizio" : item.item_type === "product" ? "Prodotto" : "Voce libera"}</p></div><strong className="text-stone-900">{euro(item.total_cents)}</strong></div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-500"><span>Quantità: {item.quantity}</span><span>Prezzo: {euro(item.unit_price_cents)}</span>{item.discount_cents > 0 && <span>Sconto: {euro(item.discount_cents)}</span>}</div>
              </article>)}
            </div>
          </section>
          <section className="rounded-2xl border border-[#e8dfe4] p-4">
            <div className="flex justify-between text-sm text-stone-600"><span>Subtotale</span><strong className="text-stone-900">{euro(selectedSale.subtotal_cents)}</strong></div>
            {selectedSale.discount_cents > 0 && <div className="mt-2 flex justify-between text-sm text-stone-500"><span>Sconto conto</span><strong>- {euro(selectedSale.discount_cents)}</strong></div>}
            <div className="mt-4 flex justify-between border-t border-[#e8dfe4] pt-4 text-lg"><strong>Totale</strong><strong className="text-[#792f59]">{euro(selectedSale.total_cents)}</strong></div>
          </section>
          <section>
            <h3 className="font-black text-stone-900">Pagamenti</h3>
            <div className="mt-3 space-y-2">{selectedSale.payments.map((payment) => <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900" key={payment.id}>
              <div><strong>{methodLabels[payment.method] ?? payment.method}</strong>{payment.method === "voucher" && payment.reference && <span className="mt-1 block font-mono text-[11px] tracking-[.1em]">{payment.reference.replace(/(\d{4})(?=\d)/g, "$1 ")}</span>}</div>
              <strong>{euro(payment.amount_cents)}</strong>
            </div>)}</div>
          </section>
          {selectedSale.notes && <section className="rounded-2xl bg-amber-50 p-4"><p className="text-xs font-black uppercase text-amber-800">Nota interna</p><p className="mt-2 text-sm text-amber-950">{selectedSale.notes}</p></section>}
          <div className="flex flex-wrap gap-2">
            {selectedSale.customer_id && <Link className="rounded-xl border border-[#e8dfe4] px-4 py-3 text-sm font-bold text-[#792f59] transition hover:border-[#792f59]" href={`/clients/${selectedSale.customer_id}`}>Apri cliente</Link>}
            {selectedSale.appointment_id && <Link className="rounded-xl bg-[#402334] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#3a1830]" href={`/calendar?appointment=${selectedSale.appointment_id}`}>Apri appuntamento</Link>}
          </div>
        </div>}
      </Drawer>
    </AppPage>
  );
}
