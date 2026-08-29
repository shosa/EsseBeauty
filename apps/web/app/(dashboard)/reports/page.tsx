"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Download, RefreshCw } from "lucide-react";
import { PERMISSION_KEYS } from "@esse-beauty/shared";
import { AppPage, Button, DateField, EmptyState, InlineError, PageHeader } from "@esse-beauty/ui";
import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
interface StaffRow { appointment_count: number; cancellation_count: number; completed_count: number; most_performed_service?: string; no_show_count: number; staff_id: string; staff_name: string; unique_customers: number; }
interface ServiceRow { appointment_count: number; completed_count: number; no_show_count: number; service_id: string; service_name: string; unique_customers: number; }
interface OverviewData { daily: Array<{ appointment_count: number; completed_count: number; day: string }>; summary: { appointment_count: number; cancellation_count: number; completed_count: number; no_show_count: number; unique_customers: number }; }

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
function percent(value: number, total: number) { return total ? Math.round(value / total * 100) : 0; }
function Panel({ children, className = "", title }: { children: ReactNode; className?: string; title: string }) { return <section className={`min-w-0 border border-stone-200 bg-white ${className}`}><h2 className="border-b border-stone-200 px-4 py-2 text-sm font-black text-[#345f5a]">{title}</h2><div className="p-4">{children}</div></section>; }

