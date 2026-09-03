"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronRight, Download, RefreshCw, Search } from "lucide-react";
import { PERMISSION_KEYS } from "@esse-beauty/shared";
import { AppPage, Button, DateField, Drawer, EmptyState, InlineError, Switch } from "@esse-beauty/ui";
import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
type Preset = "today" | "week" | "month" | "last";
type Section = "export" | "overview" | "services" | "staff" | "trends";
type SortKey = "appointments" | "completed" | "name";
type DayPartKey = "afternoon" | "evening" | "morning";

interface StaffRow { appointment_count: number; cancellation_count: number; completed_count: number; most_performed_service?: string | null; no_show_count: number; staff_id: string; staff_name: string; unique_customers: number; }
interface ServiceRow { appointment_count: number; completed_count: number; no_show_count: number; service_id: string; service_name: string; unique_customers: number; }
interface DayPartRow { appointment_count: number; completed_count: number; part: DayPartKey; }
interface OverviewData { daily: Array<{ appointment_count: number; completed_count: number; day: string }>; dayParts: DayPartRow[]; summary: { appointment_count: number; cancellation_count: number; completed_count: number; no_show_count: number; unique_customers: number }; }
interface Summary { appointments: number; cancelled: number; completed: number; customers: number; noShow: number; }

const dayPartLabels: Record<DayPartKey, string> = { afternoon: "Pomeriggio", evening: "Sera", morning: "Mattina" };
const dayPartOrder: DayPartKey[] = ["morning", "afternoon", "evening"];
const sectionByPath: Record<string, Section> = { "/reports": "overview", "/reports/export": "export", "/reports/services": "services", "/reports/staff": "staff", "/reports/trends": "trends" };
const pageHeaderContent: Record<Section, { subtitle: string; title: string }> = {
  export: { subtitle: "Scarica il registro appuntamenti del periodo in Excel, con anteprima del riepilogo.", title: "Esporta" },
  overview: { subtitle: "Volumi, qualità e rendimento del salone in un'unica vista.", title: "Panoramica" },
  services: { subtitle: "Cerca e ordina la domanda per servizio, con incidenza sul totale.", title: "Analisi servizi" },
  staff: { subtitle: "Cerca e ordina il rendimento di ogni collaboratore nel periodo.", title: "Rendimento operatori" },
  trends: { subtitle: "Confronta il periodo con quello precedente: tasso di completamento e crescita per operatore.", title: "Andamento & confronti" },
};

