"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { formatPrice } from "@esse-beauty/shared";
import { AppPage, Button, ConfirmDialog, EmptyState, InlineError, PageHeader, PageTransition, StatusBadge, Switch } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Service {
  active: boolean;
  category: string;
  description?: string;
  durationMinutes: number;
  id: string;
  name: string;
  priceCents: number;
}

export default function SettingsServicesPage() {
  const [items, setItems] = useState<Service[]>([]);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Service>();
  const { salon } = useAuth();

  async function load() {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/services`, { credentials: "include" });
    if (!response.ok) {
      setError("Impossibile caricare il catalogo servizi.");
      return;
    }
    setItems(await response.json() as Service[]);
  }

  useEffect(() => { void load(); }, [salon?.id]);

  async function toggle(item: Service) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/services/${item.id}`, {
      body: JSON.stringify({ active: !item.active }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    if (!response.ok) setError("Lo stato del servizio non è stato aggiornato.");
    await load();
  }

  async function archive() {
    if (!salon || !confirmDelete) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/services/${confirmDelete.id}`, {
      credentials: "include",
      method: "DELETE",
    });
    if (!response.ok) setError("Servizio non archiviato.");
    setConfirmDelete(undefined);
    await load();
  }

  return (
    <AppPage maxWidth="max-w-[1500px]">
      <PageTransition>
        <PageHeader
          actions={<Link href="/settings/services/new" className="inline-flex min-h-12 items-center rounded-xl bg-stone-950 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5">Nuovo servizio</Link>}
          eyebrow="Core"
          title="Catalogo Servizi"
          subtitle="Qui si gestiscono prezzo informativo, durata, categoria, ordinamento e disponibilità strutturale."
          status={<StatusBadge status="active">{items.length} servizi configurati</StatusBadge>}
        />
        {error && <InlineError className="mb-5">{error}</InlineError>}
        {items.length === 0 ? (
          <EmptyState
            action={<Link href="/settings/services/new" className="inline-flex min-h-11 items-center rounded-xl bg-stone-950 px-4 text-sm font-bold text-white">Crea il primo servizio</Link>}
            description="Crea il primo trattamento per calendario, prenotazione pubblica e report."
            title="Nessun servizio configurato"
          />
        ) : (
          <section className="grid gap-4">
            {items.map((item) => (
              <article key={item.id} className={`rounded-3xl border border-white/70 bg-white p-5 shadow-sm ring-1 ring-stone-950/5 transition hover:-translate-y-0.5 hover:shadow-md ${item.active ? "" : "opacity-60"}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <Link href={`/settings/services/${item.id}`} className="text-lg font-bold text-stone-950 hover:text-[#792f59]">{item.name}</Link>
                    <p className="mt-1 text-sm text-stone-500">{item.durationMinutes} min - {item.category}</p>
                    {item.description && <p className="mt-2 max-w-2xl text-sm text-stone-600">{item.description}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <strong>{formatPrice(item.priceCents, "it-IT")}</strong>
                    <Link href={`/settings/services/${item.id}`} className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-bold text-stone-700 hover:border-[#792f59] hover:text-[#792f59]">Configura</Link>
                    <Switch checked={item.active} onCheckedChange={() => void toggle(item)} />
                    <Button onClick={() => setConfirmDelete(item)} size="sm" variant="destructive">Archivia</Button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </PageTransition>
      <ConfirmDialog open={Boolean(confirmDelete)} destructive title="Archiviare servizio?" description="Il servizio non sarà più disponibile tra quelli attivi." confirmLabel="Archivia" onCancel={() => setConfirmDelete(undefined)} onConfirm={() => void archive()} />
    </AppPage>
  );
}
