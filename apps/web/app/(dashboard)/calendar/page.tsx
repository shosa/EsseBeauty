"use client";

import { useEffect, useMemo, useState } from "react";
import { PERMISSION_KEYS } from "@esse-beauty/shared";
import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
interface Appointment { id: string; starts_at: string; ends_at: string; customer_name: string; service_name: string; staff_name: string; color: string; staff_id: string; }

export default function CalendarPage() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState<Appointment>();
  const { hasPermission, salon } = useAuth();
  const canManageOthers = hasPermission(PERMISSION_KEYS.CALENDAR_MANAGE_OTHERS);
  const monday = useMemo(() => { const d = new Date(); const offset = (d.getDay() + 6) % 7; d.setDate(d.getDate() - offset + weekOffset * 7); d.setHours(0,0,0,0); return d; }, [weekOffset]);
  const days = Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * 86400000));
  useEffect(() => {
    const to = new Date(monday.getTime() + 7 * 86400000);
    if (!salon) return;
    void fetch(`${api}/api/salons/${salon.id}/appointments?from=${monday.toISOString()}&to=${to.toISOString()}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : []).then(setItems);
  }, [monday, salon?.id]);
  return <main className="min-h-screen bg-[#f7f5f2] p-3 md:p-8"><div className="mx-auto max-w-[1500px]">
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-[.2em] text-rose-700">Agenda</p><h1 className="text-3xl font-bold">Calendario</h1></div><div className="flex items-center gap-2"><button onClick={() => setWeekOffset((value) => value - 1)} className="rounded-xl bg-white px-4 py-2">←</button><button onClick={() => setWeekOffset(0)} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold">Oggi</button><button onClick={() => setWeekOffset((value) => value + 1)} className="rounded-xl bg-white px-4 py-2">→</button><span className="rounded-full bg-white px-3 py-2 text-xs text-stone-600">{canManageOthers ? "Gestione team" : "Sola lettura team"}</span></div></header>
    <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm"><div className="grid min-w-[840px] grid-cols-7">
      {days.map((day) => <section key={day.toISOString()} className="min-h-[640px] border-r border-stone-100 last:border-0">
        <header className="sticky top-0 border-b border-stone-100 bg-white p-3 text-center"><p className="text-xs uppercase text-stone-400">{day.toLocaleDateString("it-IT", { weekday: "short" })}</p><strong>{day.getDate()}</strong></header>
        <div className="space-y-2 p-2">{items.filter((item) => new Date(item.starts_at).toDateString() === day.toDateString()).map((item) =>
          <button key={item.id} onClick={() => setSelected(item)} className="w-full rounded-xl border-l-4 bg-stone-50 p-3 text-left shadow-sm" style={{ borderColor: item.color }}>
            <strong className="block text-xs">{new Date(item.starts_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</strong>
            <span className="block truncate text-sm font-semibold">{item.customer_name}</span><span className="block truncate text-xs text-stone-500">{item.service_name} · {item.staff_name}</span>
          </button>)}</div>
      </section>)}
    </div></div>
    {selected && <aside className="fixed inset-y-0 right-0 z-20 w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl"><button onClick={() => setSelected(undefined)} className="float-right">Chiudi</button><p className="text-sm font-bold uppercase tracking-wider text-rose-700">Appuntamento</p><h2 className="mt-2 text-2xl font-bold">{selected.customer_name}</h2><p className="mt-2 text-stone-600">{selected.service_name} con {selected.staff_name}</p><p className="mt-5 rounded-xl bg-stone-100 p-4">{new Date(selected.starts_at).toLocaleString("it-IT", { dateStyle: "full", timeStyle: "short" })}</p>
      {!canManageOthers && <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Calendario in sola lettura.</p>}
      {canManageOthers && <div className="mt-6 grid grid-cols-2 gap-2">{[["completed","Completa"],["no_show","No-show"],["cancelled","Annulla"]].map(([status,label]) => <button key={status} onClick={async () => { await fetch(`${api}/api/salons/${salon?.id}/appointments/${selected.id}`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) }); setSelected(undefined); }} className="rounded-xl border border-stone-300 px-3 py-3 text-sm font-semibold">{label}</button>)}</div>}
    </aside>}
  </div></main>;
}
