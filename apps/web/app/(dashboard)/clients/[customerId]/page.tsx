"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CalendarClock, CalendarPlus, Gift, Layers, Mail, Phone, ShieldCheck, Sparkles, Tag, Trash2, User } from "lucide-react";
import { appointmentStatusLabel, PERMISSION_KEYS } from "@esse-beauty/shared";
import { MODULE_KEYS, useModuleEnabled } from "@esse-beauty/feature-flags";
import { AppPage, Breadcrumbs, Button, ConfirmDialog, FormField, PageTransition, SaveToast, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";
import { ConsentRecordsPanel } from "../../settings/documents/_components/ConsentRecordsPanel";
import { DocumentsModuleGate } from "../../settings/documents/_components/DocumentsModuleGate";
import { WhatsAppMarketingConsentPanel } from "../_components/WhatsAppMarketingConsentPanel";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
const avatarPalette = ["#b8578a", "#8f3a68", "#57534e", "#c98a3f", "#3f7d6f", "#7a4fa0"];
type TabKey = "overview" | "appointments" | "loyalty" | "packages" | "privacy";

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
interface LoyaltyTierRef { id: string; minPoints: number; name: string; }
interface LoyaltyTierProgress {
  balance: number;
  current_tier: LoyaltyTierRef | null;
  next_tier: (LoyaltyTierRef & { pointsRemaining: number }) | null;
}
interface Customer {
  appointments: Appointment[];
  blocked: boolean;
  email: string | null;
  firstName: string;
  fullName: string;
  hasAccount: boolean;
  id: string;
  lastName: string;
  loyalty: { balance: number; history: LoyaltyItem[] } | null;
  notes: string | null;
  phone: string | null;
  tags: string[];
}

function customerName(customer: Pick<Customer, "firstName" | "lastName" | "fullName">) {
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.fullName;
}

function avatarColor(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return avatarPalette[hash % avatarPalette.length];
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function money(cents: number) {
  return (cents / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" });
}

const tabs: Array<{ icon: typeof User; key: TabKey; label: string }> = [
  { icon: User, key: "overview", label: "Panoramica" },
  { icon: CalendarClock, key: "appointments", label: "Appuntamenti" },
  { icon: Gift, key: "loyalty", label: "Fedeltà & buoni" },
  { icon: Layers, key: "packages", label: "Pacchetti" },
  { icon: ShieldCheck, key: "privacy", label: "Privacy & consensi" },
];

export default function CustomerPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = use(params);
  const router = useRouter();
  const { hasPermission, salon } = useAuth();
  const documentsEnabled = useModuleEnabled(MODULE_KEYS.DOCUMENTS);
  const loyaltyEnabled = useModuleEnabled(MODULE_KEYS.LOYALTY);
  const canManageLoyalty = hasPermission(PERMISSION_KEYS.LOYALTY_MANAGE);
  const [customer, setCustomer] = useState<Customer>();
  const [vouchers, setVouchers] = useState<PurchaseVoucher[]>([]);
  const [packages, setPackages] = useState<CustomerPackage[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [tab, setTab] = useState<TabKey>("overview");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loyaltyTier, setLoyaltyTier] = useState<LoyaltyTierProgress | null>();

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

  useEffect(() => {
    if (!salon || !loyaltyEnabled || !canManageLoyalty) {
      setLoyaltyTier(null);
      return;
    }
    const controller = new AbortController();
    void fetch(`${api}/api/salons/${salon.id}/loyalty/customers/${customerId}`, { credentials: "include", signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<LoyaltyTierProgress> : null)
      .then(setLoyaltyTier)
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) setLoyaltyTier(null);
      });
    return () => controller.abort();
  }, [canManageLoyalty, customerId, loyaltyEnabled, salon]);

  const tierProgress = useMemo(() => {
    if (!loyaltyTier) return null;
    const { balance, current_tier: current, next_tier: next } = loyaltyTier;
    if (!next) return { current, next: null, percent: current ? 100 : 0 };
    const base = current?.minPoints ?? 0;
    const span = next.minPoints - base;
    const percent = span > 0 ? Math.max(0, Math.min(100, Math.round((balance - base) / span * 100))) : 0;
    return { current, next, percent };
  }, [loyaltyTier]);

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

  function toggleTag(tag: string) {
    if (!customer) return;
    const next = customer.tags.includes(tag) ? customer.tags.filter((item) => item !== tag) : [...customer.tags, tag];
    void patch({ tags: next })
      .then(() => setTags((current) => Array.from(new Set([...current, ...next]))))
      .catch((reason: Error) => setError(reason.message));
  }

  function addTag() {
    const value = newTag.trim();
    if (!value || !customer) return;
    const next = Array.from(new Set([...customer.tags, value]));
    setNewTag("");
    void patch({ tags: next })
      .then(() => setTags((current) => Array.from(new Set([...current, value]))))
      .catch((reason: Error) => setError(reason.message));
  }

  async function toggleBlocked() {
    if (!salon || !customer) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/customers/${customerId}/block`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ blocked: !customer.blocked }),
    });
    if (!response.ok) {
      setError("Lo stato del cliente non è stato aggiornato.");
      return;
    }
    setCustomer({ ...customer, blocked: !customer.blocked });
    setMessage(customer.blocked ? "Cliente sbloccato." : "Cliente bloccato.");
  }

  async function removeCustomer() {
    if (!salon || !customer) return;
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/customers/${customerId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      setConfirmDelete(false);
      setError(response.status === 409 ? "Il cliente ha appuntamenti collegati: non può essere eliminato." : "Il cliente non è stato eliminato.");
      return;
    }
    router.push("/clients");
  }

  const now = Date.now();
  const upcoming = useMemo(() => customer?.appointments.filter((item) => new Date(item.starts_at).getTime() > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0], [customer, now]);
  const lastVisit = useMemo(() => {
    const past = customer?.appointments.filter((item) => new Date(item.starts_at).getTime() <= now).sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
    return past ? new Date(past.starts_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }) : "Mai";
  }, [customer, now]);
  const voucherBalance = useMemo(() => vouchers.filter((voucher) => voucher.status === "active").reduce((sum, voucher) => sum + voucher.balance_cents, 0), [vouchers]);

  if (error && !customer) return <AppPage maxWidth="max-w-[1600px]"><p className="text-red-700">{error}</p></AppPage>;
  if (!customer) return <AppPage maxWidth="max-w-[1600px]"><div className="h-72 animate-pulse rounded-2xl bg-stone-100" /></AppPage>;

  const name = customerName(customer);

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageTransition>
        <SaveToast variant={error ? "error" : "success"} visible={Boolean(message || error)}>{error || message}</SaveToast>
        <Breadcrumbs items={[{ href: "/clients", label: "Clienti" }, { label: name }]} />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e8dfe4] bg-white p-6 shadow-[0_10px_30px_rgb(45_29_39_/_0.055)]">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-full text-lg font-black text-white" style={{ background: avatarColor(customer.id) }}>{initials(name)}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-stone-950">{name}</h1>
                {customer.hasAccount && <StatusBadge status="active">App</StatusBadge>}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-stone-600">
                <span className="flex items-center gap-1.5"><Mail aria-hidden="true" className="size-3.5 text-stone-400" />{customer.email ?? "Nessuna email"}</span>
                <span className="flex items-center gap-1.5"><Phone aria-hidden="true" className="size-3.5 text-stone-400" />{customer.phone ?? "Nessun telefono"}</span>
              </div>
              {customer.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{customer.tags.map((item) => <span className="rounded-full bg-[#f8edf3] px-2.5 py-1 text-[11px] font-semibold text-[#792f59]" key={item}>{item}</span>)}</div>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void toggleBlocked()} variant="outline">
              {customer.blocked ? <ShieldCheck aria-hidden="true" className="size-4" /> : <Ban aria-hidden="true" className="size-4" />}
              {customer.blocked ? "Sblocca" : "Blocca"}
            </Button>
            <Button onClick={() => router.push("/calendar/appointments/new")} variant="primary"><CalendarPlus aria-hidden="true" className="size-4" />Nuovo appuntamento</Button>
            <Button className="border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800" onClick={() => setConfirmDelete(true)} variant="outline"><Trash2 aria-hidden="true" className="size-4" />Elimina cliente</Button>
          </div>
        </div>

        {error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[#e8dfe4] bg-[#e8dfe4] md:grid-cols-4">
          <div className="bg-white px-5 py-4"><strong className="block text-2xl font-bold text-[#402334]">{customer.appointments.length}</strong><span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Appuntamenti</span></div>
          <div className="bg-white px-5 py-4"><strong className="block text-2xl font-bold text-[#402334]">{lastVisit}</strong><span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Ultima visita</span></div>
          <div className="bg-white px-5 py-4"><strong className="block text-2xl font-bold text-[#402334]">{money(voucherBalance)}</strong><span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Buoni residui</span></div>
          <div className="bg-white px-5 py-4"><strong className="block text-2xl font-bold text-[#402334]">{packages.length}</strong><span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Pacchetti attivi</span></div>
        </div>

        <nav aria-label="Sezioni scheda cliente" className="mt-6 flex gap-1 overflow-x-auto border-b border-stone-200">
          {tabs.map((item) => {
            const count = item.key === "appointments" ? customer.appointments.length : item.key === "packages" ? packages.length : undefined;
            const active = tab === item.key;
            return (
              <button
                aria-selected={active}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-xl border border-b-0 px-4 py-2.5 text-sm font-bold transition ${active ? "border-stone-200 bg-white text-[#792f59]" : "border-transparent bg-stone-100 text-stone-500 hover:bg-stone-50 hover:text-stone-800"}`}
                key={item.key}
                onClick={() => setTab(item.key)}
                role="tab"
                type="button"
              >
                <item.icon aria-hidden="true" className="size-4" />
                {item.label}
                {Boolean(count) && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${active ? "bg-[#f3e2eb] text-[#792f59]" : "bg-white text-stone-500"}`}>{count}</span>}
              </button>
            );
          })}
        </nav>

        <div className="mt-6">
          {tab === "overview" && (
            <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
              <div className="space-y-4">
                <article className="rounded-2xl border border-[#e8dfe4] bg-white p-5 shadow-sm">
                  <h2 className="font-bold text-stone-950">Dati anagrafici</h2>
                  <p className="mt-1 text-xs text-stone-500">Salvataggio automatico quando esci dal campo.</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <FormField label="Nome"><input className="w-full" defaultValue={customer.firstName} onBlur={(event) => void patch({ first_name: event.target.value, last_name: customer.lastName }).catch((reason: Error) => setError(reason.message))} /></FormField>
                    <FormField label="Cognome"><input className="w-full" defaultValue={customer.lastName} onBlur={(event) => void patch({ first_name: customer.firstName, last_name: event.target.value }).catch((reason: Error) => setError(reason.message))} /></FormField>
                    <FormField label="Email"><input className="w-full" defaultValue={customer.email ?? ""} onBlur={(event) => void patch({ email: event.target.value || null }).catch((reason: Error) => setError(reason.message))} /></FormField>
                    <FormField label="Telefono"><input className="w-full" defaultValue={customer.phone ?? ""} onBlur={(event) => void patch({ phone: event.target.value || null }).catch((reason: Error) => setError(reason.message))} /></FormField>
                    <FormField className="sm:col-span-2" description="Note interne, salvate quando esci dal campo." label="Note">
                      <textarea className="min-h-24 w-full resize-y" defaultValue={customer.notes ?? ""} onBlur={(event) => void patch({ notes: event.target.value || null }).catch((reason: Error) => setError(reason.message))} />
                    </FormField>
                  </div>
                </article>

                <article className="rounded-2xl border border-[#e8dfe4] bg-white p-5 shadow-sm">
                  <h2 className="flex items-center gap-2 font-bold text-stone-950"><Tag aria-hidden="true" className="size-4 text-[#792f59]" />Segmenti</h2>
                  <p className="mt-1 text-xs text-stone-500">Usati per filtri rapidi e campagne marketing mirate.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {Array.from(new Set([...tags, ...customer.tags])).map((item) => {
                      const selected = customer.tags.includes(item);
                      return <button className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${selected ? "bg-[#792f59] text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`} key={item} onClick={() => toggleTag(item)} type="button">{item}</button>;
                    })}
                  </div>
                  <input
                    className="mt-3 w-full"
                    onChange={(event) => setNewTag(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }}
                    placeholder="Nuovo segmento e Invio"
                    value={newTag}
                  />
                </article>
              </div>

              <div className="space-y-4">
                <article className="rounded-2xl border border-[#e8dfe4] bg-white p-5 shadow-sm">
                  <h2 className="flex items-center gap-2 font-bold text-stone-950"><CalendarClock aria-hidden="true" className="size-4 text-[#792f59]" />Prossimo appuntamento</h2>
                  {upcoming ? (
                    <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl border border-stone-100 p-4">
                      <div className="rounded-xl bg-[#faf3f7] px-3 py-2 text-center"><strong className="block text-lg text-[#792f59]">{new Date(upcoming.starts_at).getDate()}</strong><span className="text-[10px] font-bold uppercase text-stone-500">{new Date(upcoming.starts_at).toLocaleDateString("it-IT", { month: "short" })}</span></div>
                      <div className="min-w-0"><h3 className="truncate font-bold text-stone-950">{upcoming.service_name}</h3><p className="text-sm text-stone-500">{upcoming.staff_name} · {new Date(upcoming.starts_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</p></div>
                      <StatusBadge status={upcoming.status}>{appointmentStatusLabel(upcoming.status)}</StatusBadge>
                    </div>
                  ) : <p className="mt-4 rounded-xl bg-stone-50 p-5 text-center text-sm text-stone-500">Nessun appuntamento in programma.</p>}
                </article>
              </div>
            </div>
          )}

          {tab === "appointments" && (
            <article className="rounded-2xl border border-[#e8dfe4] bg-white p-5 shadow-sm">
              <h2 className="font-bold text-stone-950">Storico appuntamenti</h2>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {customer.appointments.length === 0 ? <p className="rounded-xl bg-stone-50 p-6 text-center text-sm text-stone-500 lg:col-span-2">Nessun appuntamento registrato.</p> : customer.appointments.map((appointment) => (
                  <article key={appointment.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl border border-stone-100 p-4">
                    <div className="rounded-xl bg-[#faf3f7] px-3 py-2 text-center"><strong className="block text-lg text-[#792f59]">{new Date(appointment.starts_at).getDate()}</strong><span className="text-[10px] font-bold uppercase text-stone-500">{new Date(appointment.starts_at).toLocaleDateString("it-IT", { month: "short" })}</span></div>
                    <div className="min-w-0"><h3 className="truncate font-bold text-stone-950">{appointment.service_name}</h3><p className="text-sm text-stone-500">{appointment.staff_name} · {new Date(appointment.starts_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</p></div>
                    <StatusBadge status={appointment.status}>{appointmentStatusLabel(appointment.status)}</StatusBadge>
                  </article>
                ))}
              </div>
            </article>
          )}

          {tab === "loyalty" && (
            <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
              <article className="rounded-2xl border border-[#e8dfe4] bg-white p-5 shadow-sm">
                <h2 className="font-bold text-stone-950">Buoni acquisto</h2>
                <p className="mt-1 text-xs text-stone-500">Personali, non ricaricabili e utilizzabili anche parzialmente.</p>
                <div className="mt-4 space-y-3">
                  {vouchers.length === 0 && <p className="rounded-xl bg-stone-50 p-5 text-center text-sm text-stone-500">Nessun buono collegato al cliente.</p>}
                  {vouchers.map((voucher) => (
                    <article className={`overflow-hidden rounded-2xl border p-4 ${voucher.status === "active" ? "border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50" : "border-stone-200 bg-stone-100 text-stone-500"}`} key={voucher.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="text-[10px] font-black uppercase tracking-[.18em]">Buono acquisto</p><p className="mt-2 font-mono text-lg font-black tracking-[.12em]">{voucher.code.replace(/(\d{4})(?=\d)/g, "$1 ")}</p></div>
                        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${voucher.status === "active" ? "bg-teal-700 text-white" : "bg-stone-300 text-stone-700"}`}>{voucher.status === "active" ? "Attivo" : "Esaurito"}</span>
                      </div>
                      <div className="mt-5 flex items-end justify-between">
                        <div><span className="block text-xs">Saldo disponibile</span><strong className="text-2xl">{money(voucher.balance_cents)}</strong></div>
                        <div className="text-right text-xs"><span className="block">Valore iniziale</span><strong>{money(voucher.original_amount_cents)}</strong></div>
                      </div>
                      {voucher.message && <p className="mt-4 border-t border-current/10 pt-3 text-sm italic">“{voucher.message}”</p>}
                    </article>
                  ))}
                </div>
              </article>
              {customer.loyalty && (
                <article className="rounded-2xl bg-gradient-to-br from-[#2d1d27] to-[#402334] p-6 text-white shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-rose-200">Programma fedeltà</p>
                      <p className="mt-2 text-4xl font-bold">{customer.loyalty.balance} punti</p>
                    </div>
                    {tierProgress?.current && (
                      <div className="relative size-16 shrink-0 rounded-full" style={{ background: `conic-gradient(#e2a8c4 0% ${tierProgress.percent}%, rgb(255 255 255 / 0.14) ${tierProgress.percent}% 100%)` }}>
                        <div className="absolute inset-[3px] grid place-items-center rounded-full bg-[#2d1d27]"><Sparkles aria-hidden="true" className="size-5 text-rose-200" /></div>
                      </div>
                    )}
                  </div>
                  {tierProgress?.current && (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <div className="flex items-center justify-between text-xs font-bold"><span className="text-rose-100">Livello {tierProgress.current.name}</span>{tierProgress.next && <span className="text-rose-200/80">{tierProgress.next.pointsRemaining} a {tierProgress.next.name}</span>}</div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#e2a8c4]" style={{ width: `${tierProgress.percent}%` }} /></div>
                    </div>
                  )}
                  <div className="mt-5 space-y-2 border-t border-white/10 pt-4">
                    {customer.loyalty.history.length === 0 ? <p className="text-sm text-rose-100/70">Nessun movimento registrato.</p> : customer.loyalty.history.slice(0, 6).map((item) => (
                      <div className="flex justify-between text-sm" key={item.id}><span className="text-rose-100/80">{item.reason}</span><strong className={item.delta > 0 ? "text-emerald-300" : ""}>{item.delta > 0 ? "+" : ""}{item.delta}</strong></div>
                    ))}
                  </div>
                </article>
              )}
            </div>
          )}

          {tab === "packages" && (
            <article className="rounded-2xl border border-[#e8dfe4] bg-white p-5 shadow-sm">
              <h2 className="font-bold text-stone-950">Percorsi e pacchetti</h2>
              <p className="mt-1 text-xs text-stone-500">Avanzamento delle prestazioni e dei prodotti inclusi.</p>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {packages.length === 0 && <p className="rounded-xl bg-stone-50 p-5 text-center text-sm text-stone-500 lg:col-span-2">Nessun pacchetto attivo.</p>}
                {packages.map((pack) => (
                  <article className="rounded-2xl border border-violet-200 bg-violet-50 p-4" key={pack.id}>
                    <div className="flex items-start justify-between gap-3"><strong className="text-lg">{pack.name}</strong><p className="text-xs text-violet-700">{pack.expiresAt ? `Scade il ${new Date(pack.expiresAt).toLocaleDateString("it-IT")}` : "Nessuna scadenza"}</p></div>
                    <div className="mt-4 space-y-3">{pack.items.map((item) => {
                      const percentage = item.totalQuantity ? Math.min(100, Math.round(item.usedQuantity / item.totalQuantity * 100)) : 0;
                      return <div key={item.name}><div className="flex justify-between text-xs"><strong>{item.name}</strong><span>{item.remainingQuantity} rimasti su {item.totalQuantity}</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-violet-600" style={{ width: `${percentage}%` }} /></div></div>;
                    })}</div>
                  </article>
                ))}
              </div>
            </article>
          )}

          {tab === "privacy" && (
            <div className="grid gap-4 lg:grid-cols-2">
              {hasPermission(PERMISSION_KEYS.CLIENTS_EDIT) && salon && <WhatsAppMarketingConsentPanel customerId={customerId} phone={customer.phone} salonId={salon.id} />}
              <DocumentsModuleGate enabled={documentsEnabled}>
                <ConsentRecordsPanel customerId={customerId} title="Consensi documentali" />
              </DocumentsModuleGate>
            </div>
          )}
        </div>
      </PageTransition>

      <ConfirmDialog
        confirmLabel="Elimina"
        destructive
        description="Il cliente verrà rimosso se non ha appuntamenti collegati."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void removeCustomer()}
        open={confirmDelete}
        title={`Eliminare ${name}?`}
      />
    </AppPage>
  );
}
