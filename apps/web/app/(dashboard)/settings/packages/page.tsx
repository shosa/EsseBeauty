"use client";

import { useEffect, useState } from "react";
import { AppPage, Button, Dialog, EmptyState, FormField, InlineError, PageHeader, SaveToast, SectionCard, StatusBadge, Switch } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
type ItemType = "product" | "service";
interface CatalogItem { id: string; name: string; price_cents: number; }
interface Customer { id: string; name: string; phone?: string | null; }
interface PackageItem { id?: string; itemType?: ItemType; item_type?: ItemType; name: string; productId?: string | null; product_id?: string; quantity: number; serviceId?: string | null; service_id?: string; }
interface ServicePackage { active: boolean; description?: string | null; id: string; items: PackageItem[]; name: string; priceCents: number; validityDays?: number | null; }
interface Catalog { products: CatalogItem[]; services: CatalogItem[]; }

function euro(cents: number) { return (cents / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" }); }
function toCents(value: string) { const number = Number(value.replace(",", ".")); return Number.isFinite(number) ? Math.max(0, Math.round(number * 100)) : 0; }

export default function PackagesSettingsPage() {
  const { salon } = useAuth();
  const [items, setItems] = useState<ServicePackage[]>([]);
  const [catalog, setCatalog] = useState<Catalog>({ products: [], services: [] });
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ message: string; variant: "error" | "success" }>();
  const [form, setForm] = useState({ active: true, description: "", items: [] as PackageItem[], name: "", price: "0.00", validity_days: 90 });
  const [assignPackage, setAssignPackage] = useState<ServicePackage>();
  const [customerQuery, setCustomerQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);

  async function load() {
    if (!salon?.id) return;
    const [packagesResponse, catalogResponse] = await Promise.all([
      fetch(`${api}/api/salons/${salon.id}/service-packages`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/pos-catalog`, { credentials: "include" }),
    ]);
    if (!packagesResponse.ok) return setError("Pacchetti non disponibili.");
    setItems(await packagesResponse.json() as ServicePackage[]);
    if (catalogResponse.ok) setCatalog(await catalogResponse.json() as Catalog);
    setError("");
  }

  useEffect(() => { void load(); }, [salon?.id]);
  useEffect(() => {
    if (!salon || !assignPackage || customerQuery.trim().length < 2) return setCustomers([]);
    const timeout = window.setTimeout(() => {
      void fetch(`${api}/api/salons/${salon.id}/pos-customers?${new URLSearchParams({ search: customerQuery.trim() })}`, { credentials: "include" })
        .then(async (response) => response.ok ? response.json() as Promise<{ items: Customer[] }> : { items: [] })
        .then((result) => setCustomers(result.items ?? []));
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [assignPackage, customerQuery, salon?.id]);

  function addItem(itemType: ItemType, item: CatalogItem) {
    const key = itemType === "service" ? "service_id" : "product_id";
    setForm((current) => {
      const found = current.items.find((entry) => entry.item_type === itemType && entry[key] === item.id);
      return {
        ...current,
        items: found
          ? current.items.map((entry) => entry === found ? { ...entry, quantity: entry.quantity + 1 } : entry)
          : [...current.items, { item_type: itemType, name: item.name, quantity: 1, [key]: item.id }],
      };
    });
  }

  async function save() {
    if (!salon?.id) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/service-packages`, {
      body: JSON.stringify({
        active: form.active,
        description: form.description,
        items: form.items,
        name: form.name,
        price_cents: toCents(form.price),
        validity_days: form.validity_days,
      }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (!response.ok) return setToast({ message: "Pacchetto non salvato.", variant: "error" });
    setForm({ active: true, description: "", items: [], name: "", price: "0.00", validity_days: 90 });
    setToast({ message: "Pacchetto salvato.", variant: "success" });
    await load();
  }

  async function assign(customer: Customer) {
    if (!salon || !assignPackage) return;
    const expiresAt = assignPackage.validityDays ? new Date(Date.now() + assignPackage.validityDays * 86400000).toISOString() : undefined;
    const response = await fetch(`${api}/api/salons/${salon.id}/customer-service-packages`, {
      body: JSON.stringify({ customer_id: customer.id, expires_at: expiresAt, package_id: assignPackage.id }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    setToast({ message: response.ok ? `Pacchetto assegnato a ${customer.name}.` : "Assegnazione non riuscita.", variant: response.ok ? "success" : "error" });
    if (response.ok) { setAssignPackage(undefined); setCustomerQuery(""); setCustomers([]); }
  }

  return <AppPage maxWidth="max-w-[1600px]">
    <Dialog onClose={() => setAssignPackage(undefined)} open={Boolean(assignPackage)} title={`Assegna ${assignPackage?.name ?? "pacchetto"}`}>
      <FormField label="Cerca cliente"><input autoFocus onChange={(event) => setCustomerQuery(event.target.value)} placeholder="Nome, telefono o email" value={customerQuery} /></FormField>
      <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
        {customers.map((customer) => <button className="flex w-full items-center justify-between rounded-xl border border-stone-200 p-3 text-left hover:border-teal-400 hover:bg-teal-50" key={customer.id} onClick={() => void assign(customer)} type="button"><span><strong className="block">{customer.name}</strong><small className="text-stone-500">{customer.phone || "Cliente in rubrica"}</small></span><b className="text-teal-800">Assegna</b></button>)}
      </div>
    </Dialog>
    <PageHeader eyebrow="Percorsi cliente" subtitle="Configura servizi e prodotti inclusi, assegna il percorso e controlla ogni consumo dalla cassa." title="Pacchetti" />
    {error && <InlineError className="mb-5">{error}</InlineError>}
    <div className="grid gap-5 xl:grid-cols-[1fr_1.15fr]">
      <SectionCard title="Configura pacchetto" subtitle="Ogni voce mantiene una quantità autonoma: il residuo viene scalato quando il cliente la utilizza.">
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2"><FormField label="Nome pacchetto"><input onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} value={form.name} /></FormField><FormField label="Prezzo di vendita"><input min={0} onChange={(event) => setForm((value) => ({ ...value, price: event.target.value }))} step=".01" type="number" value={form.price} /></FormField></div>
          <div className="grid gap-4 md:grid-cols-2"><FormField label="Validità giorni"><input min={1} onChange={(event) => setForm((value) => ({ ...value, validity_days: Number(event.target.value) || 1 }))} type="number" value={form.validity_days} /></FormField><label className="flex items-center justify-between rounded-2xl bg-stone-50 p-4 text-sm font-bold"><span>Vendibile</span><Switch checked={form.active} onCheckedChange={(active: boolean) => setForm((value) => ({ ...value, active }))} /></label></div>
          <FormField label="Descrizione interna"><textarea onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} value={form.description} /></FormField>
          <div className="rounded-2xl border border-stone-200 p-4"><h3 className="font-black">Contenuto</h3><div className="mt-3 grid gap-3 md:grid-cols-2"><div><p className="mb-2 text-xs font-black uppercase text-stone-400">Servizi</p>{catalog.services.map((item) => <button className="mb-2 flex w-full justify-between rounded-xl bg-stone-50 p-3 text-left text-sm hover:bg-teal-50" key={item.id} onClick={() => addItem("service", item)} type="button"><span>{item.name}</span><b>+</b></button>)}</div><div><p className="mb-2 text-xs font-black uppercase text-stone-400">Prodotti</p>{catalog.products.map((item) => <button className="mb-2 flex w-full justify-between rounded-xl bg-stone-50 p-3 text-left text-sm hover:bg-teal-50" key={item.id} onClick={() => addItem("product", item)} type="button"><span>{item.name}</span><b>+</b></button>)}</div></div></div>
          <div className="space-y-2">{form.items.map((item, index) => <div className="grid grid-cols-[1fr_100px_auto] items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 p-3" key={`${item.item_type}-${item.service_id ?? item.product_id}`}><div><strong>{item.name}</strong><small className="block uppercase text-teal-700">{item.item_type === "service" ? "Servizio" : "Prodotto"}</small></div><input min={1} onChange={(event) => setForm((current) => ({ ...current, items: current.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, quantity: Math.max(1, Number(event.target.value)) } : entry) }))} type="number" value={item.quantity} /><button className="font-black text-red-700" onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))} type="button">×</button></div>)}</div>
          <Button disabled={!form.name.trim() || form.items.length === 0} onClick={() => void save()} variant="primary">Salva pacchetto</Button>
        </div>
      </SectionCard>
      <SectionCard title="Catalogo e assegnazioni" subtitle="L’assegnazione crea il percorso personale del cliente con residui separati per ogni voce.">
        {items.length === 0 ? <EmptyState title="Nessun pacchetto" description="Configura il primo percorso." /> : <div className="grid gap-3">{items.map((item) => <article className="rounded-2xl border border-stone-200 bg-white p-5" key={item.id}><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-black">{item.name}</h3><p className="mt-1 text-sm text-stone-500">{item.description || "Nessuna descrizione."}</p></div><StatusBadge status={item.active ? "active" : "archived"}>{item.active ? "Attivo" : "Spento"}</StatusBadge></div><div className="mt-4 flex flex-wrap gap-2">{item.items.map((entry) => <span className="rounded-full bg-[#faf3f7] px-3 py-1 text-xs font-bold" key={entry.id}>{entry.quantity}× {entry.name}</span>)}</div><div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4"><strong className="text-xl text-[#792f59]">{euro(item.priceCents)}</strong><Button disabled={!item.active} onClick={() => setAssignPackage(item)} size="sm" variant="outline">Assegna a cliente</Button></div></article>)}</div>}
      </SectionCard>
    </div>
    <SaveToast variant={toast?.variant} visible={Boolean(toast)}>{toast?.message ?? ""}</SaveToast>
  </AppPage>;
}
