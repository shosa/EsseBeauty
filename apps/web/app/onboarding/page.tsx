"use client";

import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Plus, Trash2 } from "lucide-react";

import type { WorkingHours } from "@esse-beauty/shared";
import { Button, FormField, ScheduleEditor, Switch } from "@esse-beauty/ui";

import { BrandLogo } from "../_components/BrandLogo";
import { AuthProvider, useAuth } from "../../lib/auth-context";
import { OnboardingProgress } from "./_components/OnboardingProgress";
import { firstActionableStep, type CategoryDraft, type LocationDraft, type OnboardingPayload, type ResourceDraft, type ServiceDraft, type StaffDraft, type StepKey } from "./types";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
const colors = ["#792f59", "#b85888", "#5f7661", "#8b6f47", "#536b89", "#9b5c45"];
const inputClass = "min-h-12 w-full rounded-xl border border-stone-200 bg-white px-4 text-base outline-none focus:border-[#792f59] focus:ring-4 focus:ring-[#792f59]/15";
const defaultHours: WorkingHours = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };

function OnboardingWizard() {
  const router = useRouter();
  const { loading, salon, user } = useAuth();
  const errorRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<OnboardingPayload | null>(null);
  const [activeStep, setActiveStep] = useState<StepKey>("identity");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [identity, setIdentity] = useState({ address: "", email: "", name: "", phone: "" });
  const [hours, setHours] = useState<WorkingHours>(defaultHours);
  const [locations, setLocations] = useState<LocationDraft[]>([]);
  const [resources, setResources] = useState<ResourceDraft[]>([]);
  const [categories, setCategories] = useState<CategoryDraft[]>([]);
  const [services, setServices] = useState<ServiceDraft[]>([]);
  const [team, setTeam] = useState<StaffDraft[]>([]);
  const [staffPairs, setStaffPairs] = useState<Array<{ service_id: string; staff_id: string }>>([]);
  const [resourcePairs, setResourcePairs] = useState<Array<{ resource_id: string; service_id: string }>>([]);

  async function load(initial = false) {
    const response = await fetch(`${api}/api/onboarding`, { credentials: "include" });
    if (!response.ok) throw new Error("Configurazione non disponibile.");
    const payload = await response.json() as OnboardingPayload;
    setData(payload);
    setIdentity({ address: payload.salon.address, email: payload.salon.email, name: payload.salon.name, phone: payload.salon.phone });
    setHours(payload.salon.opening_hours);
    setLocations(payload.locations.map((item) => ({ ...item, address: item.address ?? "", email: item.email ?? "", phone: item.phone ?? "", timezone: item.timezone ?? "Europe/Rome" })));
    setResources(payload.resources); setCategories(payload.service_categories); setServices(payload.services); setTeam(payload.staff);
    setStaffPairs(payload.service_staff); setResourcePairs(payload.service_resources);
    if (initial) setActiveStep(firstActionableStep(payload.steps));
    return payload;
  }

  useEffect(() => {
    if (loading) return;
    if (!user || !salon) return void router.replace("/login");
    if (user.role !== "owner" || salon.onboarding_completed) return void router.replace("/");
    void load(true).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Configurazione non disponibile.")).finally(() => setBusy(false));
  }, [loading, salon?.id, user?.id]);

  async function request(path: string, body?: unknown, method = "PATCH") {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`${api}${path}`, { body: body === undefined ? undefined : JSON.stringify(body), credentials: "include", headers: body === undefined ? undefined : { "content-type": "application/json" }, method });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload.error === "ONBOARDING_INCOMPLETE" && payload.issues) setData((current) => current ? { ...current, readiness: { issues: payload.issues, ready: false } } : current);
        throw new Error(errorMessage(payload.error));
      }
      setMessage("Dati salvati."); return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Salvataggio non riuscito.");
      window.setTimeout(() => errorRef.current?.focus(), 0); return false;
    } finally { setBusy(false); }
  }

  async function saveAndContinue() {
    if (!data) return;
    let saved = false;
    if (activeStep === "identity") saved = await request("/api/onboarding/salon", identity);
    if (activeStep === "locations") { saved = await request("/api/onboarding/locations", { locations }); if (saved) saved = await request("/api/onboarding/hours", { opening_hours: hours }); }
    if (activeStep === "resources") saved = await request("/api/onboarding/resources", { resources });
    if (activeStep === "services") saved = await request("/api/onboarding/services", { categories, services });
    if (activeStep === "staff") saved = await request("/api/onboarding/staff", { link_owner: team.some((item) => item.linked_to_owner), staff: team, working_hours: hours });
    if (activeStep === "assignments") saved = await request("/api/onboarding/assignments", { service_resources: resourcePairs, service_staff: staffPairs }, "PUT");
    if (activeStep === "review") { saved = await request("/api/onboarding/complete", undefined, "POST"); if (saved) { router.replace("/"); router.refresh(); } return; }
    if (!saved) return;
    const payload = await load();
    const index = payload.steps.findIndex((step) => step.key === activeStep);
    setActiveStep(payload.steps[Math.min(index + 1, payload.steps.length - 1)]?.key ?? "review");
  }

  async function logout() {
    setBusy(true); await fetch(`${api}/api/auth/logout`, { method: "POST", credentials: "include" }).catch(() => null);
    router.replace("/login"); router.refresh();
  }

  if (loading || !data) return <main className="grid min-h-screen place-items-center bg-[#f5f5f7]"><div className="size-10 animate-pulse rounded-full bg-stone-300" /></main>;
  const stepIndex = data.steps.findIndex((step) => step.key === activeStep);
  return <main className="min-h-screen bg-[#f5f5f7] px-4 py-5 text-stone-950 sm:px-6 lg:px-8"><div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-7xl flex-col overflow-hidden rounded-[28px] border border-white/80 bg-white/80 shadow-[0_26px_80px_rgb(28_25_23_/_0.12)] backdrop-blur-xl lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
    <aside className="flex flex-col border-b border-stone-200/70 bg-white/65 p-5 lg:border-b-0 lg:border-r lg:p-7"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-[14px] bg-[#792f59]"><BrandLogo className="size-8" tone="white" /></div><div><p className="text-[11px] font-semibold uppercase tracking-[.12em] text-stone-500">Primo accesso</p><h1 className="text-xl font-semibold">Esse Beauty</h1></div></div><p className="mt-6 text-sm leading-6 text-stone-500">Configura sedi, cabine, servizi e persone: saranno già pronti nel gestionale.</p><div className="mt-6"><OnboardingProgress active={activeStep} onSelect={setActiveStep} steps={data.steps} /></div><button aria-label="Esci dall'account" className="mt-6 flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-stone-600 hover:bg-red-50 hover:text-red-700 lg:mt-auto lg:justify-start" disabled={busy} onClick={() => void logout()} type="button"><LogOut aria-hidden="true" className="size-4" />Esci</button></aside>
    <section className="flex min-h-0 flex-col p-5 sm:p-8 lg:p-10"><div className="min-h-0 flex-1"><p className="text-[13px] font-semibold text-[#792f59]">Passaggio {stepIndex + 1} di {data.steps.length}</p>
      {activeStep === "identity" && <IdentityStep identity={identity} setIdentity={setIdentity} />}
      {activeStep === "locations" && <LocationsStep hours={hours} locations={locations} multiple={data.steps.find((step) => step.key === "locations")?.mode === "multiple"} setHours={setHours} setLocations={setLocations} />}
      {activeStep === "resources" && <ResourcesStep locations={locations} resources={resources} setResources={setResources} />}
      {activeStep === "services" && <ServicesStep categories={categories} services={services} setCategories={setCategories} setServices={setServices} />}
      {activeStep === "staff" && <StaffStep hours={hours} locations={locations} setTeam={setTeam} team={team} userName={user?.full_name ?? ""} />}
      {activeStep === "assignments" && <AssignmentsStep resourcePairs={resourcePairs} resources={resources} services={services} setResourcePairs={setResourcePairs} setStaffPairs={setStaffPairs} staffPairs={staffPairs} team={team} />}
      {activeStep === "review" && <ReviewStep data={data} onCorrect={setActiveStep} />}
      <div aria-live="polite" className="mt-6" ref={errorRef} tabIndex={-1}>{error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}{!error && message && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p>}</div>
    </div><div className="mt-8 flex justify-between border-t border-stone-200 pt-5"><Button disabled={busy || stepIndex === 0} onClick={() => setActiveStep(data.steps[Math.max(0, stepIndex - 1)]?.key ?? "identity")} variant="ghost">Indietro</Button><Button disabled={busy} onClick={() => void saveAndContinue()} variant="primary">{busy ? "Salvataggio..." : activeStep === "review" ? "Entra nel gestionale" : "Salva e continua"}</Button></div></section>
  </div></main>;
}

