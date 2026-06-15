"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { MODULE_KEYS, useModuleEnabled } from "@esse-beauty/feature-flags";

import { useAuth } from "../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
type Loadable<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error" };
interface Appointment { id: string; starts_at: string; customer_name: string; service_name: string; staff_name: string; color: string; }
interface CustomerResponse { total: number; }
interface StaffMember { id: string; displayName: string; workingHours?: Record<string, unknown>; }
interface LoyaltySummary { leaders: Array<{ customer_id: string; name: string; total_points: number }>; }

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-stone-100 ${className}`} />;
}

function useResource<T>(url: string | null): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ status: "loading" });
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    void fetch(url, { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setState({ status: "ready", data: (await response.json()) as T });
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) setState({ status: "error" });
      });
    return () => controller.abort();
  }, [url]);
  return state;
}

function StatCard({ label, state }: { label: string; state: Loadable<number> }) {
  return <article className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-stone-500">{label}</p>{state.status === "loading" ? <Skeleton className="mt-3 h-10 w-20" /> : state.status === "error" ? <p className="mt-3 text-sm text-red-700">Dato non disponibile</p> : <strong className="mt-2 block text-4xl text-[#402334]">{state.data}</strong>}</article>;
}

function ModuleCount({ href, label, state }: { href: string; label: string; state: Loadable<unknown[]> }) {
  return <Link href={href} className="rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5"><p className="text-sm text-stone-500">{label}</p>{state.status === "loading" ? <Skeleton className="mt-3 h-9 w-16" /> : state.status === "error" ? <p className="mt-3 text-sm text-red-700">Non disponibile</p> : <strong className="mt-2 block text-3xl text-[#402334]">{state.data.length}</strong>}</Link>;
}

export default function DashboardPage() {
  const { loading, salon, user } = useAuth();
  const inventoryEnabled = useModuleEnabled(MODULE_KEYS.INVENTORY);
  const reviewsEnabled = useModuleEnabled(MODULE_KEYS.REVIEWS);
  const waitlistEnabled = useModuleEnabled(MODULE_KEYS.WAITLIST);
  const loyaltyEnabled = useModuleEnabled(MODULE_KEYS.LOYALTY);
  const ranges = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const week = new Date(today); week.setDate(week.getDate() + 7);
    const month = new Date(today.getFullYear(), today.getMonth(), 1);
    return { today, tomorrow, week, month };
  }, []);
  const salonPath = salon ? `${api}/api/salons/${salon.id}` : null;
  const todayAppointments = useResource<Appointment[]>(salonPath ? `${salonPath}/appointments?from=${ranges.today.toISOString()}&to=${ranges.tomorrow.toISOString()}` : null);
  const weekAppointments = useResource<Appointment[]>(salonPath ? `${salonPath}/appointments?from=${ranges.today.toISOString()}&to=${ranges.week.toISOString()}` : null);
  const noShows = useResource<Appointment[]>(salonPath ? `${salonPath}/appointments?from=${ranges.month.toISOString()}&status=no_show` : null);
  const customers = useResource<CustomerResponse>(salonPath ? `${salonPath}/customers` : null);
  const staff = useResource<StaffMember[]>(salonPath ? `${salonPath}/staff?active=true` : null);
  const inventory = useResource<unknown[]>(salonPath && inventoryEnabled ? `${salonPath}/inventory?low_stock=true` : null);
  const reviews = useResource<unknown[]>(salonPath && reviewsEnabled ? `${salonPath}/reviews?published=false` : null);
  const waitlist = useResource<unknown[]>(salonPath && waitlistEnabled ? `${salonPath}/waitlist?status=waiting` : null);
  const loyalty = useResource<LoyaltySummary>(salonPath && loyaltyEnabled ? `${salonPath}/loyalty/summary` : null);
  const asCount = <T,>(state: Loadable<T>, count: (data: T) => number): Loadable<number> => state.status === "ready" ? { status: "ready", data: count(state.data) } : state;

  if (loading) return <main className="min-h-screen bg-[#f6f2f4] p-5 md:p-10"><div className="mx-auto max-w-6xl"><Skeleton className="h-12 w-80" /><div className="mt-8 grid gap-4 md:grid-cols-4">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-32" />)}</div></div></main>;
  if (!user || !salon) return <main className="grid min-h-screen place-items-center bg-[#f6f2f4] p-5"><section className="w-full max-w-xl rounded-[2rem] bg-white p-8 shadow-xl"><h1 className="text-3xl font-bold">Sessione non disponibile</h1><Link href="/login" className="mt-6 inline-grid min-h-12 w-full place-items-center rounded-xl bg-[#402334] font-bold text-white">Vai al login</Link></section></main>;

  return <main className="min-h-screen bg-[#f6f2f4] p-5 md:p-10"><div className="mx-auto max-w-7xl">
    <header><p className="text-xs font-bold uppercase tracking-[.2em] text-[#792f59]">Panoramica</p><h1 className="mt-2 text-4xl font-bold text-[#2d1d27]">Oggi da {salon.name}</h1><p className="mt-2 text-stone-500">Bentornato, {user.full_name}.</p></header>
    <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Appuntamenti oggi" state={asCount(todayAppointments, (items) => items.length)} />
      <StatCard label="Appuntamenti prossimi 7 giorni" state={asCount(weekAppointments, (items) => items.length)} />
      <StatCard label="Clienti attivi" state={asCount(customers, (item) => item.total)} />
      <StatCard label="No-show questo mese" state={asCount(noShows, (items) => items.length)} />
    </section>
    <section className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <article className="rounded-[2rem] bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Agenda di oggi</h2><Link href="/calendar" className="text-sm font-semibold text-[#792f59]">Apri calendario</Link></div>
        {todayAppointments.status === "loading" && <div className="mt-5 space-y-3">{[1,2,3].map((item) => <Skeleton key={item} className="h-16" />)}</div>}
        {todayAppointments.status === "error" && <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">Non è stato possibile caricare l&apos;agenda.</p>}
        {todayAppointments.status === "ready" && todayAppointments.data.length === 0 && <div className="mt-5 rounded-2xl border border-dashed border-stone-200 p-8 text-center"><p className="font-semibold">Nessun appuntamento per oggi</p><p className="mt-2 text-sm text-stone-500">Configura staff, servizi e clienti per creare il primo appuntamento.</p></div>}
        {todayAppointments.status === "ready" && todayAppointments.data.slice(0, 5).map((item) => <div key={item.id} className="mt-4 flex items-center gap-4 border-b border-stone-100 pb-4 last:border-0"><span className="size-3 rounded-full" style={{ backgroundColor: item.color }} /><time className="w-12 font-bold">{new Date(item.starts_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</time><div><b>{item.customer_name}</b><p className="text-sm text-stone-500">{item.service_name} · {item.staff_name}</p></div></div>)}
      </article>
      <article className="rounded-[2rem] bg-[#402334] p-6 text-white shadow-sm"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#e8b9d3]">Team</p><h2 className="mt-2 text-2xl font-bold">Staff operativo</h2>{staff.status === "loading" ? <Skeleton className="mt-5 h-20 bg-white/10" /> : staff.status === "error" ? <p className="mt-5 text-sm text-rose-200">Dati staff non disponibili.</p> : <><p className="mt-5 text-5xl font-bold">{staff.data.length}</p><p className="mt-2 text-sm text-stone-300">membri attivi configurati</p></>}<Link href="/staff" className="mt-6 inline-block rounded-xl bg-white/10 px-4 py-3 text-sm font-bold">Gestisci staff →</Link></article>
    </section>
    {(inventoryEnabled || reviewsEnabled || waitlistEnabled || loyaltyEnabled) && <section className="mt-6"><h2 className="text-xl font-bold">Moduli attivi</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {inventoryEnabled && <ModuleCount href="/inventory" label="Prodotti sotto scorta" state={inventory} />}
      {reviewsEnabled && <ModuleCount href="/reviews" label="Recensioni da gestire" state={reviews} />}
      {waitlistEnabled && <ModuleCount href="/waitlist" label="Richieste in attesa" state={waitlist} />}
      {loyaltyEnabled && <article className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-stone-500">Top clienti fedeltà</p>{loyalty.status === "loading" ? <Skeleton className="mt-3 h-20" /> : loyalty.status === "error" ? <p className="mt-3 text-sm text-red-700">Non disponibile</p> : <div className="mt-3 space-y-2">{loyalty.data.leaders.slice(0, 3).map((item, index) => <div key={item.customer_id} className="flex justify-between text-sm"><span>{index + 1}. {item.name}</span><strong>{item.total_points}</strong></div>)}</div>}</article>}
    </div></section>}
  </div></main>;
}
