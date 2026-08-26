"use client";

import { useEffect, useState } from "react";
import { Building2, DoorOpen, MapPin, Plus } from "lucide-react";

import { MODULE_KEYS, useModuleEnabled } from "@esse-beauty/feature-flags";
import { AppPage, Button, EmptyState, FormField, InlineError, KpiStrip, PageHeader, SectionCard, StatusBadge, Switch } from "@esse-beauty/ui";
import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Location { active: boolean; address?: string | null; email?: string | null; id: string; name: string; phone?: string | null; timezone?: string | null; }
interface Resource { id: string; locationId?: string | null; type: string; }

export default function LocationsPage() {
  const { salon } = useAuth();
  const multiLocation = useModuleEnabled(MODULE_KEYS.MULTI_LOCATION);
  const [locations, setLocations] = useState<Location[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [locationId, setLocationId] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load(preferredId?: string) {
    if (!salon) return;
    setError("");
    const [locationsResponse, resourcesResponse] = await Promise.all([
      fetch(`${api}/api/salons/${salon.id}/settings/locations`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/settings/resources`, { credentials: "include" }),
    ]);
    if (!locationsResponse.ok || !resourcesResponse.ok) return setError("Impossibile caricare le sedi.");
    const nextLocations = await locationsResponse.json() as Location[];
    setLocations(nextLocations);
    setResources((await resourcesResponse.json() as Resource[]).filter((item) => item.type === "cabin" || item.type === "room"));
    const candidate = preferredId || locationId;
    setLocationId(nextLocations.some((item) => item.id === candidate) ? candidate : nextLocations[0]?.id ?? "");
  }

  useEffect(() => { void load(); }, [salon?.id]);

  const selected = locations.find((item) => item.id === locationId);
  const activeLocations = locations.filter((item) => item.active).length;
  const cabinCount = (id: string) => resources.filter((item) => item.locationId === id).length;

  function updateSelected(patch: Partial<Location>) {
    if (!selected) return;
    setLocations((current) => current.map((item) => item.id === selected.id ? { ...item, ...patch } : item));
  }

  function notify(value: string) {
    setMessage(value);
    window.setTimeout(() => setMessage(""), 2200);
  }

  async function createLocation() {
    if (!salon || !name.trim()) return;
    if (!multiLocation && locations.length > 0) return setError("Attiva il modulo Multi-sede per aggiungere una seconda sede.");
    const response = await fetch(`${api}/api/salons/${salon.id}/settings/locations`, {
      body: JSON.stringify({ address, name }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (!response.ok) return setError("Sede non creata.");
    const created = await response.json() as Location;
    setName("");
    setAddress("");
    notify("Sede creata.");
    await load(created.id);
  }

  async function saveLocation() {
    if (!salon || !selected) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/settings/locations/${selected.id}`, {
      body: JSON.stringify({ active: selected.active, address: selected.address, email: selected.email, name: selected.name, phone: selected.phone, timezone: selected.timezone }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    if (!response.ok) return setError("Sede non aggiornata.");
    notify("Sede aggiornata.");
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageHeader eyebrow="Organizzazione" status={<StatusBadge status="active">{activeLocations} attive</StatusBadge>} subtitle="Anagrafica e contatti delle sedi operative." title="Sedi" />
      {error && <InlineError className="mb-4">{error}</InlineError>}
      {message && <p className="mb-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</p>}
      <KpiStrip items={[{ detail: "configurate", label: "Sedi", value: locations.length }, { detail: `${locations.length - activeLocations} non attive`, label: "Sedi attive", value: activeLocations }, { detail: "associate alle sedi", label: "Cabine", value: resources.length }]} />

      <div className="mt-4 grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <SectionCard title="Sedi operative" subtitle="Seleziona la sede da configurare.">
          <div className="space-y-2">{locations.map((location) => <button className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${locationId === location.id ? "border-[#792f59] bg-[#faf3f7]" : "border-stone-200"}`} key={location.id} onClick={() => setLocationId(location.id)} type="button"><Building2 className="size-5 shrink-0 text-[#792f59]" /><span className="min-w-0 flex-1"><strong className="block truncate">{location.name}</strong><small className="block truncate text-stone-500">{location.address || "Indirizzo da completare"}</small></span><span className="flex items-center gap-1 text-xs font-bold text-stone-500"><DoorOpen size={14} />{cabinCount(location.id)}</span></button>)}</div>
          {(multiLocation || locations.length === 0) && <div className="mt-4 space-y-3 border-t border-stone-100 pt-4"><FormField label="Nome sede"><input className="w-full" onChange={(event) => setName(event.target.value)} value={name} /></FormField><FormField label="Indirizzo"><input className="w-full" onChange={(event) => setAddress(event.target.value)} value={address} /></FormField><Button disabled={!name.trim()} onClick={() => void createLocation()} variant="outline"><Plus className="mr-2 size-4" />Aggiungi sede</Button></div>}
        </SectionCard>

        {!selected ? <EmptyState description="Aggiungi la sede principale per iniziare." title="Nessuna sede configurata" /> : <SectionCard title={selected.name} subtitle="Informazioni usate nell’operatività e nelle comunicazioni."><div className="grid gap-4 md:grid-cols-2"><FormField label="Nome"><input className="w-full" onChange={(event) => updateSelected({ name: event.target.value })} value={selected.name} /></FormField><FormField label="Indirizzo"><div className="relative"><MapPin className="absolute left-3 top-3 size-4 text-stone-400" /><input className="w-full pl-9" onChange={(event) => updateSelected({ address: event.target.value })} value={selected.address ?? ""} /></div></FormField><FormField label="Telefono"><input className="w-full" onChange={(event) => updateSelected({ phone: event.target.value })} value={selected.phone ?? ""} /></FormField><FormField label="Email"><input className="w-full" onChange={(event) => updateSelected({ email: event.target.value })} type="email" value={selected.email ?? ""} /></FormField><FormField label="Fuso orario"><input className="w-full" onChange={(event) => updateSelected({ timezone: event.target.value })} placeholder="Europe/Rome" value={selected.timezone ?? ""} /></FormField><label className="flex items-center justify-between rounded-lg border border-stone-200 px-4 text-sm font-bold">Sede attiva<Switch checked={selected.active} onCheckedChange={(active) => updateSelected({ active })} /></label></div><div className="mt-5 flex justify-end border-t border-stone-100 pt-4"><Button onClick={() => void saveLocation()} variant="primary">Salva sede</Button></div></SectionCard>}
      </div>
    </AppPage>
  );
}