function Header({ title, subtitle }: { title: string; subtitle: string }) { return <><h2 className="mt-2 text-[34px] font-semibold leading-tight tracking-[-.02em]">{title}</h2><p className="mt-2 max-w-2xl text-base leading-7 text-stone-500">{subtitle}</p></>; }
function Panel({ children, className = "" }: { children: ReactNode; className?: string }) { return <section className={`esse-panel rounded-[22px] border border-stone-200 bg-white p-5 ${className}`}>{children}</section>; }

function IdentityStep({ identity, setIdentity }: { identity: { address: string; email: string; name: string; phone: string }; setIdentity: (value: { address: string; email: string; name: string; phone: string }) => void }) {
  return <><Header title="Partiamo dal salone" subtitle="Identità e contatti usati nel gestionale e nelle comunicazioni." /><Panel className="mt-8 grid gap-5 md:grid-cols-2"><FormField className="md:col-span-2" label="Nome salone" required><input className={inputClass} value={identity.name} onChange={(e) => setIdentity({ ...identity, name: e.target.value })} /></FormField><FormField label="Telefono"><input className={inputClass} type="tel" value={identity.phone} onChange={(e) => setIdentity({ ...identity, phone: e.target.value })} /></FormField><FormField label="Email"><input className={inputClass} type="email" value={identity.email} onChange={(e) => setIdentity({ ...identity, email: e.target.value })} /></FormField><FormField className="md:col-span-2" label="Indirizzo"><input className={inputClass} value={identity.address} onChange={(e) => setIdentity({ ...identity, address: e.target.value })} /></FormField></Panel></>;
}

