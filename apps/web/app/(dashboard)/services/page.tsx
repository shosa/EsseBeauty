"use client";

import { useEffect, useState } from "react";

import { formatPrice } from "@esse-beauty/shared";
import { AppPage, EmptyState, FormField, InlineError, PageHeader, PageTransition, SectionCard, StatusBadge } from "@esse-beauty/ui";

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
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { salon } = useAuth();

  async function load() {
    if (!salon) return;
    setLoading(true);
    setError("");
    const params = query.trim() ? `?${new URLSearchParams({ q: query.trim() })}` : "";
    const response = await fetch(`${api}/api/salons/${salon.id}/operations/services${params}`, { credentials: "include" });
    if (!response.ok) {
      setError("Catalogo operativo non disponibile.");
      setItems([]);
      setLoading(false);
      return;
    }
    setItems(await response.json() as Service[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [salon?.id, query]);

  return (
    <AppPage>
      <PageTransition>
        <PageHeader
          eyebrow="Catalogo operativo"
          title="Servizi"
          subtitle="Consultazione quotidiana del catalogo attivo. Prezzo, durata e categoria si configurano solo in Impostazioni."
          status={<StatusBadge status="active">{items.length} servizi attivi</StatusBadge>}
        />

        {error && <InlineError className="mb-5">{error}</InlineError>}
        <SectionCard className="mb-5" title="Ricerca catalogo" subtitle="Nessuna modifica strutturale da questa vista.">
          <FormField label="Cerca servizio o categoria">
            <input className="w-full" onChange={(event) => setQuery(event.target.value)} placeholder="Es. piega, colore, ceretta..." value={query} />
          </FormField>
        </SectionCard>

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-3xl bg-white" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState description="Nessun servizio attivo corrisponde alla ricerca." title="Nessun servizio operativo" />
        ) : (
          <section className="grid gap-4">
            {items.map((item) => (
              <article key={item.id} className="rounded-3xl border border-white/70 bg-white p-5 shadow-sm ring-1 ring-stone-950/5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-stone-950">{item.name}</h2>
                    <p className="mt-1 text-sm text-stone-500">{item.durationMinutes} min - {item.category}</p>
                    {item.description && <p className="mt-2 max-w-2xl text-sm text-stone-600">{item.description}</p>}
                  </div>
                  <div className="text-right">
                    <strong>{formatPrice(item.priceCents, "it-IT")}</strong>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[.12em] text-stone-400">Informativo</p>
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