function inputDate(date: Date) { return date.toLocaleDateString("en-CA"); }
function presetDates(preset: string) {
  const now = new Date(); const from = new Date(now); const to = new Date(now);
  if (preset === "today") from.setHours(0, 0, 0, 0);
  if (preset === "week") { from.setDate(now.getDate() - ((now.getDay() + 6) % 7)); from.setHours(0, 0, 0, 0); }
  if (preset === "month") { from.setDate(1); from.setHours(0, 0, 0, 0); }
  if (preset === "last") { from.setMonth(now.getMonth() - 1, 1); from.setHours(0, 0, 0, 0); to.setDate(0); to.setHours(23, 59, 59, 999); }
  return { from: inputDate(from), to: inputDate(to) };
}
function requestDates(from: string, to: string) { return { from: new Date(`${from}T00:00:00`).toISOString(), to: new Date(`${to}T23:59:59.999`).toISOString() }; }
function shiftRangeBack(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00`);
  const days = Math.round((new Date(`${to}T00:00:00`).getTime() - fromDate.getTime()) / 86_400_000) + 1;
  const previousTo = new Date(fromDate); previousTo.setDate(previousTo.getDate() - 1);
  const previousFrom = new Date(previousTo); previousFrom.setDate(previousFrom.getDate() - (days - 1));
  return { from: inputDate(previousFrom), to: inputDate(previousTo) };
}
function formatDayLabel(day: string) { return new Date(`${day}T12:00:00`).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }); }
function percent(value: number, total: number) { return total ? Math.round(value / total * 100) : 0; }
function percentDelta(current: number, previous: number) { return previous ? (current - previous) / previous * 100 : null; }
function aggregateOwn(rows: StaffRow[]): Summary {
  return rows.reduce((acc, row) => ({ appointments: acc.appointments + Number(row.appointment_count), cancelled: acc.cancelled + Number(row.cancellation_count), completed: acc.completed + Number(row.completed_count), customers: acc.customers + Number(row.unique_customers), noShow: acc.noShow + Number(row.no_show_count) }), { appointments: 0, cancelled: 0, completed: 0, customers: 0, noShow: 0 });
}
function summaryFrom(overview: OverviewData | undefined, ownRows: StaffRow[]): Summary {
  return overview ? { appointments: overview.summary.appointment_count, cancelled: overview.summary.cancellation_count, completed: overview.summary.completed_count, customers: overview.summary.unique_customers, noShow: overview.summary.no_show_count } : aggregateOwn(ownRows);
}

function Card({ actions, bodyClassName = "", children, className = "", subtitle, title }: { actions?: ReactNode; bodyClassName?: string; children: ReactNode; className?: string; subtitle?: ReactNode; title?: ReactNode }) {
  return (
    <div className={`esse-panel overflow-hidden rounded-2xl border border-[#e8dfe4] bg-white shadow-[0_10px_30px_rgb(45_29_39_/_0.055)] ${className}`}>
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

function SortArrow({ active, dir }: { active: boolean; dir: 1 | -1 }) {
  if (!active) return null;
  return dir === 1 ? <ArrowUp className="ml-1 inline" size={11} /> : <ArrowDown className="ml-1 inline" size={11} />;
}

export default function ReportsPage() {
  const { hasPermission, salon } = useAuth();
  const pathname = usePathname();
  const section: Section = sectionByPath[pathname] ?? "overview";
  const canAll = hasPermission(PERMISSION_KEYS.REPORTS_VIEW_ALL);
  const canExport = hasPermission(PERMISSION_KEYS.REPORTS_EXPORT);

  const [compareEnabled, setCompareEnabled] = useState(true);
  const [preset, setPreset] = useState<Preset | "custom">("month");
  const initialRange = useMemo(() => presetDates("month"), []);
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [staffRows, setStaffRows] = useState<StaffRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [overview, setOverview] = useState<OverviewData>();
  const [previousStaffRows, setPreviousStaffRows] = useState<StaffRow[]>([]);
  const [previousOverview, setPreviousOverview] = useState<OverviewData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [staffSearch, setStaffSearch] = useState("");
  const [staffSort, setStaffSort] = useState<{ dir: 1 | -1; key: SortKey }>({ dir: -1, key: "completed" });
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceSort, setServiceSort] = useState<{ dir: 1 | -1; key: SortKey }>({ dir: -1, key: "appointments" });
  const [selectedStaff, setSelectedStaff] = useState<StaffRow>();
  const [selectedService, setSelectedService] = useState<ServiceRow>();

  async function load(signal?: AbortSignal) {
    if (!salon) return;
    const query = new URLSearchParams(requestDates(fromDate, toDate));
    const previousRange = shiftRangeBack(fromDate, toDate);
    const previousQuery = new URLSearchParams(requestDates(previousRange.from, previousRange.to));
    setLoading(true); setError("");
    try {
      const [staffResponse, serviceResponse, overviewResponse, previousStaffResponse, previousOverviewResponse] = await Promise.all([
        fetch(`${api}/api/salons/${salon.id}/reports/${canAll ? "staff" : "own"}?${query}`, { credentials: "include", signal }),
        canAll ? fetch(`${api}/api/salons/${salon.id}/reports/services?${query}`, { credentials: "include", signal }) : null,
        canAll ? fetch(`${api}/api/salons/${salon.id}/reports/overview?${query}`, { credentials: "include", signal }) : null,
        compareEnabled ? fetch(`${api}/api/salons/${salon.id}/reports/${canAll ? "staff" : "own"}?${previousQuery}`, { credentials: "include", signal }) : null,
        compareEnabled && canAll ? fetch(`${api}/api/salons/${salon.id}/reports/overview?${previousQuery}`, { credentials: "include", signal }) : null,
      ]);
      if (!staffResponse.ok || (serviceResponse && !serviceResponse.ok) || (overviewResponse && !overviewResponse.ok)) throw new Error("Impossibile caricare i report.");
      setStaffRows(await staffResponse.json() as StaffRow[]);
      setServices(serviceResponse ? await serviceResponse.json() as ServiceRow[] : []);
      setOverview(overviewResponse ? await overviewResponse.json() as OverviewData : undefined);
      setPreviousStaffRows(previousStaffResponse?.ok ? await previousStaffResponse.json() as StaffRow[] : []);
      setPreviousOverview(previousOverviewResponse?.ok ? await previousOverviewResponse.json() as OverviewData : undefined);
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Impossibile caricare i report.");
    } finally { setLoading(false); }
  }
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [canAll, compareEnabled, fromDate, salon?.id, toDate]);

  const summary = summaryFrom(overview, staffRows);
  const previousSummary = summaryFrom(previousOverview, previousStaffRows);
  const pending = Math.max(0, summary.appointments - summary.completed - summary.cancelled - summary.noShow);
  const appointmentsDelta = compareEnabled ? percentDelta(summary.appointments, previousSummary.appointments) : null;
  const completedDelta = compareEnabled ? percentDelta(summary.completed, previousSummary.completed) : null;
  const customersDelta = compareEnabled ? percentDelta(summary.customers, previousSummary.customers) : null;
  const noShowDelta = compareEnabled ? percentDelta(summary.noShow, previousSummary.noShow) : null;
  const cancelledDelta = compareEnabled ? percentDelta(summary.cancelled, previousSummary.cancelled) : null;
  const maxDaily = Math.max(1, ...(overview?.daily ?? []).map((item) => item.appointment_count));
  const rankedStaff = useMemo(() => [...staffRows].sort((a, b) => Number(b.completed_count) - Number(a.completed_count)), [staffRows]);
  const rankedServices = useMemo(() => [...services].sort((a, b) => Number(b.appointment_count) - Number(a.appointment_count)), [services]);
  const completedEnd = percent(summary.completed, summary.appointments);
  const noShowEnd = percent(summary.completed + summary.noShow, summary.appointments);
  const cancelledEnd = percent(summary.completed + summary.noShow + summary.cancelled, summary.appointments);
  const donut = `conic-gradient(#287fb8 0 ${completedEnd}%, #f0a23b ${completedEnd}% ${noShowEnd}%, #d76969 ${noShowEnd}% ${cancelledEnd}%, #b9d7a8 ${cancelledEnd}% 100%)`;
  const dayParts = dayPartOrder.map((part) => overview?.dayParts.find((item) => item.part === part) ?? { appointment_count: 0, completed_count: 0, part });

  const filteredStaff = useMemo(() => {
    const needle = staffSearch.trim().toLocaleLowerCase("it-IT");
    return [...staffRows]
      .filter((row) => !needle || row.staff_name.toLocaleLowerCase("it-IT").includes(needle))
      .sort((a, b) => {
        if (staffSort.key === "name") return staffSort.dir * a.staff_name.localeCompare(b.staff_name, "it-IT");
        const field = staffSort.key === "appointments" ? "appointment_count" : "completed_count";
        return staffSort.dir * (Number(a[field]) - Number(b[field]));
      });
  }, [staffRows, staffSearch, staffSort]);
  const filteredServices = useMemo(() => {
    const needle = serviceSearch.trim().toLocaleLowerCase("it-IT");
    return [...services]
      .filter((row) => !needle || row.service_name.toLocaleLowerCase("it-IT").includes(needle))
      .sort((a, b) => {
        if (serviceSort.key === "name") return serviceSort.dir * a.service_name.localeCompare(b.service_name, "it-IT");
        const field = serviceSort.key === "appointments" ? "appointment_count" : "completed_count";
        return serviceSort.dir * (Number(a[field]) - Number(b[field]));
      });
  }, [services, serviceSearch, serviceSort]);
  const totalServiceAppointments = services.reduce((total, row) => total + Number(row.appointment_count), 0);

  function toggleStaffSort(key: SortKey) { setStaffSort((current) => ({ dir: current.key === key ? (current.dir === 1 ? -1 : 1) : key === "name" ? 1 : -1, key })); }
  function toggleServiceSort(key: SortKey) { setServiceSort((current) => ({ dir: current.key === key ? (current.dir === 1 ? -1 : 1) : key === "name" ? 1 : -1, key })); }

  const completionTrend = (overview?.daily ?? []).map((item) => ({ day: item.day, rate: percent(item.completed_count, item.appointment_count) }));
  const currentRate = percent(summary.completed, summary.appointments);
  const previousRate = percent(previousSummary.completed, previousSummary.appointments);
  const currentNoShowRate = percent(summary.noShow, summary.appointments);
  const previousNoShowRate = percent(previousSummary.noShow, previousSummary.appointments);
  const staffGrowth = useMemo(() => {
    const previousById = new Map(previousStaffRows.map((row) => [row.staff_id, row]));
    return rankedStaff.map((row) => ({ ...row, delta: percentDelta(Number(row.completed_count), Number(previousById.get(row.staff_id)?.completed_count ?? 0)), previousCompleted: Number(previousById.get(row.staff_id)?.completed_count ?? 0) }));
  }, [previousStaffRows, rankedStaff]);

  function selectPreset(value: Preset) { const next = presetDates(value); setPreset(value); setFromDate(next.from); setToDate(next.to); }
  function exportRegister() { if (salon) window.location.href = `${api}/api/salons/${salon.id}/reports/export?${new URLSearchParams(requestDates(fromDate, toDate))}`; }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e8dfe4] pb-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#792f59]">Report</p>
          <h1 className="mt-1 text-[26px] font-bold tracking-[-.02em] text-stone-950">{pageHeaderContent[section].title}</h1>
          <p className="mt-1 text-[13px] text-stone-500">{pageHeaderContent[section].subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex h-9 items-center gap-2 rounded-xl border border-[#e8dfe4] bg-white px-3 text-[12.5px] font-bold text-stone-600">
            <Switch checked={compareEnabled} onCheckedChange={setCompareEnabled} />
            Confronta periodo precedente
          </label>
          <div className="inline-flex gap-0.5 rounded-xl border border-[#e8dfe4] bg-[#faf7f9] p-1">
            {([["today", "Oggi"], ["week", "Settimana"], ["month", "Mese"], ["last", "Mese scorso"]] as Array<[Preset, string]>).map(([value, label]) => <button aria-pressed={preset === value} className={`h-8 rounded-lg px-3 text-[12px] font-bold transition ${preset === value ? "bg-white text-[#792f59] shadow-sm" : "text-stone-500 hover:text-[#792f59]"}`} key={value} onClick={() => selectPreset(value)} type="button">{label}</button>)}
          </div>
          <button aria-label="Aggiorna report" className="grid size-9 place-items-center rounded-xl border border-[#e8dfe4] bg-white text-stone-600 transition hover:border-[#792f59] hover:text-[#792f59]" onClick={() => void load()} title="Aggiorna" type="button"><RefreshCw size={15} /></button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 border-b border-[#e8dfe4] py-3">
        <DateField aria-label="Data iniziale" max={toDate} onChange={(value) => { if (value) { setPreset("custom"); setFromDate(value); } }} value={fromDate} />
        <span className="text-xs font-bold text-stone-400">→</span>
        <DateField aria-label="Data finale" min={fromDate} onChange={(value) => { if (value) { setPreset("custom"); setToDate(value); } }} value={toDate} />
        {compareEnabled && <span className="text-xs font-semibold text-stone-400">Confronto con {formatDayLabel(shiftRangeBack(fromDate, toDate).from)} – {formatDayLabel(shiftRangeBack(fromDate, toDate).to)}</span>}
      </div>

      {error && <InlineError className="mt-4">{error}</InlineError>}
      {loading && <div className="mt-4 h-1 animate-pulse bg-[#792f59]" />}

      {/* ============ PANORAMICA ============ */}
      {section === "overview" && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[#e8dfe4] bg-[#e8dfe4] sm:grid-cols-3 lg:grid-cols-6">
            <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Appuntamenti</span><strong className="mt-1 block text-xl font-bold tabular-nums text-stone-950">{summary.appointments}</strong><DeltaChip value={appointmentsDelta} /></div>
            <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Completati</span><strong className="mt-1 block text-xl font-bold tabular-nums text-stone-950">{summary.completed}</strong><DeltaChip value={completedDelta} /></div>
            <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Clienti unici</span><strong className="mt-1 block text-xl font-bold tabular-nums text-stone-950">{summary.customers}</strong><DeltaChip value={customersDelta} /></div>
            <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">No-show</span><strong className="mt-1 block text-xl font-bold tabular-nums text-stone-950">{summary.noShow}</strong><DeltaChip suffix="vs periodo prec." value={noShowDelta === null ? null : -noShowDelta} /></div>
            <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Cancellati</span><strong className="mt-1 block text-xl font-bold tabular-nums text-stone-950">{summary.cancelled}</strong><DeltaChip suffix="vs periodo prec." value={cancelledDelta === null ? null : -cancelledDelta} /></div>
            <div className="bg-white px-4 py-3.5"><span className="text-[10px] font-black uppercase tracking-wider text-stone-500">Da gestire</span><strong className="mt-1 block text-xl font-bold tabular-nums text-stone-950">{pending}</strong><span className="mt-1.5 block text-[11px] font-semibold text-stone-400">futuri o confermati</span></div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[1.55fr_.75fr]">
            <Card subtitle="Totale giornaliero, periodo corrente vs precedente." title="Andamento appuntamenti">
              {!overview?.daily.length ? <EmptyState description="Non ci sono appuntamenti nel periodo." title="Nessun dato" /> : (
                <>
                  <svg className="w-full" viewBox="0 0 640 220">
                    <g stroke="#e8dfe4">{[16, 62, 108, 154, 200].map((y) => <line key={y} x1={40} x2={630} y1={y} y2={y} />)}</g>
                    <g className="fill-stone-400" fontSize={9.5}>{[16, 62, 108, 154, 200].map((y, index) => <text key={y} textAnchor="end" x={34} y={y + 3}>{Math.round(maxDaily * (1 - index / 4))}</text>)}</g>
                    {overview.daily.map((item, index) => {
                      const groupW = 590 / overview.daily.length; const x = 40 + index * groupW;
                      const barW = Math.max(2, Math.min(22, groupW * (compareEnabled ? 0.34 : 0.6)));
                      const prevPoint = compareEnabled ? previousOverview?.daily[index] : undefined;
                      const currH = item.appointment_count / maxDaily * 155; const prevH = prevPoint ? prevPoint.appointment_count / maxDaily * 155 : 0;
                      return (
                        <g key={item.day}>
                          {prevPoint && <rect fill="#a89ba0" height={prevH} opacity={0.45} rx={2} width={barW} x={x + groupW / 2 - barW - 2} y={200 - prevH} />}
                          <rect fill="#792f59" height={currH} rx={2} width={barW} x={prevPoint ? x + groupW / 2 + 2 : x + groupW / 2 - barW / 2} y={200 - currH} />
                          <text className="fill-stone-400" fontSize={9} textAnchor="middle" x={x + groupW / 2} y={214}>{formatDayLabel(item.day)}</text>
                        </g>
                      );
                    })}
                  </svg>
                  <div className="mt-1 flex gap-4 text-[11px] text-stone-500"><span className="inline-flex items-center gap-1.5"><i className="inline-block size-2 rounded-sm bg-[#792f59]" />Periodo corrente</span>{compareEnabled && <span className="inline-flex items-center gap-1.5"><i className="inline-block size-2 rounded-sm bg-stone-400 opacity-50" />Periodo precedente</span>}</div>
                </>
              )}
            </Card>
            <Card title="Distribuzione stati">
              <div className="grid grid-cols-[140px_1fr] items-center gap-5">
                <div className="relative aspect-square rounded-full" style={{ background: donut }}><div className="absolute inset-[27%] grid place-items-center rounded-full bg-white text-center shadow-[inset_0_0_0_1px_rgb(232_223_228)]"><strong className="text-xl font-bold">{summary.appointments}</strong><span className="text-[9px] text-stone-500">totali</span></div></div>
                <div className="space-y-2 text-xs">
                  {[["Completati", summary.completed, "#287fb8"], ["No-show", summary.noShow, "#f0a23b"], ["Cancellati", summary.cancelled, "#d76969"], ["Da gestire", pending, "#b9d7a8"]].map(([label, value, color]) => <div className="grid grid-cols-[10px_1fr_auto] items-center gap-2" key={String(label)}><i className="h-2.5 w-2.5 rounded-sm" style={{ background: String(color) }} /><span>{label}</span><strong className="tabular-nums">{value}</strong></div>)}
                </div>
              </div>
            </Card>
          </div>

          {canAll && <div className="grid gap-3 xl:grid-cols-3">
            <Card bodyClassName="p-0" title="Top operatori">
              {!rankedStaff.length ? <div className="p-4"><EmptyState description="Non ci sono appuntamenti nel periodo." title="Nessun dato" /></div> : (
                <table className="w-full text-left text-sm"><thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.1em] text-stone-500"><tr><th className="px-4 py-2.5">#</th><th>Operatore</th><th className="pr-4 text-right">Completati</th></tr></thead>
                  <tbody>{rankedStaff.slice(0, 5).map((item, index) => <tr className="border-t border-stone-100" key={item.staff_id}><td className="px-4 py-2.5"><span className="grid size-6 place-items-center rounded-full bg-[#f8edf3] text-[11px] font-black text-[#792f59]">{index + 1}</span></td><td className="font-bold text-stone-800">{item.staff_name}</td><td className="pr-4 text-right font-bold tabular-nums text-[#402334]">{item.completed_count}</td></tr>)}</tbody>
                </table>
              )}
            </Card>
            <Card bodyClassName="p-0" title="Servizi più richiesti">
              {!rankedServices.length ? <div className="p-4"><EmptyState description="Non ci sono appuntamenti nel periodo." title="Nessun dato" /></div> : (
                <table className="w-full text-left text-sm"><thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.1em] text-stone-500"><tr><th className="px-4 py-2.5">#</th><th>Servizio</th><th className="pr-4 text-right">App.</th></tr></thead>
                  <tbody>{rankedServices.slice(0, 5).map((item, index) => <tr className="border-t border-stone-100" key={item.service_id}><td className="px-4 py-2.5"><span className="grid size-6 place-items-center rounded-full bg-[#f8edf3] text-[11px] font-black text-[#792f59]">{index + 1}</span></td><td className="max-w-40 truncate font-bold text-stone-800">{item.service_name}</td><td className="pr-4 text-right font-bold tabular-nums text-[#402334]">{item.appointment_count}</td></tr>)}</tbody>
                </table>
              )}
            </Card>
            <Card bodyClassName="p-0" subtitle="Mattina · pomeriggio · sera" title="Fasce orarie">
              <table className="w-full text-left text-sm"><thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.1em] text-stone-500"><tr><th className="px-4 py-2.5">Fascia</th><th>App.</th><th className="pr-4 text-right">Completati</th></tr></thead>
                <tbody>{dayParts.map((item) => <tr className="border-t border-stone-100" key={item.part}><td className="px-4 py-2.5 font-bold text-stone-800">{dayPartLabels[item.part]}</td><td className="text-stone-500 tabular-nums">{item.appointment_count}</td><td className="pr-4 text-right font-bold tabular-nums text-[#402334]">{item.completed_count}</td></tr>)}</tbody>
              </table>
            </Card>
          </div>}
        </div>
      )}

      {/* ============ OPERATORI ============ */}
      {section === "staff" && canAll && (
        <Card actions={<span className="text-xs font-semibold text-stone-400">{filteredStaff.length} collaboratori</span>} bodyClassName="p-0" className="mt-4" title="Registro rendimento operatori">
          <div className="flex flex-wrap items-center gap-3 p-4 pb-0">
            <label className="relative min-w-[240px] flex-1">
              <span className="sr-only">Cerca operatore</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
              <input className="w-full pl-10" onChange={(event) => setStaffSearch(event.target.value)} placeholder="Cerca operatore" value={staffSearch} />
            </label>
          </div>
          {!filteredStaff.length ? <div className="p-4"><EmptyState description="Modifica la ricerca o il periodo selezionato." title="Nessun operatore" /></div> : (
            <div className="mt-3 overflow-x-auto border-t border-[#e8dfe4]">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.12em] text-stone-500">
                  <tr>
                    <th className="px-5 py-3">#</th>
                    <th className="cursor-pointer select-none" onClick={() => toggleStaffSort("name")}><span className={staffSort.key === "name" ? "text-[#792f59]" : ""}>Operatore</span><SortArrow active={staffSort.key === "name"} dir={staffSort.dir} /></th>
                    <th className="cursor-pointer select-none" onClick={() => toggleStaffSort("appointments")}><span className={staffSort.key === "appointments" ? "text-[#792f59]" : ""}>App.</span><SortArrow active={staffSort.key === "appointments"} dir={staffSort.dir} /></th>
                    <th className="cursor-pointer select-none" onClick={() => toggleStaffSort("completed")}><span className={staffSort.key === "completed" ? "text-[#792f59]" : ""}>Completati</span><SortArrow active={staffSort.key === "completed"} dir={staffSort.dir} /></th>
                    <th>Tasso</th><th>No-show</th><th>Clienti</th><th>Servizio top</th><th className="w-8 pr-5" />
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((row, index) => (
                    <tr className="group cursor-pointer border-t border-stone-100 transition hover:bg-[#fffafd] focus-visible:bg-[#fffafd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#b85888] [&>td]:py-3" key={row.staff_id} onClick={() => setSelectedStaff(row)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedStaff(row); } }} tabIndex={0}>
                      <td className="px-5"><span className="grid size-6 place-items-center rounded-full bg-[#f8edf3] text-[11px] font-black text-[#792f59]">{index + 1}</span></td>
                      <td className="font-bold text-stone-900 group-hover:text-[#792f59]">{row.staff_name}</td>
                      <td className="tabular-nums">{row.appointment_count}</td>
                      <td className="tabular-nums">{row.completed_count}</td>
                      <td className="font-bold tabular-nums text-[#287fb8]">{percent(row.completed_count, row.appointment_count)}%</td>
                      <td className="tabular-nums">{row.no_show_count}</td>
                      <td className="tabular-nums">{row.unique_customers}</td>
                      <td className="max-w-40 truncate">{row.most_performed_service ?? "—"}</td>
                      <td className="pr-5 text-right"><ChevronRight aria-label="Apri dettaglio operatore" className="inline text-[#792f59] transition group-hover:translate-x-0.5" size={16} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ============ SERVIZI ============ */}
      {section === "services" && canAll && (
        <Card actions={<span className="text-xs font-semibold text-stone-400">{filteredServices.length} servizi</span>} bodyClassName="p-0" className="mt-4" title="Registro analisi servizi">
          <div className="flex flex-wrap items-center gap-3 p-4 pb-0">
            <label className="relative min-w-[240px] flex-1">
              <span className="sr-only">Cerca servizio</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
              <input className="w-full pl-10" onChange={(event) => setServiceSearch(event.target.value)} placeholder="Cerca servizio" value={serviceSearch} />
            </label>
          </div>
          {!filteredServices.length ? <div className="p-4"><EmptyState description="Modifica la ricerca o il periodo selezionato." title="Nessun servizio" /></div> : (
            <div className="mt-3 overflow-x-auto border-t border-[#e8dfe4]">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.12em] text-stone-500">
                  <tr>
                    <th className="px-5 py-3">#</th>
                    <th className="cursor-pointer select-none" onClick={() => toggleServiceSort("name")}><span className={serviceSort.key === "name" ? "text-[#792f59]" : ""}>Servizio</span><SortArrow active={serviceSort.key === "name"} dir={serviceSort.dir} /></th>
                    <th className="cursor-pointer select-none" onClick={() => toggleServiceSort("appointments")}><span className={serviceSort.key === "appointments" ? "text-[#792f59]" : ""}>App.</span><SortArrow active={serviceSort.key === "appointments"} dir={serviceSort.dir} /></th>
                    <th className="cursor-pointer select-none" onClick={() => toggleServiceSort("completed")}><span className={serviceSort.key === "completed" ? "text-[#792f59]" : ""}>Completati</span><SortArrow active={serviceSort.key === "completed"} dir={serviceSort.dir} /></th>
                    <th>Tasso</th><th>Clienti</th><th>No-show</th><th>Incidenza</th><th className="w-8 pr-5" />
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.map((row, index) => (
                    <tr className="group cursor-pointer border-t border-stone-100 transition hover:bg-[#fffafd] focus-visible:bg-[#fffafd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#b85888] [&>td]:py-3" key={row.service_id} onClick={() => setSelectedService(row)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedService(row); } }} tabIndex={0}>
                      <td className="px-5"><span className="grid size-6 place-items-center rounded-full bg-[#f8edf3] text-[11px] font-black text-[#792f59]">{index + 1}</span></td>
                      <td className="max-w-44 truncate font-bold text-stone-900 group-hover:text-[#792f59]">{row.service_name}</td>
                      <td className="tabular-nums">{row.appointment_count}</td>
                      <td className="tabular-nums">{row.completed_count}</td>
                      <td className="font-bold tabular-nums text-[#287fb8]">{percent(row.completed_count, row.appointment_count)}%</td>
                      <td className="tabular-nums">{row.unique_customers}</td>
                      <td className="tabular-nums">{row.no_show_count}</td>
                      <td className="w-24"><div className="h-2 rounded bg-stone-100"><div className="h-full rounded bg-[#4a9b8f]" style={{ width: `${percent(row.appointment_count, totalServiceAppointments)}%` }} /></div></td>
                      <td className="pr-5 text-right"><ChevronRight aria-label="Apri dettaglio servizio" className="inline text-[#792f59] transition group-hover:translate-x-0.5" size={16} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ============ ANDAMENTO & CONFRONTI ============ */}
      {section === "trends" && canAll && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 xl:grid-cols-[1.5fr_.8fr]">
            <Card subtitle="Quota appuntamenti completati sul totale, giorno per giorno." title="Tasso di completamento nel tempo">
              {!completionTrend.length ? <EmptyState description="Non ci sono appuntamenti nel periodo." title="Nessun dato" /> : (() => {
                const values = completionTrend.map((point) => point.rate);
                const max = Math.max(100, ...values); const min = Math.min(0, ...values); const range = Math.max(1, max - min);
                const stepX = 600 / Math.max(1, completionTrend.length - 1);
                const coords = completionTrend.map((point, index) => [30 + index * stepX, 160 - ((point.rate - min) / range) * 150] as const);
                const path = coords.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x},${y}`).join(" ");
                const areaPath = `${path} L${coords[coords.length - 1]?.[0] ?? 30},160 L30,160 Z`;
                const last = coords[coords.length - 1];
                return (
                  <svg className="w-full" viewBox="0 0 640 190">
                    <g stroke="#e8dfe4">{[10, 60, 110, 160].map((y) => <line key={y} x1={30} x2={630} y1={y} y2={y} />)}</g>
                    <defs><linearGradient id="reportsRateFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#792f59" stopOpacity={0.28} /><stop offset="100%" stopColor="#792f59" stopOpacity={0} /></linearGradient></defs>
                    <path d={areaPath} fill="url(#reportsRateFill)" />
                    <path d={path} fill="none" stroke="#792f59" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} />
                    {last && <circle cx={last[0]} cy={last[1]} fill="#792f59" r={4.5} />}
                    {completionTrend.map((point, index) => index % Math.max(1, Math.ceil(completionTrend.length / 8)) === 0 && <text className="fill-stone-400" fontSize={9} key={point.day} textAnchor="middle" x={30 + index * stepX} y={180}>{formatDayLabel(point.day)}</text>)}
                  </svg>
                );
              })()}
            </Card>
            <Card title="Confronto rapido">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between border-t border-stone-100 pt-2 first:border-t-0 first:pt-0"><span className="text-stone-600">Tasso completamento</span><span className="font-bold tabular-nums text-[#402334]">{currentRate}% <DeltaChip suffix="pt" value={compareEnabled ? currentRate - previousRate : null} /></span></div>
                <div className="flex items-center justify-between border-t border-stone-100 pt-2"><span className="text-stone-600">Tasso no-show</span><span className="font-bold tabular-nums text-[#402334]">{currentNoShowRate}% <DeltaChip suffix="pt" value={compareEnabled ? -(currentNoShowRate - previousNoShowRate) : null} /></span></div>
                <div className="flex items-center justify-between border-t border-stone-100 pt-2"><span className="text-stone-600">Clienti unici</span><span className="font-bold tabular-nums text-[#402334]">{summary.customers} <DeltaChip value={customersDelta} /></span></div>
              </div>
            </Card>
          </div>
          <Card subtitle="Completati nel periodo corrente vs precedente." title="Crescita per operatore">
            {!compareEnabled ? <EmptyState description="Attiva “Confronta periodo precedente” per vedere la crescita per operatore." title="Confronto disattivato" /> : !staffGrowth.length ? <EmptyState description="Non ci sono appuntamenti nel periodo." title="Nessun dato" /> : (
              <table className="w-full text-left text-sm"><thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.1em] text-stone-500"><tr><th className="px-4 py-2.5">Operatore</th><th className="text-right">Periodo prec.</th><th className="pr-4 text-right">Periodo corrente</th><th className="pr-4 text-right">Variazione</th></tr></thead>
                <tbody>{staffGrowth.map((row) => <tr className="border-t border-stone-100" key={row.staff_id}><td className="px-4 py-2.5 font-bold text-stone-800">{row.staff_name}</td><td className="text-right tabular-nums text-stone-500">{row.previousCompleted}</td><td className="pr-4 text-right font-bold tabular-nums text-[#402334]">{row.completed_count}</td><td className="pr-4 text-right"><DeltaChip suffix="" value={row.delta} /></td></tr>)}</tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {/* ============ ESPORTA ============ */}
      {section === "export" && canExport && (
        <div className="mt-4 grid gap-3 md:grid-cols-[320px_1fr]">
          <Card title="Esporta registro">
            <p className="text-sm text-stone-600">Scarica il registro appuntamenti del periodo selezionato, con un foglio di riepilogo, in formato Excel.</p>
            <Button className="mt-4 w-full justify-center" onClick={exportRegister}><Download className="mr-2" size={16} />Scarica Excel</Button>
          </Card>
          <Card subtitle={`${formatDayLabel(fromDate)} – ${formatDayLabel(toDate)}`} title="Anteprima riepilogo">
            <table className="w-full text-left text-sm"><thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.1em] text-stone-500"><tr><th className="px-4 py-2.5">Indicatore</th><th className="pr-4 text-right">Valore</th></tr></thead>
              <tbody>
                <tr className="border-t border-stone-100"><td className="px-4 py-2.5 font-bold text-stone-800">Appuntamenti totali</td><td className="pr-4 text-right tabular-nums">{summary.appointments}</td></tr>
                <tr className="border-t border-stone-100"><td className="px-4 py-2.5 font-bold text-stone-800">Completati</td><td className="pr-4 text-right tabular-nums">{summary.completed}</td></tr>
                <tr className="border-t border-stone-100"><td className="px-4 py-2.5 font-bold text-stone-800">Cancellati</td><td className="pr-4 text-right tabular-nums">{summary.cancelled}</td></tr>
                <tr className="border-t border-stone-100"><td className="px-4 py-2.5 font-bold text-stone-800">No-show</td><td className="pr-4 text-right tabular-nums">{summary.noShow}</td></tr>
                <tr className="border-t border-stone-100"><td className="px-4 py-2.5 font-bold text-stone-800">Clienti unici</td><td className="pr-4 text-right tabular-nums">{summary.customers}</td></tr>
              </tbody>
            </table>
          </Card>
        </div>
      )}

      <Drawer onClose={() => setSelectedStaff(undefined)} open={Boolean(selectedStaff)} title={selectedStaff?.staff_name ?? ""}>
        {selectedStaff && (
          <div className="space-y-4">
            <p className="text-xs text-stone-500">Dettaglio rendimento · periodo selezionato</p>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-[#e8dfe4] p-3"><span className="text-[9.5px] font-black uppercase tracking-wider text-stone-500">Appuntamenti</span><strong className="mt-1 block text-base font-bold tabular-nums">{selectedStaff.appointment_count}</strong></div>
              <div className="rounded-xl border border-[#e8dfe4] p-3"><span className="text-[9.5px] font-black uppercase tracking-wider text-stone-500">Tasso completamento</span><strong className="mt-1 block text-base font-bold tabular-nums">{percent(selectedStaff.completed_count, selectedStaff.appointment_count)}%</strong></div>
              <div className="rounded-xl border border-[#e8dfe4] p-3"><span className="text-[9.5px] font-black uppercase tracking-wider text-stone-500">Clienti unici</span><strong className="mt-1 block text-base font-bold tabular-nums">{selectedStaff.unique_customers}</strong></div>
              <div className="rounded-xl border border-[#e8dfe4] p-3"><span className="text-[9.5px] font-black uppercase tracking-wider text-stone-500">No-show</span><strong className="mt-1 block text-base font-bold tabular-nums">{selectedStaff.no_show_count}</strong></div>
            </div>
            <div className="flex justify-between border-t border-stone-100 pt-2.5 text-sm"><span className="text-stone-500">Cancellati</span><strong className="tabular-nums text-stone-900">{selectedStaff.cancellation_count}</strong></div>
            <div className="flex justify-between border-t border-stone-100 pt-2.5 text-sm"><span className="text-stone-500">Servizio più eseguito</span><strong className="text-stone-900">{selectedStaff.most_performed_service ?? "—"}</strong></div>
          </div>
        )}
      </Drawer>

      <Drawer onClose={() => setSelectedService(undefined)} open={Boolean(selectedService)} title={selectedService?.service_name ?? ""}>
        {selectedService && (
          <div className="space-y-4">
            <p className="text-xs text-stone-500">Dettaglio servizio · periodo selezionato</p>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-[#e8dfe4] p-3"><span className="text-[9.5px] font-black uppercase tracking-wider text-stone-500">Appuntamenti</span><strong className="mt-1 block text-base font-bold tabular-nums">{selectedService.appointment_count}</strong></div>
              <div className="rounded-xl border border-[#e8dfe4] p-3"><span className="text-[9.5px] font-black uppercase tracking-wider text-stone-500">Tasso completamento</span><strong className="mt-1 block text-base font-bold tabular-nums">{percent(selectedService.completed_count, selectedService.appointment_count)}%</strong></div>
              <div className="rounded-xl border border-[#e8dfe4] p-3"><span className="text-[9.5px] font-black uppercase tracking-wider text-stone-500">Clienti unici</span><strong className="mt-1 block text-base font-bold tabular-nums">{selectedService.unique_customers}</strong></div>
              <div className="rounded-xl border border-[#e8dfe4] p-3"><span className="text-[9.5px] font-black uppercase tracking-wider text-stone-500">Incidenza</span><strong className="mt-1 block text-base font-bold tabular-nums">{percent(selectedService.appointment_count, totalServiceAppointments)}%</strong></div>
            </div>
            <div className="flex justify-between border-t border-stone-100 pt-2.5 text-sm"><span className="text-stone-500">No-show</span><strong className="tabular-nums text-stone-900">{selectedService.no_show_count}</strong></div>
          </div>
        )}
      </Drawer>
    </AppPage>
  );
}
