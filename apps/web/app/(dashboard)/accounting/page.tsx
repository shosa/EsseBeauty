"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download, FileText, RefreshCw, Search } from "lucide-react";
import { AppPage, Button, Drawer, EmptyState, InlineError, PageHeader, SectionCard } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
type Preset = "today" | "week" | "month" | "last";
type PaymentMethod = "cash" | "card" | "bank_transfer" | "voucher" | "other";
type CartItemType = "service" | "product" | "package" | "custom";

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

export default function AccountingPage() {
  const { salon } = useAuth();
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
  const casualSales = (data?.rows ?? []).filter((row) => !row.customer_name).length;
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
  const paymentColors = ["#287fb8", "#4a9b8f", "#f0a23b", "#d76969", "#9c83bd"];
  const paymentSegments = (data?.payments ?? []).map((item, index) => { const start = paymentCursor; paymentCursor += paymentTotal ? item.amount_cents / paymentTotal * 100 : 0; return `${paymentColors[index % paymentColors.length]} ${start}% ${paymentCursor}%`; });
  const paymentDonut = paymentSegments.length ? `conic-gradient(${paymentSegments.join(",")})` : "#e7e5e4";

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

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageHeader eyebrow="Amministrazione" title="Contabilità" subtitle="Incassi, composizione dei pagamenti e movimenti in un'unica vista gestionale." />
      {error && <InlineError className="mb-5">{error}</InlineError>}
      {saleLoading && <div className="mb-5 rounded-xl bg-stone-100 px-4 py-3 text-sm font-bold text-stone-600">Caricamento dettaglio vendita...</div>}

      <div className="mb-3 border border-stone-200 bg-white p-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
          {presetLabels.map(([value, label]) => <Button key={value} onClick={() => selectPreset(value)} size="sm" variant={preset === value ? "primary" : "outline"}>{label}</Button>)}
          </div>
          <label className="ml-auto text-[10px] font-bold uppercase text-stone-500">Dal<input className="ml-2 rounded border border-stone-200 px-2 py-1.5 text-xs text-stone-950" max={toDate} onChange={(event) => { if (event.target.value) { setPreset("custom"); setFromDate(event.target.value); } }} type="date" value={fromDate} /></label>
          <label className="text-[10px] font-bold uppercase text-stone-500">Al<input className="ml-2 rounded border border-stone-200 px-2 py-1.5 text-xs text-stone-950" min={fromDate} onChange={(event) => { if (event.target.value) { setPreset("custom"); setToDate(event.target.value); } }} type="date" value={toDate} /></label>
          <button aria-label="Aggiorna contabilità" className="grid h-8 w-8 place-items-center border border-stone-200" onClick={() => void loadSales()} title="Aggiorna"><RefreshCw size={15} /></button>
          <Button onClick={exportPdf} size="sm" variant="outline"><FileText className="mr-2" size={16} />PDF</Button>
          <Button onClick={exportRegister} size="sm" variant="outline"><Download className="mr-2" size={16} />Excel</Button>
        </div>
      </div>

      <section className="mb-3 grid border border-stone-200 bg-white sm:grid-cols-3 xl:grid-cols-6">
        {[["Incassato", euro(data?.summary.total_cents ?? 0), `${activeDays} giorni attivi`], ["Spese", euro(overview?.summary.expense_total_cents ?? 0), `${overview?.expenses.summary.count ?? 0} movimenti`], ["Margine", euro(overview?.summary.gross_margin_cents ?? 0), "incassi meno spese"], ["Vendite", data?.summary.count ?? 0, `${Math.round((data?.summary.count ?? 0) / activeDays)} al giorno`], ["Scontrino medio", euro(data?.summary.average_cents ?? 0), "per movimento"], ["Sconti", euro(data?.summary.discount_cents ?? 0), `${discountRate}% sul lordo`]].map(([label, value, detail]) => <div className="min-h-24 border-b border-r border-stone-200 p-3 last:border-r-0 sm:border-b-0" key={String(label)}><span className="text-[10px] font-black uppercase text-stone-500">{label}</span><strong className="mt-1 block text-2xl font-medium text-stone-950">{value}</strong><span className="text-[10px] text-stone-500">{detail}</span></div>)}
      </section>

      <div className="grid gap-3 xl:grid-cols-[1.45fr_.75fr]">
        <SectionCard title="Andamento incassi" subtitle="Totale giornaliero delle vendite concluse nel periodo.">
          {!dailyTotals.length ? <EmptyState title="Nessun incasso" description="Non ci sono movimenti nel periodo." /> : <div className="flex h-56 items-end gap-2 border-b border-stone-200 px-2 pt-6">{dailyTotals.map(([day, value]) => <div className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" key={day}><strong className="text-[9px] text-stone-600">{euro(value)}</strong><div className="w-3/5 min-w-5 max-w-12 bg-[#287fb8]" style={{ height: `${Math.max(8, value / maxDaily * 155)}px` }} /><span className="text-[9px] text-stone-500">{day}</span></div>)}</div>}
        </SectionCard>
        <SectionCard title="Metodi di pagamento" subtitle="Distribuzione degli incassi registrati.">
          {data?.payments.length ? <div className="grid grid-cols-[125px_1fr] items-center gap-4"><div className="relative aspect-square rounded-full" style={{ background: paymentDonut }}><div className="absolute inset-[29%] grid place-items-center rounded-full bg-white text-center"><strong className="text-sm">{euro(paymentTotal)}</strong></div></div><div className="space-y-2">{data.payments.map((item, index) => <div className="grid grid-cols-[8px_1fr_auto] items-center gap-2 text-xs" key={item.method}><i className="h-2 w-2" style={{ background: paymentColors[index % paymentColors.length] }} /><span>{methodLabels[item.method as PaymentMethod] ?? item.method}</span><strong>{euro(item.amount_cents)}</strong></div>)}</div></div> : <EmptyState title="Nessun incasso" description="Non ci sono pagamenti nel periodo." />}
        </SectionCard>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <SectionCard title="Migliori operatori" subtitle={`Giornata migliore: ${bestDay?.[0] ?? "—"}${bestDay ? ` · ${euro(bestDay[1])}` : ""}`}><table className="w-full text-left text-xs"><thead className="bg-stone-100 text-[9px] uppercase"><tr><th className="p-2">#</th><th>Operatore</th><th>Vendite</th><th className="text-right">Incassato</th></tr></thead><tbody>{operatorTotals.map((item, index) => <tr className="border-t border-stone-100" key={item.name}><td className="p-2 text-stone-400">{index + 1}</td><td className="font-bold">{item.name}</td><td>{item.count}</td><td className="text-right font-bold">{euro(item.total)}</td></tr>)}</tbody></table></SectionCard>
        <SectionCard title="Clienti per valore" subtitle="Classifica per incasso nel periodo selezionato."><table className="w-full text-left text-xs"><thead className="bg-stone-100 text-[9px] uppercase"><tr><th className="p-2">#</th><th>Cliente</th><th>Acquisti</th><th className="text-right">Valore</th></tr></thead><tbody>{customerTotals.map((item, index) => <tr className="border-t border-stone-100" key={item.name}><td className="p-2 text-stone-400">{index + 1}</td><td className="font-bold">{item.name}</td><td>{item.count}</td><td className="text-right font-bold">{euro(item.total)}</td></tr>)}</tbody></table></SectionCard>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[.8fr_1.2fr]">
        <SectionCard title="Spese per categoria" subtitle="Uscite operative registrate dal magazzino nel periodo.">
          {!overview?.expenses.categories.length ? <EmptyState title="Nessuna spesa" description="Non ci sono uscite operative nel periodo selezionato." /> : <div className="space-y-3">{overview.expenses.categories.map((item) => {
            const width = overview.expenses.summary.total_cents ? Math.max(6, item.total_cents / overview.expenses.summary.total_cents * 100) : 0;
            return <div key={item.category}><div className="flex justify-between gap-3 text-xs"><strong>{item.category}</strong><span>{euro(item.total_cents)} · {item.count}</span></div><div className="mt-1 h-2 bg-stone-100"><div className="h-full bg-[#d76969]" style={{ width: `${width}%` }} /></div></div>;
          })}</div>}
        </SectionCard>
        <SectionCard title="Registro spese" subtitle={`${overview?.expenses.rows.length ?? 0} uscite nel periodo selezionato.`}>
          {!overview?.expenses.rows.length ? <EmptyState title="Nessuna uscita" description="Le spese registrate compariranno qui insieme al documento sorgente." /> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-[#f7eef3]"><tr><th className="p-3">Data</th><th>Descrizione</th><th>Categoria</th><th>Fornitore</th><th>Documento</th><th className="text-right">Totale</th></tr></thead><tbody>{overview.expenses.rows.slice(0, 12).map((expense) => <tr className="border-t border-stone-100" key={expense.id}><td className="p-3">{new Date(expense.competence_date).toLocaleDateString("it-IT")}</td><td className="font-bold">{expense.description}</td><td>{expense.category}</td><td>{expense.supplier_name ?? "—"}</td><td>{expense.document_number ?? "—"}</td><td className="text-right font-black">{euro(expense.total_cents)}</td></tr>)}</tbody></table></div>}
        </SectionCard>
      </div>

      <SectionCard className="mt-3" title="Registro vendite" subtitle={`${filteredRows.length} movimenti visibili nel periodo selezionato.`}>
        <div className="mb-4 flex flex-wrap gap-3">
          <label className="relative min-w-[240px] flex-1"><Search className="pointer-events-none absolute left-3 top-3 text-stone-400" size={18} /><input className="w-full rounded-xl border border-stone-200 py-2.5 pl-10 pr-3 text-sm" onChange={(event) => setSearch(event.target.value)} placeholder="Cerca cliente o operatore" value={search} /></label>
          <select className="rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold" onChange={(event) => setPaymentFilter(event.target.value as PaymentMethod | "all")} value={paymentFilter}><option value="all">Tutti i pagamenti</option>{Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select className="rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold" onChange={(event) => setSort(event.target.value as "date" | "total")} value={sort}><option value="date">Più recenti</option><option value="total">Totale più alto</option></select>
        </div>
        {!filteredRows.length ? <EmptyState title="Nessun movimento" description="Modifica la ricerca, i filtri o il periodo selezionato." /> : <div className="overflow-x-auto rounded-2xl border"><table className="w-full min-w-[880px] text-left text-sm"><thead className="bg-[#f7eef3]"><tr><th className="p-4">Data</th><th>Cliente</th><th>Operatore</th><th>Pagamento</th><th>Sconto</th><th className="text-right">Totale</th><th /></tr></thead><tbody>{filteredRows.map((row) => <tr className="cursor-pointer border-t transition hover:bg-[#fff8fb]" key={row.id} onClick={() => void openSale(row.id)}><td className="p-4">{new Date(row.closed_at).toLocaleString("it-IT")}</td><td className="font-bold">{row.customer_name || "Cliente occasionale"}</td><td>{row.staff_name || "—"}</td><td><div className="flex flex-wrap gap-1">{row.payment_methods.map((method) => <span className="rounded-md bg-stone-100 px-2 py-1 text-[10px] font-bold" key={method}>{methodLabels[method]}</span>)}</div></td><td>{euro(row.discount_cents)}</td><td className="text-right text-base font-black">{euro(row.total_cents)}</td><td className="p-4 text-right"><span className="font-bold text-[#792f59]">Dettaglio</span></td></tr>)}</tbody></table></div>}
      </SectionCard>

      <Drawer onClose={() => setSelectedSale(undefined)} open={Boolean(selectedSale)} title="Dettaglio vendita">
        {selectedSale && <div className="space-y-5">
          <section className="rounded-2xl bg-[#402334] p-5 text-white">
            <p className="text-xs font-black uppercase tracking-[.16em] text-[#e8bfd4]">Incasso registrato</p>
            <strong className="mt-2 block text-4xl">{euro(selectedSale.total_cents)}</strong>
            <p className="mt-2 text-sm text-stone-300">{new Date(selectedSale.closed_at).toLocaleString("it-IT")}</p>
          </section>
          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-stone-200 p-3"><span className="text-[10px] font-black uppercase text-stone-400">Cliente</span><strong className="mt-1 block">{selectedSale.customer_name || "Cliente occasionale"}</strong></div>
            <div className="rounded-xl border border-stone-200 p-3"><span className="text-[10px] font-black uppercase text-stone-400">Operatore</span><strong className="mt-1 block">{selectedSale.staff_name || "Non assegnato"}</strong></div>
            <div className="rounded-xl border border-stone-200 p-3"><span className="text-[10px] font-black uppercase text-stone-400">Registrata da</span><strong className="mt-1 block">{selectedSale.cashier_name || "Sistema"}</strong></div>
            <div className="rounded-xl border border-stone-200 p-3"><span className="text-[10px] font-black uppercase text-stone-400">Origine</span><strong className="mt-1 block">{selectedSale.appointment_id ? "Appuntamento" : "Vendita libera"}</strong></div>
          </section>
          <section>
            <h3 className="font-black">Cosa e stato venduto</h3>
            <div className="mt-3 space-y-2">
              {selectedSale.items.map((item) => <article className="rounded-2xl border border-stone-200 p-4" key={item.id}>
                <div className="flex items-start justify-between gap-3"><div><strong>{item.description}</strong><p className="mt-1 text-xs uppercase text-stone-400">{item.item_type === "service" ? "Servizio" : item.item_type === "product" ? "Prodotto" : "Voce libera"}</p></div><strong>{euro(item.total_cents)}</strong></div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-500"><span>Quantita: {item.quantity}</span><span>Prezzo: {euro(item.unit_price_cents)}</span>{item.discount_cents > 0 && <span>Sconto: {euro(item.discount_cents)}</span>}</div>
              </article>)}
            </div>
          </section>
          <section className="rounded-2xl border border-stone-200 p-4">
            <div className="flex justify-between text-sm"><span>Subtotale</span><strong>{euro(selectedSale.subtotal_cents)}</strong></div>
            {selectedSale.discount_cents > 0 && <div className="mt-2 flex justify-between text-sm text-stone-500"><span>Sconto conto</span><strong>- {euro(selectedSale.discount_cents)}</strong></div>}
            <div className="mt-4 flex justify-between border-t border-stone-200 pt-4 text-lg"><strong>Totale</strong><strong className="text-[#792f59]">{euro(selectedSale.total_cents)}</strong></div>
          </section>
          <section>
            <h3 className="font-black">Pagamenti</h3>
            <div className="mt-3 space-y-2">{selectedSale.payments.map((payment) => <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900" key={payment.id}>
              <div><strong>{methodLabels[payment.method] ?? payment.method}</strong>{payment.method === "voucher" && payment.reference && <span className="mt-1 block font-mono text-[11px] tracking-[.1em]">{payment.reference.replace(/(\d{4})(?=\d)/g, "$1 ")}</span>}</div>
              <strong>{euro(payment.amount_cents)}</strong>
            </div>)}</div>
          </section>
          {selectedSale.notes && <section className="rounded-2xl bg-amber-50 p-4"><p className="text-xs font-black uppercase text-amber-800">Nota interna</p><p className="mt-2 text-sm text-amber-950">{selectedSale.notes}</p></section>}
          <div className="flex flex-wrap gap-2">
            {selectedSale.customer_id && <Link className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-bold text-[#792f59]" href={`/clients/${selectedSale.customer_id}`}>Apri cliente</Link>}
            {selectedSale.appointment_id && <Link className="rounded-xl bg-[#402334] px-4 py-3 text-sm font-bold text-white" href={`/calendar?appointment=${selectedSale.appointment_id}`}>Apri appuntamento</Link>}
          </div>
        </div>}
      </Drawer>
    </AppPage>
  );
}
