"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { appointmentStatusLabel } from "@esse-beauty/shared";
import { AppPage, Button, ConfirmDialog, PageTransition, SaveToast, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Appointment { id: string; service_name: string; staff_name: string; starts_at: string; status: string; }
interface LoyaltyItem { id: string; delta: number; reason: string; createdAt: string; }
interface PurchaseVoucher {
  balance_cents: number;
  code: string;
  created_at: string;
  id: string;
  message?: string | null;
  original_amount_cents: number;
  status: "active" | "exhausted";
}
interface CustomerPackage {
  expiresAt?: string | null;
  id: string;
  items: Array<{ name: string; remainingQuantity: number; totalQuantity: number; usedQuantity: number }>;
  name: string;
  startsAt: string;
}
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
export default function CustomerPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = use(params);
  const router = useRouter();
  const { salon } = useAuth();
  const [customer, setCustomer] = useState<Customer>();
  const [vouchers, setVouchers] = useState<PurchaseVoucher[]>([]);
  const [packages, setPackages] = useState<CustomerPackage[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!salon) return;
    const [customerResponse, voucherResponse, packageResponse] = await Promise.all([
      fetch(`${api}/api/salons/${salon.id}/customers/${customerId}`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/vouchers?${new URLSearchParams({ customer_id: customerId })}`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/customer-service-packages?${new URLSearchParams({ customer_id: customerId })}`, { credentials: "include" }),
    ]);
    if (!customerResponse.ok) throw new Error("Cliente non trovato.");
    setCustomer((await customerResponse.json()) as Customer);
    setVouchers(voucherResponse.ok ? await voucherResponse.json() as PurchaseVoucher[] : []);
    setPackages(packageResponse.ok ? await packageResponse.json() as CustomerPackage[] : []);
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
    if (!salon || !customer) return;
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

  if (error && !customer) return <AppPage maxWidth="max-w-[1600px]"><p className="text-red-700">{error}</p></AppPage>;
  if (!customer) return <AppPage maxWidth="max-w-[1600px]"><div className="h-72 animate-pulse rounded-2xl bg-stone-100" /></AppPage>;

  return <AppPage maxWidth="max-w-[1600px]"><PageTransition>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#7b3159]">Profilo cliente</p>
        <h1 className="mt-2 text-3xl font-bold">{customer.fullName}</h1>
        <p className="mt-1 text-sm text-stone-500">{customer.email ?? "Nessuna email"} - {customer.phone ?? "Nessun telefono"}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void toggleBlocked()} variant={customer.blocked ? "destructive" : "outline"}>{customer.blocked ? "Sblocca cliente" : "Blocca cliente"}</Button>
        <Button onClick={() => setConfirmDelete(true)} variant="destructive">Elimina</Button>
        <Link href="/calendar/appointments/new" className="inline-flex min-h-11 items-center rounded-xl bg-stone-950 px-4 py-3 text-sm font-bold text-white">Nuovo appuntamento</Link>
      </div>
    </header>
    <SaveToast visible={Boolean(message)}>{message}</SaveToast>
    {error && <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="mt-7 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
      <section className="space-y-5">
        <article className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-bold">Dati e note</h2><div className="mt-4 grid gap-3"><input defaultValue={customer.fullName} onBlur={(event) => void patch({ full_name: event.target.value })} className="rounded-xl border p-3" /><input defaultValue={customer.email ?? ""} onBlur={(event) => void patch({ email: event.target.value || null })} placeholder="Email" className="rounded-xl border p-3" /><input defaultValue={customer.phone ?? ""} onBlur={(event) => void patch({ phone: event.target.value || null })} placeholder="Telefono" className="rounded-xl border p-3" /><textarea defaultValue={customer.notes ?? ""} onBlur={(event) => void patch({ notes: event.target.value || null })} rows={6} placeholder="Note interne, salvate quando esci dal campo" className="rounded-xl border p-3" /></div></article>
        <article className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-bold">Tag</h2><div className="mt-4 flex flex-wrap gap-2">{Array.from(new Set([...tags, ...customer.tags])).map((tag) => { const selected = customer.tags.includes(tag); const next = selected ? customer.tags.filter((item) => item !== tag) : [...customer.tags, tag]; return <button key={tag} onClick={() => void patch({ tags: next }).then(() => setTags((current) => Array.from(new Set([...current, ...next])))).catch((reason: Error) => setError(reason.message))} className={`rounded-full px-3 py-2 text-xs font-bold ${selected ? "bg-[#7b3159] text-white" : "bg-stone-100"}`}>{tag}</button>; })}</div><input placeholder="Nuovo tag + Invio" onKeyDown={(event) => { if (event.key === "Enter" && event.currentTarget.value.trim()) { event.preventDefault(); const tag = event.currentTarget.value.trim(); const next = Array.from(new Set([...customer.tags, tag])); event.currentTarget.value = ""; void patch({ tags: next }).then(() => setTags((current) => Array.from(new Set([...current, tag])))).catch((reason: Error) => setError(reason.message)); } }} className="mt-3 w-full rounded-xl border p-3 text-sm" /></article>
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-end justify-between gap-3">
            <div><h2 className="font-bold">Buoni acquisto</h2><p className="mt-1 text-xs text-stone-500">Personali, non ricaricabili e utilizzabili anche parzialmente.</p></div>
            <strong className="text-sm text-[#792f59]">{vouchers.filter((voucher) => voucher.status === "active").length} attivi</strong>
          </div>
          <div className="mt-4 space-y-3">
            {vouchers.length === 0 && <p className="rounded-xl bg-stone-50 p-5 text-center text-sm text-stone-500">Nessun buono collegato al cliente.</p>}
            {vouchers.map((voucher) => (
              <article
                className={`overflow-hidden rounded-2xl border p-4 ${voucher.status === "active" ? "border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50" : "border-stone-200 bg-stone-100 text-stone-500"}`}
                key={voucher.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.18em]">Buono acquisto</p>
                    <p className="mt-2 font-mono text-lg font-black tracking-[.12em]">{voucher.code.replace(/(\d{4})(?=\d)/g, "$1 ")}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${voucher.status === "active" ? "bg-teal-700 text-white" : "bg-stone-300 text-stone-700"}`}>
                    {voucher.status === "active" ? "Attivo" : "Esaurito"}
                  </span>
                </div>
                <div className="mt-5 flex items-end justify-between">
                  <div><span className="block text-xs">Saldo disponibile</span><strong className="text-2xl">{(voucher.balance_cents / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" })}</strong></div>
                  <div className="text-right text-xs"><span className="block">Valore iniziale</span><strong>{(voucher.original_amount_cents / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" })}</strong></div>
                </div>
                {voucher.message && <p className="mt-4 border-t border-current/10 pt-3 text-sm italic">“{voucher.message}”</p>}
              </article>
            ))}
          </div>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <div><h2 className="font-bold">Percorsi e pacchetti</h2><p className="mt-1 text-xs text-stone-500">Avanzamento delle prestazioni e dei prodotti inclusi.</p></div>
          <div className="mt-4 space-y-3">
            {packages.length === 0 && <p className="rounded-xl bg-stone-50 p-5 text-center text-sm text-stone-500">Nessun pacchetto attivo.</p>}
            {packages.map((pack) => <article className="rounded-2xl border border-violet-200 bg-violet-50 p-4" key={pack.id}>
              <div className="flex items-start justify-between gap-3"><div><strong className="text-lg">{pack.name}</strong><p className="mt-1 text-xs text-violet-700">{pack.expiresAt ? `Scade il ${new Date(pack.expiresAt).toLocaleDateString("it-IT")}` : "Nessuna scadenza"}</p></div><StatusBadge status="active">In corso</StatusBadge></div>
              <div className="mt-4 space-y-3">{pack.items.map((item) => {
                const percentage = item.totalQuantity ? Math.min(100, Math.round(item.usedQuantity / item.totalQuantity * 100)) : 0;
                return <div key={item.name}><div className="flex justify-between text-xs"><strong>{item.name}</strong><span>{item.remainingQuantity} rimasti su {item.totalQuantity}</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-violet-600" style={{ width: `${percentage}%` }} /></div></div>;
              })}</div>
            </article>)}
          </div>
        </article>
        {customer.loyalty && <article className="rounded-2xl bg-[#2f2430] p-5 text-white shadow-sm"><p className="text-xs uppercase tracking-wider text-rose-200">Fedelta</p><p className="mt-2 text-4xl font-bold">{customer.loyalty.balance} punti</p><div className="mt-4 space-y-2">{customer.loyalty.history.slice(0, 5).map((item) => <div key={item.id} className="flex justify-between text-sm"><span>{item.reason}</span><strong>{item.delta > 0 ? "+" : ""}{item.delta}</strong></div>)}</div></article>}
      </section>
      <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-bold">Storico appuntamenti</h2><div className="mt-5 space-y-3">{customer.appointments.length === 0 ? <p className="rounded-xl bg-stone-50 p-6 text-center text-sm text-stone-500">Nessun appuntamento registrato.</p> : customer.appointments.map((appointment) => <article key={appointment.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl border border-stone-100 p-4"><div className="rounded-xl bg-rose-50 px-3 py-2 text-center"><strong className="block">{new Date(appointment.starts_at).getDate()}</strong><span className="text-xs uppercase">{new Date(appointment.starts_at).toLocaleDateString("it-IT", { month: "short" })}</span></div><div><h3 className="font-bold">{appointment.service_name}</h3><p className="text-sm text-stone-500">{appointment.staff_name} - {new Date(appointment.starts_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</p></div><StatusBadge status={appointment.status}>{appointmentStatusLabel(appointment.status)}</StatusBadge></article>)}</div></section>
    </div>
  </PageTransition>
  <ConfirmDialog
    confirmLabel="Elimina"
    destructive
    description="Il cliente verrà rimosso se non ha appuntamenti collegati."
    onCancel={() => setConfirmDelete(false)}
    onConfirm={() => void removeCustomer()}
    open={confirmDelete}
    title={`Eliminare ${customer.fullName}?`}
  />
  </AppPage>;
}