export default function ReportsPage() {
  const { salon, hasPermission } = useAuth();
  const initialRange = useMemo(() => presetDates("month"), []);
  const [preset, setPreset] = useState("month");
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [staffRows, setStaffRows] = useState<StaffRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [overview, setOverview] = useState<OverviewData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canAll = hasPermission(PERMISSION_KEYS.REPORTS_VIEW_ALL);

  async function load(signal?: AbortSignal) {
    if (!salon) return;
    const query = new URLSearchParams(requestDates(fromDate, toDate));
    setLoading(true); setError("");
    try {
      const [staffResponse, serviceResponse, overviewResponse] = await Promise.all([
        fetch(`${api}/api/salons/${salon.id}/reports/${canAll ? "staff" : "own"}?${query}`, { credentials: "include", signal }),
        canAll ? fetch(`${api}/api/salons/${salon.id}/reports/services?${query}`, { credentials: "include", signal }) : null,
        canAll ? fetch(`${api}/api/salons/${salon.id}/reports/overview?${query}`, { credentials: "include", signal }) : null,
      ]);
      if (!staffResponse.ok || (serviceResponse && !serviceResponse.ok) || (overviewResponse && !overviewResponse.ok)) throw new Error("Impossibile caricare i report.");
      setStaffRows(await staffResponse.json() as StaffRow[]);
      setServices(serviceResponse ? await serviceResponse.json() as ServiceRow[] : []);
      setOverview(overviewResponse ? await overviewResponse.json() as OverviewData : undefined);
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Impossibile caricare i report.");
    } finally { setLoading(false); }
  }
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [canAll, fromDate, salon?.id, toDate]);

  const own = staffRows.reduce((acc, row) => ({ appointments: acc.appointments + Number(row.appointment_count), completed: acc.completed + Number(row.completed_count), customers: acc.customers + Number(row.unique_customers), cancelled: acc.cancelled + Number(row.cancellation_count), noShow: acc.noShow + Number(row.no_show_count) }), { appointments: 0, cancelled: 0, completed: 0, customers: 0, noShow: 0 });
  const summary = overview ? { appointments: overview.summary.appointment_count, cancelled: overview.summary.cancellation_count, completed: overview.summary.completed_count, customers: overview.summary.unique_customers, noShow: overview.summary.no_show_count } : own;
  const pending = Math.max(0, summary.appointments - summary.completed - summary.cancelled - summary.noShow);
  const maxDaily = Math.max(1, ...(overview?.daily ?? []).map((item) => item.appointment_count));
  const rankedStaff = [...staffRows].sort((a, b) => Number(b.completed_count) - Number(a.completed_count));
  const rankedServices = [...services].sort((a, b) => Number(b.appointment_count) - Number(a.appointment_count));
  const activeDays = Math.max(1, overview?.daily.length ?? 1);
  const completedEnd = percent(summary.completed, summary.appointments);
  const noShowEnd = percent(summary.completed + summary.noShow, summary.appointments);
  const cancelledEnd = percent(summary.completed + summary.noShow + summary.cancelled, summary.appointments);
  const donut = `conic-gradient(#287fb8 0 ${completedEnd}%, #f0a23b ${completedEnd}% ${noShowEnd}%, #d76969 ${noShowEnd}% ${cancelledEnd}%, #b9d7a8 ${cancelledEnd}% 100%)`;

  function selectPreset(value: string) { const next = presetDates(value); setPreset(value); setFromDate(next.from); setToDate(next.to); }
  function exportExcel() { if (salon) window.location.href = `${api}/api/salons/${salon.id}/reports/export?${new URLSearchParams(requestDates(fromDate, toDate))}`; }

  return <AppPage maxWidth="max-w-[1600px]">
    <PageHeader eyebrow="Analisi" title="Report operativi" subtitle="Volumi, qualità e rendimento in un'unica vista." />

    <div className="mb-3 flex flex-wrap items-end gap-2 border border-stone-200 bg-white p-2">
      <div className="flex flex-wrap gap-1">{[["today", "Oggi"], ["week", "Settimana"], ["month", "Mese"], ["last", "Mese scorso"]].map(([value, label]) => <Button key={value} onClick={() => selectPreset(value!)} size="sm" variant={preset === value ? "primary" : "ghost"}>{label}</Button>)}</div>
      <div className="ml-auto w-44"><span className="mb-1 block text-[10px] font-bold uppercase text-stone-500">Dal</span><DateField aria-label="Data iniziale" max={toDate} onChange={(value) => { if (value) { setPreset("custom"); setFromDate(value); } }} value={fromDate} /></div>
      <div className="w-44"><span className="mb-1 block text-[10px] font-bold uppercase text-stone-500">Al</span><DateField aria-label="Data finale" min={fromDate} onChange={(value) => { if (value) { setPreset("custom"); setToDate(value); } }} value={toDate} /></div>
      <button aria-label="Aggiorna report" className="grid h-8 w-8 place-items-center border border-stone-200 text-stone-600 hover:bg-stone-50" onClick={() => void load()} title="Aggiorna"><RefreshCw size={15} /></button>
      {hasPermission(PERMISSION_KEYS.REPORTS_EXPORT) && <Button onClick={exportExcel} size="sm" variant="outline"><Download className="mr-2" size={16} />Excel</Button>}
    </div>
    {error && <InlineError className="mb-3">{error}</InlineError>}{loading && <div className="mb-3 h-1 animate-pulse bg-[#792f59]" />}

    <section className="mb-3 grid border border-stone-200 bg-white sm:grid-cols-3 xl:grid-cols-6">
      {[["Appuntamenti", summary.appointments, `${Math.round(summary.appointments / activeDays)} al giorno`], ["Completati", summary.completed, `${percent(summary.completed, summary.appointments)}% del totale`], ["Clienti unici", summary.customers, "nel periodo"], ["No-show", summary.noShow, `${percent(summary.noShow, summary.appointments)}% del totale`], ["Cancellati", summary.cancelled, `${percent(summary.cancelled, summary.appointments)}% del totale`], ["Da gestire", pending, "futuri o confermati"]].map(([label, value, detail]) => <div className="min-h-24 border-b border-r border-stone-200 p-3 last:border-r-0 sm:border-b-0" key={String(label)}><span className="text-[10px] font-black uppercase text-stone-500">{label}</span><strong className="mt-1 block text-3xl font-medium text-stone-950">{value}</strong><span className="text-[10px] text-stone-500">{detail}</span></div>)}
    </section>

    <div className="grid gap-3 xl:grid-cols-[1.55fr_.75fr]">
      <Panel title="Andamento appuntamenti">
        {!overview?.daily.length ? <EmptyState title="Nessun dato" description="Non ci sono appuntamenti nel periodo." /> : <div className="flex h-56 items-end gap-1 overflow-x-auto border-b border-stone-300 px-2 pt-5">{overview.daily.map((item) => <div className="flex min-w-8 flex-1 flex-col items-center justify-end" key={item.day} title={`${item.appointment_count} totali · ${item.completed_count} completati`}><span className="mb-1 text-[9px] font-bold">{item.appointment_count}</span><div className="relative w-3/5 min-w-4 max-w-9 bg-[#a9c7df]" style={{ height: `${Math.max(5, item.appointment_count / maxDaily * 155)}px` }}><div className="absolute inset-x-0 bottom-0 bg-[#287fb8]" style={{ height: `${percent(item.completed_count, item.appointment_count)}%` }} /></div><span className="mt-2 whitespace-nowrap text-[9px] text-stone-500">{new Date(`${item.day}T12:00:00`).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}</span></div>)}</div>}
        <div className="mt-3 flex gap-4 text-[10px]"><span><i className="mr-1 inline-block h-2 w-2 bg-[#287fb8]" />Completati</span><span><i className="mr-1 inline-block h-2 w-2 bg-[#a9c7df]" />Altri stati</span></div>
      </Panel>
      <Panel title="Distribuzione stati"><div className="grid grid-cols-[150px_1fr] items-center gap-5"><div className="relative aspect-square rounded-full" style={{ background: donut }}><div className="absolute inset-[28%] grid place-items-center rounded-full bg-white text-center"><strong className="text-xl">{summary.appointments}</strong><span className="text-[9px] text-stone-500">totali</span></div></div><div className="space-y-2 text-xs">{[["Completati", summary.completed, "#287fb8"], ["No-show", summary.noShow, "#f0a23b"], ["Cancellati", summary.cancelled, "#d76969"], ["Da gestire", pending, "#b9d7a8"]].map(([label, value, color]) => <div className="grid grid-cols-[10px_1fr_auto] items-center gap-2" key={String(label)}><i className="h-2.5 w-2.5" style={{ background: String(color) }} /><span>{label}</span><strong>{value}</strong></div>)}</div></div></Panel>
    </div>

    {canAll && <div className="mt-3 grid gap-3 xl:grid-cols-2">
      <Panel title="Rendimento collaboratori"><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="bg-stone-100 text-[9px] uppercase text-stone-600"><tr>{["#", "Collaboratore", "App.", "Completati", "Tasso", "No-show", "Clienti", "Servizio top"].map((label) => <th className="px-2 py-2" key={label}>{label}</th>)}</tr></thead><tbody>{rankedStaff.map((item, index) => <tr className="border-t border-stone-100 hover:bg-[#faf7f9]" key={item.staff_id}><td className="px-2 py-2 text-stone-400">{index + 1}</td><td className="px-2 py-2 font-bold">{item.staff_name}</td><td className="px-2 py-2">{item.appointment_count}</td><td className="px-2 py-2">{item.completed_count}</td><td className="px-2 py-2 font-bold text-[#287fb8]">{percent(item.completed_count, item.appointment_count)}%</td><td className="px-2 py-2">{item.no_show_count}</td><td className="px-2 py-2">{item.unique_customers}</td><td className="max-w-36 truncate px-2 py-2">{item.most_performed_service ?? "—"}</td></tr>)}</tbody></table></div></Panel>
      <Panel title="Analisi servizi"><div className="overflow-x-auto"><table className="w-full min-w-[590px] text-left text-xs"><thead className="bg-stone-100 text-[9px] uppercase text-stone-600"><tr>{["#", "Servizio", "App.", "Completati", "Tasso", "Clienti", "No-show", "Incidenza"].map((label) => <th className="px-2 py-2" key={label}>{label}</th>)}</tr></thead><tbody>{rankedServices.map((item, index) => <tr className="border-t border-stone-100 hover:bg-[#faf7f9]" key={item.service_id}><td className="px-2 py-2 text-stone-400">{index + 1}</td><td className="max-w-44 truncate px-2 py-2 font-bold">{item.service_name}</td><td className="px-2 py-2">{item.appointment_count}</td><td className="px-2 py-2">{item.completed_count}</td><td className="px-2 py-2 font-bold text-[#287fb8]">{percent(item.completed_count, item.appointment_count)}%</td><td className="px-2 py-2">{item.unique_customers}</td><td className="px-2 py-2">{item.no_show_count}</td><td className="w-24 px-2 py-2"><div className="h-2 bg-stone-100"><div className="h-full bg-[#4a9b8f]" style={{ width: `${percent(item.appointment_count, summary.appointments)}%` }} /></div></td></tr>)}</tbody></table></div></Panel>
    </div>}
  </AppPage>;
}
