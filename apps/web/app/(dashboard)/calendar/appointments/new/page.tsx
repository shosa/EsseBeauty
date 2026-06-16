"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumbs, Button, InlineError, PageSkeleton } from "@esse-beauty/ui";

import { useAuth } from "../../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Option {
  id: string;
  name: string;
}

export default function NewAppointmentPage() {
  const router = useRouter();
  const { salon } = useAuth();
  const [customers, setCustomers] = useState<Option[]>([]);
  const [services, setServices] = useState<Option[]>([]);
  const [staff, setStaff] = useState<Option[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!salon) return;
    setLoading(true);
    setError("");
    void Promise.all([
      fetch(`${api}/api/salons/${salon.id}/customers`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/services?active=true`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/staff?active=true`, { credentials: "include" }),
    ])
      .then(async ([customersResponse, servicesResponse, staffResponse]) => {
        if (!customersResponse.ok || !servicesResponse.ok || !staffResponse.ok) {
          throw new Error("Dati di base non disponibili.");
        }
        const customerData = (await customersResponse.json()) as {
          items?: Array<{ full_name: string; id: string }>;
        };
        const serviceData = (await servicesResponse.json()) as Array<{
          id: string;
          name: string;
        }>;
        const staffData = (await staffResponse.json()) as Array<{
          displayName: string;
          id: string;
        }>;
        setCustomers(
          (customerData.items ?? []).map((item) => ({
            id: item.id,
            name: item.full_name,
          })),
        );
        setServices(serviceData.map((item) => ({ id: item.id, name: item.name })));
        setStaff(staffData.map((item) => ({ id: item.id, name: item.displayName })));
      })
      .catch(() => setError("Configura almeno un cliente, un servizio e un collaboratore prima di creare un appuntamento."))
      .finally(() => setLoading(false));
  }, [salon]);

  async function createAppointment(formData: FormData) {
    if (!salon) return;
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/appointments`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customer_id: formData.get("customer_id"),
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
        <Breadcrumbs
          items={[
            { href: "/calendar", label: "Calendario" },
            { label: "Nuovo appuntamento" },
          ]}
        />
        <form action={createAppointment} className="mt-5 grid gap-4 rounded-3xl bg-white p-6 shadow-sm md:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-rose-700">Agenda</p>
            <h1 className="mt-2 text-3xl font-bold">Nuovo appuntamento</h1>
            <p className="mt-2 text-sm text-stone-600">Seleziona cliente, servizio, collaboratore e orario.</p>
          </div>
          {error && <InlineError>{error}</InlineError>}
          <select required name="customer_id" className="min-h-12 rounded-xl border border-stone-200 bg-white px-3">
            <option value="">Seleziona cliente</option>
            {customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select required name="service_id" className="min-h-12 rounded-xl border border-stone-200 bg-white px-3">
            <option value="">Seleziona servizio</option>
            {services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select required name="staff_id" className="min-h-12 rounded-xl border border-stone-200 bg-white px-3">
            <option value="">Seleziona collaboratore</option>
            {staff.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <input required type="datetime-local" name="starts_at" className="min-h-12 rounded-xl border border-stone-200 px-3" />
          <textarea name="notes" placeholder="Note interne" className="min-h-28 rounded-xl border border-stone-200 p-3" />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => router.push("/calendar")}>Annulla</Button>
            <Button type="submit">Crea appuntamento</Button>
          </div>
        </form>
      </div>
    </main>
  );
}
