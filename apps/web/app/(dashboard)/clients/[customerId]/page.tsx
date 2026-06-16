"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Appointment { id: string; service_name: string; staff_name: string; starts_at: string; status: string; }
interface LoyaltyItem { id: string; delta: number; reason: string; createdAt: string; }
interface Customer {
  appointments: Appointment[];
  blocked: boolean;
  email: string | null;
  fullName: string;
  id: string;
  loyalty: { balance: number; history: LoyaltyItem[] } | null;
  notes: string | null;
  phone: string | null;
  tags: string[];
}
interface Service { id: string; name: string; }
interface Staff { id: string; displayName: string; }

export default function CustomerPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = use(params);
  const router = useRouter();
  const { salon } = useAuth();
  const [customer, setCustomer] = useState<Customer>();
  const [tags, setTags] = useState<string[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [showAppointment, setShowAppointment] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/customers/${customerId}`, { credentials: "include" });
    if (!response.ok) throw new Error("Cliente non trovato.");
    setCustomer((await response.json()) as Customer);
  }

  useEffect(() => {
    void load().catch((reason: Error) => setError(reason.message));
  }, [customerId, salon?.id]);

  useEffect(() => {
    if (!salon) return;
    void fetch(`${api}/api/salons/${salon.id}/customers/tags`, { credentials: "include" })
      .then((response) => response.ok ? response.json() : [])
      .then(setTags);
  }, [salon?.id]);

  async function patch(body: Record<string, unknown>) {
    if (!salon) return;
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/customers/${customerId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("Salvataggio non riuscito.");
    const updated = (await response.json()) as Partial<Customer>;
    setCustomer((current) => current ? { ...current, ...updated } : current);
    setMessage("Salvato");
    window.setTimeout(() => setMessage(""), 1800);
  }

  async function toggleBlocked() {
    if (!salon || !customer) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/customers/${customerId}/block`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ blocked: !customer.blocked }),
    });
    if (response.ok) setCustomer({ ...customer, blocked: !customer.blocked });
  }

  async function removeCustomer() {
    if (!salon || !customer || !window.confirm(`Eliminare il cliente "${customer.fullName}"?`)) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/customers/${customerId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      setError(response.status === 409 ? "Il cliente ha appuntamenti collegati: non puo essere eliminato." : "Il cliente non e stato eliminato.");
      return;
    }
    router.push("/clients");
  }

  async function openAppointment() {
    if (!salon) return;
    const [serviceResponse, staffResponse] = await Promise.all([
      fetch(`${api}/api/salons/${salon.id}/services?active=true`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/staff?active=true`, { credentials: "include" }),
    ]);
    setServices(serviceResponse.ok ? await serviceResponse.json() : []);
    setStaff(staffResponse.ok ? await staffResponse.json() : []);
    setShowAppointment(true);
  }

  async function createAppointment(formData: FormData) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/appointments`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customer_id: customerId,
        service_id: formData.get("service_id"),
        staff_id: formData.get("staff_id"),
        starts_at: new Date(String(formData.get("starts_at"))).toISOString(),
        notes: formData.get("notes") || undefined,
      }),
    });
    if (!response.ok) {
      setError(response.status === 409 ? "Orario gia occupato." : "Appuntamento non creato.");
      return;
    }
    setShowAppointment(false);
    await load();
  }

  if (error && !customer) return <main className="p-8 text-red-700">{error}</main>;
  if (!customer) return <main className="p-8"><div className="h-72 animate-pulse rounded-2xl bg-stone-100" /></main>;

  return <main className="min-h-screen bg-[#f7f4f2] p-4 md:p-8"><div className="mx-auto max-w-6xl">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#7b3159]">Profilo cliente</p>
        <h1 className="mt-2 text-3xl font-bold">{customer.fullName}</h1>
        <p className="mt-1 text-sm text-stone-500">{customer.email ?? "Nessuna email"} - {customer.phone ?? "Nessun telefono"}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => void toggleBlocked()} className={`rounded-xl px-4 py-3 text-sm font-bold ${customer.blocked ? "bg-red-100 text-red-700" : "border border-stone-300"}`}>{customer.blocked ? "Sblocca cliente" : "Blocca cliente"}</button>
        <button onClick={() => void removeCustomer()} className="rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-700">Elimina</button>
        <button onClick={() => void openAppointment()} className="rounded-xl bg-[#7b3159] px-4 py-3 text-sm font-bold text-white">Nuovo appuntamento</button>
      </div>
    </header>
    {message && <p className="fixed right-5 top-5 z-40 rounded-xl bg-stone-900 px-4 py-3 text-sm text-white">{message}</p>}
    {error && <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="mt-7 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
      <section className="space-y-5">
        <article className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-bold">Dati e note</h2><div className="mt-4 grid gap-3"><input defaultValue={customer.fullName} onBlur={(event) => void patch({ full_name: event.target.value })} className="rounded-xl border p-3" /><input defaultValue={customer.email ?? ""} onBlur={(event) => void patch({ email: event.target.value || null })} placeholder="Email" className="rounded-xl border p-3" /><input defaultValue={customer.phone ?? ""} onBlur={(event) => void patch({ phone: event.target.value || null })} placeholder="Telefono" className="rounded-xl border p-3" /><textarea defaultValue={customer.notes ?? ""} onBlur={(event) => void patch({ notes: event.target.value || null })} rows={6} placeholder="Note interne, salvate quando esci dal campo" className="rounded-xl border p-3" /></div></article>
        <article className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-bold">Tag</h2><div className="mt-4 flex flex-wrap gap-2">{Array.from(new Set([...tags, ...customer.tags])).map((tag) => { const selected = customer.tags.includes(tag); const next = selected ? customer.tags.filter((item) => item !== tag) : [...customer.tags, tag]; return <button key={tag} onClick={() => void patch({ tags: next }).then(() => setTags((current) => Array.from(new Set([...current, ...next])))).catch((reason: Error) => setError(reason.message))} className={`rounded-full px-3 py-2 text-xs font-bold ${selected ? "bg-[#7b3159] text-white" : "bg-stone-100"}`}>{tag}</button>; })}</div><input placeholder="Nuovo tag + Invio" onKeyDown={(event) => { if (event.key === "Enter" && event.currentTarget.value.trim()) { event.preventDefault(); const tag = event.currentTarget.value.trim(); const next = Array.from(new Set([...customer.tags, tag])); event.currentTarget.value = ""; void patch({ tags: next }).then(() => setTags((current) => Array.from(new Set([...current, tag])))).catch((reason: Error) => setError(reason.message)); } }} className="mt-3 w-full rounded-xl border p-3 text-sm" /></article>
        {customer.loyalty && <article className="rounded-2xl bg-[#2f2430] p-5 text-white shadow-sm"><p className="text-xs uppercase tracking-wider text-rose-200">Fedelta</p><p className="mt-2 text-4xl font-bold">{customer.loyalty.balance} punti</p><div className="mt-4 space-y-2">{customer.loyalty.history.slice(0, 5).map((item) => <div key={item.id} className="flex justify-between text-sm"><span>{item.reason}</span><strong>{item.delta > 0 ? "+" : ""}{item.delta}</strong></div>)}</div></article>}
      </section>
      <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-bold">Storico appuntamenti</h2><div className="mt-5 space-y-3">{customer.appointments.length === 0 ? <p className="rounded-xl bg-stone-50 p-6 text-center text-sm text-stone-500">Nessun appuntamento registrato.</p> : customer.appointments.map((appointment) => <article key={appointment.id} className="grid grid-cols-[auto_1fr_auto] gap-4 rounded-xl border border-stone-100 p-4"><div className="rounded-xl bg-rose-50 px-3 py-2 text-center"><strong className="block">{new Date(appointment.starts_at).getDate()}</strong><span className="text-xs uppercase">{new Date(appointment.starts_at).toLocaleDateString("it-IT", { month: "short" })}</span></div><div><h3 className="font-bold">{appointment.service_name}</h3><p className="text-sm text-stone-500">{appointment.staff_name} - {new Date(appointment.starts_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</p></div><span className="text-xs font-bold uppercase text-stone-500">{appointment.status}</span></article>)}</div></section>
    </div>
    {showAppointment && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><form action={createAppointment} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-bold">Nuovo appuntamento</h2><div className="mt-5 grid gap-4"><select required name="service_id" className="rounded-xl border p-3"><option value="">Seleziona servizio</option>{services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select required name="staff_id" className="rounded-xl border p-3"><option value="">Seleziona operatore</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select><input required type="datetime-local" name="starts_at" className="rounded-xl border p-3" /><textarea name="notes" placeholder="Note" className="rounded-xl border p-3" /></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowAppointment(false)} className="rounded-xl border px-4 py-3">Annulla</button><button className="rounded-xl bg-[#7b3159] px-4 py-3 font-bold text-white">Crea</button></div></form></div>}
  </div></main>;
}
