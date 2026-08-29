"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { AppPage, Breadcrumbs, Button, DateTimeField, Dialog, FormField, InlineError, PageSkeleton } from "@esse-beauty/ui";

import { useAuth } from "../../../../../lib/auth-context";
import { ServiceCategoryIcon } from "../../../services/ServiceCategoryIcon";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Category {
  activeServiceCount: number;
  icon: string;
  id: string;
  name: string;
}

interface Service {
  category: string;
  categoryIcon?: string | null;
  categoryId?: string | null;
  description?: string | null;
  durationMinutes: number;
  id: string;
  name: string;
  priceCents: number;
}

interface StaffOption {
  color?: string | null;
  id: string;
  name: string;
}

interface CustomerOption {
  email: string | null;
  id: string;
  name: string;
  phone: string | null;
}

interface ResourceOption {
  active: boolean;
  id: string;
  name: string;
  serviceIds: string[];
}

interface AppointmentOverlap {
  customer_name: string;
  ends_at: string;
  id: string;
  service_name: string;
  starts_at: string;
}

interface SchedulingConflict {
  code: string;
  forceable: boolean;
  message: string;
}

function euro(cents: number) {
  return (cents / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" });
}

export default function NewAppointmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { salon } = useAuth();
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [resources, setResources] = useState<ResourceOption[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");
  const [staffQuery, setStaffQuery] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [overlaps, setOverlaps] = useState<AppointmentOverlap[]>([]);
  const [schedulingWarnings, setSchedulingWarnings] = useState<SchedulingConflict[]>([]);

  useEffect(() => {
    if (!salon) return;
    setLoading(true);
    setError("");
    void Promise.all([
      fetch(`${api}/api/salons/${salon.id}/service-categories?active=true`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/operations/services`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/operations/staff`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/settings/resources`, { credentials: "include" }),
    ])
      .then(async ([categoriesResponse, servicesResponse, staffResponse, resourcesResponse]) => {
        if (!categoriesResponse.ok || !servicesResponse.ok || !staffResponse.ok || !resourcesResponse.ok) throw new Error();
        const categoryData = await categoriesResponse.json() as Category[];
        const serviceData = await servicesResponse.json() as Service[];
        const staffData = await staffResponse.json() as Array<{ color?: string | null; display_name: string; id: string }>;
        const resourceData = await resourcesResponse.json() as Array<{ active: boolean; id: string; name: string }>;
        const resourcesWithServices = await Promise.all(resourceData.filter((item) => item.active).map(async (resource) => {
          const response = await fetch(`${api}/api/salons/${salon.id}/settings/resources/${resource.id}/services`, { credentials: "include" });
          const links = response.ok ? await response.json() as Array<{ service_id: string }> : [];
          return { ...resource, serviceIds: links.map((link) => link.service_id) };
        }));
        const availableCategories = categoryData.filter((category) =>
          serviceData.some((service) => service.categoryId === category.id),
        );
        setCategories(availableCategories);
        setServices(serviceData);
        setStaff(staffData.map((item) => ({ color: item.color, id: item.id, name: item.display_name })));
        setResources(resourcesWithServices);
      })
      .catch(() => setError("Configura almeno una categoria, un servizio e un collaboratore prima di creare un appuntamento."))
      .finally(() => setLoading(false));
  }, [salon]);

  useEffect(() => {
    const startsAtParam = searchParams.get("startsAt");
    if (startsAtParam) {
      const date = new Date(startsAtParam);
      const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
      setStartsAt(local);
    }
  }, [searchParams]);

  useEffect(() => {
    const duplicateId = searchParams.get("duplicate");
    if (!salon || !duplicateId || services.length === 0) return;
    void fetch(`${api}/api/salons/${salon.id}/appointments/${duplicateId}`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const item = await response.json() as {
          customer_email: string | null;
          customer_id: string;
          customer_name: string;
          customer_phone: string | null;
          notes?: string | null;
          service_id: string;
        };
        const service = services.find((candidate) => candidate.id === item.service_id);
        if (!service) return;
        setSelectedCustomer({ email: item.customer_email, id: item.customer_id, name: item.customer_name, phone: item.customer_phone });
        setCustomerQuery(item.customer_name);
        setCategoryId(service.categoryId ?? "");
        setServiceId(service.id);
        setNotes(item.notes ?? "");
      })
      .catch(() => setError("Impossibile duplicare l’appuntamento selezionato."));
  }, [salon, searchParams, services]);

  useEffect(() => {
    if (!salon || !serviceId) return;
    const requestedStaffId = searchParams.get("staffId") ?? "";
    setStaffId("");
    setResourceId("");
    void fetch(`${api}/api/salons/${salon.id}/operations/staff?serviceId=${serviceId}&strictAssignments=true`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const rows = await response.json() as Array<{ color?: string | null; display_name: string; id: string }>;
        setStaff(rows.map((item) => ({ color: item.color, id: item.id, name: item.display_name })));
        if (rows.some((item) => item.id === requestedStaffId)) setStaffId(requestedStaffId);
      })
      .catch(() => setError("Impossibile caricare i collaboratori abilitati per questo servizio."));
  }, [salon?.id, searchParams, serviceId]);

  useEffect(() => {
    if (!salon || selectedCustomer) return;
    const query = customerQuery.trim();
    if (query.length < 2) {
      setCustomerResults([]);
      return;
    }
    const timeout = window.setTimeout(() => {
      setCustomerLoading(true);
      const params = new URLSearchParams({ search: query });
      void fetch(`${api}/api/salons/${salon.id}/customers?${params}`, { credentials: "include" })
        .then(async (response) => {
          if (!response.ok) throw new Error();
          const data = await response.json() as { items?: Array<{ email: string | null; full_name: string; id: string; phone: string | null }> };
          setCustomerResults((data.items ?? []).map((item) => ({ email: item.email, id: item.id, name: item.full_name, phone: item.phone })));
        })
        .catch(() => setCustomerResults([]))
        .finally(() => setCustomerLoading(false));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [customerQuery, salon, selectedCustomer]);

  const selectedCategory = categories.find((item) => item.id === categoryId);
  const selectedService = services.find((item) => item.id === serviceId);
  const selectedStaff = staff.find((item) => item.id === staffId);
  const compatibleResources = resources.filter((item) => item.serviceIds.includes(serviceId));
  const selectedResource = compatibleResources.find((item) => item.id === resourceId);
  const canCreate = Boolean(
    selectedCustomer
    && selectedCategory
    && selectedService
    && selectedStaff
    && startsAt
    && (compatibleResources.length === 0 || selectedResource),
  );

  useEffect(() => {
    if (!serviceId) return;
    const requestedResourceId = searchParams.get("resourceId") ?? "";
    if (compatibleResources.some((item) => item.id === requestedResourceId)) setResourceId(requestedResourceId);
    else if (compatibleResources.length === 1) setResourceId(compatibleResources[0]!.id);
  }, [compatibleResources, searchParams, serviceId]);
  const visibleServices = useMemo(() => {
    const query = serviceQuery.trim().toLowerCase();
    return services.filter((item) =>
      item.categoryId === categoryId
      && (!query || `${item.name} ${item.description ?? ""}`.toLowerCase().includes(query)),
    );
  }, [categoryId, serviceQuery, services]);
  const visibleStaff = useMemo(() => {
    const query = staffQuery.trim().toLowerCase();
    return staff.filter((item) => !query || item.name.toLowerCase().includes(query));
  }, [staff, staffQuery]);

  const customerHelp = useMemo(() => {
    if (selectedCustomer) return `${selectedCustomer.email ?? "senza email"}${selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ""}`;
    if (customerQuery.trim().length < 2) return "Scrivi almeno 2 caratteri: nome, email o telefono.";
    if (customerLoading) return "Ricerca in corso...";
    if (customerResults.length === 0) return "Nessun cliente trovato. Crea prima il profilo cliente se è nuovo.";
    return "Seleziona il cliente corretto dai risultati.";
  }, [customerLoading, customerQuery, customerResults.length, selectedCustomer]);

  async function createAppointment(confirmOverlap = false, forceConflicts = false) {
    if (!salon || saving) return;
    setError("");
    if (!selectedCustomer) return setError("Seleziona un cliente dalla ricerca.");
    if (!selectedCategory) return setError("Seleziona una categoria.");
    if (!selectedService) return setError("Seleziona un servizio.");
    if (!selectedStaff) return setError("Seleziona un collaboratore.");
    if (compatibleResources.length > 0 && !selectedResource) return setError("Seleziona una cabina.");
    if (!startsAt) return setError("Inserisci data e ora dell’appuntamento.");

    setSaving(true);
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/appointments`, {
        body: JSON.stringify({
          customer_id: selectedCustomer.id,
          confirm_overlap: confirmOverlap,
          force_conflicts: forceConflicts,
          notes: notes || undefined,
          resource_id: selectedResource?.id,
          service_id: selectedService.id,
          staff_id: selectedStaff.id,
          starts_at: new Date(startsAt).toISOString(),
        }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { conflicts?: AppointmentOverlap[] | SchedulingConflict[]; error?: string };
        if (response.status === 409) {
          if (payload.error === "APPOINTMENT_OVERLAP_CONFIRMATION_REQUIRED") {
            setOverlaps((payload.conflicts ?? []) as AppointmentOverlap[]);
            return;
          }
          if (payload.error === "SCHEDULING_CONFLICTS") {
            setSchedulingWarnings((payload.conflicts ?? []) as SchedulingConflict[]);
            return;
          }
          throw new Error(payload.error === "APPOINTMENT_CONFLICT"
            ? "Questo orario coincide con un blocco o supera il limite di affiancamento configurato."
            : "L’orario selezionato non è disponibile.");
        }
        throw new Error("Appuntamento non creato.");
      }
      const appointment = await response.json() as { id: string };
      setOverlaps([]);
      setSchedulingWarnings([]);
      router.push(`/calendar?appointment=${encodeURIComponent(appointment.id)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Appuntamento non creato.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageSkeleton />;

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <Dialog
        footer={
          <>
            <Button onClick={() => { setOverlaps([]); setSchedulingWarnings([]); }} variant="outline">Modifica orario</Button>
            <Button disabled={saving || schedulingWarnings.some((warning) => !warning.forceable)} onClick={() => void createAppointment(true, schedulingWarnings.length > 0)} variant="primary">
              {saving ? "Creazione..." : schedulingWarnings.length ? "Forza e crea" : "Conferma affiancamento"}
            </Button>
          </>
        }
        onClose={() => { setOverlaps([]); setSchedulingWarnings([]); }}
        open={overlaps.length > 0 || schedulingWarnings.length > 0}
        title={schedulingWarnings.length ? "Avvisi di pianificazione" : "Appuntamenti sovrapposti"}
      >
        {schedulingWarnings.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-bold">Puoi forzare gli avvisi consentiti.</p>
            <ul className="mt-2 list-disc pl-5">{schedulingWarnings.map((warning) => <li key={warning.code}>{warning.message}{!warning.forceable ? " (non forzabile)" : ""}</li>)}</ul>
          </div>
        ) : (
        <>
        <p className="text-sm leading-6 text-stone-600">
          Il collaboratore ha già un appuntamento in questa fascia. Confermando, gli appuntamenti verranno mostrati affiancati in agenda.
        </p>
        <div className="mt-5 rounded-2xl border border-[#ead1df] bg-[#fffafd] p-4">
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#8f3a68]">Anteprima agenda</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-xl border-l-4 border-[#792f59] bg-white p-3 shadow-sm">
              <p className="text-xs font-bold text-[#792f59]">
                {startsAt && new Date(startsAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="mt-1 truncate text-sm font-bold">{selectedCustomer?.name}</p>
              <p className="truncate text-xs text-stone-500">{selectedService?.name}</p>
            </div>
            <div className="min-w-0 rounded-xl border-l-4 border-amber-500 bg-white p-3 shadow-sm">
              <p className="text-xs font-bold text-amber-700">
                {overlaps[0] && new Date(overlaps[0].starts_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="mt-1 truncate text-sm font-bold">{overlaps[0]?.customer_name}</p>
              <p className="truncate text-xs text-stone-500">{overlaps[0]?.service_name}</p>
            </div>
          </div>
          {overlaps.length > 1 && (
            <p className="mt-3 text-xs font-semibold text-amber-800">
              Sono presenti altri {overlaps.length - 1} appuntamenti sovrapposti.
            </p>
          )}
        </div>
        </>
        )}
      </Dialog>
      <Breadcrumbs items={[{ href: "/calendar", label: "Calendario" }, { label: "Nuovo appuntamento" }]} />
      <header className="mt-4 border-b border-stone-200 pb-4">
        <h1 className="text-3xl font-bold tracking-[-.025em] text-[#2d1d27]">Nuovo appuntamento</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-600">Cliente, orario, trattamento e risorse in un’unica vista.</p>
      </header>

      {error && <InlineError className="mt-4">{error}</InlineError>}

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <section aria-labelledby="primary-data-title" className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-stone-950" id="primary-data-title">Dati principali</h2>
              <p className="mt-1 text-sm text-stone-600">Chi prenota e quando.</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <FormField description={customerHelp} label="Cliente" required>
                <div className="relative">
                  <input
                    aria-autocomplete="list"
                    aria-controls="customer-results"
                    aria-expanded={!selectedCustomer && customerResults.length > 0}
                    autoComplete="off"
                    className="min-h-11 w-full"
                    onChange={(event) => {
                      setCustomerQuery(event.target.value);
                      setSelectedCustomer(undefined);
                    }}
                    placeholder="Nome, email o telefono"
                    value={selectedCustomer?.name ?? customerQuery}
                  />
                  {!selectedCustomer && customerResults.length > 0 && (
                    <div className="absolute inset-x-0 top-[calc(100%+8px)] z-40 max-h-72 overflow-y-auto rounded-xl border border-stone-200 bg-white p-1 shadow-[0_16px_40px_rgb(45_29_39_/_0.14)]" id="customer-results" role="listbox">
                      {customerResults.map((customer) => (
                        <button className="block min-h-14 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[#faf3f7] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20" key={customer.id} onClick={() => {
                          setSelectedCustomer(customer);
                          setCustomerQuery(customer.name);
                          setCustomerResults([]);
                        }} role="option" type="button">
                          <b className="block">{customer.name}</b>
                          <span className="text-xs text-stone-600">{customer.email ?? "Senza email"}{customer.phone ? ` · ${customer.phone}` : ""}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </FormField>
              <FormField label="Data e ora" required>
                <DateTimeField aria-label="Data e ora dell’appuntamento" onChange={setStartsAt} required step={300} value={startsAt} />
              </FormField>
            </div>
          </section>

          <section aria-labelledby="treatment-section-title" className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-stone-950" id="treatment-section-title">Trattamento</h2>
              <p className="mt-1 text-sm text-stone-600">Categoria e servizio.</p>
            </div>
            <div className="grid gap-5 lg:grid-cols-[minmax(260px,.72fr)_minmax(0,1.28fr)]">
              <fieldset>
                <legend className="text-sm font-bold text-stone-900">Categoria <span aria-hidden="true" className="text-red-700">*</span></legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {categories.map((category) => {
                    const active = categoryId === category.id;
                    return (
                      <button aria-pressed={active} className={`flex min-h-14 items-center gap-2 rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20 ${active ? "border-[#792f59] bg-[#faf3f7]" : "border-stone-200 bg-white hover:border-[#d7a6c1]"}`} key={category.id} onClick={() => {
                        setCategoryId(category.id);
                        setServiceId("");
                        setServiceQuery("");
                      }} type="button">
                        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${active ? "bg-[#792f59] text-white" : "bg-stone-100 text-[#792f59]"}`}>
                          <ServiceCategoryIcon className="size-4" name={category.icon} />
                        </span>
                        <span className="min-w-0 flex-1"><strong className="block truncate text-xs sm:text-sm">{category.name}</strong><small className="hidden text-stone-600 sm:block">{category.activeServiceCount} servizi</small></span>
                        {active && <Check aria-hidden="true" className="size-4 shrink-0 text-[#792f59]" />}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="lg:border-l lg:border-stone-100 lg:pl-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-stone-900">Servizio <span aria-hidden="true" className="text-red-700">*</span></h3>
                  {selectedCategory && <input aria-label="Cerca servizio" className="min-h-10 w-full sm:w-56" onChange={(event) => setServiceQuery(event.target.value)} placeholder="Cerca servizio" value={serviceQuery} />}
                </div>
                {selectedCategory ? (
                  <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {visibleServices.map((service) => {
                      const active = serviceId === service.id;
                      return (
                        <button aria-pressed={active} className={`flex min-h-16 items-start justify-between gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20 ${active ? "border-[#792f59] bg-[#faf3f7]" : "border-stone-200 bg-white hover:border-[#d7a6c1]"}`} key={service.id} onClick={() => setServiceId(service.id)} type="button">
                          <span className="min-w-0"><strong className="block truncate text-sm">{service.name}</strong><small className="mt-0.5 block text-stone-600">{service.durationMinutes} min</small></span>
                          <span className="flex shrink-0 items-center gap-1.5"><b className="text-sm text-[#792f59]">{euro(service.priceCents)}</b>{active && <Check aria-hidden="true" className="size-4 text-[#792f59]" />}</span>
                        </button>
                      );
                    })}
                    {visibleServices.length === 0 && <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600 sm:col-span-2">Nessun servizio trovato.</p>}
                  </div>
                ) : <p className="mt-2 rounded-xl bg-stone-50 p-3 text-sm text-stone-600">Seleziona una categoria.</p>}
              </div>
            </div>
          </section>

          <section aria-labelledby="scheduling-section-title" className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-stone-950" id="scheduling-section-title">Risorse e dettagli</h2>
              <p className="mt-1 text-sm text-stone-600">Collaboratore, cabina e indicazioni interne.</p>
            </div>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(240px,.65fr)]">
              <div>
                {selectedService ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-stone-900">Collaboratore <span aria-hidden="true" className="text-red-700">*</span></h3>
                      <input aria-label="Cerca collaboratore" className="min-h-10 w-full sm:w-56" onChange={(event) => setStaffQuery(event.target.value)} placeholder="Cerca collaboratore" value={staffQuery} />
                    </div>
                    <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto pr-1">
                      {visibleStaff.map((member) => {
                        const active = staffId === member.id;
                        return (
                          <button aria-pressed={active} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20 ${active ? "border-[#792f59] bg-[#faf3f7] text-[#642744]" : "border-stone-200 bg-white hover:border-[#d7a6c1]"}`} key={member.id} onClick={() => setStaffId(member.id)} type="button">
                            <span className="grid size-7 place-items-center rounded-full text-xs font-black text-white" style={{ background: member.color || "#792f59" }}>{member.name.slice(0, 1).toUpperCase()}</span>
                            {member.name}
                            {active && <Check aria-hidden="true" className="size-4" />}
                          </button>
                        );
                      })}
                      {visibleStaff.length === 0 && <p className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">Nessun collaboratore assegnato a questo servizio.</p>}
                    </div>

                    {compatibleResources.length > 0 && (
                      <div className="mt-4 border-t border-stone-100 pt-4">
                        <h3 className="text-sm font-bold text-stone-900">Cabina <span aria-hidden="true" className="text-red-700">*</span></h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {compatibleResources.map((resource) => {
                            const active = resourceId === resource.id;
                            return <button aria-pressed={active} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20 ${active ? "border-[#792f59] bg-[#faf3f7] text-[#642744]" : "border-stone-200 bg-white hover:border-[#d7a6c1]"}`} key={resource.id} onClick={() => setResourceId(resource.id)} type="button">{resource.name}{active && <Check aria-hidden="true" className="size-4" />}</button>;
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600">Seleziona un servizio per scegliere collaboratore e cabina.</p>}
              </div>
              <div className="lg:border-l lg:border-stone-100 lg:pl-5">
                <label className="text-sm font-bold text-stone-900" htmlFor="appointment-notes">Note interne <span className="font-normal text-stone-600">(facoltative)</span></label>
                <textarea className="mt-2 min-h-24 w-full resize-y" id="appointment-notes" onChange={(event) => setNotes(event.target.value)} placeholder="Preferenze o promemoria" value={notes} />
              </div>
            </div>
          </section>
        </div>

        <aside aria-labelledby="summary-title" className="self-start rounded-xl border border-stone-200 bg-white p-4 xl:sticky xl:top-20">
          <h2 className="text-lg font-bold text-stone-950" id="summary-title">Riepilogo</h2>
          <p aria-live="polite" className="mt-1 text-sm text-stone-600">{canCreate ? "Tutto pronto per la creazione." : "Completa i campi obbligatori."}</p>
          <dl className="mt-3 divide-y divide-stone-100 text-sm">
            <div className="py-2.5"><dt className="text-stone-600">Cliente</dt><dd className="font-bold text-stone-950">{selectedCustomer?.name ?? "Da selezionare"}</dd></div>
            <div className="py-2.5"><dt className="text-stone-600">Servizio</dt><dd className="font-bold text-stone-950">{selectedService ? `${selectedService.name} · ${selectedService.durationMinutes} min · ${euro(selectedService.priceCents)}` : "Da selezionare"}</dd></div>
            <div className="py-2.5"><dt className="text-stone-600">Data e ora</dt><dd className="font-bold text-stone-950">{startsAt ? new Date(startsAt).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" }) : "Da inserire"}</dd></div>
            <div className="py-2.5"><dt className="text-stone-600">Collaboratore</dt><dd className="font-bold text-stone-950">{selectedStaff?.name ?? "Da selezionare"}</dd></div>
            {compatibleResources.length > 0 && <div className="py-2.5"><dt className="text-stone-600">Cabina</dt><dd className="font-bold text-stone-950">{selectedResource?.name ?? "Da selezionare"}</dd></div>}
          </dl>
          <Button className="mt-4 w-full" disabled={saving || !canCreate} onClick={() => void createAppointment()} variant="primary">{saving ? "Creazione in corso…" : "Crea appuntamento"}</Button>
          <Button className="mt-2 w-full" onClick={() => router.push("/calendar")} variant="ghost">Annulla</Button>
        </aside>
      </div>
    </AppPage>
  );
}
