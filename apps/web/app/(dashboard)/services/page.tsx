"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { formatPrice, PERMISSION_KEYS } from "@esse-beauty/shared";
import { AppPage, Button, EmptyState, InlineError, PageHeader, PageTransition, Switch } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";

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

export default function ServicesPage() {
  const [items, setItems] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { hasPermission, salon } = useAuth();
  const canEdit = hasPermission(PERMISSION_KEYS.SETTINGS_SERVICES);

  async function load() {
    if (!salon) return;
    setLoading(true);
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/services`, { credentials: "include" });
    if (!response.ok) {
      setError(response.status === 403 ? "Non hai il permesso di gestire i servizi." : "Impossibile caricare i servizi.");
      setItems([]);
      setLoading(false);
      return;
    }
    const data: unknown = await response.json();
    setItems(Array.isArray(data) ? data as Service[] : []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [salon?.id]);

  async function toggle(item: Service) {
    if (!salon || !canEdit) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/services/${item.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    if (!response.ok) setError("Lo stato del servizio non e stato aggiornato.");
    await load();
  }

  return (
    <AppPage>
      <PageTransition>
        <PageHeader
          eyebrow="Catalogo"
          title="Servizi"
          subtitle="Trattamenti, durata, prezzo informativo e disponibilita online."
          actions={canEdit ? (
            <Link href="/services/new" className="inline-flex min-h-12 items-center rounded-xl bg-stone-950 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5">Nuovo servizio</Link>
          ) : (
            <Button disabled>Nuovo servizio</Button>
          )}
        />

        {error && <InlineError className="mb-5">{error}</InlineError>}
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-3xl bg-white" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState
            action={canEdit ? <Link href="/services/new" className="inline-flex min-h-11 items-center rounded-xl bg-stone-950 px-4 text-sm font-bold text-white">Crea il primo servizio</Link> : null}
            description="Crea il primo trattamento per calendario, prenotazione pubblica e report."
            title="Nessun servizio configurato"
          />
        ) : (
          <section className="grid gap-4">
            {items.map((item) => (
              <article key={item.id} className={`rounded-3xl border border-white/70 bg-white p-5 shadow-sm ring-1 ring-stone-950/5 transition hover:-translate-y-0.5 hover:shadow-md ${item.active ? "" : "opacity-60"}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <Link href={`/services/${item.id}`} className="text-lg font-bold text-stone-950 hover:text-[#792f59]">{item.name}</Link>
                    <p className="mt-1 text-sm text-stone-500">{item.durationMinutes} min - {item.category}</p>
                    {item.description && <p className="mt-2 max-w-2xl text-sm text-stone-600">{item.description}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <strong>{formatPrice(item.priceCents, "it-IT")}</strong>
                    <Link href={`/services/${item.id}`} className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-bold text-stone-700 hover:border-[#792f59] hover:text-[#792f59]">Apri scheda</Link>
                    <Switch checked={item.active} disabled={!canEdit} onCheckedChange={() => void toggle(item)} />
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </PageTransition>
    </AppPage>
  );
}
