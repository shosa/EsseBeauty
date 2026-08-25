"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, DoorOpen, MapPin, Plus, Search, UsersRound } from "lucide-react";

import { AppPage, Button, EmptyState, FormField, InlineError, KpiStrip, PageHeader, SectionCard, StatusBadge, Switch } from "@esse-beauty/ui";
import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Location { active: boolean; id: string; name: string; }
interface Cabin { active: boolean; capacity: number; id: string; locationId?: string | null; name: string; type: string; }
interface Service { category: string; id: string; name: string; }

export default function CabinsPage() {
  const { salon } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [assignmentCounts, setAssignmentCounts] = useState<Record<string, number>>({});
  const [locationId, setLocationId] = useState("");
  const [cabinId, setCabinId] = useState("");
  const [assigned, setAssigned] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "all" | "inactive">("active");
  const [cabinName, setCabinName] = useState("");
  const [capacity, setCapacity] = useState(1);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

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
    if (preferredCabin) setCabinId(preferredCabin);
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

  const selectedCabin = cabins.find((item) => item.id === cabinId);
  const visibleCabins = cabins
    .filter((item) => item.locationId === locationId)
    .filter((item) => statusFilter === "all" || item.active === (statusFilter === "active"))
    .filter((item) => item.name.toLocaleLowerCase("it-IT").includes(query.trim().toLocaleLowerCase("it-IT")));
  const categories = useMemo(() => Array.from(new Set(services.map((item) => item.category))), [services]);
  const activeCabins = cabins.filter((item) => item.active);
  const configuredCabins = cabins.filter((item) => (assignmentCounts[item.id] ?? 0) > 0).length;

  function notify(value: string) {
    setMessage(value);
    window.setTimeout(() => setMessage(""), 2200);
  }

  function updateCabinDraft(patch: Partial<Cabin>) {
    if (!selectedCabin) return;
    setCabins((current) => current.map((item) => item.id === selectedCabin.id ? { ...item, ...patch } : item));
  }

  async function createCabin() {
    if (!salon || !locationId || !cabinName.trim()) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/settings/resources`, {
      body: JSON.stringify({ capacity, location_id: locationId, name: cabinName, type: "cabin" }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (!response.ok) return setError("Cabina non creata.");
    const created = await response.json() as Cabin;
    setCabinName("");
    setCapacity(1);
    notify("Cabina creata.");
    await load(locationId, created.id);
  }

  async function saveCabin() {
    if (!salon || !selectedCabin) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/settings/resources/${selectedCabin.id}`, {
      body: JSON.stringify({ active: selectedCabin.active, capacity: selectedCabin.capacity, location_id: selectedCabin.locationId, name: selectedCabin.name, type: selectedCabin.type }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    if (!response.ok) return setError("Cabina non aggiornata.");
    notify("Cabina aggiornata.");
    await load(selectedCabin.locationId ?? locationId, selectedCabin.id);
  }

  async function saveAssignments() {
    if (!salon || !cabinId) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/settings/resources/${cabinId}/services`, {
      body: JSON.stringify({ service_ids: assigned }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PUT",
    });
    if (!response.ok) return setError("Servizi della cabina non salvati.");
    setAssignmentCounts((current) => ({ ...current, [cabinId]: assigned.length }));
    notify("Servizi della cabina salvati.");
  }

  return (
    <AppPage maxWidth="max-w-[1800px]">
      <PageHeader eyebrow="Spazi operativi" status={<StatusBadge status="active">{activeCabins.length} attive</StatusBadge>} subtitle="Gestisci capienza, disponibilità e trattamenti compatibili." title="Cabine" />
      {error && <InlineError className="mb-4">{error}</InlineError>}
      {message && <p className="mb-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</p>}
      {loading && <div className="mb-4 h-1 animate-pulse bg-[#0e7490]" />}
      <KpiStrip items={[{ detail: `${cabins.length - activeCabins.length} non attive`, label: "Cabine attive", value: activeCabins.length }, { detail: "persone complessive", label: "Capienza", value: activeCabins.reduce((sum, item) => sum + item.capacity, 0) }, { detail: "con servizi associati", label: "Cabine pronte", value: `${configuredCabins}/${cabins.length}` }]} />

      {locations.length === 0 ? (
        <div className="mt-4"><EmptyState description="Configura prima la sede operativa nelle impostazioni." title="Nessuna sede configurata" /><div className="mt-3 flex justify-center"><Link className="rounded-lg bg-[#792f59] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#682647]" href="/settings/locations">Configura sedi</Link></div></div>
      ) : (
        <div className="mt-4 space-y-4">
          <SectionCard title="Cabine operative" subtitle={`${visibleCabins.length} ambienti visualizzati`}>
            <div className="mb-4 grid gap-2 md:grid-cols-[240px_minmax(240px,1fr)_160px]">
              <label className="relative"><MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" /><select className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm font-bold" onChange={(event) => { setLocationId(event.target.value); setCabinId(""); }} value={locationId}>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.active ? "" : " (non attiva)"}</option>)}</select></label>
              <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" /><input className="w-full rounded-lg border border-stone-200 py-2 pl-9 pr-3 text-sm" onChange={(event) => setQuery(event.target.value)} placeholder="Cerca cabina" value={query} /></label>
              <select className="rounded-lg border border-stone-200 bg-white px-3 text-sm font-bold" onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} value={statusFilter}><option value="active">Attive</option><option value="inactive">Non attive</option><option value="all">Tutte</option></select>
            </div>
            {visibleCabins.length === 0 ? <EmptyState description="Aggiungi il primo ambiente operativo o modifica i filtri." title="Nessuna cabina" /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{visibleCabins.map((cabin) => <button className={`border p-4 text-left ${cabinId === cabin.id ? "border-[#0e7490] bg-cyan-50" : "border-stone-200 bg-white"}`} key={cabin.id} onClick={() => setCabinId(cabin.id)} type="button"><div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-lg bg-cyan-50 text-[#0e7490]"><DoorOpen size={20} /></span><StatusBadge status={cabin.active ? "active" : "inactive"}>{cabin.active ? "Attiva" : "Non attiva"}</StatusBadge></div><strong className="mt-3 block">{cabin.name}</strong><div className="mt-2 flex gap-4 text-xs text-stone-500"><span className="flex items-center gap-1"><UsersRound size={13} />{cabin.capacity}</span><span className="flex items-center gap-1"><Check size={13} />{assignmentCounts[cabin.id] ?? 0} servizi</span></div></button>)}</div>}
            <div className="mt-5 grid gap-3 border-t border-stone-100 pt-4 sm:grid-cols-[1fr_120px_auto] sm:items-end"><FormField label="Nuova cabina"><input className="w-full" onChange={(event) => setCabinName(event.target.value)} value={cabinName} /></FormField><FormField label="Capienza"><input className="w-full" min={1} onChange={(event) => setCapacity(Math.max(1, Number(event.target.value)))} type="number" value={capacity} /></FormField><Button disabled={!cabinName.trim()} onClick={() => void createCabin()} variant="primary"><Plus className="mr-2 size-4" />Aggiungi</Button></div>
          </SectionCard>

          {selectedCabin && <SectionCard title={`Gestisci · ${selectedCabin.name}`} subtitle="Dati e stato operativo della cabina."><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><FormField label="Nome"><input className="w-full" onChange={(event) => updateCabinDraft({ name: event.target.value })} value={selectedCabin.name} /></FormField><FormField label="Capienza"><input className="w-full" min={1} onChange={(event) => updateCabinDraft({ capacity: Math.max(1, Number(event.target.value)) })} type="number" value={selectedCabin.capacity} /></FormField><FormField label="Sede"><select className="w-full" onChange={(event) => updateCabinDraft({ locationId: event.target.value })} value={selectedCabin.locationId ?? ""}>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></FormField><label className="flex items-center justify-between rounded-lg border border-stone-200 px-3 text-sm font-bold">Cabina attiva<Switch checked={selectedCabin.active} onCheckedChange={(active) => updateCabinDraft({ active })} /></label></div><div className="mt-4 flex justify-end"><Button onClick={() => void saveCabin()} variant="primary">Salva cabina</Button></div></SectionCard>}

          {selectedCabin && <SectionCard title="Servizi compatibili" subtitle="I trattamenti selezionati richiedono una cabina libera durante la prenotazione."><div className="space-y-4">{categories.map((category) => <div key={category}><p className="mb-2 text-[10px] font-black uppercase text-stone-400">{category}</p><div className="flex flex-wrap gap-2">{services.filter((service) => service.category === category).map((service) => <button className={`rounded-lg border px-3 py-2 text-xs font-bold ${assigned.includes(service.id) ? "border-cyan-300 bg-cyan-50 text-cyan-900" : "border-stone-200 text-stone-500"}`} key={service.id} onClick={() => setAssigned((current) => current.includes(service.id) ? current.filter((id) => id !== service.id) : [...current, service.id])} type="button">{service.name}</button>)}</div></div>)}</div><div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4"><span className="text-xs text-stone-500">{assigned.length} servizi selezionati</span><Button onClick={() => void saveAssignments()} variant="primary">Salva compatibilità</Button></div></SectionCard>}
        </div>
      )}
    </AppPage>
  );
}
