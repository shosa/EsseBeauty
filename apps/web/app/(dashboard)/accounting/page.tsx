"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Download, FileText, RefreshCw, Search } from "lucide-react";
import { AppPage, Button, DateField, Drawer, EmptyState, InlineError } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
type Preset = "today" | "week" | "month" | "last";
type PaymentMethod = "cash" | "card" | "bank_transfer" | "voucher" | "other";
type CartItemType = "service" | "product" | "package" | "custom";
type Section = "overview" | "sales" | "expenses" | "analysis" | "report";
type Density = "comfortable" | "compact";
type ReportFormat = "pdf" | "excel";

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
interface ExpenseRow { category: string; competence_date: string; description: string; document_number?: string | null; id: string; supplier_name?: string | null; total_cents: number }
interface AccountingOverview {
  expenses: {
    categories: Array<{ category: string; count: number; total_cents: number }>;
    rows: ExpenseRow[];
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
const reportTypeLabels: Record<Preset, string> = { last: "Riepilogo mese precedente", month: "Riepilogo mensile", today: "Chiusura giornaliera", week: "Riepilogo settimanale" };
const paletteColors = ["#792f59", "#b8578a", "#c98a3f", "#3f7d6f", "#7a4fa0", "#57534e"];
const pageSize = 20;

function euro(cents: number) {
  return (cents / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" });
}

function compactEuro(cents: number) {
  const value = cents / 100;
  if (Math.abs(value) >= 1000) return `€${(value / 1000).toFixed(1).replace(".0", "")}k`;
  return `€${Math.round(value)}`;
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

function shiftRangeBack(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00`);
  const days = Math.round((new Date(`${to}T00:00:00`).getTime() - fromDate.getTime()) / 86_400_000) + 1;
  const previousTo = new Date(fromDate);
  previousTo.setDate(previousTo.getDate() - 1);
  const previousFrom = new Date(previousTo);
  previousFrom.setDate(previousFrom.getDate() - (days - 1));
  return { from: inputDate(previousFrom), to: inputDate(previousTo) };
}

function dateRangeDays(from: string, to: string) {
  const days: string[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (cursor <= end) { days.push(inputDate(cursor)); cursor.setDate(cursor.getDate() + 1); }
  return days;
}

function formatDayLabel(day: string) {
  return new Date(`${day}T00:00:00`).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function periodLabel(preset: Preset | "custom", from: string, to: string) {
  if (preset === "today") return "Oggi";
  if (preset === "week") return "Questa settimana";
  if (preset === "month") return "Questo mese";
  if (preset === "last") return "Il mese scorso";
  return `${formatDayLabel(from)} – ${formatDayLabel(to)}`;
}

function percentDelta(current: number, previous: number) {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

function dailyRevenueSeries(rows: SaleRow[], from: string, to: string) {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(inputDate(new Date(row.closed_at)), (totals.get(inputDate(new Date(row.closed_at))) ?? 0) + row.total_cents);
  return dateRangeDays(from, to).map((day) => ({ day, total: totals.get(day) ?? 0 }));
}

function dailyExpenseSeries(rows: ExpenseRow[], from: string, to: string) {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(inputDate(new Date(row.competence_date)), (totals.get(inputDate(new Date(row.competence_date))) ?? 0) + row.total_cents);
  return dateRangeDays(from, to).map((day) => ({ day, total: totals.get(day) ?? 0 }));
}

function totalsByStaff(rows: SaleRow[]) {
  const totals = new Map<string, { count: number; total: number }>();
  for (const row of rows) {
    const name = row.staff_name || "Non assegnato";
    const current = totals.get(name) ?? { count: 0, total: 0 };
    totals.set(name, { count: current.count + 1, total: current.total + row.total_cents });
  }
  return totals;
}

const sections: Array<{ key: Section; label: string }> = [
  { key: "overview", label: "Panoramica" },
  { key: "sales", label: "Registro vendite" },
  { key: "expenses", label: "Spese" },
  { key: "analysis", label: "Analisi & confronti" },
  { key: "report", label: "Report" },
];

function Card({ actions, bodyClassName = "", children, className = "", subtitle, title }: { actions?: ReactNode; bodyClassName?: string; children: ReactNode; className?: string; subtitle?: ReactNode; title?: ReactNode }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-[#e8dfe4] bg-white shadow-[0_1px_2px_rgb(45_29_39_/_0.04)] ${className}`}>
      {(title || subtitle || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e8dfe4] px-4 py-3.5">
          <div>{title && <h2 className="text-[14.5px] font-bold text-stone-900">{title}</h2>}{subtitle && <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p>}</div>
          {actions}
        </div>
      )}
      <div className={`p-4 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

function DeltaChip({ suffix = "vs periodo prec.", value }: { suffix?: string; value: number | null }) {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <span className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black ${up ? "bg-[#e5f3ec] text-[#1c7a5c]" : "bg-[#faeae8] text-[#b23a2e]"}`}>
      {up ? <ArrowUp size={10} /> : <ArrowDown size={10} />}{Math.abs(value).toFixed(1)}%
      <span className="ml-0.5 font-semibold text-stone-400">{suffix}</span>
    </span>
  );
}

function RevenueChart({ current, previous }: { current: Array<{ day: string; total: number }>; previous?: Array<{ day: string; total: number }> }) {
  const max = Math.max(1, ...current.map((point) => point.total), ...(previous ?? []).map((point) => point.total)) * 1.1;
  const chartX0 = 40; const chartW = 590; const baseY = 200; const chartH = 184;
  const groupW = chartW / Math.max(1, current.length);
  const barW = Math.max(2, Math.min(22, groupW * (previous ? 0.34 : 0.6)));
  const labelStep = Math.max(1, Math.ceil(current.length / 12));
  return (
    <svg className="w-full" viewBox="0 0 640 220">
      <g stroke="#e8dfe4">{[16, 62, 108, 154, 200].map((y) => <line key={y} x1={chartX0} x2={630} y1={y} y2={y} />)}</g>
      <g className="fill-stone-400" fontSize={9.5}>{[16, 62, 108, 154, 200].map((y, index) => <text key={y} textAnchor="end" x={34} y={y + 3}>{compactEuro(max * (1 - index / 4))}</text>)}</g>
      {current.map((point, index) => {
        const x = chartX0 + index * groupW;
        const prevPoint = previous?.[index];
        const currH = (point.total / max) * chartH;
        const prevH = prevPoint ? (prevPoint.total / max) * chartH : 0;
        return (
          <g key={point.day}>
            {prevPoint && <rect fill="#a89ba0" height={prevH} opacity={0.45} rx={2} width={barW} x={x + groupW / 2 - barW - 2} y={baseY - prevH} />}
            <rect fill="#792f59" height={currH} rx={2} width={barW} x={prevPoint ? x + groupW / 2 + 2 : x + groupW / 2 - barW / 2} y={baseY - currH} />
            {index % labelStep === 0 && <text className="fill-stone-400" fontSize={9} textAnchor="middle" x={x + groupW / 2} y={214}>{formatDayLabel(point.day)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function MarginLineChart({ points }: { points: Array<{ day: string; total: number }> }) {
  const values = points.map((point) => point.total);
  const max = Math.max(1, ...values); const min = Math.min(0, ...values); const range = Math.max(1, max - min);
  const chartX0 = 30; const chartW = 600; const baseY = 160; const chartH = 150;
  const stepX = chartW / Math.max(1, points.length - 1);
  const coords = points.map((point, index) => [chartX0 + index * stepX, baseY - ((point.total - min) / range) * chartH] as const);
  const path = coords.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const areaPath = `${path} L${coords[coords.length - 1]?.[0] ?? chartX0},${baseY} L${chartX0},${baseY} Z`;
  const labelStep = Math.max(1, Math.ceil(points.length / 8));
  const last = coords[coords.length - 1];
  return (
    <svg className="w-full" viewBox="0 0 640 190">
      <g stroke="#e8dfe4">{[10, 60, 110, 160].map((y) => <line key={y} x1={chartX0} x2={630} y1={y} y2={y} />)}</g>
      <defs><linearGradient id="marginFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#792f59" stopOpacity={0.28} /><stop offset="100%" stopColor="#792f59" stopOpacity={0} /></linearGradient></defs>
      <path d={areaPath} fill="url(#marginFill)" />
      <path d={path} fill="none" stroke="#792f59" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} />
      {last && <circle cx={last[0]} cy={last[1]} fill="#792f59" r={4.5} />}
      {points.map((point, index) => index % labelStep === 0 && <text className="fill-stone-400" fontSize={9} key={point.day} textAnchor="middle" x={chartX0 + index * stepX} y={180}>{formatDayLabel(point.day)}</text>)}
    </svg>
  );
}

export default function AccountingPage() {
  const { salon } = useAuth();
  const [section, setSection] = useState<Section>("overview");
  const [compareEnabled, setCompareEnabled] = useState(true);
  const [preset, setPreset] = useState<Preset | "custom">("today");
  const initialRange = useMemo(() => presetRange("today"), []);
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"date" | "total">("date");
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | "all">("all");
  const [density, setDensity] = useState<Density>("comfortable");
  const [reportFormat, setReportFormat] = useState<ReportFormat>("pdf");
  const [salesPage, setSalesPage] = useState(1);
  const [expensePage, setExpensePage] = useState(1);
  const [data, setData] = useState<SalesResponse>();
  const [overview, setOverview] = useState<AccountingOverview>();
  const [previousData, setPreviousData] = useState<SalesResponse>();
  const [previousOverview, setPreviousOverview] = useState<AccountingOverview>();
  const [error, setError] = useState("");
  const [selectedSale, setSelectedSale] = useState<SaleDetail>();
  const [saleLoading, setSaleLoading] = useState(false);

  async function loadSales() {
    if (!salon) return;
    setError("");
    const query = new URLSearchParams(requestRange(fromDate, toDate));
    const requests = [
      fetch(`${api}/api/salons/${salon.id}/sales?${query}`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/accounting/overview?${query}`, { credentials: "include" }),
    ];
    const previousRange = shiftRangeBack(fromDate, toDate);
    const previousQuery = new URLSearchParams(requestRange(previousRange.from, previousRange.to));
    if (compareEnabled) requests.push(
      fetch(`${api}/api/salons/${salon.id}/sales?${previousQuery}`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/accounting/overview?${previousQuery}`, { credentials: "include" }),
    );
    const [salesResponse, overviewResponse, previousSalesResponse, previousOverviewResponse] = await Promise.all(requests);
    if (!salesResponse?.ok || !overviewResponse?.ok) return setError(salesResponse?.status === 403 || overviewResponse?.status === 403 ? "Non hai accesso alla contabilita gestionale." : "Movimenti non disponibili.");
    setData(await salesResponse.json() as SalesResponse);
    setOverview(await overviewResponse.json() as AccountingOverview);
    if (compareEnabled && previousSalesResponse?.ok && previousOverviewResponse?.ok) {
      setPreviousData(await previousSalesResponse.json() as SalesResponse);
      setPreviousOverview(await previousOverviewResponse.json() as AccountingOverview);
    } else {
      setPreviousData(undefined);
      setPreviousOverview(undefined);
    }
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

  useEffect(() => { void loadSales(); }, [compareEnabled, fromDate, salon?.id, toDate]);
  useEffect(() => { setSalesPage(1); }, [search, paymentFilter, sort, fromDate, toDate]);
  useEffect(() => { setExpensePage(1); }, [fromDate, toDate]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("it-IT");
    return [...(data?.rows ?? [])]
      .filter((row) => !needle || `${row.customer_name ?? ""} ${row.staff_name ?? ""}`.toLocaleLowerCase("it-IT").includes(needle))
      .filter((row) => paymentFilter === "all" || row.payment_methods.includes(paymentFilter))
      .sort((a, b) => sort === "total" ? b.total_cents - a.total_cents : new Date(b.closed_at).getTime() - new Date(a.closed_at).getTime());
  }, [data?.rows, paymentFilter, search, sort]);
  const pagedRows = filteredRows.slice((salesPage - 1) * pageSize, salesPage * pageSize);
  const totalSalesPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pagedExpenseRows = (overview?.expenses.rows ?? []).slice((expensePage - 1) * pageSize, expensePage * pageSize);
  const totalExpensePages = Math.max(1, Math.ceil((overview?.expenses.rows.length ?? 0) / pageSize));

  const dailyRevenue = useMemo(() => dailyRevenueSeries(data?.rows ?? [], fromDate, toDate), [data?.rows, fromDate, toDate]);
  const previousRangeDates = useMemo(() => shiftRangeBack(fromDate, toDate), [fromDate, toDate]);
  const previousDailyRevenue = useMemo(() => previousData ? dailyRevenueSeries(previousData.rows, previousRangeDates.from, previousRangeDates.to) : undefined, [previousData, previousRangeDates]);
  const dailyMargin = useMemo(() => {
    const revenue = dailyRevenueSeries(data?.rows ?? [], fromDate, toDate);
    const expense = dailyExpenseSeries(overview?.expenses.rows ?? [], fromDate, toDate);
    return revenue.map((point, index) => ({ day: point.day, total: point.total - (expense[index]?.total ?? 0) }));
  }, [data?.rows, fromDate, overview?.expenses.rows, toDate]);
  const activeDays = Math.max(1, dateRangeDays(fromDate, toDate).length);
  const discountRate = data?.summary.total_cents ? Math.round(data.summary.discount_cents / (data.summary.total_cents + data.summary.discount_cents) * 100) : 0;
  const operatorTotals = useMemo(() => [...totalsByStaff(data?.rows ?? []).entries()].map(([name, value]) => ({ name, ...value })).sort((a, b) => b.total - a.total).slice(0, 8), [data?.rows]);
  const customerTotals = useMemo(() => {
    const totals = new Map<string, { count: number; total: number }>();
    for (const row of data?.rows ?? []) { const name = row.customer_name || "Cliente occasionale"; const current = totals.get(name) ?? { count: 0, total: 0 }; totals.set(name, { count: current.count + 1, total: current.total + row.total_cents }); }
    return [...totals.entries()].map(([name, value]) => ({ name, ...value })).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [data?.rows]);
  const dayPartTotals = useMemo(() => {
    const buckets = { mattina: { count: 0, total: 0 }, pomeriggio: { count: 0, total: 0 }, sera: { count: 0, total: 0 } };
    for (const row of data?.rows ?? []) {
      const hour = new Date(row.closed_at).getHours();
      const key = hour < 12 ? "mattina" : hour < 18 ? "pomeriggio" : "sera";
      buckets[key].count += 1;
      buckets[key].total += row.total_cents;
    }
    return buckets;
  }, [data?.rows]);
  const supplierTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of overview?.expenses.rows ?? []) totals.set(row.supplier_name || "Fornitore non specificato", (totals.get(row.supplier_name || "Fornitore non specificato") ?? 0) + row.total_cents);
    return [...totals.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [overview?.expenses.rows]);
  const operatorGrowth = useMemo(() => {
    if (!previousData) return [];
    const previousTotals = totalsByStaff(previousData.rows);
    return operatorTotals.map((item) => {
      const previousTotal = previousTotals.get(item.name)?.total ?? 0;
      return { ...item, delta: percentDelta(item.total, previousTotal), previousTotal };
    });
  }, [operatorTotals, previousData]);
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

  const incassatoDelta = percentDelta(data?.summary.total_cents ?? 0, previousData?.summary.total_cents ?? 0);
  const speseDelta = percentDelta(overview?.summary.expense_total_cents ?? 0, previousOverview?.summary.expense_total_cents ?? 0);
  const margineDelta = percentDelta(overview?.summary.gross_margin_cents ?? 0, previousOverview?.summary.gross_margin_cents ?? 0);
  const venditeDelta = percentDelta(data?.summary.count ?? 0, previousData?.summary.count ?? 0);
  const scontrinoDelta = percentDelta(data?.summary.average_cents ?? 0, previousData?.summary.average_cents ?? 0);
  const scontiDelta = percentDelta(data?.summary.discount_cents ?? 0, previousData?.summary.discount_cents ?? 0);

  return (
    <AppPage maxWidth="max-w-[1600px]">
      {/* ---------- topbar: enterprise console, not a marketing hero ---------- */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e8dfe4] pb-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#792f59]">Amministrazione · Centro di controllo</p>
          <h1 className="mt-1 text-[26px] font-bold tracking-[-.02em] text-stone-950">Contabilità</h1>
          <p className="mt-1 text-[13px] text-stone-500">Incassi, spese, margini e rapportini in un&apos;unica postazione gestionale.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex h-9 items-center gap-2 rounded-xl border border-[#e8dfe4] bg-white px-3 text-[12.5px] font-bold text-stone-600">
            <input checked={compareEnabled} className="accent-[#792f59]" onChange={(event) => setCompareEnabled(event.target.checked)} type="checkbox" />
            Confronta periodo precedente
          </label>
          <div className="inline-flex gap-0.5 rounded-xl border border-[#e8dfe4] bg-[#faf7f9] p-1">
            {presetLabels.map(([value, label]) => <button className={`h-8 rounded-lg px-3 text-[12px] font-bold transition ${preset === value ? "bg-white text-[#792f59] shadow-sm" : "text-stone-500 hover:text-[#792f59]"}`} key={value} onClick={() => selectPreset(value)} type="button">{label}</button>)}
          </div>
          <button aria-label="Aggiorna contabilità" className="grid size-9 place-items-center rounded-xl border border-[#e8dfe4] bg-white text-stone-600 transition hover:border-[#792f59] hover:text-[#792f59]" onClick={() => void loadSales()} title="Aggiorna" type="button"><RefreshCw size={15} /></button>
        </div>
      </header>

      {/* ---------- tabs ---------- */}
      <nav className="flex flex-wrap gap-6 border-b border-[#e8dfe4]">
        {sections.map((item) => (
          <button className={`relative flex items-center gap-1.5 py-3 text-[13.5px] font-bold transition ${section === item.key ? "text-[#792f59]" : "text-stone-500 hover:text-stone-800"}`} key={item.key} onClick={() => setSection(item.key)} type="button">
            {item.label}
            {item.key === "sales" && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${section === item.key ? "bg-[#f7eef3] text-[#792f59]" : "bg-stone-100 text-stone-400"}`}>{filteredRows.length}</span>}
            {item.key === "expenses" && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${section === item.key ? "bg-[#f7eef3] text-[#792f59]" : "bg-stone-100 text-stone-400"}`}>{overview?.expenses.rows.length ?? 0}</span>}
            {section === item.key && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-t-full bg-[#792f59]" />}
          </button>
        ))}
      </nav>

      {/* ---------- date range sub-bar ---------- */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#e8dfe4] py-3">
        <DateField aria-label="Data iniziale" max={toDate} onChange={(value) => { if (value) { setPreset("custom"); setFromDate(value); } }} value={fromDate} />
        <span className="text-xs font-bold text-stone-400">→</span>
        <DateField aria-label="Data finale" min={fromDate} onChange={(value) => { if (value) { setPreset("custom"); setToDate(value); } }} value={toDate} />
        {compareEnabled && <span className="text-xs font-semibold text-stone-400">Confronto con {formatDayLabel(previousRangeDates.from)} – {formatDayLabel(previousRangeDates.to)}</span>}
      </div>

      {error && <InlineError className="mt-4">{error}</InlineError>}
      {saleLoading && <div className="mt-4 rounded-xl border border-[#e8dfe4] bg-[#fffafd] px-4 py-3 text-sm font-bold text-[#792f59]">Caricamento dettaglio vendita…</div>}

      {/* ============ PANORAMICA ============ */}
      {section === "overview" && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[#e8dfe4] bg-[#e8dfe4] sm:grid-cols-3 lg:grid-cols-6">
            <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Incassato</span><strong className="mt-1 block text-xl font-bold tnum text-stone-950">{euro(data?.summary.total_cents ?? 0)}</strong><DeltaChip value={incassatoDelta} /></div>
            <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Spese</span><strong className="mt-1 block text-xl font-bold tnum text-stone-950">{euro(overview?.summary.expense_total_cents ?? 0)}</strong><DeltaChip value={speseDelta} /></div>
            <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Margine netto</span><strong className="mt-1 block text-xl font-bold tnum text-stone-950">{euro(overview?.summary.gross_margin_cents ?? 0)}</strong><DeltaChip value={margineDelta} /></div>
            <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Vendite</span><strong className="mt-1 block text-xl font-bold tnum text-stone-950">{data?.summary.count ?? 0}</strong><DeltaChip value={venditeDelta} /></div>
            <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Scontrino medio</span><strong className="mt-1 block text-xl font-bold tnum text-stone-950">{euro(data?.summary.average_cents ?? 0)}</strong><DeltaChip value={scontrinoDelta} /></div>
            <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Sconti</span><strong className="mt-1 block text-xl font-bold tnum text-stone-950">{euro(data?.summary.discount_cents ?? 0)}</strong><span className="mt-1.5 block text-[11px] font-semibold text-stone-400">{discountRate}% sul lordo</span></div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[1.45fr_.75fr]">
            <Card subtitle="Totale giornaliero, periodo corrente vs precedente." title="Andamento incassi">
              {!data?.rows.length ? <EmptyState description="Non ci sono movimenti nel periodo." title="Nessun incasso" /> : (
                <>
                  <RevenueChart current={dailyRevenue} previous={compareEnabled ? previousDailyRevenue : undefined} />
                  <div className="mt-1 flex gap-4 text-[11px] text-stone-500"><span className="inline-flex items-center gap-1.5"><i className="inline-block size-2 rounded-sm bg-[#792f59]" />Periodo corrente</span>{compareEnabled && <span className="inline-flex items-center gap-1.5"><i className="inline-block size-2 rounded-sm bg-stone-400 opacity-50" />Periodo precedente</span>}</div>
                </>
              )}
            </Card>
            <Card subtitle="Distribuzione incassi del periodo." title="Metodi di pagamento">
              {data?.payments.length ? (
                <div className="grid grid-cols-[110px_1fr] items-center gap-4">
                  <div className="relative aspect-square rounded-full" style={{ background: paymentDonut }}>
                    <div className="absolute inset-[26%] grid place-items-center rounded-full bg-white text-center shadow-[inset_0_0_0_1px_rgb(232_223_228)]"><strong className="text-sm font-bold tnum text-[#402334]">{euro(paymentTotal)}</strong></div>
                  </div>
                  <div className="space-y-2.5">
                    {data.payments.map((item, index) => (
                      <div className="grid grid-cols-[8px_1fr_auto] items-center gap-2.5 text-xs" key={item.method}>
                        <i className="size-2 rounded-full" style={{ background: paletteColors[index % paletteColors.length] }} />
                        <span className="font-semibold text-stone-600">{methodLabels[item.method as PaymentMethod] ?? item.method}</span>
                        <strong className="font-bold tnum text-[#402334]">{euro(item.amount_cents)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <EmptyState description="Non ci sono pagamenti nel periodo." title="Nessun incasso" />}
            </Card>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <Card bodyClassName="p-0" title="Migliori operatori">
              {!operatorTotals.length ? <div className="p-4"><EmptyState description="Non ci sono vendite nel periodo." title="Nessun dato" /></div> : (
                <table className="w-full text-left text-sm"><thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.1em] text-stone-500"><tr><th className="px-4 py-2.5">#</th><th>Operatore</th><th className="pr-4 text-right">Incasso</th></tr></thead>
                  <tbody>{operatorTotals.slice(0, 5).map((item, index) => <tr className="border-t border-stone-100" key={item.name}><td className="px-4 py-2.5"><span className="grid size-6 place-items-center rounded-full bg-[#f8edf3] text-[11px] font-black text-[#792f59]">{index + 1}</span></td><td className="font-bold text-stone-800">{item.name}</td><td className="pr-4 text-right font-bold tnum text-[#402334]">{euro(item.total)}</td></tr>)}</tbody>
                </table>
              )}
            </Card>
            <Card bodyClassName="p-0" title="Clienti per valore">
              {!customerTotals.length ? <div className="p-4"><EmptyState description="Non ci sono vendite nel periodo." title="Nessun dato" /></div> : (
                <table className="w-full text-left text-sm"><thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.1em] text-stone-500"><tr><th className="px-4 py-2.5">#</th><th>Cliente</th><th className="pr-4 text-right">Valore</th></tr></thead>
                  <tbody>{customerTotals.slice(0, 5).map((item, index) => <tr className="border-t border-stone-100" key={item.name}><td className="px-4 py-2.5"><span className="grid size-6 place-items-center rounded-full bg-[#f8edf3] text-[11px] font-black text-[#792f59]">{index + 1}</span></td><td className="font-bold text-stone-800">{item.name}</td><td className="pr-4 text-right font-bold tnum text-[#402334]">{euro(item.total)}</td></tr>)}</tbody>
                </table>
              )}
            </Card>
            <Card bodyClassName="p-0" subtitle="Mattina · pomeriggio · sera" title="Vendite per fascia oraria">
              <table className="w-full text-left text-sm"><thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.1em] text-stone-500"><tr><th className="px-4 py-2.5">Fascia</th><th>Vendite</th><th className="pr-4 text-right">Incassato</th></tr></thead>
                <tbody>
                  <tr className="border-t border-stone-100"><td className="px-4 py-2.5 font-bold text-stone-800">Mattina</td><td className="text-stone-500">{dayPartTotals.mattina.count}</td><td className="pr-4 text-right font-bold tnum text-[#402334]">{euro(dayPartTotals.mattina.total)}</td></tr>
                  <tr className="border-t border-stone-100"><td className="px-4 py-2.5 font-bold text-stone-800">Pomeriggio</td><td className="text-stone-500">{dayPartTotals.pomeriggio.count}</td><td className="pr-4 text-right font-bold tnum text-[#402334]">{euro(dayPartTotals.pomeriggio.total)}</td></tr>
                  <tr className="border-t border-stone-100"><td className="px-4 py-2.5 font-bold text-stone-800">Sera</td><td className="text-stone-500">{dayPartTotals.sera.count}</td><td className="pr-4 text-right font-bold tnum text-[#402334]">{euro(dayPartTotals.sera.total)}</td></tr>
                </tbody>
              </table>
            </Card>
          </div>
        </div>
      )}

      {/* ============ REGISTRO VENDITE ============ */}
      {section === "sales" && (
        <Card actions={<div className="inline-flex gap-0.5 rounded-lg border border-[#e8dfe4] bg-[#faf7f9] p-0.5"><button className={`h-7 rounded-md px-2.5 text-[11px] font-bold ${density === "comfortable" ? "bg-white text-[#792f59] shadow-sm" : "text-stone-500"}`} onClick={() => setDensity("comfortable")} type="button">Comoda</button><button className={`h-7 rounded-md px-2.5 text-[11px] font-bold ${density === "compact" ? "bg-white text-[#792f59] shadow-sm" : "text-stone-500"}`} onClick={() => setDensity("compact")} type="button">Compatta</button></div>} bodyClassName="p-0" className="mt-4" subtitle={`${filteredRows.length} movimenti nel periodo selezionato.`} title="Registro vendite">
          <div className="flex flex-wrap items-center gap-3 p-4 pb-0">
            <label className="relative min-w-[240px] flex-1">
              <span className="sr-only">Cerca cliente o operatore</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
              <input className="w-full pl-10" onChange={(event) => setSearch(event.target.value)} placeholder="Cerca cliente o operatore" value={search} />
            </label>
            <select className="w-[190px]" onChange={(event) => setPaymentFilter(event.target.value as PaymentMethod | "all")} value={paymentFilter}><option value="all">Tutti i pagamenti</option>{Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            {filtersActive && <Button onClick={resetFilters} size="sm" variant="outline">Azzera filtri</Button>}
          </div>
          {!filteredRows.length ? <div className="p-4"><EmptyState description="Modifica la ricerca, i filtri o il periodo selezionato." title="Nessun movimento" /></div> : (
            <>
              <div className="mt-3 overflow-x-auto border-t border-[#e8dfe4]">
                <table className="w-full min-w-[880px] text-left text-sm">
                  <thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.12em] text-stone-500">
                    <tr>
                      <th className="cursor-pointer select-none px-5 py-3" onClick={() => setSort("date")}><span className={sort === "date" ? "text-[#792f59]" : ""}>Data</span>{sort === "date" && <ArrowDown className="ml-1 inline" size={11} />}</th>
                      <th>Cliente</th><th>Operatore</th><th>Pagamento</th><th>Sconto</th>
                      <th className="cursor-pointer select-none text-right" onClick={() => setSort("total")}><span className={sort === "total" ? "text-[#792f59]" : ""}>Totale</span>{sort === "total" && <ArrowDown className="ml-1 inline" size={11} />}</th>
                      <th className="w-8 pr-5" />
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((row) => (
                      <tr
                        className={`group cursor-pointer border-t border-stone-100 transition hover:bg-[#fffafd] focus-visible:bg-[#fffafd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#b85888] ${density === "compact" ? "[&>td]:py-1.5" : "[&>td]:py-3.5"}`}
                        key={row.id}
                        onClick={() => void openSale(row.id)}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void openSale(row.id); } }}
                        tabIndex={0}
                      >
                        <td className="px-5 text-stone-500">{new Date(row.closed_at).toLocaleString("it-IT")}</td>
                        <td className="font-bold text-stone-900 group-hover:text-[#792f59]">{row.customer_name || "Cliente occasionale"}</td>
                        <td className="text-stone-600">{row.staff_name || "—"}</td>
                        <td><div className="flex flex-wrap gap-1">{row.payment_methods.map((method) => <span className="rounded-full bg-[#f8edf3] px-2 py-1 text-[10px] font-bold text-[#792f59]" key={method}>{methodLabels[method]}</span>)}</div></td>
                        <td className="tnum text-stone-500">{euro(row.discount_cents)}</td>
                        <td className="text-right text-base font-black tnum text-[#402334]">{euro(row.total_cents)}</td>
                        <td className="pr-5 text-right text-[11px] font-bold text-[#792f59]">Dettaglio</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e8dfe4] px-5 py-3 text-xs text-stone-500">
                <span>{(salesPage - 1) * pageSize + 1}–{Math.min(salesPage * pageSize, filteredRows.length)} di {filteredRows.length} movimenti</span>
                <div className="flex items-center gap-1.5">
                  <Button disabled={salesPage <= 1} onClick={() => setSalesPage((value) => Math.max(1, value - 1))} size="sm" variant="outline">‹</Button>
                  <span className="px-2 font-bold text-stone-600">{salesPage} / {totalSalesPages}</span>
                  <Button disabled={salesPage >= totalSalesPages} onClick={() => setSalesPage((value) => Math.min(totalSalesPages, value + 1))} size="sm" variant="outline">›</Button>
                </div>
              </div>
            </>
          )}
        </Card>
      )}

      {/* ============ SPESE ============ */}
      {section === "expenses" && (
        <div className="mt-4 grid gap-3 xl:grid-cols-[.8fr_1.2fr]">
          <Card subtitle="Uscite operative nel periodo." title="Spese per categoria">
            {!overview?.expenses.categories.length ? <EmptyState description="Non ci sono uscite operative nel periodo selezionato." title="Nessuna spesa" /> : (
              <div className="space-y-3.5">
                {overview.expenses.categories.map((item, index) => {
                  const width = overview.expenses.summary.total_cents ? Math.max(6, item.total_cents / overview.expenses.summary.total_cents * 100) : 0;
                  return <div key={item.category}><div className="flex justify-between gap-3 text-xs"><strong className="font-bold text-stone-700">{item.category}</strong><span className="tnum font-semibold text-stone-500">{euro(item.total_cents)} · {item.count}</span></div><div className="mt-1.5 h-2 rounded-full bg-[#f1e9ee]"><div className="h-full rounded-full" style={{ background: paletteColors[index % paletteColors.length], width: `${width}%` }} /></div></div>;
                })}
              </div>
            )}
            {Boolean(supplierTotals.length) && (
              <>
                <div className="mb-2 mt-5 text-[10px] font-black uppercase tracking-[.1em] text-stone-500">Top fornitori</div>
                <div className="space-y-1.5">{supplierTotals.map((item) => <div className="flex justify-between text-xs" key={item.name}><span className="font-semibold text-stone-600">{item.name}</span><strong className="tnum font-bold text-stone-800">{euro(item.total)}</strong></div>)}</div>
              </>
            )}
          </Card>
          <Card bodyClassName="p-0" subtitle={`${overview?.expenses.rows.length ?? 0} uscite nel periodo selezionato.`} title="Registro spese">
            {!overview?.expenses.rows.length ? <div className="p-4"><EmptyState description="Le spese registrate compariranno qui insieme al documento sorgente." title="Nessuna uscita" /></div> : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.12em] text-stone-500"><tr><th className="px-4 py-3">Data</th><th>Descrizione</th><th>Categoria</th><th>Fornitore</th><th>Documento</th><th className="pr-4 text-right">Totale</th></tr></thead>
                    <tbody>{pagedExpenseRows.map((expense) => <tr className="border-t border-stone-100" key={expense.id}><td className="px-4 py-3 text-stone-500">{new Date(expense.competence_date).toLocaleDateString("it-IT")}</td><td className="font-bold text-stone-800">{expense.description}</td><td className="text-stone-600">{expense.category}</td><td className="text-stone-600">{expense.supplier_name ?? "—"}</td><td className="text-stone-500">{expense.document_number ?? "—"}</td><td className="pr-4 text-right font-black tnum text-[#402334]">{euro(expense.total_cents)}</td></tr>)}</tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e8dfe4] px-4 py-3 text-xs text-stone-500">
                  <span>{(expensePage - 1) * pageSize + 1}–{Math.min(expensePage * pageSize, overview.expenses.rows.length)} di {overview.expenses.rows.length} uscite</span>
                  <div className="flex items-center gap-1.5">
                    <Button disabled={expensePage <= 1} onClick={() => setExpensePage((value) => Math.max(1, value - 1))} size="sm" variant="outline">‹</Button>
                    <span className="px-2 font-bold text-stone-600">{expensePage} / {totalExpensePages}</span>
                    <Button disabled={expensePage >= totalExpensePages} onClick={() => setExpensePage((value) => Math.min(totalExpensePages, value + 1))} size="sm" variant="outline">›</Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* ============ ANALISI & CONFRONTI ============ */}
      {section === "analysis" && (
        <div className="mt-4 space-y-3">
          {!compareEnabled || !previousData ? (
            <EmptyState description="Attiva “Confronta periodo precedente” in alto per vedere l'analisi comparativa." title="Confronto disattivato" />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#e8dfe4] bg-white p-4"><span className="text-[11px] font-black uppercase tracking-[.08em] text-stone-500">Incassato</span><div className="mt-1.5 flex items-baseline gap-2"><strong className="text-2xl font-black tnum">{euro(data?.summary.total_cents ?? 0)}</strong><span className="tnum text-xs text-stone-400 line-through">{euro(previousData.summary.total_cents)}</span></div><DeltaChip value={incassatoDelta} /></div>
                <div className="rounded-2xl border border-[#e8dfe4] bg-white p-4"><span className="text-[11px] font-black uppercase tracking-[.08em] text-stone-500">Margine netto</span><div className="mt-1.5 flex items-baseline gap-2"><strong className="text-2xl font-black tnum">{euro(overview?.summary.gross_margin_cents ?? 0)}</strong><span className="tnum text-xs text-stone-400 line-through">{euro(previousOverview?.summary.gross_margin_cents ?? 0)}</span></div><DeltaChip value={margineDelta} /></div>
                <div className="rounded-2xl border border-[#e8dfe4] bg-white p-4"><span className="text-[11px] font-black uppercase tracking-[.08em] text-stone-500">Scontrino medio</span><div className="mt-1.5 flex items-baseline gap-2"><strong className="text-2xl font-black tnum">{euro(data?.summary.average_cents ?? 0)}</strong><span className="tnum text-xs text-stone-400 line-through">{euro(previousData.summary.average_cents)}</span></div><DeltaChip value={scontrinoDelta} /></div>
              </div>

              <Card subtitle="Ricavi meno spese registrate, giorno per giorno nel periodo." title="Margine netto — andamento nel periodo">
                <MarginLineChart points={dailyMargin} />
              </Card>

              <Card bodyClassName="p-0" subtitle="Incasso per operatore, periodo corrente vs precedente." title="Performance per operatore">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.1em] text-stone-500"><tr><th className="px-4 py-2.5">Operatore</th><th className="text-right">Periodo corrente</th><th className="text-right">Periodo precedente</th><th className="pr-4 text-right">Var.</th></tr></thead>
                  <tbody>{operatorGrowth.map((item) => (
                    <tr className="border-t border-stone-100" key={item.name}>
                      <td className="px-4 py-2.5 font-bold text-stone-800">{item.name}</td>
                      <td className="text-right tnum text-stone-700">{euro(item.total)}</td>
                      <td className="text-right tnum text-stone-400">{euro(item.previousTotal)}</td>
                      <td className={`pr-4 text-right text-xs font-black ${item.delta === null ? "text-stone-400" : item.delta >= 0 ? "text-[#1c7a5c]" : "text-[#b23a2e]"}`}>{item.delta === null ? "—" : `${item.delta >= 0 ? "+" : ""}${item.delta.toFixed(1)}%`}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ============ REPORT ============ */}
      {section === "report" && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[340px_1fr]">
          <Card bodyClassName="p-0" className="self-start">
            <div className="border-b border-[#e8dfe4] p-4">
              <span className="mb-2.5 block text-[11px] font-black uppercase tracking-[.08em] text-stone-500">Tipo di rapporto</span>
              {presetLabels.map(([value, label]) => (
                <label className={`mb-1.5 flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] font-bold last:mb-0 ${preset === value ? "border-[#792f59] bg-[#f7eef3] text-[#43223a]" : "border-[#e8dfe4] text-stone-600"}`} key={value}>
                  <input checked={preset === value} className="accent-[#792f59]" onChange={() => selectPreset(value)} type="radio" />
                  <span><span className="block">{reportTypeLabels[value]}</span><span className="mt-0.5 block text-[11.5px] font-medium text-stone-400">{periodLabel(value, fromDate, toDate)}</span></span>
                </label>
              ))}
              <label className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] font-bold ${preset === "custom" ? "border-[#792f59] bg-[#f7eef3] text-[#43223a]" : "border-[#e8dfe4] text-stone-600"}`}>
                <input checked={preset === "custom"} className="accent-[#792f59]" onChange={() => setPreset("custom")} type="radio" />
                <span>Periodo personalizzato<span className="mt-0.5 block text-[11.5px] font-medium text-stone-400">Regola le date nella barra sopra</span></span>
              </label>
            </div>
            <div className="border-b border-[#e8dfe4] p-4">
              <span className="mb-2.5 block text-[11px] font-black uppercase tracking-[.08em] text-stone-500">Formato</span>
              <div className="flex gap-1.5">
                <button className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border text-[12.5px] font-bold ${reportFormat === "pdf" ? "border-[#792f59] bg-[#792f59] text-white" : "border-[#e8dfe4] text-stone-600"}`} onClick={() => setReportFormat("pdf")} type="button"><FileText size={14} />PDF</button>
                <button className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border text-[12.5px] font-bold ${reportFormat === "excel" ? "border-[#792f59] bg-[#792f59] text-white" : "border-[#e8dfe4] text-stone-600"}`} onClick={() => setReportFormat("excel")} type="button"><Download size={14} />Excel</button>
              </div>
              <p className="mt-2.5 text-[11.5px] leading-5 text-stone-500">{reportFormat === "pdf" ? "Il PDF contiene il riepilogo del periodo e le spese per categoria, pronto da stampare o archiviare." : "L'Excel contiene il dettaglio riga per riga di ogni vendita e ogni pagamento del periodo."}</p>
            </div>
            <div className="p-4"><button className="h-11 w-full rounded-xl bg-[#792f59] text-[13.5px] font-black text-white transition hover:bg-[#5f2447]" onClick={() => reportFormat === "pdf" ? exportPdf() : exportRegister()} type="button">Genera rapportino</button></div>
          </Card>

          <div className="rounded-sm border border-[#d9c9ce] bg-white shadow-[0_22px_44px_rgb(45_29_39_/_0.14),0_2px_6px_rgb(45_29_39_/_0.08)]">
            <div className="p-8 pb-7">
              <div className="flex items-start justify-between gap-4 border-b-2 border-stone-900 pb-4">
                <div className="font-display text-lg font-semibold text-stone-900">{salon?.name ?? "EsseBeauty"}</div>
                <div className="text-right text-[11px] leading-6 text-stone-500">Generato il {new Date().toLocaleString("it-IT")}</div>
              </div>
              <h2 className="font-display mt-5 text-2xl font-semibold text-stone-900">{reportTypeLabels[preset === "custom" ? "today" : preset]}</h2>
              <p className="mt-1 text-[13px] text-stone-500">{periodLabel(preset, fromDate, toDate)}</p>

              <div className="mt-6 border-t border-[#d9c9ce]">
                <div className="flex justify-between border-b border-dashed border-[#d9c9ce] py-2.5 font-mono text-[13px]"><span className="font-semibold text-stone-600">Incassato</span><span className="tnum">{euro(data?.summary.total_cents ?? 0)}</span></div>
                <div className="flex justify-between border-b border-dashed border-[#d9c9ce] py-2.5 font-mono text-[13px]"><span className="font-semibold text-stone-600">Sconti applicati</span><span className="tnum">− {euro(data?.summary.discount_cents ?? 0)}</span></div>
                <div className="flex justify-between border-b border-dashed border-[#d9c9ce] py-2.5 font-mono text-[13px]"><span className="font-semibold text-stone-600">Spese registrate</span><span className="tnum">− {euro(overview?.summary.expense_total_cents ?? 0)}</span></div>
                <div className="font-display mt-1 flex justify-between border-t-2 border-stone-900 pt-3.5 text-base font-semibold"><span>Margine netto</span><span className="tnum">{euro(overview?.summary.gross_margin_cents ?? 0)}</span></div>
              </div>

              {Boolean(data?.payments.length) && (
                <>
                  <div className="mt-6 text-[11px] font-black uppercase tracking-[.1em] text-stone-500">Metodi di pagamento</div>
                  <table className="mt-2.5 w-full text-[12.5px]">{data?.payments.map((item) => <tr key={item.method}><td className="border-b border-[#e8dfe4] py-1.5">{methodLabels[item.method as PaymentMethod] ?? item.method}</td><td className="border-b border-[#e8dfe4] py-1.5 text-right font-mono tnum">{euro(item.amount_cents)}</td></tr>)}</table>
                </>
              )}

              {Boolean(overview?.expenses.categories.length) && (
                <>
                  <div className="mt-6 text-[11px] font-black uppercase tracking-[.1em] text-stone-500">Spese per categoria</div>
                  <table className="mt-2.5 w-full text-[12.5px]">{overview?.expenses.categories.map((item) => <tr key={item.category}><td className="border-b border-[#e8dfe4] py-1.5">{item.category}</td><td className="border-b border-[#e8dfe4] py-1.5 text-right font-mono tnum">{euro(item.total_cents)}</td></tr>)}</table>
                </>
              )}

              {Boolean(operatorTotals.length) && (
                <>
                  <div className="mt-6 text-[11px] font-black uppercase tracking-[.1em] text-stone-500">Migliori operatori</div>
                  <table className="mt-2.5 w-full text-[12.5px]">{operatorTotals.slice(0, 4).map((item) => <tr key={item.name}><td className="border-b border-[#e8dfe4] py-1.5">{item.name} — {item.count} vendite</td><td className="border-b border-[#e8dfe4] py-1.5 text-right font-mono tnum">{euro(item.total)}</td></tr>)}</table>
                </>
              )}

              <div className="mt-8 flex justify-end"><div className="w-52 text-center"><div className="border-t border-stone-400" /><div className="mt-1.5 text-[10px] text-stone-400">Firma responsabile di cassa</div></div></div>
              <div className="mt-6 flex justify-between border-t border-[#e8dfe4] pt-4 text-[10.5px] text-stone-400"><span>Documento generato automaticamente da EsseBeauty</span><span>Pagina 1 di 1</span></div>
            </div>
          </div>
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
