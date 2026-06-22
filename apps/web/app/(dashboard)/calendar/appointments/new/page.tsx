"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppPage, Breadcrumbs, Button, FormField, InlineError, PageSkeleton } from "@esse-beauty/ui";

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

function euro(cents: number) {
  return (cents / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" });
}

export default function NewAppointmentPage() {
  const router = useRouter();
  const { salon } = useAuth();
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");
  const [staffQuery, setStaffQuery] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!salon) return;
    setLoading(true);
    setError("");
    void Promise.all([
      fetch(`${api}/api/salons/${salon.id}/service-categories?active=true`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/operations/services`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/operations/staff`, { credentials: "include" }),
    ])
      .then(async ([categoriesResponse, servicesResponse, staffResponse]) => {
        if (!categoriesResponse.ok || !servicesResponse.ok || !staffResponse.ok) throw new Error();
        const categoryData = await categoriesResponse.json() as Category[];
        const serviceData = await servicesResponse.json() as Service[];
        const staffData = await staffResponse.json() as Array<{ color?: string | null; display_name: string; id: string }>;
        const availableCategories = categoryData.filter((category) =>
          serviceData.some((service) => service.categoryId === category.id),
        );
        setCategories(availableCategories);
        setServices(serviceData);
        setStaff(staffData.map((item) => ({ color: item.color, id: item.id, name: item.display_name })));
      })
      .catch(() => setError("Configura almeno una categoria, un servizio e un collaboratore prima di creare un appuntamento."))
      .finally(() => setLoading(false));
  }, [salon]);

  useEffect(() => {
    if (!salon || !serviceId) return;
    setStaffId("");
    void fetch(`${api}/api/salons/${salon.id}/operations/staff?serviceId=${serviceId}`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const rows = await response.json() as Array<{ color?: string | null; display_name: string; id: string }>;
        setStaff(rows.map((item) => ({ color: item.color, id: item.id, name: item.display_name })));
      })
      .catch(() => setError("Impossibile caricare i collaboratori abilitati per questo servizio."));
  }, [salon?.id, serviceId]);

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

  async function createAppointment() {
    if (!salon || saving) return;
    setError("");
    if (!selectedCustomer) return setError("Seleziona un cliente dalla ricerca.");
    if (!selectedCategory) return setError("Seleziona una categoria.");
    if (!selectedService) return setError("Seleziona un servizio.");
    if (!selectedStaff) return setError("Seleziona un collaboratore.");
    if (!startsAt) return setError("Inserisci data e ora dell’appuntamento.");

    setSaving(true);
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/appointments`, {
        body: JSON.stringify({
          customer_id: selectedCustomer.id,
          notes: notes || undefined,
          service_id: selectedService.id,
          staff_id: selectedStaff.id,
          starts_at: new Date(startsAt).toISOString(),
        }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        if (response.status === 409) {
          throw new Error(payload.error === "APPOINTMENT_CONFLICT"
            ? "Questo orario si sovrappone a un altro impegno. Abilita l’overbooking oppure scegli un altro orario."
            : "L’orario selezionato non è disponibile.");
        }
        throw new Error("Appuntamento non creato.");
      }
      const appointment = await response.json() as { id: string };
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
      <Breadcrumbs items={[{ href: "/calendar", label: "Calendario" }, { label: "Nuovo appuntamento" }]} />
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-[#e8dfe4] bg-white p-6 shadow-[0_10px_30px_rgb(45_29_39_/_0.055)]">
          <header>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-rose-700">Agenda</p>
            <h1 className="mt-2 text-3xl font-bold">Nuovo appuntamento</h1>
            <p className="mt-2 text-sm text-stone-600">Cliente, categoria, servizio e collaboratore si scelgono tramite ricerca e schede visuali.</p>
          </header>
          {error && <InlineError className="mt-5">{error}</InlineError>}

          <div className="mt-6 space-y-7">
            <FormField description={customerHelp} label="Cliente" required>
              <input
                autoComplete="off"
                className="min-h-12 w-full"
                onChange={(event) => {
                  setCustomerQuery(event.target.value);
                  setSelectedCustomer(undefined);
                }}
                placeholder="Cerca per nome, email o telefono"
                value={selectedCustomer?.name ?? customerQuery}
              />
              {!selectedCustomer && customerResults.length > 0 && (
                <div className="mt-2 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
                  {customerResults.map((customer) => (
                    <button className="block w-full border-b border-stone-100 px-4 py-3 text-left text-sm last:border-0 hover:bg-rose-50" key={customer.id} onClick={() => {
                      setSelectedCustomer(customer);
                      setCustomerQuery(customer.name);
                      setCustomerResults([]);
                    }} type="button">
                      <b className="block">{customer.name}</b>
                      <span className="text-xs text-stone-500">{customer.email ?? "senza email"}{customer.phone ? ` · ${customer.phone}` : ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </FormField>

            <div>
              <p className="text-sm font-bold text-stone-900">Categoria <span className="text-red-700">*</span></p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((category) => (
                  <button className={`flex min-h-20 items-center gap-3 rounded-xl border p-3 text-left transition ${categoryId === category.id ? "border-[#792f59] bg-[#faf3f7] shadow-sm" : "border-stone-200 bg-white hover:border-[#d7a6c1]"}`} key={category.id} onClick={() => {
                    setCategoryId(category.id);
                    setServiceId("");
                    setServiceQuery("");
                  }} type="button">
                    <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${categoryId === category.id ? "bg-[#792f59] text-white" : "bg-stone-100 text-[#792f59]"}`}>
                      <ServiceCategoryIcon className="size-5" name={category.icon} />
                    </span>
                    <span><strong className="block">{category.name}</strong><small className="text-stone-500">{category.activeServiceCount} servizi</small></span>
                  </button>
                ))}
              </div>
            </div>

            {selectedCategory && (
              <div>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div><p className="text-sm font-bold text-stone-900">Servizio <span className="text-red-700">*</span></p><p className="mt-1 text-xs text-stone-500">{selectedCategory.name}</p></div>
                  <input className="min-h-10 w-full sm:w-72" onChange={(event) => setServiceQuery(event.target.value)} placeholder="Cerca servizio" value={serviceQuery} />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {visibleServices.map((service) => (
                    <button className={`flex min-h-20 items-start justify-between gap-4 rounded-xl border p-4 text-left transition ${serviceId === service.id ? "border-[#792f59] bg-[#faf3f7]" : "border-stone-200 hover:border-[#d7a6c1]"}`} key={service.id} onClick={() => setServiceId(service.id)} type="button">
                      <span className="min-w-0"><strong className="block truncate">{service.name}</strong><small className="mt-1 block text-stone-500">{service.durationMinutes} min</small></span>
                      <b className="shrink-0 text-[#792f59]">{euro(service.priceCents)}</b>
                    </button>
                  ))}
                  {visibleServices.length === 0 && <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500 sm:col-span-2">Nessun servizio trovato in questa categoria.</p>}
                </div>
              </div>
            )}

            {selectedService && (
              <div>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div><p className="text-sm font-bold text-stone-900">Collaboratore <span className="text-red-700">*</span></p><p className="mt-1 text-xs text-stone-500">Assegna l’appuntamento alla persona corretta.</p></div>
                  <input className="min-h-10 w-full sm:w-72" onChange={(event) => setStaffQuery(event.target.value)} placeholder="Cerca collaboratore" value={staffQuery} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {visibleStaff.map((member) => (
                    <button className={`inline-flex min-h-12 items-center gap-3 rounded-xl border px-4 text-sm font-bold transition ${staffId === member.id ? "border-[#792f59] bg-[#faf3f7] text-[#642744]" : "border-stone-200 bg-white hover:border-[#d7a6c1]"}`} key={member.id} onClick={() => setStaffId(member.id)} type="button">
                      <span className="grid size-8 place-items-center rounded-full text-xs font-black text-white" style={{ background: member.color || "#792f59" }}>{member.name.slice(0, 1).toUpperCase()}</span>
                      {member.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-5 md:grid-cols-2">
              <FormField label="Data e ora" required>
                <input className="w-full" onChange={(event) => setStartsAt(event.target.value)} type="datetime-local" value={startsAt} />
              </FormField>
              <FormField label="Note interne">
                <textarea className="min-h-24 w-full resize-y" onChange={(event) => setNotes(event.target.value)} value={notes} />
              </FormField>
            </div>
          </div>
        </section>

        <aside className="self-start rounded-2xl border border-[#e8dfe4] bg-white p-5 shadow-[0_10px_30px_rgb(45_29_39_/_0.055)] xl:sticky xl:top-24">
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#8f3a68]">Riepilogo</p>
          <h2 className="mt-1 text-xl font-bold">Appuntamento</h2>
          <dl className="mt-5 divide-y divide-stone-100 text-sm">
            <div className="py-3"><dt className="text-stone-500">Cliente</dt><dd className="mt-1 font-bold">{selectedCustomer?.name ?? "Da selezionare"}</dd></div>
            <div className="py-3"><dt className="text-stone-500">Categoria</dt><dd className="mt-1 font-bold">{selectedCategory?.name ?? "Da selezionare"}</dd></div>
            <div className="py-3"><dt className="text-stone-500">Servizio</dt><dd className="mt-1 font-bold">{selectedService ? `${selectedService.name} · ${selectedService.durationMinutes} min` : "Da selezionare"}</dd></div>
            <div className="py-3"><dt className="text-stone-500">Collaboratore</dt><dd className="mt-1 font-bold">{selectedStaff?.name ?? "Da selezionare"}</dd></div>
            <div className="py-3"><dt className="text-stone-500">Inizio</dt><dd className="mt-1 font-bold">{startsAt ? new Date(startsAt).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" }) : "Da inserire"}</dd></div>
          </dl>
          <Button className="mt-5 w-full" disabled={saving} onClick={() => void createAppointment()} variant="primary">{saving ? "Creazione..." : "Crea appuntamento"}</Button>
          <Button className="mt-2 w-full" onClick={() => router.push("/calendar")} variant="ghost">Annulla</Button>
        </aside>
      </div>
    </AppPage>
  );
}
