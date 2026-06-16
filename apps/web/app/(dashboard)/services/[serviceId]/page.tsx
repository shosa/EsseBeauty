"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Breadcrumbs, Button, ConfirmDialog, EmptyState, InlineError, PageSkeleton } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Service {
  active: boolean;
  category: string;
  description?: string | null;
  durationMinutes: number;
  id: string;
  name: string;
  priceCents: number;
}

export default function ServiceDetailPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const { salon } = useAuth();
  const router = useRouter();
  const [service, setService] = useState<Service>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function load() {
    if (!salon) return;
    setLoading(true);
    const response = await fetch(`${api}/api/salons/${salon.id}/services`, { credentials: "include" });
    if (!response.ok) {
      setError("Impossibile caricare il servizio.");
      setLoading(false);
      return;
    }
    const services = await response.json() as Service[];
    setService(services.find((item) => item.id === serviceId));
    setLoading(false);
  }

  useEffect(() => { void load(); }, [salon?.id, serviceId]);

  async function save(data: FormData) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/services/${serviceId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        category: data.get("category"),
        description: data.get("description") || undefined,
        duration_minutes: Number(data.get("duration")),
        price_cents: Math.round(Number(data.get("price")) * 100),
      }),
    });
    if (!response.ok) {
      setError("Servizio non salvato.");
      return;
    }
    await load();
  }

  async function archive() {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/services/${serviceId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      setError("Servizio non archiviato.");
      return;
    }
    router.push("/services");
  }

  if (loading) return <PageSkeleton />;

  return (
    <main className="min-h-screen bg-stone-100 p-5 md:p-10">
      <div className="mx-auto max-w-3xl">
        <Breadcrumbs items={[{ href: "/services", label: "Servizi" }, { label: service?.name ?? "Servizio" }]} />
        {error && <div className="mt-4"><InlineError>{error}</InlineError></div>}
        {!service ? (
          <EmptyState title="Servizio non trovato" description="Potrebbe essere archiviato o non accessibile." />
        ) : (
          <form action={save} className="mt-5 grid gap-4 rounded-3xl bg-white p-6 shadow-sm md:p-8">
            <h1 className="text-3xl font-bold">{service.name}</h1>
            <input required name="name" defaultValue={service.name} className="min-h-12 rounded-xl border px-3" />
            <input required name="category" defaultValue={service.category} className="min-h-12 rounded-xl border px-3" />
            <textarea name="description" defaultValue={service.description ?? ""} className="min-h-28 rounded-xl border p-3" />
            <input required name="duration" type="number" min="5" step="5" defaultValue={service.durationMinutes} className="min-h-12 rounded-xl border px-3" />
            <input required name="price" type="number" min="0" step="0.01" defaultValue={(service.priceCents / 100).toFixed(2)} className="min-h-12 rounded-xl border px-3" />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>Archivia</Button>
              <Button type="submit">Salva</Button>
            </div>
          </form>
        )}
      </div>
      <ConfirmDialog open={confirmDelete} destructive title="Archiviare servizio?" description="Il servizio non sarà più disponibile tra quelli attivi." confirmLabel="Archivia" onCancel={() => setConfirmDelete(false)} onConfirm={() => void archive()} />
    </main>
  );
}
