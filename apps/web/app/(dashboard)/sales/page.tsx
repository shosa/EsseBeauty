"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppPage, Button, Dialog, Drawer, EmptyState, FormField, InlineError, PageHeader, SaveToast, SectionCard, StatCard, StatGrid, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
type Tab = "register" | "sales" | "stats";
type Preset = "today" | "week" | "month" | "last";
type PaymentMethod = "cash" | "card" | "bank_transfer" | "voucher" | "other";
type CatalogType = "service" | "product";
type CartItemType = CatalogType | "custom";

interface CatalogItem { category?: string; id: string; name: string; price_cents: number; stock_quantity?: number; }
interface Customer { email?: string | null; id: string; name: string; phone?: string | null; }
interface StaffItem { color: string; id: string; name: string; }
interface PosCatalog { products: CatalogItem[]; services: CatalogItem[]; staff: StaffItem[]; }
interface CartLine { description: string; discount_cents: number; id: string; item_type: CartItemType; product_id?: string; quantity: number; service_id?: string; unit_price_cents: number; }
interface Payment { amount_cents: number; method: PaymentMethod; }
interface SaleRow { appointment_id?: string | null; closed_at: string; customer_name?: string | null; discount_cents: number; id: string; staff_name?: string | null; total_cents: number; }
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