function LocationsStep({ hours, locations, multiple, setHours, setLocations }: { hours: WorkingHours; locations: LocationDraft[]; multiple: boolean; setHours: (value: WorkingHours) => void; setLocations: Dispatch<SetStateAction<LocationDraft[]>> }) {
  const patch = (index: number, value: Partial<LocationDraft>) => setLocations((items) => items.map((item, i) => i === index ? { ...item, ...value } : item));
  return <><Header title="Sedi e orari" subtitle={multiple ? "Configura tutte le sedi operative." : "Configura la sede principale del salone."}/><div className="mt-8 space-y-4">{locations.map((location, index) => <Panel className="grid gap-4 md:grid-cols-2" key={location.id ?? index}><FormField label="Nome sede" required><input className={inputClass} value={location.name} onChange={(e) => patch(index, { name: e.target.value })} /></FormField><FormField label="Indirizzo"><input className={inputClass} value={location.address} onChange={(e) => patch(index, { address: e.target.value })} /></FormField><FormField label="Telefono"><input className={inputClass} value={location.phone} onChange={(e) => patch(index, { phone: e.target.value })} /></FormField><FormField label="Email"><input className={inputClass} type="email" value={location.email} onChange={(e) => patch(index, { email: e.target.value })} /></FormField><label className="flex min-h-12 items-center justify-between rounded-xl border border-stone-200 px-4 text-sm font-semibold md:col-span-2">Sede attiva<Switch checked={location.active} onCheckedChange={(active) => patch(index, { active })} /></label></Panel>)}{multiple && <Button onClick={() => setLocations((items) => [...items, { active: true, address: "", email: "", name: `Sede ${items.length + 1}`, phone: "", timezone: "Europe/Rome" }])} variant="outline"><Plus className="size-4" />Aggiungi sede</Button>}<Panel><h3 className="mb-4 text-lg font-semibold">Orari del salone</h3><ScheduleEditor onChange={setHours} value={hours} /></Panel></div></>;
}

