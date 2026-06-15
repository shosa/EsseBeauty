"use client";

import { useEffect, useMemo, useState } from "react";

import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
interface Appointment { color: string; customer_name: string; ends_at: string; id: string; service_name: string; staff_id: string; staff_name: string; starts_at: string; }
interface Option { id: string; name: string; }
const statusActions = [
  { label: "Completa", status: "completed" },
  { label: "No-show", status: "no_show" },
  { label: "Annulla", status: "cancelled" },
];

export default function CalendarPage() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState<Appointment>();
  const [createOpen, setCreateOpen] = useState(false);
  const [customers, setCustomers] = useState<Option[]>([]);
  const [services, setServices] = useState<Option[]>([]);
  const [staff, setStaff] = useState<Option[]>([]);
  const [error, setError] = useState("");
  const { hasPermission, salon } = useAuth();
  const canManageOthers = hasPermission(PERMISSION_KEYS.CALENDAR_MANAGE_OTHERS);
  const canManageOwn = hasPermission(PERMISSION_KEYS.CALENDAR_MANAGE_OWN);
  const canCreate = canManageOthers || canManageOwn;
  const monday = useMemo(() => {
    const date = new Date();
    const offset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - offset + weekOffset * 7);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [weekOffset]);
  const days = Array.from({ length: 7 }, (_, index) => new Date(monday.getTime() + index * 86400000));

  async function load() {
    if (!salon) return;
    const to = new Date(monday.getTime() + 7 * 86400000);
    const response = await fetch(`${api}/api/salons/${salon.id}/appointments?from=${monday.toISOString()}&to=${to.toISOString()}`, { credentials: "include" });
    if (!response.ok) {
      setError("Impossibile caricare il calendario.");
      setItems([]);
      return;
    }
    const data: unknown = await response.json();
    setItems(Array.isArray(data) ? data as Appointment[] : []);
  }

  useEffect(() => { void load(); }, [monday, salon?.id]);

  async function openCreate() {
    if (!salon) return;
    setError("");
    const [customersResponse, servicesResponse, staffResponse] = await Promise.all([
      fetch(`${api}/api/salons/${salon.id}/customers`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/services?active=true`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/staff?active=true`, { credentials: "include" }),
    ]);
    if (!customersResponse.ok || !servicesResponse.ok || !staffResponse.ok) {
      setError("Configura almeno un cliente, un servizio e un collaboratore prima di creare un appuntamento.");
      return;
    }
    const customerData = await customersResponse.json() as { items?: Array<{ full_name: string; id: string }> };
    const serviceData = await servicesResponse.json() as Array<{ id: string; name: string }>;
    const staffData = await staffResponse.json() as Array<{ displayName: string; id: string }>;
    setCustomers((customerData.items ?? []).map((item) => ({ id: item.id, name: item.full_name })));
    setServices(serviceData.map((item) => ({ id: item.id, name: item.name })));
    setStaff(staffData.map((item) => ({ id: item.id, name: item.displayName })));
    setCreateOpen(true);
  }

  async function createAppointment(formData: FormData) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/appointments`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customer_id: formData.get("customer_id"),
        service_id: formData.get("service_id"),
        staff_id: formData.get("staff_id"),
        starts_at: new Date(String(formData.get("starts_at"))).toISOString(),
        notes: formData.get("notes") || undefined,
      }),
    });
    if (!response.ok) {
      setError(response.status === 409 ? "L'orario selezionato è già occupato." : "L'appuntamento non è stato creato.");
      return;
    }
    setCreateOpen(false);
    await load();
  }

  async function updateStatus(status: string) {
    if (!selected || !salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/appointments/${selected.id}`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    if (!response.ok) {
      setError("Lo stato dell'appuntamento non è stato aggiornato.");
      return;
    }
    setSelected(undefined);
    await load();
  }

  return <main className="min-h-screen bg-[#f7f5f2] p-3 md:p-8"><div className="mx-auto max-w-[1500px]">
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-[.2em] text-rose-700">Agenda</p><h1 className="text-3xl font-bold">Calendario</h1></div><div className="flex flex-wrap items-center gap-2">{canCreate && <button onClick={() => void openCreate()} className="rounded-xl bg-[#402334] px-4 py-2 font-bold text-white">Nuovo appuntamento</button>}<button onClick={() => setWeekOffset((value) => value - 1)} className="rounded-xl bg-white px-4 py-2">←</button><button onClick={() => setWeekOffset(0)} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold">Oggi</button><button onClick={() => setWeekOffset((value) => value + 1)} className="rounded-xl bg-white px-4 py-2">→</button></div></header>
    {error && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm"><div className="grid min-w-[840px] grid-cols-7">
      {days.map((day) => <section key={day.toISOString()} className="min-h-[640px] border-r border-stone-100 last:border-0"><header className="sticky top-0 border-b border-stone-100 bg-white p-3 text-center"><p className="text-xs uppercase text-stone-400">{day.toLocaleDateString("it-IT", { weekday: "short" })}</p><strong>{day.getDate()}</strong></header><div className="space-y-2 p-2">{items.filter((item) => new Date(item.starts_at).toDateString() === day.toDateString()).map((item) => <button key={item.id} onClick={() => setSelected(item)} className="w-full rounded-xl border-l-4 bg-stone-50 p-3 text-left shadow-sm" style={{ borderColor: item.color }}><strong className="block text-xs">{new Date(item.starts_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</strong><span className="block truncate text-sm font-semibold">{item.customer_name}</span><span className="block truncate text-xs text-stone-500">{item.service_name} · {item.staff_name}</span></button>)}</div></section>)}
    </div></div>
    {selected && <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl"><button onClick={() => setSelected(undefined)} className="float-right">Chiudi</button><p className="text-sm font-bold uppercase tracking-wider text-rose-700">Appuntamento</p><h2 className="mt-2 text-2xl font-bold">{selected.customer_name}</h2><p className="mt-2 text-stone-600">{selected.service_name} con {selected.staff_name}</p><p className="mt-5 rounded-xl bg-stone-100 p-4">{new Date(selected.starts_at).toLocaleString("it-IT", { dateStyle: "full", timeStyle: "short" })}</p>{canCreate ? <div className="mt-6 grid grid-cols-2 gap-2">{statusActions.map((action) => <button key={action.status} onClick={() => void updateStatus(action.status)} className="rounded-xl border border-stone-300 px-3 py-3 text-sm font-semibold">{action.label}</button>)}</div> : <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Calendario in sola lettura.</p>}</aside>}
    {createOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4"><form action={createAppointment} className="grid w-full max-w-lg gap-4 rounded-[2rem] bg-white p-6 shadow-2xl"><div className="flex justify-between"><h2 className="text-xl font-bold">Nuovo appuntamento</h2><button type="button" onClick={() => setCreateOpen(false)}>Chiudi</button></div><select required name="customer_id" className="min-h-11 rounded-xl border bg-white px-3"><option value="">Seleziona cliente</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select required name="service_id" className="min-h-11 rounded-xl border bg-white px-3"><option value="">Seleziona servizio</option>{services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select required name="staff_id" className="min-h-11 rounded-xl border bg-white px-3"><option value="">Seleziona collaboratore</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input required type="datetime-local" name="starts_at" className="min-h-11 rounded-xl border px-3" /><textarea name="notes" placeholder="Note interne" className="rounded-xl border p-3" /><button className="min-h-11 rounded-xl bg-[#402334] font-bold text-white">Crea appuntamento</button></form></div>}
  </div></main>;
}
