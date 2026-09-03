"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Search } from "lucide-react";
import { PERMISSION_KEYS } from "@esse-beauty/shared";
import { AppPage, Button, Dialog, Drawer, EmptyState, InlineError, SaveToast, Switch } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
type Section = "assignments" | "catalog";
type ItemType = "product" | "service";
type AssignmentStatus = "active" | "depleted" | "expired" | "expiring";

interface CatalogItem { category?: string | null; id: string; name: string; price_cents: number; }
interface Catalog { products: CatalogItem[]; services: CatalogItem[]; }
interface PackageItem { id?: string; item_type?: ItemType; itemType?: ItemType; name: string; product_id?: string; productId?: string | null; quantity: number; service_id?: string; serviceId?: string | null; }
interface ServicePackage { active: boolean; description?: string | null; id: string; items: PackageItem[]; name: string; priceCents: number; validityDays?: number | null; }
interface BalanceItem { itemType: ItemType; name: string; packageItemId: string; remainingQuantity: number; totalQuantity: number; usedQuantity: number; }
interface CustomerPackage { active: boolean; customerId: string; customerName: string; expiresAt?: string | null; id: string; items: BalanceItem[]; name: string; packageId: string; priceCents: number; startsAt: string; totalSessions: number; usedSessions: number; }
interface UsageRow { appointmentId?: string | null; createdAt: string; customerName: string; id: string; itemName?: string | null; operatorName?: string | null; packageName: string; quantityUsed: number; }

const sectionByPath: Record<string, Section> = { "/packages": "catalog", "/packages/assignments": "assignments" };
const pageHeaderContent: Record<Section, { subtitle: string; title: string }> = {
  assignments: { subtitle: "Clienti con un percorso assegnato, con stato e registro utilizzi.", title: "Assegnazioni" },
  catalog: { subtitle: "Pacchetti attivi e vendibili in cassa: contenuto, prezzo e disponibilità.", title: "Catalogo" },
};
const statusLabels: Record<AssignmentStatus, string> = { active: "Attivo", depleted: "Esaurito", expired: "Scaduto", expiring: "In scadenza" };
const statusClasses: Record<AssignmentStatus, string> = {
  active: "bg-[#e5f3ec] text-[#1c7a5c]",
  depleted: "bg-stone-100 text-stone-600",
  expired: "bg-[#faeae8] text-[#b23a2e]",
  expiring: "bg-[#fbf0dd] text-[#a3690b]",
};

function euro(cents: number) { return (cents / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" }); }
function toCents(value: string) { const number = Number(value.replace(",", ".")); return Number.isFinite(number) ? Math.max(0, Math.round(number * 100)) : 0; }
function formatDate(value: string) { return new Date(value).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }); }
function formatDateTime(value: string) { return new Date(value).toLocaleString("it-IT", { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "short" }); }
function assignmentStatus(row: CustomerPackage): AssignmentStatus {
  const now = Date.now();
  const expiresAtMs = row.expiresAt ? new Date(row.expiresAt).getTime() : null;
  if (expiresAtMs !== null && expiresAtMs < now) return "expired";
  if (!row.active || row.usedSessions >= row.totalSessions) return "depleted";
  if (expiresAtMs !== null && expiresAtMs - now < 30 * 86_400_000) return "expiring";
  return "active";
}

function Card({ actions, bodyClassName = "", children, className = "", subtitle, title }: { actions?: ReactNode; bodyClassName?: string; children: ReactNode; className?: string; subtitle?: ReactNode; title?: ReactNode }) {
  return (
    <div className={`esse-panel overflow-hidden rounded-2xl border border-[#e8dfe4] bg-white shadow-[0_10px_30px_rgb(45_29_39_/_0.055)] ${className}`}>
      {(title || subtitle || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e8dfe4] px-4 py-3.5">
          <div>{title && <h2 className="text-[14.5px] font-bold text-stone-900">{title}</h2>}{subtitle && <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p>}</div>
          {actions}
        </div>
      )}
      <div className={`p-4 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

function StatusPill({ status }: { status: AssignmentStatus }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-black ${statusClasses[status]}`}>{statusLabels[status]}</span>;
}