const methodLabels: Record<PaymentMethod, string> = { bank_transfer: "Bonifico", card: "Carta", cash: "Contanti", other: "Altro", voucher: "Voucher" };
function euro(cents: number) { return (cents / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" }); }
function cents(value: string) { const amount = Number(value.replace(",", ".")); return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0; }
function rangeFor(preset: Preset) {
  const now = new Date(); const from = new Date(now); const to = new Date(now);
  if (preset === "today") from.setHours(0, 0, 0, 0);
  if (preset === "week") { from.setDate(now.getDate() - ((now.getDay() + 6) % 7)); from.setHours(0, 0, 0, 0); }
  if (preset === "month") { from.setDate(1); from.setHours(0, 0, 0, 0); }
  if (preset === "last") { from.setMonth(now.getMonth() - 1, 1); from.setHours(0, 0, 0, 0); to.setDate(0); to.setHours(23, 59, 59, 999); }
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function SalesPage() {
  const { salon } = useAuth();
  const [tab, setTab] = useState<Tab>("register");
  const [preset, setPreset] = useState<Preset>("today");
  const [catalog, setCatalog] = useState<PosCatalog>();
  const [data, setData] = useState<SalesResponse>();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [catalogType, setCatalogType] = useState<CatalogType>("service");
  const [query, setQuery] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer>();
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [staffId, setStaffId] = useState("");
  const [discountCents, setDiscountCents] = useState(0);
  const [payments, setPayments] = useState<Payment[]>([{ amount_cents: 0, method: "card" }]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleDetail>();
  const [saleLoading, setSaleLoading] = useState(false);

  async function loadCatalog() {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/pos-catalog`, { credentials: "include" });
    if (!response.ok) return setError("Catalogo cassa non disponibile.");
    setCatalog(await response.json() as PosCatalog);
  }
  async function loadSales() {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/sales?${new URLSearchParams(rangeFor(preset))}`, { credentials: "include" });
    if (!response.ok) return setError(response.status === 403 ? "Non hai accesso alla contabilità gestionale." : "Movimenti non disponibili.");
    setData(await response.json() as SalesResponse);
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
  useEffect(() => { void loadCatalog(); }, [salon?.id]);
  useEffect(() => { void loadSales(); }, [preset, salon?.id]);
  useEffect(() => {
    if (!salon || !customerDialogOpen) return;
    const search = customerQuery.trim();
    if (search.length < 2) {
      setCustomerResults([]);
      setCustomerLoading(false);
      return;
    }
    const timeout = window.setTimeout(() => {
      setCustomerLoading(true);
      const params = new URLSearchParams({ search });
      void fetch(`${api}/api/salons/${salon.id}/pos-customers?${params}`, { credentials: "include" })
        .then(async (response) => {
          if (!response.ok) throw new Error();
          const result = await response.json() as { items?: Customer[] };
          setCustomerResults(result.items ?? []);
        })
        .catch(() => setCustomerResults([]))
        .finally(() => setCustomerLoading(false));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [customerDialogOpen, customerQuery, salon?.id]);

  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + Math.max(0, line.quantity * line.unit_price_cents - line.discount_cents), 0), [cart]);
  const total = Math.max(0, subtotal - discountCents);
  const paid = payments.reduce((sum, item) => sum + item.amount_cents, 0);
  useEffect(() => { if (payments.length === 1) setPayments((current) => [{ ...current[0]!, amount_cents: total }]); }, [total]);
  const visibleCatalog = (catalogType === "service" ? catalog?.services : catalog?.products)?.filter((item) => `${item.name} ${item.category ?? ""}`.toLowerCase().includes(query.toLowerCase())) ?? [];

  function addItem(item: CatalogItem) {
    setCart((current) => {
      const found = current.find((line) => line.id === item.id && line.item_type === catalogType);
      if (found) return current.map((line) => line === found ? { ...line, quantity: line.quantity + 1 } : line);
      return [...current, {
        description: item.name, discount_cents: 0, id: item.id, item_type: catalogType,
        product_id: catalogType === "product" ? item.id : undefined, quantity: 1,
        service_id: catalogType === "service" ? item.id : undefined, unit_price_cents: item.price_cents,
      }];
    });
  }
  function updateLine(index: number, patch: Partial<CartLine>) { setCart((current) => current.map((line, i) => i === index ? { ...line, ...patch } : line)); }
  function addCustomItem() {
    setCart((current) => [...current, {
      description: "Voce libera",
      discount_cents: 0,
      id: crypto.randomUUID(),
      item_type: "custom",
      quantity: 1,
      unit_price_cents: 0,
    }]);
  }
  function chooseCustomer(customer: Customer) {
    setCustomerId(customer.id);
    setSelectedCustomer(customer);
    setCustomerDialogOpen(false);
    setCustomerQuery("");
    setCustomerResults([]);
  }
  function clearCustomer() {
    setCustomerId("");
    setSelectedCustomer(undefined);
  }
  function resetRegister() { setCart([]); clearCustomer(); setStaffId(""); setDiscountCents(0); setPayments([{ amount_cents: 0, method: "card" }]); setNotes(""); }

  async function checkout() {
    if (!salon || !cart.length || paid !== total) return;
    setSaving(true); setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/pos-checkout`, {
      body: JSON.stringify({ customer_id: customerId || undefined, discount_cents: discountCents, items: cart, notes, payments, staff_id: staffId || undefined }),
      credentials: "include", headers: { "content-type": "application/json" }, method: "POST",
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      const messages: Record<string, string> = { PAYMENT_TOTAL_MISMATCH: "I pagamenti non coincidono con il totale." };
      setError(messages[body.error ?? ""] ?? "Vendita non registrata."); setSaving(false); return;
    }
    resetRegister(); await Promise.all([loadCatalog(), loadSales()]); setMessage("Vendita registrata correttamente."); setSaving(false);
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <SaveToast visible={Boolean(message)}>{message}</SaveToast>
      <Dialog onClose={() => setCustomerDialogOpen(false)} open={customerDialogOpen} title="Rubrica clienti">
        <label className="block text-sm font-bold text-stone-700">Cerca cliente
          <input
            autoFocus
            className="mt-2 min-h-12 w-full rounded-xl border border-stone-200 px-4"
            onChange={(event) => setCustomerQuery(event.target.value)}
            placeholder="Nome, telefono o email"
            value={customerQuery}
          />
        </label>
        <p className="mt-2 text-xs text-stone-500">Scrivi almeno 2 caratteri. Vengono mostrati al massimo 20 risultati.</p>
        <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto">
          {customerLoading && <div className="rounded-xl bg-stone-50 p-5 text-center text-sm font-semibold text-stone-500">Ricerca in corso…</div>}
          {!customerLoading && customerQuery.trim().length >= 2 && customerResults.length === 0 && <EmptyState title="Nessun cliente trovato" description="Controlla il testo inserito oppure usa Cliente occasionale." />}
          {!customerLoading && customerResults.map((customer) => (
            <button className="flex w-full items-center gap-3 rounded-2xl border border-stone-200 p-3 text-left transition hover:border-[#c98cac] hover:bg-[#fff9fc]" key={customer.id} onClick={() => chooseCustomer(customer)} type="button">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f3e2eb] text-xs font-black text-[#792f59]">{customer.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate">{customer.name}</strong>
                <span className="mt-1 block truncate text-xs text-stone-500">{[customer.phone, customer.email].filter(Boolean).join(" · ") || "Nessun recapito"}</span>
              </span>
              <span className="text-sm font-bold text-[#792f59]">Seleziona</span>
            </button>
          ))}
        </div>
        <div className="mt-5 border-t border-stone-100 pt-4">
          <Button onClick={() => { clearCustomer(); setCustomerDialogOpen(false); }} variant="ghost">Continua come cliente occasionale</Button>
        </div>
      </Dialog>
      <Drawer onClose={() => setSelectedSale(undefined)} open={Boolean(selectedSale)} title="Dettaglio vendita">
        {selectedSale && <div className="space-y-5">
          <section className="rounded-2xl bg-[#402334] p-5 text-white">
            <p className="text-xs font-black uppercase tracking-[.16em] text-[#e8bfd4]">Incasso registrato</p>
            <strong className="mt-2 block text-4xl">{euro(selectedSale.total_cents)}</strong>
            <p className="mt-2 text-sm text-stone-300">{new Date(selectedSale.closed_at).toLocaleString("it-IT")}</p>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-stone-200 p-3"><span className="text-[10px] font-black uppercase text-stone-400">Cliente</span><strong className="mt-1 block">{selectedSale.customer_name || "Cliente occasionale"}</strong></div>
            <div className="rounded-xl border border-stone-200 p-3"><span className="text-[10px] font-black uppercase text-stone-400">Operatore</span><strong className="mt-1 block">{selectedSale.staff_name || "Non assegnato"}</strong></div>
            <div className="rounded-xl border border-stone-200 p-3"><span className="text-[10px] font-black uppercase text-stone-400">Registrata da</span><strong className="mt-1 block">{selectedSale.cashier_name || "Sistema"}</strong></div>
            <div className="rounded-xl border border-stone-200 p-3"><span className="text-[10px] font-black uppercase text-stone-400">Origine</span><strong className="mt-1 block">{selectedSale.appointment_id ? "Appuntamento" : "Vendita libera"}</strong></div>
          </section>

          {(selectedSale.customer_phone || selectedSale.customer_email) && <section className="rounded-2xl bg-stone-50 p-4 text-sm">
            {selectedSale.customer_phone && <p><span className="text-stone-500">Telefono:</span> <strong>{selectedSale.customer_phone}</strong></p>}
            {selectedSale.customer_email && <p className="mt-1"><span className="text-stone-500">Email:</span> <strong>{selectedSale.customer_email}</strong></p>}
          </section>}

          <section>
            <h3 className="font-black">Cosa è stato venduto</h3>
            <div className="mt-3 space-y-2">
              {selectedSale.items.map((item) => <article className="rounded-2xl border border-stone-200 p-4" key={item.id}>
                <div className="flex items-start justify-between gap-3"><div><strong>{item.description}</strong><p className="mt-1 text-xs uppercase text-stone-400">{item.item_type === "service" ? "Servizio" : item.item_type === "product" ? "Prodotto" : "Voce libera"}</p></div><strong>{euro(item.total_cents)}</strong></div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-500"><span>Quantità: {item.quantity}</span><span>Prezzo: {euro(item.unit_price_cents)}</span>{item.discount_cents > 0 && <span>Sconto: {euro(item.discount_cents)}</span>}</div>
              </article>)}
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 p-4">
            <div className="flex justify-between text-sm"><span>Subtotale</span><strong>{euro(selectedSale.subtotal_cents)}</strong></div>
            {selectedSale.discount_cents > 0 && <div className="mt-2 flex justify-between text-sm text-stone-500"><span>Sconto conto</span><strong>- {euro(selectedSale.discount_cents)}</strong></div>}
            <div className="mt-4 flex justify-between border-t border-stone-200 pt-4 text-lg"><strong>Totale</strong><strong className="text-[#792f59]">{euro(selectedSale.total_cents)}</strong></div>
          </section>

          <section>
            <h3 className="font-black">Pagamenti</h3>
            <div className="mt-3 space-y-2">{selectedSale.payments.map((payment) => <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900" key={payment.id}><strong>{methodLabels[payment.method] ?? payment.method}</strong><strong>{euro(payment.amount_cents)}</strong></div>)}</div>
          </section>

          {selectedSale.notes && <section className="rounded-2xl bg-amber-50 p-4"><p className="text-xs font-black uppercase text-amber-800">Nota interna</p><p className="mt-2 text-sm text-amber-950">{selectedSale.notes}</p></section>}

          <div className="flex flex-wrap gap-2">
            {selectedSale.customer_id && <Link className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-bold text-[#792f59]" href={`/clients/${selectedSale.customer_id}`}>Apri cliente</Link>}
            {selectedSale.appointment_id && <Link className="rounded-xl bg-[#402334] px-4 py-3 text-sm font-bold text-white" href={`/calendar?appointment=${selectedSale.appointment_id}`}>Apri appuntamento</Link>}
          </div>
        </div>}
      </Drawer>
      <PageHeader eyebrow="Punto vendita" title="Cassa" subtitle="Vendite da appuntamento, servizi liberi, prodotti e pagamenti in un unico flusso." status={<StatusBadge status="active">Operativa</StatusBadge>} />
      <div className="mb-5 flex gap-1 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-sm">
        {([["register", "Cassa"], ["sales", "Registro vendite"], ["stats", "Statistiche"]] as Array<[Tab, string]>).map(([value, label]) => <button className={`min-h-11 rounded-xl px-5 text-sm font-black ${tab === value ? "bg-[#402334] text-white shadow-md" : "text-stone-500 hover:bg-stone-50"}`} key={value} onClick={() => setTab(value)}>{label}</button>)}
      </div>
      {error && <InlineError className="mb-5">{error}</InlineError>}
      {saleLoading && <div className="mb-5 rounded-xl bg-stone-100 px-4 py-3 text-sm font-bold text-stone-600">Caricamento dettaglio vendita…</div>}

      {tab === "register" && <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_520px]">
        <SectionCard title="Catalogo" subtitle="Seleziona servizi o prodotti da aggiungere al conto.">
          <div className="mb-4 flex flex-wrap gap-2">
            <Button onClick={() => setCatalogType("service")} variant={catalogType === "service" ? "primary" : "outline"}>Servizi</Button>
            <Button onClick={() => setCatalogType("product")} variant={catalogType === "product" ? "primary" : "outline"}>Prodotti</Button>
            <Button onClick={addCustomItem} variant="outline">Riga libera</Button>
            <input className="min-h-11 min-w-64 flex-1 rounded-xl border border-stone-200 px-4" onChange={(event) => setQuery(event.target.value)} placeholder="Cerca nel catalogo" value={query} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {visibleCatalog.map((item) => <button className="rounded-2xl border border-stone-200 bg-[#fbfaf8] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#b85888] hover:shadow-md" key={item.id} onClick={() => addItem(item)}>
              <div className="flex items-start justify-between gap-3"><strong>{item.name}</strong><span className="font-black text-[#792f59]">{euro(item.price_cents)}</span></div>
              <p className={`mt-2 text-xs ${catalogType === "product" && (item.stock_quantity ?? 0) <= 0 ? "font-bold text-amber-700" : "text-stone-500"}`}>{catalogType === "service" ? item.category || "Servizio" : `Disponibilità: ${item.stock_quantity ?? 0}${(item.stock_quantity ?? 0) <= 0 ? " · vendita consentita" : ""}`}</p>
            </button>)}
            {!visibleCatalog.length && <EmptyState title="Nessun elemento" description="Il catalogo non contiene risultati per questa ricerca." />}
          </div>
        </SectionCard>

        <aside className="self-start rounded-[1.8rem] border border-stone-200 bg-white p-5 shadow-[0_20px_55px_rgb(45_29_39_/_0.10)] xl:sticky xl:top-24">
          <div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#792f59]">Conto corrente</p><h2 className="mt-1 text-2xl font-black">Nuova vendita</h2></div><Button onClick={resetRegister} size="sm" variant="ghost">Azzera</Button></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <FormField label="Cliente">
              <div className="flex min-h-12 items-center gap-2 rounded-xl border border-stone-200 bg-white p-1.5">
                <div className="min-w-0 flex-1 px-2">
                  <strong className="block truncate text-sm">{selectedCustomer?.name ?? "Cliente occasionale"}</strong>
                  {selectedCustomer && <span className="block truncate text-[11px] text-stone-500">{selectedCustomer.phone || selectedCustomer.email || "Cliente in rubrica"}</span>}
                </div>
                {selectedCustomer && <button aria-label="Rimuovi cliente" className="rounded-lg px-2 py-2 text-xs font-bold text-stone-500 hover:bg-stone-100" onClick={clearCustomer} type="button">Rimuovi</button>}
                <button
                  aria-label="Apri rubrica clienti"
                  className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#d7a6c1] text-[#792f59] transition hover:bg-[#f8eaf1]"
                  onClick={() => setCustomerDialogOpen(true)}
                  title="Apri rubrica clienti"
                  type="button"
                >
                  <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="M5 4.5h13a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H5z" />
                    <path d="M5 7H3.5M5 12H3.5M5 17H3.5" />
                    <circle cx="12" cy="10" r="2.3" />
                    <path d="M8.5 16a3.5 3.5 0 0 1 7 0" />
                  </svg>
                </button>
              </div>
            </FormField>
            <FormField label="Operatore"><select className="w-full" onChange={(event) => setStaffId(event.target.value)} value={staffId}><option value="">Non assegnato</option>{catalog?.staff.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></FormField>
          </div>
          <div className="mt-5 space-y-3">
            {!cart.length && <EmptyState title="Carrello vuoto" description="Aggiungi un servizio o un prodotto dal catalogo." />}
            {cart.map((line, index) => <article className="rounded-2xl border border-stone-200 bg-[#fbfaf8] p-3" key={`${line.item_type}-${line.id}`}>
              <div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1">
                {line.item_type === "custom"
                  ? <input aria-label="Descrizione riga libera" className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 font-bold" onChange={(event) => updateLine(index, { description: event.target.value })} value={line.description} />
                  : <strong>{line.description}</strong>}
                <p className="mt-1 text-xs uppercase text-stone-400">{line.item_type === "service" ? "Servizio" : line.item_type === "product" ? "Prodotto" : "Voce libera"}</p>
              </div><button className="text-sm font-bold text-red-700" onClick={() => setCart((current) => current.filter((_, i) => i !== index))}>Rimuovi</button></div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <label className="text-[10px] font-bold text-stone-500">Quantità<input className="mt-1 w-full rounded-lg border p-2" min={1} onChange={(event) => updateLine(index, { quantity: Math.max(1, Number(event.target.value)) })} type="number" value={line.quantity} /></label>
                <label className="text-[10px] font-bold text-stone-500">Prezzo<input className="mt-1 w-full rounded-lg border p-2" min={0} onChange={(event) => updateLine(index, { unit_price_cents: cents(event.target.value) })} step=".01" type="number" value={(line.unit_price_cents / 100).toFixed(2)} /></label>
                <label className="text-[10px] font-bold text-stone-500">Sconto<input className="mt-1 w-full rounded-lg border p-2" min={0} onChange={(event) => updateLine(index, { discount_cents: cents(event.target.value) })} step=".01" type="number" value={(line.discount_cents / 100).toFixed(2)} /></label>
              </div>
            </article>)}
          </div>
          <div className="mt-5 border-y border-stone-200 py-4">
            <div className="flex justify-between text-sm"><span>Subtotale</span><b>{euro(subtotal)}</b></div>
            <label className="mt-3 flex items-center justify-between text-sm">Sconto conto<input className="w-28 rounded-xl border p-2 text-right font-bold" min={0} onChange={(event) => setDiscountCents(cents(event.target.value))} step=".01" type="number" value={(discountCents / 100).toFixed(2)} /></label>
            <div className="mt-4 flex items-end justify-between"><strong>Totale</strong><b className="text-4xl text-[#5f2447]">{euro(total)}</b></div>
          </div>
          <div className="mt-5">
            <div className="flex justify-between"><strong>Pagamenti</strong><button className="text-sm font-bold text-[#792f59]" onClick={() => setPayments((current) => [...current, { amount_cents: 0, method: "cash" }])}>Dividi</button></div>
            <div className="mt-3 space-y-2">{payments.map((payment, index) => <div className="grid grid-cols-[1fr_130px_auto] gap-2" key={index}>
              <select className="rounded-xl border px-3" onChange={(event) => setPayments((current) => current.map((item, i) => i === index ? { ...item, method: event.target.value as PaymentMethod } : item))} value={payment.method}>{Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <input className="rounded-xl border p-2 text-right font-bold" onChange={(event) => setPayments((current) => current.map((item, i) => i === index ? { ...item, amount_cents: cents(event.target.value) } : item))} step=".01" type="number" value={(payment.amount_cents / 100).toFixed(2)} />
              {payments.length > 1 && <button aria-label="Rimuovi pagamento" className="px-2 font-black text-red-700" onClick={() => setPayments((current) => current.filter((_, i) => i !== index))}>×</button>}
            </div>)}</div>
            <div className={`mt-3 rounded-xl px-3 py-2 text-sm font-bold ${paid === total ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>Registrato: {euro(paid)} / {euro(total)}</div>
          </div>
          <FormField className="mt-5" label="Nota interna"><textarea className="min-h-20 w-full" onChange={(event) => setNotes(event.target.value)} value={notes} /></FormField>
          <Button className="mt-5 min-h-14 w-full text-base" disabled={saving || !cart.length || paid !== total || cart.some((line) => !line.description.trim())} onClick={() => void checkout()} variant="primary">{saving ? "Registrazione…" : `Incassa ${euro(total)}`}</Button>
        </aside>
      </div>}

      {(tab === "sales" || tab === "stats") && <>
        <div className="mb-5 flex flex-wrap gap-2">{([["today", "Oggi"], ["week", "Settimana"], ["month", "Mese"], ["last", "Mese scorso"]] as Array<[Preset, string]>).map(([value, label]) => <Button key={value} onClick={() => setPreset(value)} size="sm" variant={preset === value ? "primary" : "outline"}>{label}</Button>)}</div>
        <StatGrid className="mb-5 md:grid-cols-4"><StatCard label="Incassato" value={euro(data?.summary.total_cents ?? 0)} /><StatCard label="Vendite" value={data?.summary.count ?? 0} /><StatCard label="Scontrino medio" value={euro(data?.summary.average_cents ?? 0)} /><StatCard label="Sconti" value={euro(data?.summary.discount_cents ?? 0)} /></StatGrid>
      </>}

      {tab === "sales" && <SectionCard title="Registro vendite" subtitle="Vendite da appuntamento e vendite libere effettuate dalla cassa.">
        {!data?.rows.length ? <EmptyState title="Nessun movimento" description="Le vendite concluse appariranno qui." /> : <div className="overflow-x-auto rounded-2xl border"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#f7eef3]"><tr><th className="p-4">Data</th><th>Cliente</th><th>Operatore</th><th>Sconto</th><th className="text-right">Totale</th><th /></tr></thead><tbody>{data.rows.map((row) => <tr className="cursor-pointer border-t transition hover:bg-[#fff8fb]" key={row.id} onClick={() => void openSale(row.id)}><td className="p-4">{new Date(row.closed_at).toLocaleString("it-IT")}</td><td className="font-bold">{row.customer_name || "Cliente occasionale"}</td><td>{row.staff_name || "—"}</td><td>{euro(row.discount_cents)}</td><td className="text-right text-base font-black">{euro(row.total_cents)}</td><td className="p-4 text-right"><span className="font-bold text-[#792f59]">Vedi dettaglio →</span></td></tr>)}</tbody></table></div>}
      </SectionCard>}

      {tab === "stats" && <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
        <SectionCard title="Metodi di pagamento">{data?.payments.length ? <div className="space-y-4">{data.payments.map((item) => <div className="flex items-center justify-between rounded-xl bg-stone-50 p-4" key={item.method}><b>{methodLabels[item.method as PaymentMethod] ?? item.method}</b><strong>{euro(item.amount_cents)}</strong></div>)}</div> : <EmptyState title="Nessun incasso" description="Non ci sono pagamenti nel periodo." />}</SectionCard>
        <SectionCard title="Andamento del periodo" subtitle="Indicatori sintetici della cassa gestionale."><div className="grid gap-4 sm:grid-cols-2"><StatCard label="Valore medio vendita" value={euro(data?.summary.average_cents ?? 0)} /><StatCard label="Sconto medio" value={euro(data?.summary.count ? Math.round(data.summary.discount_cents / data.summary.count) : 0)} /><StatCard label="Vendite giornaliere" value={data?.summary.count ?? 0} detail="Nel periodo selezionato" /><StatCard label="Netto gestionale" value={euro(data?.summary.total_cents ?? 0)} /></div></SectionCard>
      </div>}
    </AppPage>
  );
}
