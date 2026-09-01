"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Info, UserPlus, X } from "lucide-react";
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
  firstName?: string;
  id: string;
  lastName?: string;
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

function duration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

export default function NewAppointmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { salon } = useAuth();
  const fromWaitlist = Boolean(searchParams.get("waitlistId"));
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [resources, setResources] = useState<ResourceOption[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [staffId, setStaffId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");
  const [staffQuery, setStaffQuery] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newCustomerSaving, setNewCustomerSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [overlaps, setOverlaps] = useState<AppointmentOverlap[]>([]);
  const [schedulingWarnings, setSchedulingWarnings] = useState<SchedulingConflict[]>([]);
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [createdCount, setCreatedCount] = useState(0);

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
    const customerId = searchParams.get("customerId");
    const requestedServiceId = searchParams.get("serviceId");
    if (!salon || services.length === 0 || (!customerId && !requestedServiceId)) return;
    const service = services.find((candidate) => candidate.id === requestedServiceId);
    if (service) {
      setCategoryId(service.categoryId ?? "");
      setSelectedServiceIds((current) => current.includes(service.id) ? current : [...current, service.id]);
    }
    if (!customerId || selectedCustomer?.id === customerId) return;
    void fetch(`${api}/api/salons/${salon.id}/customers/${customerId}`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const customer = await response.json() as { email: string | null; firstName?: string; fullName: string; id: string; lastName?: string; phone: string | null };
        const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.fullName;
        setSelectedCustomer({ email: customer.email, firstName: customer.firstName, id: customer.id, lastName: customer.lastName, name, phone: customer.phone });
        setCustomerQuery(name);
      })
      .catch(() => setError("Impossibile caricare il cliente della lista d’attesa."));
  }, [salon, searchParams, selectedCustomer?.id, services]);

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
        setSelectedServiceIds([service.id]);
        setNotes(item.notes ?? "");
      })
      .catch(() => setError("Impossibile duplicare l’appuntamento selezionato."));
  }, [salon, searchParams, services]);

  useEffect(() => {
    if (!salon) return;
    setStaffId("");
    setResourceId("");
    if (selectedServiceIds.length === 0) return;
    const requestedStaffId = searchParams.get("staffId") ?? "";
    void Promise.all(selectedServiceIds.map((id) =>
      fetch(`${api}/api/salons/${salon.id}/operations/staff?serviceId=${id}&strictAssignments=true`, { credentials: "include" })
        .then((response) => response.ok ? response.json() as Promise<Array<{ color?: string | null; display_name: string; id: string }>> : []),
    ))
      .then((lists) => {
        const [first, ...rest] = lists;
        if (!first) return;
        const intersected = first.filter((member) => rest.every((list) => list.some((candidate) => candidate.id === member.id)));
        setStaff(intersected.map((item) => ({ color: item.color, id: item.id, name: item.display_name })));
        if (intersected.some((item) => item.id === requestedStaffId)) setStaffId(requestedStaffId);
      })
      .catch(() => setError("Impossibile caricare i collaboratori abilitati per questi servizi."));
  }, [salon?.id, searchParams, selectedServiceIds]);

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
          const data = await response.json() as { items?: Array<{ email: string | null; first_name: string; full_name: string; id: string; last_name: string; phone: string | null }> };
          setCustomerResults((data.items ?? []).map((item) => ({ email: item.email, firstName: item.first_name, id: item.id, lastName: item.last_name, name: [item.first_name, item.last_name].filter(Boolean).join(" ") || item.full_name, phone: item.phone })));
        })
        .catch(() => setCustomerResults([]))
        .finally(() => setCustomerLoading(false));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [customerQuery, salon, selectedCustomer]);

  const selectedCategory = categories.find((item) => item.id === categoryId);
  const selectedServices = useMemo(
    () => selectedServiceIds.map((id) => services.find((item) => item.id === id)).filter((item): item is Service => Boolean(item)),
    [selectedServiceIds, services],
  );
  const selectedStaff = staff.find((item) => item.id === staffId);
  const compatibleResources = selectedServiceIds.length > 0
    ? resources.filter((item) => selectedServiceIds.every((id) => item.serviceIds.includes(id)))
    : [];
  const selectedResource = compatibleResources.find((item) => item.id === resourceId);
  const totalDurationMinutes = selectedServices.reduce((sum, item) => sum + item.durationMinutes, 0);
  const totalPriceCents = selectedServices.reduce((sum, item) => sum + item.priceCents, 0);
  const sequenceStarts = useMemo(() => {
    if (!startsAt) return [];
    const base = new Date(startsAt).getTime();
    let offset = 0;
    return selectedServices.map((service) => {
      const start = new Date(base + offset * 60_000);
      offset += service.durationMinutes;
      return { end: new Date(base + offset * 60_000), service, start };
    });
  }, [selectedServices, startsAt]);
  const canCreate = Boolean(
    selectedCustomer
    && selectedServices.length > 0
    && selectedStaff
    && startsAt
    && (compatibleResources.length === 0 || selectedResource),
  );

  useEffect(() => {
    if (selectedServiceIds.length === 0) return;
    const requestedResourceId = searchParams.get("resourceId") ?? "";
    if (compatibleResources.some((item) => item.id === requestedResourceId)) setResourceId(requestedResourceId);
    else if (compatibleResources.length === 1) setResourceId(compatibleResources[0]!.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compatibleResources, searchParams, selectedServiceIds]);

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

  function toggleService(id: string) {
    setSelectedServiceIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  const customerHelp = useMemo(() => {
    if (selectedCustomer) return `${selectedCustomer.email ?? "senza email"}${selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ""}`;
    if (customerQuery.trim().length < 2) return "Scrivi almeno 2 caratteri: nome, email o telefono.";
    if (customerLoading) return "Ricerca in corso...";
    if (customerResults.length === 0) return "Nessun cliente trovato. Puoi crearlo da +.";
    return "Seleziona il cliente corretto dai risultati.";
  }, [customerLoading, customerQuery, customerResults.length, selectedCustomer]);

  const closeNewCustomerDialog = useCallback(() => {
    if (!newCustomerSaving) setNewCustomerOpen(false);
  }, [newCustomerSaving]);

  async function createCustomerFromDialog(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!salon || newCustomerSaving) return;
    const formData = new FormData(event.currentTarget);
    setNewCustomerSaving(true);
    setError("");
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/customers`, {
        body: JSON.stringify({
          email: formData.get("email") || undefined,
          first_name: formData.get("first_name"),
          last_name: formData.get("last_name"),
          phone: formData.get("phone") || undefined,
        }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error("Cliente non creato.");
      const customer = await response.json() as { email: string | null; firstName?: string; first_name?: string; fullName?: string; full_name?: string; id: string; lastName?: string; last_name?: string; phone: string | null };
      const firstName = customer.firstName ?? customer.first_name ?? String(formData.get("first_name") ?? "");
      const lastName = customer.lastName ?? customer.last_name ?? String(formData.get("last_name") ?? "");
      const name = [firstName, lastName].filter(Boolean).join(" ") || customer.fullName || customer.full_name || "";
      const selected = { email: customer.email, firstName, id: customer.id, lastName, name, phone: customer.phone };
      setSelectedCustomer(selected);
      setCustomerQuery(name);
      setCustomerResults([]);
      setNewCustomerOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Cliente non creato.");
    } finally {
      setNewCustomerSaving(false);
    }
  }

  async function runStep(index: number, confirmOverlap = false, forceConflicts = false) {
    if (!salon || !selectedCustomer || !selectedStaff) return;
    const step = sequenceStarts[index];
    if (!step) return;
    setError("");
    setSaving(true);
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/appointments`, {
        body: JSON.stringify({
          customer_id: selectedCustomer.id,
          confirm_overlap: confirmOverlap,
          force_conflicts: forceConflicts,
          notes: notes || undefined,
          resource_id: selectedResource?.id,
          service_id: step.service.id,
          staff_id: selectedStaff.id,
          starts_at: step.start.toISOString(),
        }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { conflicts?: AppointmentOverlap[] | SchedulingConflict[]; error?: string };
        if (response.status === 409) {
          setSequenceIndex(index);
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
      setCreatedCount((count) => count + 1);
      setOverlaps([]);
      setSchedulingWarnings([]);
      if (index + 1 < sequenceStarts.length) {
        await runStep(index + 1);
        return;
      }
      const waitlistId = searchParams.get("waitlistId");
      if (waitlistId) {
        const waitlistResponse = await fetch(`${api}/api/salons/${salon.id}/waitlist/${waitlistId}`, {
          body: JSON.stringify({ status: "booked" }),
          credentials: "include",
          headers: { "content-type": "application/json" },
          method: "PATCH",
        });
        if (!waitlistResponse.ok) setError("Appuntamenti creati, ma la richiesta non è stata chiusa automaticamente.");
      }
      router.push(`/calendar?appointment=${encodeURIComponent(appointment.id)}`);
    } catch (reason) {
      setError(
        createdCount > 0
          ? `Creati ${createdCount} di ${sequenceStarts.length} appuntamenti, poi: ${reason instanceof Error ? reason.message : "errore imprevisto"}`
          : reason instanceof Error ? reason.message : "Appuntamento non creato.",
      );
    } finally {
      setSaving(false);
    }
  }

  function startSequence() {
    if (!selectedCustomer) return setError("Seleziona un cliente dalla ricerca.");
    if (selectedServices.length === 0) return setError("Seleziona almeno un servizio.");
    if (!selectedStaff) return setError("Seleziona un collaboratore.");
    if (compatibleResources.length > 0 && !selectedResource) return setError("Seleziona una cabina.");
    if (!startsAt) return setError("Inserisci data e ora dell’appuntamento.");
    setCreatedCount(0);
    setSequenceIndex(0);
    void runStep(0);
  }

  if (loading) return <PageSkeleton />;

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <Dialog
        footer={
          <>
            <Button onClick={() => { setOverlaps([]); setSchedulingWarnings([]); }} variant="outline">Modifica orario</Button>
            <Button disabled={saving || schedulingWarnings.some((warning) => !warning.forceable)} onClick={() => void runStep(sequenceIndex, true, schedulingWarnings.length > 0)} variant="primary">
              {saving ? "Creazione..." : schedulingWarnings.length ? "Forza e crea" : "Conferma affiancamento"}
            </Button>
          </>
        }
        onClose={() => { setOverlaps([]); setSchedulingWarnings([]); }}
        open={overlaps.length > 0 || schedulingWarnings.length > 0}
        title={schedulingWarnings.length ? "Avvisi di pianificazione" : "Appuntamenti sovrapposti"}
      >
        {sequenceStarts.length > 1 && (
          <p className="mb-4 text-xs font-bold uppercase tracking-[.1em] text-[#792f59]">
            Servizio {sequenceIndex + 1} di {sequenceStarts.length}: {sequenceStarts[sequenceIndex]?.service.name}
          </p>
        )}
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
                {sequenceStarts[sequenceIndex] && sequenceStarts[sequenceIndex]!.start.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="mt-1 truncate text-sm font-bold">{selectedCustomer?.name}</p>
              <p className="truncate text-xs text-stone-500">{sequenceStarts[sequenceIndex]?.service.name}</p>
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
      <Dialog
        footer={null}
        onClose={closeNewCustomerDialog}
        open={newCustomerOpen}
        title="Nuovo cliente"
      >
        <form className="grid gap-4" onSubmit={(event) => void createCustomerFromDialog(event)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Nome" required><input autoComplete="given-name" className="w-full" name="first_name" required /></FormField>
            <FormField label="Cognome" required><input autoComplete="family-name" className="w-full" name="last_name" required /></FormField>
            <FormField label="Email"><input autoComplete="email" className="w-full" name="email" type="email" /></FormField>
            <FormField label="Telefono"><input autoComplete="tel" className="w-full" name="phone" /></FormField>
          </div>
          <div className="flex justify-end gap-2">
            <Button disabled={newCustomerSaving} onClick={closeNewCustomerDialog} type="button" variant="outline">Annulla</Button>
            <Button disabled={newCustomerSaving} type="submit" variant="primary">{newCustomerSaving ? "Creazione..." : "Crea e seleziona"}</Button>
          </div>
        </form>
      </Dialog>
      <Breadcrumbs items={[{ href: "/calendar", label: "Calendario" }, { label: "Nuovo appuntamento" }]} />
      <header className="mt-4 border-b border-stone-200 pb-4">
        <h1 className="text-3xl font-bold tracking-[-.025em] text-[#2d1d27]">Nuovo appuntamento</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-600">Cliente, orario, trattamento e risorse in un’unica vista.</p>
      </header>

      {fromWaitlist && (
        <div className="sticky top-16 z-20 mt-3 flex items-center gap-3 rounded-xl border border-[#e5bfd3] bg-[#fff7fb] px-4 py-3 shadow-sm">
          <span className="rounded-full bg-[#792f59] px-3 py-1 text-xs font-black text-white">Da lista d’attesa</span>
          <p className="min-w-0 flex-1 text-sm font-semibold text-[#542138]">Stai trasformando una richiesta cliente in appuntamento.</p>
          <span className="group relative shrink-0">
            <button aria-describedby="waitlist-context-tooltip" aria-label="Informazioni sulla richiesta cliente" className="grid min-h-11 min-w-11 place-items-center rounded-full text-[#792f59] hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/25" type="button"><Info aria-hidden="true" className="size-5" /></button>
            <span className="pointer-events-none absolute right-0 top-full z-30 mt-2 w-64 rounded-xl bg-stone-950 p-3 text-xs font-semibold leading-5 text-white opacity-0 shadow-xl transition group-hover:opacity-100 group-focus-within:opacity-100" id="waitlist-context-tooltip" role="tooltip">Cliente, servizio, collaboratore e fascia provengono dalla richiesta. Verifica l’orario prima di creare l’appuntamento.</span>
          </span>
        </div>
      )}

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
                <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
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
                <Button aria-label="Crea cliente" className="min-h-11 px-3" onClick={() => setNewCustomerOpen(true)} title="Crea cliente" type="button" variant="outline"><UserPlus className="size-4" /></Button>
                </div>
              </FormField>
              <FormField description="Orario del primo servizio: gli altri seguono in sequenza." label="Data e ora" required>
                <DateTimeField aria-label="Data e ora dell’appuntamento" onChange={setStartsAt} required step={300} value={startsAt} />
              </FormField>
            </div>
          </section>

          <section aria-labelledby="treatment-section-title" className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-stone-950" id="treatment-section-title">Trattamento</h2>
              <p className="mt-1 text-sm text-stone-600">Seleziona uno o più servizi: verranno prenotati uno dopo l’altro, consecutivi.</p>
            </div>

            {selectedServices.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#ead1df] bg-[#fffafd] p-3">
                {selectedServices.map((service, index) => (
                  <span className="inline-flex items-center gap-2 rounded-lg border border-[#e8bfd4] bg-white py-1.5 pl-2.5 pr-1.5 text-xs font-bold text-[#642744]" key={service.id}>
                    <span className="grid size-5 place-items-center rounded-full bg-[#792f59] text-[10px] font-black text-white">{index + 1}</span>
                    {service.name}
                    <span className="font-normal text-stone-500">{duration(service.durationMinutes)}</span>
                    <button aria-label={`Rimuovi ${service.name} dalla sequenza`} className="grid size-6 place-items-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-red-700" onClick={() => toggleService(service.id)} type="button"><X aria-hidden="true" className="size-3.5" /></button>
                  </span>
                ))}
                <span className="ml-auto text-xs font-bold text-[#792f59]">{duration(totalDurationMinutes)} totali · {euro(totalPriceCents)}</span>
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-[minmax(260px,.72fr)_minmax(0,1.28fr)]">
              <fieldset>
                <legend className="text-sm font-bold text-stone-900">Categoria</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {categories.map((category) => {
                    const active = categoryId === category.id;
                    return (
                      <button aria-pressed={active} className={`flex min-h-14 items-center gap-2 rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20 ${active ? "border-[#792f59] bg-[#faf3f7]" : "border-stone-200 bg-white hover:border-[#d7a6c1]"}`} key={category.id} onClick={() => {
                        setCategoryId(category.id);
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
                  <h3 className="text-sm font-bold text-stone-900">Servizi <span aria-hidden="true" className="text-red-700">*</span></h3>
                  {selectedCategory && <input aria-label="Cerca servizio" className="min-h-10 w-full sm:w-56" onChange={(event) => setServiceQuery(event.target.value)} placeholder="Cerca servizio" value={serviceQuery} />}
                </div>
                {selectedCategory ? (
                  <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {visibleServices.map((service) => {
                      const active = selectedServiceIds.includes(service.id);
                      return (
                        <button aria-pressed={active} className={`flex min-h-16 items-start justify-between gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20 ${active ? "border-[#792f59] bg-[#faf3f7]" : "border-stone-200 bg-white hover:border-[#d7a6c1]"}`} key={service.id} onClick={() => toggleService(service.id)} type="button">
                          <span className="min-w-0"><strong className="block truncate text-sm">{service.name}</strong><small className="mt-0.5 block text-stone-600">{service.durationMinutes} min</small></span>
                          <span className="flex shrink-0 items-center gap-1.5"><b className="text-sm text-[#792f59]">{euro(service.priceCents)}</b>{active && <Check aria-hidden="true" className="size-4 text-[#792f59]" />}</span>
                        </button>
                      );
                    })}
                    {visibleServices.length === 0 && <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600 sm:col-span-2">Nessun servizio trovato.</p>}
                  </div>
                ) : <p className="mt-2 rounded-xl bg-stone-50 p-3 text-sm text-stone-600">Seleziona una categoria per sfogliare i servizi.</p>}
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
                {selectedServices.length > 0 ? (
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
                      {visibleStaff.length === 0 && <p className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">{selectedServices.length > 1 ? "Nessun collaboratore è abilitato a tutti i servizi selezionati." : "Nessun collaboratore assegnato a questo servizio."}</p>}
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
                ) : <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600">Seleziona almeno un servizio per scegliere collaboratore e cabina.</p>}
              </div>
              <div className="lg:border-l lg:border-stone-100 lg:pl-5">
                <label className="text-sm font-bold text-stone-900" htmlFor="appointment-notes">Note interne <span className="font-normal text-stone-600">(facoltative)</span></label>
                <textarea className="mt-2 min-h-24 w-full resize-y" id="appointment-notes" onChange={(event) => setNotes(event.target.value)} placeholder="Preferenze o promemoria" value={notes} />
              </div>
            </div>
          </section>
        </div>

        <aside aria-labelledby="summary-title" className={`self-start rounded-xl border border-stone-200 bg-white p-4 xl:sticky ${fromWaitlist ? "xl:top-36" : "xl:top-20"}`}>
          {fromWaitlist && <p className="mb-2 text-xs font-black uppercase tracking-[.14em] text-[#792f59]">Richiesta cliente</p>}
          <h2 className="text-lg font-bold text-stone-950" id="summary-title">Riepilogo</h2>
          <p aria-live="polite" className="mt-1 text-sm text-stone-600">{canCreate ? (sequenceStarts.length > 1 ? `${sequenceStarts.length} appuntamenti consecutivi pronti.` : "Tutto pronto per la creazione.") : "Completa i campi obbligatori."}</p>
          <dl className="mt-3 divide-y divide-stone-100 text-sm">
            <div className="py-2.5"><dt className="text-stone-600">Cliente</dt><dd className="font-bold text-stone-950">{selectedCustomer?.name ?? "Da selezionare"}</dd></div>
            <div className="py-2.5">
              <dt className="text-stone-600">{sequenceStarts.length > 1 ? "Servizi in sequenza" : "Servizio"}</dt>
              {sequenceStarts.length === 0 ? <dd className="font-bold text-stone-950">Da selezionare</dd> : (
                <dd className="mt-1.5 space-y-1.5">
                  {sequenceStarts.map((step, index) => (
                    <div className="flex items-center justify-between gap-2 text-xs" key={step.service.id}>
                      <span className="min-w-0 truncate font-bold text-stone-950">{index + 1}. {step.service.name}</span>
                      <span className="shrink-0 font-semibold text-stone-500">{step.start.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}–{step.end.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-stone-100 pt-1.5 text-xs font-bold text-[#792f59]"><span>Totale</span><span>{duration(totalDurationMinutes)} · {euro(totalPriceCents)}</span></div>
                </dd>
              )}
            </div>
            <div className="py-2.5"><dt className="text-stone-600">Data e ora</dt><dd className="font-bold text-stone-950">{startsAt ? new Date(startsAt).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" }) : "Da inserire"}</dd></div>
            <div className="py-2.5"><dt className="text-stone-600">Collaboratore</dt><dd className="font-bold text-stone-950">{selectedStaff?.name ?? "Da selezionare"}</dd></div>
            {compatibleResources.length > 0 && <div className="py-2.5"><dt className="text-stone-600">Cabina</dt><dd className="font-bold text-stone-950">{selectedResource?.name ?? "Da selezionare"}</dd></div>}
          </dl>
          <Button className="mt-4 w-full" disabled={saving || !canCreate} onClick={startSequence} variant="primary">
            {saving ? `Creazione ${createdCount + 1} di ${sequenceStarts.length}…` : sequenceStarts.length > 1 ? `Crea ${sequenceStarts.length} appuntamenti` : "Crea appuntamento"}
          </Button>
          <Button className="mt-2 w-full" onClick={() => router.push("/calendar")} variant="ghost">Annulla</Button>
        </aside>
      </div>
      {fromWaitlist && (
        <aside aria-label="Riepilogo richiesta cliente" className="sticky bottom-3 z-20 mt-3 rounded-2xl border border-[#dcb3ca] bg-white/95 p-3 shadow-[0_12px_36px_rgb(45_29_39_/_0.2)] backdrop-blur xl:hidden">
          <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black text-stone-950">Riepilogo richiesta cliente</h2><span className="text-xs font-bold text-[#792f59]">Da lista d’attesa</span></div>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="min-w-0"><dt className="text-stone-500">Cliente</dt><dd className="truncate font-bold">{selectedCustomer?.name ?? "Caricamento…"}</dd></div>
            <div className="min-w-0"><dt className="text-stone-500">Servizio</dt><dd className="truncate font-bold">{selectedServices[0]?.name ?? "Da selezionare"}</dd></div>
            <div className="min-w-0"><dt className="text-stone-500">Data e ora</dt><dd className="truncate font-bold">{startsAt ? new Date(startsAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }) : "Da inserire"}</dd></div>
            <div className="min-w-0"><dt className="text-stone-500">Collaboratore</dt><dd className="truncate font-bold">{selectedStaff?.name ?? "Da selezionare"}</dd></div>
          </dl>
        </aside>
      )}
    </AppPage>
  );
}
