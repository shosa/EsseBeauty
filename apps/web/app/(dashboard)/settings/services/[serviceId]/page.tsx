"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppPage, Breadcrumbs, Button, ConfirmDialog, EmptyState, FormField, InlineError, PageHeaderMetrics, PageSkeleton, SectionCard, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../../../lib/auth-context";

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
    router.push("/settings/services");
  }

  if (loading) return <PageSkeleton />;

  return (
    <AppPage maxWidth="max-w-[1500px]">
      <Breadcrumbs items={[{ href: "/settings/services", label: "Catalogo servizi" }, { label: service?.name ?? "Servizio" }]} />
      {error && <div className="mb-4"><InlineError>{error}</InlineError></div>}
      {!service ? (
        <EmptyState title="Servizio non trovato" description="Potrebbe essere archiviato o non accessibile." />
      ) : (
        <>
          <PageHeaderMetrics
            eyebrow="Servizio"
            metrics={[
              { detail: "Durata catalogo", label: "Durata", value: `${service.durationMinutes} min` },
              { detail: "Prezzo informativo", label: "Prezzo", value: `${(service.priceCents / 100).toFixed(2)} EUR` },
              { detail: "Classificazione", label: "Categoria", value: service.category },
              { detail: "Disponibilità", label: "Stato", value: service.active ? "Attivo" : "Archiviato" },
            ]}
            status={<StatusBadge status={service.active ? "active" : "archived"}>{service.active ? "Attivo" : "Archiviato"}</StatusBadge>}
            subtitle={service.category}
            title={service.name}
          />
          <SectionCard title="Dati servizio">
            <form action={save} className="grid gap-4">
              <FormField label="Nome servizio" required><input required name="name" defaultValue={service.name} className="min-h-12 w-full rounded-xl border px-3" /></FormField>
              <FormField label="Categoria" required><input required name="category" defaultValue={service.category} className="min-h-12 w-full rounded-xl border px-3" /></FormField>
              <FormField label="Descrizione"><textarea name="description" defaultValue={service.description ?? ""} className="min-h-28 w-full rounded-xl border p-3" /></FormField>
              <FormField label="Durata" required description="Durata in minuti."><input required name="duration" type="number" min="5" step="5" defaultValue={service.durationMinutes} className="min-h-12 w-full rounded-xl border px-3" /></FormField>
              <FormField label="Prezzo informativo" required description="Solo informativo, non genera pagamenti o documenti fiscali."><input required name="price" type="number" min="0" step="0.01" defaultValue={(service.priceCents / 100).toFixed(2)} className="min-h-12 w-full rounded-xl border px-3" /></FormField>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>Archivia</Button>
                <Button type="submit" variant="primary">Salva</Button>
              </div>
            </form>
          </SectionCard>
        </>
      )}
      <ConfirmDialog open={confirmDelete} destructive title="Archiviare servizio?" description="Il servizio non sara piu disponibile tra quelli attivi." confirmLabel="Archivia" onCancel={() => setConfirmDelete(false)} onConfirm={() => void archive()} />
    </AppPage>
  );
}
