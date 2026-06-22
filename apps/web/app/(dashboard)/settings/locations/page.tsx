"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, DoorOpen, Plus } from "lucide-react";

import { MODULE_KEYS, useModuleEnabled } from "@esse-beauty/feature-flags";
import { AppPage, Button, EmptyState, FormField, InlineError, PageHeader, SectionCard, StatusBadge } from "@esse-beauty/ui";
import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Location {
  active: boolean;
  address?: string | null;
  id: string;
  name: string;
}

interface Cabin {
  active: boolean;
  capacity: number;
  id: string;
  locationId?: string | null;
  name: string;
  type: string;
}

interface Service {
  category: string;
  id: string;
  name: string;
}

export default function LocationsPage() {
  const { salon } = useAuth();
  const multiLocation = useModuleEnabled(MODULE_KEYS.MULTI_LOCATION);
  const [locations, setLocations] = useState<Location[]>([]);
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [locationId, setLocationId] = useState("");
  const [cabinId, setCabinId] = useState("");
  const [assigned, setAssigned] = useState<string[]>([]);
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [cabinName, setCabinName] = useState("");
  const [capacity, setCapacity] = useState(1);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load(preferredLocation?: string) {
    if (!salon) return;
    const [locationsResponse, resourcesResponse, servicesResponse] = await Promise.all([
      fetch(`${api}/api/salons/${salon.id}/settings/locations`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/settings/resources`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/services?active=true`, { credentials: "include" }),
    ]);
    if (!locationsResponse.ok || !resourcesResponse.ok || !servicesResponse.ok) {
      setError("Impossibile caricare sedi e cabine.");
      return;
    }
    const nextLocations = await locationsResponse.json() as Location[];
    setLocations(nextLocations);
    setCabins((await resourcesResponse.json() as Cabin[]).filter((item) => item.type === "cabin" || item.type === "room"));
    setServices(await servicesResponse.json() as Service[]);
    const nextId = preferredLocation || locationId;
    setLocationId(nextLocations.some((item) => item.id === nextId) ? nextId : nextLocations[0]?.id ?? "");
  }

  useEffect(() => { void load(); }, [salon?.id]);

  useEffect(() => {
    if (!salon || !cabinId) return setAssigned([]);
    void fetch(`${api}/api/salons/${salon.id}/settings/resources/${cabinId}/services`, { credentials: "include" })
      .then(async (response) => {
        if (response.ok) setAssigned((await response.json() as Array<{ service_id: string }>).map((item) => item.service_id));
      });
  }, [cabinId, salon?.id]);

  const selectedLocation = locations.find((item) => item.id === locationId);
  const selectedCabin = cabins.find((item) => item.id === cabinId);
  const visibleCabins = cabins.filter((item) => item.locationId === locationId);
  const categories = useMemo(() => Array.from(new Set(services.map((item) => item.category))), [services]);

  async function createLocation() {
    if (!salon || !locationName.trim()) return;
    if (!multiLocation && locations.length > 0) return setError("Attiva il modulo Multi-sede per aggiungere una seconda sede.");
    const response = await fetch(`${api}/api/salons/${salon.id}/settings/locations`, {
      body: JSON.stringify({ address: locationAddress, name: locationName }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (!response.ok) return setError("Sede non creata.");
    const created = await response.json() as Location;
    setLocationName("");
    setLocationAddress("");
    setMessage("Sede creata.");
    await load(created.id);
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
    setMessage("Cabina creata.");
    await load(locationId);
    setCabinId(created.id);
  }

  async function saveAssignments() {
    if (!salon || !cabinId) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/settings/resources/${cabinId}/services`, {
      body: JSON.stringify({ service_ids: assigned }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PUT",
    });
    setMessage(response.ok ? "Servizi della cabina salvati." : "");
    setError(response.ok ? "" : "Servizi della cabina non salvati.");
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageHeader
        eyebrow="Organizzazione"
        status={<StatusBadge status="active">{locations.length} sedi · {cabins.length} cabine</StatusBadge>}
        subtitle="Configura gli ambienti reali del salone: l’agenda impedirà che la stessa cabina venga usata da due appuntamenti contemporaneamente."
        title={multiLocation ? "Sedi e cabine" : "Cabine del salone"}
      />
      {error && <InlineError className="mb-5">{error}</InlineError>}
      {message && <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p>}

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <SectionCard title="Sedi operative" subtitle={multiLocation ? "Scegli la sede da configurare." : "La sede principale contiene cabine e collaboratori."}>
          <div className="space-y-2">
            {locations.map((location) => (
              <button
                className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left ${locationId === location.id ? "border-[#9d4f78] bg-[#faf3f7]" : "border-stone-200"}`}
                key={location.id}
                onClick={() => { setLocationId(location.id); setCabinId(""); }}
                type="button"
              >
                <span className="grid size-10 place-items-center rounded-lg bg-white text-[#792f59] ring-1 ring-stone-200"><Building2 className="size-5" /></span>
                <span><strong className="block">{location.name}</strong><small className="text-stone-500">{location.address || "Indirizzo da completare"}</small></span>
              </button>
            ))}
          </div>
          {(multiLocation || locations.length === 0) && (
            <div className="mt-5 space-y-3 border-t border-stone-100 pt-5">
              <FormField label="Nome sede" required><input className="w-full" value={locationName} onChange={(event) => setLocationName(event.target.value)} /></FormField>
              <FormField label="Indirizzo"><input className="w-full" value={locationAddress} onChange={(event) => setLocationAddress(event.target.value)} /></FormField>
              <Button disabled={!locationName.trim()} onClick={() => void createLocation()} variant="outline"><Plus className="mr-2 size-4" />Aggiungi sede</Button>
            </div>
          )}
        </SectionCard>

        <div className="space-y-5">
          {!selectedLocation ? (
            <EmptyState description="Crea la sede principale per iniziare." title="Nessuna sede configurata" />
          ) : (
            <SectionCard title={`Cabine · ${selectedLocation.name}`} subtitle="Ogni cabina può essere riservata a specifici trattamenti.">
              {visibleCabins.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {visibleCabins.map((cabin) => (
                    <button className={`flex items-center gap-3 rounded-xl border p-4 text-left ${cabinId === cabin.id ? "border-[#9d4f78] bg-[#faf3f7]" : "border-stone-200"}`} key={cabin.id} onClick={() => setCabinId(cabin.id)} type="button">
                      <span className="grid size-10 place-items-center rounded-lg bg-white text-[#792f59] ring-1 ring-stone-200"><DoorOpen className="size-5" /></span>
                      <span><strong className="block">{cabin.name}</strong><small className="text-stone-500">Capienza {cabin.capacity}</small></span>
                    </button>
                  ))}
                </div>
              ) : <EmptyState description="Aggiungi il primo ambiente operativo." title="Nessuna cabina" />}
              <div className="mt-5 grid gap-3 border-t border-stone-100 pt-5 sm:grid-cols-[minmax(0,1fr)_130px_auto] sm:items-end">
                <FormField label="Nome cabina" required><input className="w-full" value={cabinName} onChange={(event) => setCabinName(event.target.value)} /></FormField>
                <FormField label="Capienza"><input className="w-full" min={1} type="number" value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} /></FormField>
                <Button disabled={!cabinName.trim()} onClick={() => void createCabin()} variant="primary"><Plus className="mr-2 size-4" />Aggiungi</Button>
              </div>
            </SectionCard>
          )}

          {selectedCabin && (
            <SectionCard title={`Servizi compatibili · ${selectedCabin.name}`} subtitle="Questi trattamenti richiederanno automaticamente una cabina libera durante la prenotazione.">
              <div className="space-y-4">
                {categories.map((category) => (
                  <div key={category}>
                    <p className="mb-2 text-[11px] font-black uppercase tracking-[.16em] text-stone-400">{category}</p>
                    <div className="flex flex-wrap gap-2">
                      {services.filter((service) => service.category === category).map((service) => (
                        <button
                          className={`rounded-xl border px-4 py-3 text-sm font-bold ${assigned.includes(service.id) ? "border-sky-300 bg-sky-50 text-sky-900" : "border-stone-200 bg-white text-stone-500"}`}
                          key={service.id}
                          onClick={() => setAssigned((current) => current.includes(service.id) ? current.filter((id) => id !== service.id) : [...current, service.id])}
                          type="button"
                        >
                          {service.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-end border-t border-stone-100 pt-5"><Button onClick={() => void saveAssignments()} variant="primary">Salva servizi cabina</Button></div>
            </SectionCard>
          )}
        </div>
      </div>
    </AppPage>
  );
}
