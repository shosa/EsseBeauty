"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Appointment {
  id: string;
  starts_at: string;
  customer_name: string;
  service_name: string;
  staff_name: string;
  color: string;
}

interface CustomerResponse {
  total: number;
}

interface StaffMember {
  id: string;
}

type Loadable<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error" };

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-stone-100 ${className}`} />;
}

function StatCard({
  label,
  state,
}: {
  label: string;
  state: Loadable<number>;
}) {
  return <article className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-stone-500">{label}</p>{state.status === "loading" ? <Skeleton className="mt-3 h-10 w-20" /> : state.status === "error" ? <p className="mt-3 text-sm text-red-700">Dato non disponibile</p> : <strong className="mt-2 block text-4xl text-[#402334]">{state.data}</strong>}</article>;
}

export default function DashboardPage() {
  const { loading, salon, user } = useAuth();
  const [appointments, setAppointments] = useState<Loadable<Appointment[]>>({ status: "loading" });
  const [customers, setCustomers] = useState<Loadable<number>>({ status: "loading" });
  const [staff, setStaff] = useState<Loadable<number>>({ status: "loading" });

  useEffect(() => {
    if (!salon) return;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    void fetch(`${api}/api/salons/${salon.id}/appointments?from=${start.toISOString()}&to=${end.toISOString()}`, { credentials: "include" })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data: Appointment[]) => setAppointments({ status: "ready", data }))
      .catch(() => setAppointments({ status: "error" }));

    void fetch(`${api}/api/salons/${salon.id}/customers`, { credentials: "include" })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data: CustomerResponse) => setCustomers({ status: "ready", data: data.total }))
      .catch(() => setCustomers({ status: "error" }));

    void fetch(`${api}/api/salons/${salon.id}/staff`, { credentials: "include" })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data: StaffMember[]) => setStaff({ status: "ready", data: data.length }))
      .catch(() => setStaff({ status: "error" }));
  }, [salon]);

  if (loading) {
    return <main className="min-h-screen bg-[#f6f2f4] p-5 md:p-10"><div className="mx-auto max-w-6xl"><Skeleton className="h-4 w-28" /><Skeleton className="mt-4 h-12 w-80" /><div className="mt-8 grid gap-4 md:grid-cols-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-32" />)}</div></div></main>;
  }

  if (!user || !salon) {
    return <main className="grid min-h-screen place-items-center bg-[#f6f2f4] p-5"><section className="w-full max-w-xl rounded-[2rem] bg-white p-8 shadow-xl"><h1 className="text-3xl font-bold">Sessione non disponibile</h1><Link href="/login" className="mt-6 inline-grid min-h-12 w-full place-items-center rounded-xl bg-[#402334] font-bold text-white">Vai al login</Link></section></main>;
  }

  const appointmentCount =
    appointments.status === "ready"
      ? { status: "ready", data: appointments.data.length } as const
      : appointments;

  return <main className="min-h-screen bg-[#f6f2f4] p-5 md:p-10"><div className="mx-auto max-w-6xl">
    <header><p className="text-xs font-bold uppercase tracking-[.2em] text-[#792f59]">Panoramica</p><h1 className="mt-2 text-4xl font-bold text-[#2d1d27]">Oggi da {salon.name}</h1><p className="mt-2 text-stone-500">Bentornato, {user.full_name}.</p></header>

    <section className="mt-8 grid gap-4 md:grid-cols-3"><StatCard label="Appuntamenti oggi" state={appointmentCount} /><StatCard label="Clienti registrati" state={customers} /><StatCard label="Membri dello staff" state={staff} /></section>

    <section className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <article className="rounded-[2rem] bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Agenda di oggi</h2><Link href="/calendar" className="text-sm font-semibold text-[#792f59]">Apri calendario</Link></div>
        {appointments.status === "loading" && <div className="mt-5 space-y-3">{[1,2,3].map((item) => <Skeleton key={item} className="h-16" />)}</div>}
        {appointments.status === "error" && <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">Non è stato possibile caricare l&apos;agenda.</p>}
        {appointments.status === "ready" && appointments.data.length === 0 && <div className="mt-5 rounded-2xl border border-dashed border-stone-200 p-8 text-center"><p className="font-semibold">Nessun appuntamento per oggi</p><p className="mt-2 text-sm text-stone-500">Dopo aver configurato staff, servizi e clienti potrai creare il primo appuntamento.</p></div>}
        {appointments.status === "ready" && appointments.data.slice(0, 5).map((item) => <div key={item.id} className="mt-4 flex items-center gap-4 border-b border-stone-100 pb-4 last:border-0"><span className="size-3 rounded-full" style={{ backgroundColor: item.color }} /><time className="w-12 font-bold">{new Date(item.starts_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</time><div><b>{item.customer_name}</b><p className="text-sm text-stone-500">{item.service_name} · {item.staff_name}</p></div></div>)}
      </article>

      <article className="rounded-[2rem] bg-[#402334] p-6 text-white shadow-sm"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#e8b9d3]">Primi passi</p><h2 className="mt-2 text-2xl font-bold">Prepara il salone</h2><div className="mt-5 space-y-3"><Link href="/staff" className="flex items-center justify-between rounded-xl bg-white/10 p-4"><span>1. Aggiungi lo staff</span><span>→</span></Link><Link href="/services" className="flex items-center justify-between rounded-xl bg-white/10 p-4"><span>2. Configura i servizi</span><span>→</span></Link><Link href="/clients" className="flex items-center justify-between rounded-xl bg-white/10 p-4"><span>3. Inserisci i clienti</span><span>→</span></Link><Link href="/settings" className="flex items-center justify-between rounded-xl bg-white/10 p-4"><span>4. Completa le impostazioni</span><span>→</span></Link></div></article>
    </section>
  </div></main>;
}
