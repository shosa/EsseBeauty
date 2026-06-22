"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { type WorkingHours } from "@esse-beauty/shared";
import { AppPage, Button, FormField, PageHeader, SaveToast, ScheduleEditor, SectionCard } from "@esse-beauty/ui";
import { useAuth } from "../../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Member {
  id: string;
  displayName: string;
  bio?: string;
  color: string;
  specializations: string[];
  workingHours: WorkingHours;
}

interface StaffAccess {
  active: boolean;
  email: string;
  role?: "owner" | "manager" | "receptionist" | "employee" | null;
  user_id?: string | null;
}

interface StaffService {
  active: boolean;
  category: string;
  enabled: boolean;
  id: string;
  name: string;
}

interface Location {
  active: boolean;
  address?: string | null;
  id: string;
  name: string;
}

export default function StaffDetailPage() {
  const { staffId } = useParams<{ staffId: string }>();
  const { salon } = useAuth();
  const [member, setMember] = useState<Member>();
  const [salonHours, setSalonHours] = useState<WorkingHours>();
  const [access, setAccess] = useState<StaffAccess>({ active: true, email: "", role: null, user_id: null });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [services, setServices] = useState<StaffService[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);

  const load = async () => {
    if (!salon) return;
    const [staffRows, accessResponse, settingsResponse, capabilityResponse] = await Promise.all([
      fetch(`${api}/api/salons/${salon.id}/staff`, { credentials: "include" }).then((response) => response.json()),
      fetch(`${api}/api/salons/${salon.id}/staff/${staffId}/access`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/staff-default-hours`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/staff/${staffId}/services`, { credentials: "include" }),
    ]);
    setMember(staffRows.find((item: Member) => item.id === staffId));
    if (accessResponse.ok) setAccess(await accessResponse.json() as StaffAccess);
    if (settingsResponse.ok) {
      const settings = await settingsResponse.json() as { opening_hours?: WorkingHours };
      setSalonHours(settings.opening_hours);
    }
    if (capabilityResponse.ok) {
      const data = await capabilityResponse.json() as {
        location_id?: string | null;
        locations: Location[];
        services: StaffService[];
      };
      setServices(data.services);
      setLocations(data.locations);
      setLocationId(data.location_id ?? null);
    }
  };

  useEffect(() => {
    void load();
  }, [salon?.id, staffId]);

  useEffect(() => {
    if (!message && !error) return;
    const timeout = window.setTimeout(() => {
      setMessage("");
      setError("");
    }, 2600);
    return () => window.clearTimeout(timeout);
  }, [error, message]);

  async function save() {
    if (!member || !salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/staff/${staffId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        display_name: member.displayName,
        bio: member.bio,
        color: member.color,
        specializations: member.specializations,
        working_hours: member.workingHours,
      }),
    });
    setMessage(response.ok ? "Profilo staff salvato." : "");
    setError(response.ok ? "" : "Profilo non salvato.");
  }

  async function saveAccess(data: FormData) {
    if (!salon) return;
    const password = String(data.get("password") ?? "");
    const response = await fetch(`${api}/api/salons/${salon.id}/staff/${staffId}/access`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        active: data.get("active") === "on",
        email: data.get("email"),
        ...(password ? { password } : {}),
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "ACCESS_NOT_SAVED" }));
      setError(payload.error === "PASSWORD_REQUIRED" ? "Inserisci una password per creare il primo accesso." : "Accesso App Staff non salvato.");
      return;
    }
    setAccess(await response.json() as StaffAccess);
    setMessage("Accesso App Staff salvato.");
  }

  async function saveCapabilities() {
    if (!salon) return;
    const serviceIds = services.filter((service) => service.enabled).map((service) => service.id);
    if (serviceIds.length === 0) {
      setError("Abilita almeno un servizio per il collaboratore.");
      return;
    }
    const response = await fetch(`${api}/api/salons/${salon.id}/staff/${staffId}/services`, {
      body: JSON.stringify({ location_id: locationId, service_ids: serviceIds }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PUT",
    });
    setMessage(response.ok ? "Sede e competenze salvate." : "");
    setError(response.ok ? "" : "Sede e competenze non salvate.");
  }

  if (!member) return <AppPage maxWidth="max-w-[1600px]"><SectionCard><div className="h-96 animate-pulse rounded-2xl bg-stone-100" /></SectionCard></AppPage>;

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <SaveToast visible={Boolean(message || error)} variant={error ? "error" : "success"}>{error || message}</SaveToast>
      <PageHeader eyebrow="Profilo staff" title={member.displayName} subtitle="Anagrafica, accesso App Staff e orari ricorrenti." />

      <div className="grid gap-5 xl:grid-cols-12">
        <SectionCard className="xl:col-span-5" title="Profilo" subtitle="Dati visibili nel gestionale e nelle aree collegate al collaboratore.">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_170px]">
            <FormField label="Nome collaboratore" required>
              <input className="w-full" value={member.displayName} onChange={(event) => setMember({ ...member, displayName: event.target.value })} />
            </FormField>
            <FormField label="Colore">
              <div className="flex min-h-12 items-center gap-3 rounded-xl border border-stone-200 bg-[#fffafd] px-3">
                <label className="relative block size-8 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(214_211_209)]" style={{ backgroundColor: member.color }}>
                  <span className="sr-only">Scegli colore collaboratore</span>
                  <input aria-label="Colore collaboratore" className="absolute inset-0 size-full cursor-pointer opacity-0" type="color" value={member.color} onChange={(event) => setMember({ ...member, color: event.target.value })} />
                </label>
                <span className="text-sm font-bold uppercase text-stone-500">{member.color}</span>
              </div>
            </FormField>
            <FormField label="Biografia" description="Nota interna o breve presentazione del collaboratore." className="sm:col-span-2">
              <textarea className="min-h-28 w-full resize-y" value={member.bio ?? ""} onChange={(event) => setMember({ ...member, bio: event.target.value })} />
            </FormField>
          </div>
          <div className="mt-6 flex justify-end border-t border-stone-100 pt-5">
            <Button onClick={() => void save()} variant="primary">Salva profilo</Button>
          </div>
        </SectionCard>

        <SectionCard className="xl:col-span-7" title="Accesso App Staff" subtitle="Credenziali usate dal collaboratore per accedere alla propria app operativa.">
          <form action={saveAccess}>
            <div className="grid gap-5 md:grid-cols-2">
              <FormField label="Email dipendente" required>
                <input className="w-full" name="email" type="email" required value={access.email} onChange={(event) => setAccess({ ...access, email: event.target.value })} />
              </FormField>
              <FormField label={access.user_id ? "Reimposta password" : "Password iniziale"} description={access.user_id ? "Lascia vuoto per mantenere la password attuale. Minimo 10 caratteri." : "Minimo 10 caratteri."}>
                <input className="w-full" name="password" type="password" minLength={10} />
              </FormField>
              <div className="md:col-span-2">
                <label className="flex min-h-16 items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-[#fbfaf8] px-4">
                  <span>
                    <strong className="block text-sm text-stone-900">Accesso App Staff attivo</strong>
                    <span className="mt-1 block text-xs text-stone-500">Consente al collaboratore di accedere alla propria agenda.</span>
                  </span>
                  <input disabled={access.role === "owner"} name="active" type="checkbox" checked={access.active} onChange={(event) => setAccess({ ...access, active: event.target.checked })} />
                </label>
              </div>
            </div>
            {access.role === "owner" && (
              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                Questo profilo è collegato al titolare. L’accesso all’App Staff usa lo stesso account senza modificarne ruolo o stato.
              </p>
            )}
            <div className="mt-6 flex justify-end border-t border-stone-100 pt-5">
              <Button type="submit" variant="primary">Salva accesso App Staff</Button>
            </div>
          </form>
        </SectionCard>

        <SectionCard className="xl:col-span-12" title="Orari settimanali" subtitle="Puoi aggiungere più fasce nello stesso giorno, ad esempio 09:00–13:00 e 15:00–19:00.">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-[#fbfaf8] p-4">
            <div>
              <strong className="block text-sm text-stone-900">Orario base del salone</strong>
              <span className="mt-1 block text-xs text-stone-500">Sostituisce le fasce sottostanti con gli orari di apertura attuali.</span>
            </div>
            <Button disabled={!salonHours} onClick={() => salonHours && setMember({ ...member, workingHours: structuredClone(salonHours) })} size="sm" variant="outline">Carica orari salone</Button>
          </div>
          <ScheduleEditor
            onChange={(workingHours) => setMember({ ...member, workingHours })}
            value={member.workingHours}
          />
          <div className="mt-6 flex justify-end border-t border-stone-100 pt-5">
            <Button onClick={() => void save()} variant="primary">Salva orari</Button>
          </div>
        </SectionCard>

        <SectionCard className="xl:col-span-12" title="Sede e servizi abilitati" subtitle="Determina dove può lavorare il collaboratore e quali prenotazioni può ricevere dall’App Clienti.">
          {locations.length > 0 && (
            <div>
              <p className="text-sm font-bold text-stone-900">Sede di lavoro</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {locations.filter((location) => location.active).map((location) => (
                  <button
                    className={`rounded-xl border p-4 text-left transition ${locationId === location.id ? "border-[#9d4f78] bg-[#faf3f7]" : "border-stone-200 bg-white hover:border-[#d7a6c1]"}`}
                    key={location.id}
                    onClick={() => setLocationId(location.id)}
                    type="button"
                  >
                    <strong className="block">{location.name}</strong>
                    <span className="mt-1 block text-xs text-stone-500">{location.address || "Indirizzo non specificato"}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className={locations.length > 0 ? "mt-6 border-t border-stone-100 pt-6" : ""}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-stone-900">Competenze operative</p>
                <p className="mt-1 text-xs text-stone-500">I servizi non abilitati non compariranno tra le scelte disponibili per questo collaboratore.</p>
              </div>
              <Button onClick={() => setServices(services.map((service) => ({ ...service, enabled: service.active })))} size="sm" variant="outline">Seleziona tutti</Button>
            </div>
            <div className="mt-4 space-y-4">
              {Array.from(new Set(services.map((service) => service.category))).map((category) => (
                <div key={category}>
                  <p className="mb-2 text-[11px] font-black uppercase tracking-[.16em] text-stone-400">{category}</p>
                  <div className="flex flex-wrap gap-2">
                    {services.filter((service) => service.category === category).map((service) => (
                      <button
                        className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${service.enabled ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-stone-200 bg-white text-stone-500"}`}
                        disabled={!service.active}
                        key={service.id}
                        onClick={() => setServices(services.map((item) => item.id === service.id ? { ...item, enabled: !item.enabled } : item))}
                        type="button"
                      >
                        {service.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 flex justify-end border-t border-stone-100 pt-5">
            <Button onClick={() => void saveCapabilities()} variant="primary">Salva sede e competenze</Button>
          </div>
        </SectionCard>

      </div>
    </AppPage>
  );
}