function ResourcesStep({ locations, resources, setResources }: { locations: LocationDraft[]; resources: ResourceDraft[]; setResources: Dispatch<SetStateAction<ResourceDraft[]>> }) {
  const patch = (index: number, value: Partial<ResourceDraft>) => setResources((items) => items.map((item, i) => i === index ? { ...item, ...value } : item));
  return <><Header title="Cabine e risorse" subtitle="Crea le cabine e collegale alla sede in cui si trovano."/><div className="mt-8 space-y-3">{resources.map((resource, index) => <Panel className="grid gap-3 md:grid-cols-[1fr_1fr_120px_auto]" key={resource.id ?? index}><input aria-label="Nome cabina" className={inputClass} value={resource.name} onChange={(e) => patch(index, { name: e.target.value })}/><select aria-label="Sede della cabina" className={inputClass} value={resource.location_id} onChange={(e) => patch(index, { location_id: e.target.value })}>{locations.filter((item) => item.active).map((item) => <option key={item.id ?? item.name} value={item.id}>{item.name}</option>)}</select><input aria-label="Capienza" className={inputClass} min={1} type="number" value={resource.capacity} onChange={(e) => patch(index, { capacity: Number(e.target.value) })}/><Button onClick={() => setResources((items) => items.filter((_, i) => i !== index))} variant="ghost"><Trash2 className="size-4"/>Rimuovi</Button></Panel>)}<Button disabled={!locations.some((item) => item.id && item.active)} onClick={() => setResources((items) => [...items, { active: true, capacity: 1, location_id: locations.find((item) => item.active)?.id ?? "", name: `Cabina ${items.length + 1}`, type: "cabin" }])} variant="outline"><Plus className="size-4"/>Aggiungi cabina</Button></div></>;
}

function ServicesStep({ categories, services, setCategories, setServices }: { categories: CategoryDraft[]; services: ServiceDraft[]; setCategories: Dispatch<SetStateAction<CategoryDraft[]>>; setServices: Dispatch<SetStateAction<ServiceDraft[]>> }) {
  const [categoryName, setCategoryName] = useState("");
  function addCategory() { if (categoryName.trim()) { setCategories((items) => [...items, { icon: "sparkles", id: `local-${crypto.randomUUID()}`, name: categoryName.trim() }]); setCategoryName(""); } }
  function addService() { const category = categories[0]; if (category) setServices((items) => [...items, { active: true, buffer_after_minutes: 0, buffer_before_minutes: 0, category: category.name, category_id: category.id, duration_minutes: 30, name: `Nuovo servizio ${items.length + 1}`, online_booking_enabled: true, price_cents: 0 }]); }
  const patch = (index: number, value: Partial<ServiceDraft>) => setServices((items) => items.map((item, i) => i === index ? { ...item, ...value } : item));
  return <><Header title="Categorie e servizi" subtitle="Definisci il catalogo reale: durata, prezzo, buffer e prenotabilità."/><div className="mt-8 grid gap-4 lg:grid-cols-[300px_1fr]"><Panel><FormField label="Nuova categoria"><input className={inputClass} value={categoryName} onChange={(e) => setCategoryName(e.target.value)}/></FormField><Button className="mt-3" onClick={addCategory} variant="outline"><Plus className="size-4"/>Aggiungi categoria</Button><div className="mt-4 space-y-2">{categories.map((item) => <p className="rounded-xl bg-stone-50 p-3 text-sm font-semibold" key={item.id}>{item.name}</p>)}</div></Panel><Panel><Button disabled={!categories.length} onClick={addService} variant="outline"><Plus className="size-4"/>Aggiungi servizio</Button><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="text-xs uppercase text-stone-500"><th className="p-2">Servizio</th><th className="p-2">Categoria</th><th className="p-2">Durata</th><th className="p-2">Prezzo</th><th className="p-2">Online</th><th/></tr></thead><tbody>{services.map((service, index) => <tr className="border-t border-stone-100" key={service.id ?? index}><td className="p-2"><input aria-label="Servizio" className={inputClass} value={service.name} onChange={(e) => patch(index, { name: e.target.value })}/></td><td className="p-2"><select aria-label="Categoria" className={inputClass} value={service.category_id} onChange={(e) => { const category = categories.find((item) => item.id === e.target.value); patch(index, { category_id: e.target.value, category: category?.name ?? service.category }); }}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></td><td className="p-2"><input aria-label="Durata" className={inputClass} min={5} step={5} type="number" value={service.duration_minutes} onChange={(e) => patch(index, { duration_minutes: Number(e.target.value) })}/></td><td className="p-2"><input aria-label="Prezzo" className={inputClass} min={0} step={0.5} type="number" value={service.price_cents / 100} onChange={(e) => patch(index, { price_cents: Math.round(Number(e.target.value) * 100) })}/></td><td className="p-2"><Switch aria-label={`Prenotazione online ${service.name}`} checked={service.online_booking_enabled} onCheckedChange={(online_booking_enabled) => patch(index, { online_booking_enabled })}/></td><td><Button aria-label={`Rimuovi ${service.name}`} onClick={() => setServices((items) => items.filter((_, i) => i !== index))} variant="ghost"><Trash2 className="size-4"/></Button></td></tr>)}</tbody></table></div><p className="mt-3 text-sm text-stone-500">Catalogo servizi: {services.length} servizi configurati.</p></Panel></div></>;
}

