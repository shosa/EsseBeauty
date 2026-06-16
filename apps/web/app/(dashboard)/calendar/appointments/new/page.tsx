"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumbs, Button, FormField, InlineError, PageSkeleton } from "@esse-beauty/ui";

import { useAuth } from "../../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Option {
  id: string;
  name: string;
}

interface CustomerOption {
  email: string | null;
  id: string;
  name: string;
  phone: string | null;
}

export default function NewAppointmentPage() {
  const router = useRouter();
  const { salon } = useAuth();
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption>();
  const [services, setServices] = useState<Option[]>([]);
  const [staff, setStaff] = useState<Option[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [customerLoading, setCustomerLoading] = useState(false);

  useEffect(() => {
    if (!salon) return;
    setLoading(true);
    setError("");
    void Promise.all([
      fetch(`${api}/api/salons/${salon.id}/services?active=true`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/staff?active=true`, { credentials: "include" }),
    ])
      .then(async ([servicesResponse, staffResponse]) => {
        if (!servicesResponse.ok || !staffResponse.ok) throw new Error("Dati di base non disponibili.");
        const serviceData = (await servicesResponse.json()) as Array<{ id: string; name: string }>;
        const staffData = (await staffResponse.json()) as Array<{ displayName: string; id: string }>;
        setServices(serviceData.map((item) => ({ id: item.id, name: item.name })));
        setStaff(staffData.map((item) => ({ id: item.id, name: item.displayName })));
      })
      .catch(() => setError("Configura almeno un servizio e un collaboratore prima di creare un appuntamento."))
      .finally(() => setLoading(false));
  }, [salon]);

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
          if (!response.ok) throw new Error("Ricerca clienti non disponibile.");
          const data = await response.json() as { items?: Array<{ email: string | null; full_name: string; id: string; phone: string | null }> };
          setCustomerResults((data.items ?? []).map((item) => ({ email: item.email, id: item.id, name: item.full_name, phone: item.phone })));
        })
        .catch(() => setCustomerResults([]))
        .finally(() => setCustomerLoading(false));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [customerQuery, salon, selectedCustomer]);

  const customerHelp = useMemo(() => {
    if (selectedCustomer) return `${selectedCustomer.email ?? "senza email"}${selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ""}`;
    if (customerQuery.trim().length < 2) return "Scrivi almeno 2 caratteri: nome, email o telefono.";
    if (customerLoading) return "Ricerca in corso...";
    if (customerResults.length === 0) return "Nessun cliente trovato. Crea prima il profilo cliente se è nuovo.";
    return "Seleziona il cliente corretto dai risultati.";
  }, [customerLoading, customerQuery, customerResults.length, selectedCustomer]);

  async function createAppointment(formData: FormData) {
    if (!salon) return;
    setError("");
    if (!selectedCustomer) {
      setError("Seleziona un cliente dalla ricerca prima di creare l'appuntamento.");
      return;
    }
    const response = await fetch(`${api}/api/salons/${salon.id}/appointments`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customer_id: selectedCustomer.id,
        service_id: formData.get("service_id"),
        staff_id: formData.get("staff_id"),
        starts_at: new Date(String(formData.get("starts_at"))).toISOString(),
        notes: formData.get("notes") || undefined,
      }),
    });
    if (!response.ok) {
      setError(response.status === 409 ? "L'orario selezionato è già occupato." : "Appuntamento non creato.");
      return;
    }
    const appointment = (await response.json()) as { id: string };
    router.push(`/calendar/appointments/${appointment.id}`);
  }

  if (loading) return <PageSkeleton />;

  return (
    <main className="min-h-screen bg-stone-100 p-5 md:p-10">
      <div className="mx-auto max-w-3xl">
        <Breadcrumbs items={[{ href: "/calendar", label: "Calendario" }, { label: "Nuovo appuntamento" }]} />
        <form action={createAppointment} className="mt-5 grid gap-5 rounded-3xl bg-white p-6 shadow-sm md:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-rose-700">Agenda</p>
            <h1 className="mt-2 text-3xl font-bold">Nuovo appuntamento</h1>
            <p className="mt-2 text-sm text-stone-600">Cerca il cliente, poi scegli servizio, collaboratore e orario.</p>
          </div>
          {error && <InlineError>{error}</InlineError>}

          <FormField description={customerHelp} label="Cliente" required>
            <input
              autoComplete="off"
              className="min-h-12 w-full rounded-xl border border-stone-200 px-3"
              onChange={(event) => {
                setCustomerQuery(event.target.value);
                setSelectedCustomer(undefined);
              }}
              placeholder="Cerca per nome, email o telefono"
              value={selectedCustomer?.name ?? customerQuery}
            />
            {!selectedCustomer && customerResults.length > 0 && (
              <div className="mt-2 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                {customerResults.map((customer) => (
                  <button
                    className="block w-full border-b border-stone-100 px-4 py-3 text-left text-sm last:border-0 hover:bg-rose-50"
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setCustomerQuery(customer.name);
                      setCustomerResults([]);
                    }}
                    type="button"
                  >
                    <b className="block">{customer.name}</b>
                    <span className="text-xs text-stone-500">{customer.email ?? "senza email"}{customer.phone ? ` · ${customer.phone}` : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </FormField>

          <FormField label="Servizio" required>
            <select required name="service_id" className="min-h-12 w-full rounded-xl border border-stone-200 bg-white px-3">
              <option value="">Seleziona servizio</option>
              {services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </FormField>
          <FormField label="Collaboratore" required>
            <select required name="staff_id" className="min-h-12 w-full rounded-xl border border-stone-200 bg-white px-3">
              <option value="">Seleziona collaboratore</option>
              {staff.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </FormField>
          <FormField label="Data e ora" required>
            <input required type="datetime-local" name="starts_at" className="min-h-12 w-full rounded-xl border border-stone-200 px-3" />
          </FormField>
          <FormField label="Note interne">
            <textarea name="notes" className="min-h-28 w-full rounded-xl border border-stone-200 p-3" />
          </FormField>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => router.push("/calendar")}>Annulla</Button>
            <Button type="submit">Crea appuntamento</Button>
          </div>
        </form>
      </div>
    </main>
  );
}
