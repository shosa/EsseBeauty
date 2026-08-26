"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, DoorOpen, MapPin, Plus, Save, Search, Settings2, UsersRound, X } from "lucide-react";

import { AppPage, Button, Dialog, Drawer, EmptyState, FormField, InlineError, PageHeaderMetrics, SaveToast, Switch } from "@esse-beauty/ui";
import { useAuth } from "../../../lib/auth-context";
import { CabinList, CabinStatusFilter, CabinSummary, CabinToolbarActions, CabinWorkspaceItem, filterCabins, toggleServiceAssignment } from "./cabins-workspace";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Location { active: boolean; id: string; name: string; }
interface Cabin extends CabinWorkspaceItem {}
interface Service { category: string; id: string; name: string; }

function AccordionSection({ children, icon, label, onToggle, open, summary }: { children: React.ReactNode; icon: React.ReactNode; label: string; onToggle(): void; open: boolean; summary: string }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <button aria-expanded={open} className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-stone-50" onClick={onToggle} type="button">
        <span className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f8edf3] text-[#792f59]">{icon}</span><span><strong className="block text-sm text-stone-950">{label}</strong><span className="mt-0.5 block text-xs font-medium text-stone-500">{summary}</span></span></span>
        <ChevronDown className={`size-4 shrink-0 text-stone-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-stone-100 px-4 py-4">{children}</div>}
    </section>
  );
}

export default function CabinsPage() {
  const { salon } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [assignmentCounts, setAssignmentCounts] = useState<Record<string, number>>({});
  const [locationId, setLocationId] = useState("");
  const [cabinId, setCabinId] = useState("");
  const [cabinDraft, setCabinDraft] = useState<Cabin | null>(null);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CabinStatusFilter>("active");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [cabinName, setCabinName] = useState("");
  const [newCabinLocationId, setNewCabinLocationId] = useState("");
  const [capacity, setCapacity] = useState(1);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load(preferredLocation?: string, preferredCabin?: string) {
    if (!salon) return;
    setLoading(true);
    setError("");
    const [locationsResponse, resourcesResponse, servicesResponse] = await Promise.all([
      fetch(`${api}/api/salons/${salon.id}/settings/locations`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/settings/resources`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/services?active=true`, { credentials: "include" }),
    ]);
    if (!locationsResponse.ok || !resourcesResponse.ok || !servicesResponse.ok) {
      setError("Impossibile caricare le cabine.");
      setLoading(false);
      return;
    }
    const nextLocations = await locationsResponse.json() as Location[];
    const nextCabins = (await resourcesResponse.json() as Cabin[]).filter((item) => item.type === "cabin" || item.type === "room");
    setLocations(nextLocations);
    setCabins(nextCabins);
    setServices(await servicesResponse.json() as Service[]);
    const counts = await Promise.all(nextCabins.map(async (cabin) => {
      const response = await fetch(`${api}/api/salons/${salon.id}/settings/resources/${cabin.id}/services`, { credentials: "include" });
      return [cabin.id, response.ok ? (await response.json() as unknown[]).length : 0] as const;
    }));
    setAssignmentCounts(Object.fromEntries(counts));
    const candidateLocation = preferredLocation || locationId;
    const nextLocationId = nextLocations.some((item) => item.id === candidateLocation)
      ? candidateLocation
      : nextLocations.find((item) => item.active)?.id ?? nextLocations[0]?.id ?? "";
    setLocationId(nextLocationId);
    if (preferredCabin) {
      setCabinId(preferredCabin);
      setCabinDraft(nextCabins.find((item) => item.id === preferredCabin) ?? null);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [salon?.id]);
  useEffect(() => {
    if (!salon || !cabinId) { setAssigned([]); return; }
    void fetch(`${api}/api/salons/${salon.id}/settings/resources/${cabinId}/services`, { credentials: "include" })
      .then(async (response) => {
        if (response.ok) setAssigned((await response.json() as Array<{ service_id: string }>).map((item) => item.service_id));
      });
  }, [cabinId, salon?.id]);

  const visibleCabins = filterCabins(cabins, { locationId, query, status: statusFilter });
  const categories = useMemo(() => Array.from(new Set(services.map((item) => item.category))), [services]);
  const activeCabins = cabins.filter((item) => item.active);
  const configuredCabins = cabins.filter((item) => (assignmentCounts[item.id] ?? 0) > 0).length;
  const selectedLocation = locations.find((item) => item.id === locationId);

  function notify(value: string) {
    setMessage(value);
    window.setTimeout(() => setMessage(""), 2400);
  }

  function openCabin(cabinIdToOpen: string) {
    const cabin = cabins.find((item) => item.id === cabinIdToOpen);
    if (!cabin) return;
    setCabinId(cabin.id);
    setCabinDraft({ ...cabin });
    setDetailsOpen(true);
    setServicesOpen(false);
  }

  function closeCabin() {
    setCabinId("");
    setCabinDraft(null);
    setAssigned([]);
  }

  function updateCabinDraft(patch: Partial<Cabin>) {
    setCabinDraft((current) => current ? { ...current, ...patch } : current);
  }

  async function createCabin() {
    if (!salon || !newCabinLocationId || !cabinName.trim()) return;
    setSaving(true);
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/settings/resources`, {
      body: JSON.stringify({ capacity, location_id: newCabinLocationId, name: cabinName.trim(), type: "cabin" }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    setSaving(false);
    if (!response.ok) return setError("Cabina non creata.");
    const created = await response.json() as Cabin;
    setCabinName("");
    setCapacity(1);
    setCreateOpen(false);
    notify("Cabina creata e pronta da configurare.");
    await load(newCabinLocationId, created.id);
  }

  async function saveWorkspace() {
    if (!salon || !cabinDraft) return;
    setSaving(true);
    setError("");
    const [cabinResponse, assignmentsResponse] = await Promise.all([
      fetch(`${api}/api/salons/${salon.id}/settings/resources/${cabinDraft.id}`, {
        body: JSON.stringify({ active: cabinDraft.active, capacity: cabinDraft.capacity, location_id: cabinDraft.locationId, name: cabinDraft.name.trim(), type: cabinDraft.type }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
      fetch(`${api}/api/salons/${salon.id}/settings/resources/${cabinDraft.id}/services`, {
        body: JSON.stringify({ service_ids: assigned }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "PUT",
      }),
    ]);
    setSaving(false);
    if (!cabinResponse.ok || !assignmentsResponse.ok) return setError("Modifiche non salvate completamente. Riprova.");
    notify("Cabina aggiornata.");
    closeCabin();
    await load(cabinDraft.locationId ?? locationId);
  }

  async function toggleCabinActive(cabin: CabinWorkspaceItem) {
    if (!salon) return;
    setCabins((current) => current.map((item) => item.id === cabin.id ? { ...item, active: !cabin.active } : item));
    const response = await fetch(`${api}/api/salons/${salon.id}/settings/resources/${cabin.id}`, {
      body: JSON.stringify({ active: !cabin.active, capacity: cabin.capacity, location_id: cabin.locationId, name: cabin.name, type: cabin.type }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    if (!response.ok) {
      setCabins((current) => current.map((item) => item.id === cabin.id ? { ...item, active: cabin.active } : item));
      setError("Stato della cabina non aggiornato.");
      return;
    }
    notify(cabin.active ? "Cabina disattivata." : "Cabina resa operativa.");
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageHeaderMetrics
        eyebrow="Spazi operativi"
        metrics={[
          { detail: `${cabins.length - activeCabins.length} non attive`, label: "Operative", value: activeCabins.length },
          { detail: "posti complessivi", label: "Capienza", value: activeCabins.reduce((sum, item) => sum + item.capacity, 0) },
          { detail: "con servizi associati", label: "Pronte", value: `${configuredCabins}/${cabins.length}` },
        ]}
        subtitle="Controlla gli ambienti, cambia stato e configura i trattamenti senza lasciare la lista."
        title="Cabine"
      />

      {error && <InlineError className="mb-4">{error}</InlineError>}
      {loading && <div className="mb-4 h-1 animate-pulse rounded-full bg-[#792f59]" />}
      <SaveToast visible={Boolean(message)}>{message}</SaveToast>

      {locations.length === 0 ? (
        <div><EmptyState description="Configura prima la sede operativa nelle impostazioni." title="Nessuna sede configurata" /><div className="mt-3 flex justify-center"><Link className="rounded-lg bg-[#792f59] px-4 py-2 text-sm font-bold text-white" href="/settings/locations">Configura sedi</Link></div></div>
      ) : (
        <section aria-label="Console cabine">
          <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-stone-200 bg-white p-2 shadow-sm lg:flex-row lg:items-center">
            <label className="relative lg:w-64"><MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#792f59]" /><select aria-label="Sede operativa" className="w-full rounded-xl border-0 bg-[#f8f3f6] py-2.5 pl-9 pr-3 text-sm font-bold" onChange={(event) => { setLocationId(event.target.value); closeCabin(); }} value={locationId}>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.active ? "" : " (non attiva)"}</option>)}</select></label>
            <label className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" /><input aria-label="Cerca cabina" className="w-full rounded-xl border-0 bg-stone-50 py-2.5 pl-9 pr-3 text-sm" onChange={(event) => setQuery(event.target.value)} placeholder="Cerca per nome..." value={query} /></label>
            <label className="relative lg:w-44"><Settings2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" /><select aria-label="Filtra per stato" className="w-full rounded-xl border-0 bg-stone-50 py-2.5 pl-9 pr-3 text-sm font-bold" onChange={(event) => setStatusFilter(event.target.value as CabinStatusFilter)} value={statusFilter}><option value="active">Solo attive</option><option value="inactive">Non attive</option><option value="all">Tutte</option></select></label>
            <CabinToolbarActions count={visibleCabins.length} onCreate={() => { setNewCabinLocationId(locationId); setCreateOpen(true); }} />
          </div>

          {visibleCabins.length === 0
            ? <EmptyState description="Aggiungi un ambiente o modifica i filtri di ricerca." title="Nessuna cabina trovata" />
            : <CabinList assignmentCounts={assignmentCounts} cabins={visibleCabins} locationName={selectedLocation?.name ?? "Sede"} onSelect={openCabin} onToggleActive={(cabin) => void toggleCabinActive(cabin)} selectedCabinId={cabinId} />}
        </section>
      )}

      <Dialog
        footer={<><Button onClick={() => setCreateOpen(false)} variant="secondary"><X className="mr-2 size-4" />Annulla</Button><Button disabled={!cabinName.trim() || saving} onClick={() => void createCabin()} variant="primary"><Plus className="mr-2 size-4" />{saving ? "Creazione..." : "Crea cabina"}</Button></>}
        onClose={() => setCreateOpen(false)}
        open={createOpen}
        title="Nuova cabina"
      >
        <div className="mb-5 flex items-center gap-3 rounded-2xl bg-[#f8edf3] p-4"><span className="grid size-11 place-items-center rounded-xl bg-white text-[#792f59] shadow-sm"><DoorOpen className="size-5" /></span><div><strong className="text-sm text-stone-950">Aggiungi uno spazio operativo</strong><p className="mt-0.5 text-xs leading-5 text-stone-500">Potrai associare i trattamenti subito dopo la creazione.</p></div></div>
        <div className="space-y-4">
          <FormField label="Nome cabina" required><input autoFocus className="w-full" onChange={(event) => setCabinName(event.target.value)} placeholder="Es. Cabina viso 1" value={cabinName} /></FormField>
          <div className="grid gap-4 sm:grid-cols-2"><FormField label="Sede"><select className="w-full" onChange={(event) => setNewCabinLocationId(event.target.value)} value={newCabinLocationId}>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></FormField><FormField label="Capienza"><input className="w-full" min={1} onChange={(event) => setCapacity(Math.max(1, Number(event.target.value)))} type="number" value={capacity} /></FormField></div>
        </div>
      </Dialog>

      <Drawer
        footer={cabinDraft && <div className="flex items-center justify-between gap-4"><span className="flex items-center gap-1.5 text-xs font-bold text-stone-500"><UsersRound className="size-3.5" />{assigned.length} servizi</span><Button disabled={!cabinDraft.name.trim() || saving} onClick={() => void saveWorkspace()} variant="primary"><Save className="mr-2 size-4" />{saving ? "Salvataggio..." : "Salva modifiche"}</Button></div>}
        onClose={closeCabin}
        open={Boolean(cabinDraft)}
        size="xl"
        title={cabinDraft?.name ?? "Cabina"}
      >
        {cabinDraft && <div className="space-y-3">
          <CabinSummary cabin={cabinDraft} locationName={locations.find((item) => item.id === cabinDraft.locationId)?.name ?? "Sede"} serviceCount={assigned.length} />

          <AccordionSection icon={<Settings2 className="size-4" />} label="Dati cabina" onToggle={() => setDetailsOpen((value) => !value)} open={detailsOpen} summary={`${cabinDraft.capacity} ${cabinDraft.capacity === 1 ? "persona" : "persone"} · ${locations.find((item) => item.id === cabinDraft.locationId)?.name ?? "Sede"}`}>
            <div className="space-y-4"><FormField label="Nome"><input className="w-full" onChange={(event) => updateCabinDraft({ name: event.target.value })} value={cabinDraft.name} /></FormField><div className="grid grid-cols-2 gap-3"><FormField label="Capienza"><input className="w-full" min={1} onChange={(event) => updateCabinDraft({ capacity: Math.max(1, Number(event.target.value)) })} type="number" value={cabinDraft.capacity} /></FormField><FormField label="Sede"><select className="w-full" onChange={(event) => updateCabinDraft({ locationId: event.target.value })} value={cabinDraft.locationId ?? ""}>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></FormField></div><label className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-3 text-sm font-bold">Disponibile in agenda<Switch checked={cabinDraft.active} onCheckedChange={(active) => updateCabinDraft({ active })} /></label></div>
          </AccordionSection>

          <AccordionSection icon={<Check className="size-4" />} label="Servizi compatibili" onToggle={() => setServicesOpen((value) => !value)} open={servicesOpen} summary={assigned.length ? `${assigned.length} trattamenti associati` : "Configurazione richiesta"}>
            <div className="space-y-5">{categories.map((category) => <div className="rounded-2xl bg-stone-50 p-4" key={category}><div className="mb-3 flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-[.14em] text-stone-500">{category}</p><span className="text-[10px] font-bold text-stone-400">{services.filter((service) => service.category === category && assigned.includes(service.id)).length}/{services.filter((service) => service.category === category).length} selezionati</span></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{services.filter((service) => service.category === category).map((service) => <button className={`min-h-14 rounded-xl border px-3 py-3 text-left text-xs font-bold transition ${assigned.includes(service.id) ? "border-cyan-300 bg-cyan-50 text-cyan-900 shadow-sm" : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"}`} key={service.id} onClick={() => setAssigned((current) => toggleServiceAssignment(current, service.id))} type="button"><span className="flex items-center justify-between gap-2">{service.name}{assigned.includes(service.id) && <Check className="size-4 shrink-0 text-cyan-700" />}</span></button>)}</div></div>)}</div>
          </AccordionSection>
        </div>}
      </Drawer>
    </AppPage>
  );
}