function StaffStep({ hours, locations, setTeam, team, userName }: { hours: WorkingHours; locations: LocationDraft[]; setTeam: Dispatch<SetStateAction<StaffDraft[]>>; team: StaffDraft[]; userName: string }) {
  const patch = (index: number, value: Partial<StaffDraft>) => setTeam((items) => items.map((item, i) => i === index ? { ...item, ...value } : item));
  function add() { setTeam((items) => [...items, { active: true, color: colors[items.length % colors.length] ?? "#792f59", display_name: items.length ? "" : userName, job_title: "", linked_to_owner: items.length === 0, location_id: locations.find((item) => item.active)?.id ?? "", working_hours: hours }]); }
  return <><Header title="Staff" subtitle="Crea i profili, assegna ruolo, sede principale e orari."/><div className="mt-8 space-y-3">{team.map((member, index) => <Panel className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]" key={member.id ?? index}><input aria-label="Nome collaboratore" className={inputClass} value={member.display_name} onChange={(e) => patch(index, { display_name: e.target.value })}/><input aria-label="Ruolo" className={inputClass} placeholder="Ruolo" value={member.job_title} onChange={(e) => patch(index, { job_title: e.target.value })}/><select aria-label="Sede principale" className={inputClass} value={member.location_id} onChange={(e) => patch(index, { location_id: e.target.value })}><option value="">Seleziona sede</option>{locations.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Button onClick={() => setTeam((items) => items.filter((_, i) => i !== index))} variant="ghost"><Trash2 className="size-4"/>Rimuovi</Button>{index === 0 && <label className="flex items-center gap-2 text-sm font-semibold md:col-span-4"><Switch checked={Boolean(member.linked_to_owner)} onCheckedChange={(checked) => setTeam((items) => items.map((item, i) => ({ ...item, linked_to_owner: i === 0 ? checked : false })))}/>Collega al titolare</label>}</Panel>)}<Button onClick={add} variant="outline"><Plus className="size-4"/>Aggiungi collaboratore</Button></div></>;
}

function AssignmentsStep({ resourcePairs, resources, services, setResourcePairs, setStaffPairs, staffPairs, team }: { resourcePairs: Array<{ resource_id: string; service_id: string }>; resources: ResourceDraft[]; services: ServiceDraft[]; setResourcePairs: Dispatch<SetStateAction<Array<{ resource_id: string; service_id: string }>>>; setStaffPairs: Dispatch<SetStateAction<Array<{ service_id: string; staff_id: string }>>>; staffPairs: Array<{ service_id: string; staff_id: string }>; team: StaffDraft[] }) {
  const bookableServices = services.filter((item) => item.active && item.id); const activeTeam = team.filter((item) => item.active && item.id);
  const toggleStaff = (service_id: string, staff_id: string) => setStaffPairs((pairs) => pairs.some((item) => item.service_id === service_id && item.staff_id === staff_id) ? pairs.filter((item) => item.service_id !== service_id || item.staff_id !== staff_id) : [...pairs, { service_id, staff_id }]);
  return <><Header title="Assegna servizi allo staff" subtitle="Ogni servizio prenotabile deve avere almeno un operatore. Puoi indicare anche le cabine necessarie."/><div className="mt-8 space-y-4">{bookableServices.map((service) => <Panel key={service.id}><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">{service.name}</h3><Button onClick={() => setStaffPairs((pairs) => [...pairs.filter((item) => item.service_id !== service.id), ...activeTeam.map((member) => ({ service_id: service.id!, staff_id: member.id! }))])} variant="ghost">Seleziona tutto</Button></div><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{activeTeam.map((member) => <label className="flex min-h-11 items-center gap-3 rounded-xl border border-stone-200 px-3 text-sm font-semibold" key={member.id}><Switch aria-label={`${member.display_name} può eseguire ${service.name}`} checked={staffPairs.some((item) => item.service_id === service.id && item.staff_id === member.id)} onCheckedChange={() => toggleStaff(service.id!, member.id!)}/>{member.display_name}</label>)}</div>{resources.some((item) => item.active && item.id) && <div className="mt-5 border-t border-stone-100 pt-4"><p className="text-sm font-semibold">Cabine richieste</p><div className="mt-2 flex flex-wrap gap-2">{resources.filter((item) => item.active && item.id).map((resource) => <label className="flex min-h-11 items-center gap-2 rounded-xl bg-stone-50 px-3 text-sm" key={resource.id}><Switch checked={resourcePairs.some((item) => item.service_id === service.id && item.resource_id === resource.id)} onCheckedChange={() => setResourcePairs((pairs) => pairs.some((item) => item.service_id === service.id && item.resource_id === resource.id) ? pairs.filter((item) => item.service_id !== service.id || item.resource_id !== resource.id) : [...pairs, { service_id: service.id!, resource_id: resource.id! }])}/>{resource.name}</label>)}</div></div>}</Panel>)}</div></>;
}

function ReviewStep({ data, onCorrect }: { data: OnboardingPayload; onCorrect: (key: StepKey) => void }) {
  return <><Header title="Verifica finale" subtitle="Controlliamo che agenda, sedi, servizi e staff siano davvero pronti."/><div className="mt-8 space-y-3">{data.steps.filter((step) => step.key !== "review").map((step) => <Panel className="flex items-center justify-between gap-4" key={step.key}><div><h3 className="font-semibold">{step.label}</h3><p className={`mt-1 text-sm ${step.status === "complete" ? "text-emerald-700" : "text-amber-700"}`}>{step.status === "complete" ? "Completato" : "Richiede attenzione"}</p>{step.issues?.map((issue) => <p className="mt-1 text-sm text-stone-600" key={issue.code + issue.entity_id}>{issue.message}</p>)}</div>{step.status !== "complete" && <Button onClick={() => onCorrect(step.key)} variant="outline">Correggi</Button>}</Panel>)}{data.readiness.ready && <p className="rounded-xl bg-emerald-50 p-4 font-semibold text-emerald-800">Il salone è pronto per lavorare.</p>}</div></>;
}

function errorMessage(code?: string) {
  if (code === "INVALID_LOCATIONS") return "Controlla i dati delle sedi.";
  if (code === "MULTI_LOCATION_REQUIRED") return "Il piano attuale consente una sola sede.";
  if (code === "INVALID_RESOURCES") return "Controlla cabine e sedi associate.";
  if (code === "INVALID_SERVICES") return "Controlla categorie, durata e prezzo dei servizi.";
  if (code === "INVALID_STAFF") return "Completa nome e sede dello staff.";
  if (code === "ONBOARDING_INCOMPLETE") return "Completa le configurazioni indicate prima di entrare nel gestionale.";
  return "Salvataggio non riuscito. Riprova.";
}

export default function OnboardingPage() { return <AuthProvider><OnboardingWizard /></AuthProvider>; }