export default function PackagesPage() {
  const { hasPermission, salon } = useAuth();
  const pathname = usePathname();
  const section: Section = sectionByPath[pathname] ?? "catalog";
  const canManageCatalog = hasPermission(PERMISSION_KEYS.SETTINGS_SERVICES);

  const [catalog, setCatalog] = useState<ServicePackage[]>([]);
  const [posCatalog, setPosCatalog] = useState<Catalog>({ products: [], services: [] });
  const [assignments, setAssignments] = useState<CustomerPackage[]>([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ message: string; variant: "error" | "success" }>();

  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<ServicePackage>();
  const [togglingActive, setTogglingActive] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ active: true, description: "", items: [] as PackageItem[], name: "", price: "0.00", validity_days: 90 });

  const [assignSearch, setAssignSearch] = useState("");
  const [assignStatusFilter, setAssignStatusFilter] = useState<AssignmentStatus | "all">("all");
  const [selectedAssignment, setSelectedAssignment] = useState<CustomerPackage>();
  const [drawerUsages, setDrawerUsages] = useState<UsageRow[]>([]);

  async function load() {
    if (!salon?.id) return;
    const [packagesResponse, posCatalogResponse, assignmentsResponse] = await Promise.all([
      fetch(`${api}/api/salons/${salon.id}/service-packages`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/pos-catalog`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/customer-service-packages`, { credentials: "include" }),
    ]);
    if (!packagesResponse.ok) return setError("Pacchetti non disponibili.");
    setCatalog(await packagesResponse.json() as ServicePackage[]);
    if (posCatalogResponse.ok) setPosCatalog(await posCatalogResponse.json() as Catalog);
    if (assignmentsResponse.ok) setAssignments(await assignmentsResponse.json() as CustomerPackage[]);
    setError("");
  }
  useEffect(() => { void load(); }, [salon?.id]);

  async function loadDrawerUsages(customerPackageId: string) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/service-package-usages?${new URLSearchParams({ customer_package_id: customerPackageId })}`, { credentials: "include" });
    setDrawerUsages(response.ok ? await response.json() as UsageRow[] : []);
  }
  useEffect(() => {
    if (selectedAssignment) void loadDrawerUsages(selectedAssignment.id); else setDrawerUsages([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-fetch when the drawer target changes, not on every assignments refresh
  }, [selectedAssignment?.id, salon?.id]);
  useEffect(() => {
    if (!selectedAssignment) return;
    const fresh = assignments.find((row) => row.id === selectedAssignment.id);
    if (fresh && fresh !== selectedAssignment) setSelectedAssignment(fresh);
  }, [assignments, selectedAssignment]);
  useEffect(() => {
    if (!selectedPackage) return;
    const fresh = catalog.find((row) => row.id === selectedPackage.id);
    if (fresh && fresh !== selectedPackage) setSelectedPackage(fresh);
  }, [catalog, selectedPackage]);

  function toggleCategory(name: string) {
    setExpandedCategories((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  function openBuilder() {
    setForm({ active: true, description: "", items: [], name: "", price: "0.00", validity_days: 90 });
    setExpandedCategories(new Set());
    setBuilderOpen(true);
  }

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
    setBuilderOpen(false);
    setToast({ message: "Pacchetto salvato.", variant: "success" });
    await load();
  }

  async function toggleActive() {
    if (!salon || !selectedPackage) return;
    const nextActive = !selectedPackage.active;
    setTogglingActive(true);
    const response = await fetch(`${api}/api/salons/${salon.id}/service-packages/${selectedPackage.id}`, {
      body: JSON.stringify({ active: nextActive }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    setTogglingActive(false);
    if (!response.ok) return setToast({ message: "Aggiornamento non riuscito.", variant: "error" });
    setToast({ message: nextActive ? "Pacchetto riattivato." : "Pacchetto disattivato dalla vendita.", variant: "success" });
    await load();
  }

  const servicesByCategory = useMemo(() => {
    const groups = new Map<string, CatalogItem[]>();
    for (const item of posCatalog.services) {
      const category = item.category?.trim() || "Altro";
      groups.set(category, [...(groups.get(category) ?? []), item]);
    }
    return [...groups.entries()].sort(([a], [b]) => a === "Altro" ? 1 : b === "Altro" ? -1 : a.localeCompare(b, "it-IT"));
  }, [posCatalog.services]);

  const filteredCatalog = useMemo(() => {
    const needle = catalogSearch.trim().toLocaleLowerCase("it-IT");
    return catalog.filter((item) => !needle || item.name.toLocaleLowerCase("it-IT").includes(needle));
  }, [catalog, catalogSearch]);

  const assignmentsWithStatus = useMemo(() => assignments.map((row) => ({ ...row, status: assignmentStatus(row) })), [assignments]);
  const filteredAssignments = useMemo(() => {
    const needle = assignSearch.trim().toLocaleLowerCase("it-IT");
    return assignmentsWithStatus
      .filter((row) => !needle || `${row.customerName} ${row.name}`.toLocaleLowerCase("it-IT").includes(needle))
      .filter((row) => assignStatusFilter === "all" || row.status === assignStatusFilter)
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  }, [assignSearch, assignStatusFilter, assignmentsWithStatus]);

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e8dfe4] pb-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#792f59]">Pacchetti</p>
          <h1 className="mt-1 text-[26px] font-bold tracking-[-.02em] text-stone-950">{pageHeaderContent[section].title}</h1>
          <p className="mt-1 text-[13px] text-stone-500">{pageHeaderContent[section].subtitle}</p>
        </div>
      </header>

      {error && <InlineError className="mt-4">{error}</InlineError>}

      {/* ============ CATALOGO ============ */}
      {section === "catalog" && (
        <Card
          actions={
            <div className="flex flex-wrap items-center gap-2.5">
              <label className="relative min-w-[220px] flex-1">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                <input className="w-full pl-10" onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Cerca pacchetto" value={catalogSearch} />
              </label>
              {canManageCatalog && <Button onClick={openBuilder} size="sm">Crea pacchetto</Button>}
            </div>
          }
          bodyClassName="p-0"
          className="mt-4"
          subtitle={`${filteredCatalog.length} percorsi configurati`}
          title="Catalogo pacchetti"
        >
          {!filteredCatalog.length ? <div className="p-4"><EmptyState description="Crea il primo percorso con il pulsante qui sopra." title="Nessun pacchetto" /></div> : (
            <div className="overflow-x-auto border-t border-[#e8dfe4]">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.12em] text-stone-500"><tr><th className="px-5 py-3">Nome</th><th>Contenuto</th><th>Prezzo</th><th>Validità</th><th>Stato</th><th className="w-8 pr-5" /></tr></thead>
                <tbody>
                  {filteredCatalog.map((item) => {
                    const preview = item.items.slice(0, 2);
                    const extra = item.items.length - preview.length;
                    return (
                      <tr className="group cursor-pointer border-t border-stone-100 transition hover:bg-[#fffafd] focus-visible:bg-[#fffafd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#b85888] [&>td]:py-3" key={item.id} onClick={() => setSelectedPackage(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedPackage(item); } }} tabIndex={0}>
                        <td className="max-w-52 truncate px-5 font-bold text-stone-900 group-hover:text-[#792f59]">{item.name}</td>
                        <td className="max-w-64"><div className="flex flex-wrap gap-1">{preview.map((entry, index) => <span className="rounded-full bg-[#faf3f7] px-2.5 py-1 text-[10.5px] font-bold text-[#792f59]" key={entry.id ?? index}>{entry.quantity}× {entry.name}</span>)}{extra > 0 && <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10.5px] font-bold text-stone-500">+{extra}</span>}</div></td>
                        <td className="font-bold text-[#792f59]">{euro(item.priceCents)}</td>
                        <td className="text-stone-500">{item.validityDays ? `${item.validityDays} giorni` : "—"}</td>
                        <td><span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-black ${item.active ? "bg-[#e5f3ec] text-[#1c7a5c]" : "bg-stone-100 text-stone-600"}`}>{item.active ? "Attivo" : "Spento"}</span></td>
                        <td className="pr-5 text-right text-[#792f59] opacity-70 transition group-hover:opacity-100">›</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ============ ASSEGNAZIONI ============ */}
      {section === "assignments" && (
        <Card actions={<span className="text-xs font-semibold text-stone-400">{filteredAssignments.length} percorsi</span>} bodyClassName="p-0" className="mt-4" title="Registro assegnazioni">
          <div className="flex flex-wrap items-center gap-3 p-4 pb-0">
            <label className="relative min-w-[240px] flex-1">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
              <input className="w-full pl-10" onChange={(event) => setAssignSearch(event.target.value)} placeholder="Cerca cliente o pacchetto" value={assignSearch} />
            </label>
            <select aria-label="Filtra per stato" className="w-[190px]" onChange={(event) => setAssignStatusFilter(event.target.value as AssignmentStatus | "all")} value={assignStatusFilter}>
              <option value="all">Tutti gli stati</option>
              {(Object.keys(statusLabels) as AssignmentStatus[]).map((key) => <option key={key} value={key}>{statusLabels[key]}</option>)}
            </select>
          </div>
          {!filteredAssignments.length ? <div className="p-4"><EmptyState description="Modifica la ricerca o il filtro selezionato." title="Nessuna assegnazione" /></div> : (
            <div className="mt-3 overflow-x-auto border-t border-[#e8dfe4]">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.12em] text-stone-500"><tr><th className="px-5 py-3">Cliente</th><th>Pacchetto</th><th>Iniziato</th><th>Scade</th><th>Stato</th><th>Utilizzo</th><th className="w-8 pr-5" /></tr></thead>
                <tbody>
                  {filteredAssignments.map((row) => (
                    <tr className="group cursor-pointer border-t border-stone-100 transition hover:bg-[#fffafd] focus-visible:bg-[#fffafd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#b85888] [&>td]:py-3" key={row.id} onClick={() => setSelectedAssignment(row)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedAssignment(row); } }} tabIndex={0}>
                      <td className="px-5 font-bold text-stone-900 group-hover:text-[#792f59]">{row.customerName}</td>
                      <td className="max-w-52 truncate">{row.name}</td>
                      <td className="text-stone-500">{formatDate(row.startsAt)}</td>
                      <td className="text-stone-500">{row.expiresAt ? formatDate(row.expiresAt) : "—"}</td>
                      <td><StatusPill status={row.status} /></td>
                      <td className="w-32"><div className="h-1.5 rounded bg-stone-100"><div className="h-full rounded bg-[#4a9b8f]" style={{ width: `${Math.min(100, Math.round(row.usedSessions / Math.max(1, row.totalSessions) * 100))}%` }} /></div><span className="mt-1 block text-[10.5px] text-stone-500">{row.usedSessions}/{row.totalSessions} usate</span></td>
                      <td className="pr-5 text-right text-[#792f59] opacity-70 transition group-hover:opacity-100">›</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ============ MODALE: CREA PACCHETTO ============ */}
      <Dialog footer={<Button disabled={!form.name.trim() || form.items.length === 0} onClick={() => void save()} variant="primary">Salva pacchetto</Button>} onClose={() => setBuilderOpen(false)} open={builderOpen} size="2xl" title="Crea pacchetto">
        <p className="-mt-2 mb-4 text-xs text-stone-500">Ogni voce mantiene un residuo autonomo: si scala quando il cliente la utilizza.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-3">
            <label className="block"><span className="mb-1 block text-[10px] font-black uppercase text-stone-500">Nome pacchetto</span><input className="w-full" onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} value={form.name} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="mb-1 block text-[10px] font-black uppercase text-stone-500">Prezzo di vendita</span><input className="w-full" min={0} onChange={(event) => setForm((value) => ({ ...value, price: event.target.value }))} step=".01" type="number" value={form.price} /></label>
              <label className="block"><span className="mb-1 block text-[10px] font-black uppercase text-stone-500">Validità giorni</span><input className="w-full" min={1} onChange={(event) => setForm((value) => ({ ...value, validity_days: Number(event.target.value) || 1 }))} type="number" value={form.validity_days} /></label>
            </div>
            <label className="flex items-center justify-between rounded-xl border border-[#e8dfe4] px-3 py-2.5 text-sm font-bold text-stone-700"><span>Vendibile</span><Switch checked={form.active} onCheckedChange={(active) => setForm((value) => ({ ...value, active }))} /></label>
            <label className="block"><span className="mb-1 block text-[10px] font-black uppercase text-stone-500">Descrizione interna</span><textarea className="w-full" onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} value={form.description} /></label>
            {form.items.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-black uppercase text-stone-400">Selezionati</p>
                <div className="space-y-1.5">
                  {form.items.map((item, index) => (
                    <div className="grid grid-cols-[1fr_64px_auto] items-center gap-2 rounded-lg border border-[#e8dfe4] bg-[#faf3f7] px-3 py-2 text-xs" key={`${item.item_type}-${item.service_id ?? item.product_id}`}>
                      <span className="font-bold text-stone-800">{item.name}</span>
                      <input className="!min-h-8 w-16 px-2 text-center" min={1} onChange={(event) => setForm((current) => ({ ...current, items: current.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, quantity: Math.max(1, Number(event.target.value)) } : entry) }))} type="number" value={item.quantity} />
                      <button className="font-black text-[#b23a2e]" onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))} type="button">×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="rounded-xl border border-[#e8dfe4] p-3">
            <h3 className="mb-2 text-xs font-black text-stone-800">Contenuto</h3>
            <p className="mb-1.5 text-[10px] font-black uppercase text-stone-400">Servizi per categoria</p>
            <div className="max-h-[28rem] divide-y divide-[#e8dfe4] overflow-y-auto rounded-lg border border-[#e8dfe4]">
              {servicesByCategory.map(([category, items]) => {
                const expanded = expandedCategories.has(category);
                return (
                  <div key={category}>
                    <button className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-black text-stone-700 hover:bg-stone-50" onClick={() => toggleCategory(category)} type="button">
                      <span>{category}<span className="ml-1.5 font-semibold text-stone-400">({items.length})</span></span>
                      <ChevronDown className={`size-3.5 shrink-0 text-stone-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </button>
                    {expanded && (
                      <div className="space-y-1.5 px-3 pb-2.5">
                        {items.map((item) => <button className="flex w-full justify-between rounded-lg bg-stone-50 px-3 py-2 text-left text-xs font-bold text-stone-700 hover:bg-[#faf3f7] hover:text-[#792f59]" key={item.id} onClick={() => addItem("service", item)} type="button"><span>{item.name}</span><b>+</b></button>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mb-1.5 mt-3 text-[10px] font-black uppercase text-stone-400">Prodotti</p>
            <div className="max-h-56 space-y-1.5 overflow-y-auto">
              {posCatalog.products.map((item) => <button className="flex w-full justify-between rounded-lg bg-stone-50 px-3 py-2 text-left text-xs font-bold text-stone-700 hover:bg-[#faf3f7] hover:text-[#792f59]" key={item.id} onClick={() => addItem("product", item)} type="button"><span>{item.name}</span><b>+</b></button>)}
            </div>
          </div>
        </div>
      </Dialog>

      {/* ============ DRAWER: DETTAGLIO PACCHETTO ============ */}
      <Drawer onClose={() => setSelectedPackage(undefined)} open={Boolean(selectedPackage)} title={selectedPackage?.name ?? ""}>
        {selectedPackage && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-stone-500">{euro(selectedPackage.priceCents)} · {selectedPackage.validityDays ? `${selectedPackage.validityDays} giorni di validità` : "senza scadenza"}</p>
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-black ${selectedPackage.active ? "bg-[#e5f3ec] text-[#1c7a5c]" : "bg-stone-100 text-stone-600"}`}>{selectedPackage.active ? "Attivo" : "Spento"}</span>
            </div>
            {selectedPackage.description && <p className="text-sm text-stone-600">{selectedPackage.description}</p>}
            <div>
              <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-stone-500">Contenuto</p>
              <div className="space-y-1.5">
                {selectedPackage.items.map((entry, index) => <div className="flex items-center justify-between rounded-lg border border-[#e8dfe4] px-3 py-2 text-xs" key={entry.id ?? index}><span className="font-bold text-stone-800">{entry.name}</span><span className="text-stone-500">{entry.quantity}×</span></div>)}
              </div>
            </div>
            {canManageCatalog && (
              <Button className="w-full justify-center" disabled={togglingActive} onClick={() => void toggleActive()} variant={selectedPackage.active ? "outline" : "primary"}>
                {selectedPackage.active ? "Disattiva dalla vendita" : "Riattiva"}
              </Button>
            )}
          </div>
        )}
      </Drawer>

      {/* ============ DRAWER: DETTAGLIO ASSEGNAZIONE ============ */}
      <Drawer onClose={() => setSelectedAssignment(undefined)} open={Boolean(selectedAssignment)} title={selectedAssignment?.customerName ?? ""}>
        {selectedAssignment && (() => {
          const status = assignmentStatus(selectedAssignment);
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between"><p className="text-xs text-stone-500">{selectedAssignment.name} · dal {formatDate(selectedAssignment.startsAt)}</p><StatusPill status={status} /></div>
              <div>
                <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-stone-500">Residuo per voce</p>
                <div className="space-y-2">
                  {selectedAssignment.items.map((item) => (
                    <div className="rounded-xl border border-[#e8dfe4] p-3" key={item.packageItemId}>
                      <div className="mb-1.5 flex justify-between text-xs font-bold text-stone-800"><span>{item.name}</span><span className="tabular-nums">{item.usedQuantity}/{item.totalQuantity}</span></div>
                      <div className="h-1.5 rounded bg-stone-100"><div className={`h-full rounded ${item.remainingQuantity <= 0 ? "bg-stone-400" : "bg-[#4a9b8f]"}`} style={{ width: `${Math.round(item.usedQuantity / item.totalQuantity * 100)}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-stone-500">Registro utilizzi</p>
                {!drawerUsages.length ? <p className="text-xs text-stone-500">Nessun utilizzo registrato.</p> : (
                  <div className="space-y-1.5">{drawerUsages.map((usage) => <div className="flex justify-between border-t border-stone-100 pt-1.5 text-xs first:border-t-0 first:pt-0" key={usage.id}><span className="text-stone-700">{usage.itemName ?? "—"}</span><span className="font-bold text-stone-500">{formatDateTime(usage.createdAt)}</span></div>)}</div>
                )}
              </div>
            </div>
          );
        })()}
      </Drawer>

      <SaveToast variant={toast?.variant} visible={Boolean(toast)}>{toast?.message ?? ""}</SaveToast>
    </AppPage>
  );
}
