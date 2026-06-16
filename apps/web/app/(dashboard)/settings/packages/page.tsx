"use client";

import { useEffect, useMemo, useState } from "react";

import {
  AppPage,
  Button,
  EmptyState,
  FormField,
  InlineError,
  PageHeader,
  SaveToast,
  SectionCard,
  StatCard,
  StatGrid,
  StatusBadge,
  Switch,
} from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface ServicePackage {
  active: boolean;
  createdAt?: string;
  description?: string | null;
  id: string;
  includedSessions: number;
  name: string;
  serviceId?: string | null;
  validityDays?: number | null;
}

export default function PackagesSettingsPage() {
  const { salon } = useAuth();
  const [items, setItems] = useState<ServicePackage[]>([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ message: string; variant: "error" | "success" }>();
  const [form, setForm] = useState({ active: true, description: "", included_sessions: 5, name: "", validity_days: 90 });

  const stats = useMemo(() => ({
    active: items.filter((item) => item.active).length,
    sessions: items.reduce((sum, item) => sum + Number(item.includedSessions ?? 0), 0),
  }), [items]);

  function load() {
    if (!salon?.id) return;
    void fetch(`${api}/api/salons/${salon.id}/service-packages`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Pacchetti non disponibili.");
        setItems(await response.json());
        setError("");
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Pacchetti non disponibili."));
  }

  useEffect(load, [salon?.id]);

  async function save() {
    if (!salon?.id) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/service-packages`, {
      body: JSON.stringify(form),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      setToast({ message: "Pacchetto non salvato.", variant: "error" });
      return;
    }
    setForm({ active: true, description: "", included_sessions: 5, name: "", validity_days: 90 });
    setToast({ message: "Pacchetto salvato.", variant: "success" });
    load();
  }

  return (
    <AppPage>
      <PageHeader
        eyebrow="Moduli"
        subtitle="Configura percorsi acquistabili in piÃ¹ sedute e consumabili dagli appuntamenti."
        title="Pacchetti servizi"
      />
      {error && <InlineError className="mb-5">{error}</InlineError>}
      <StatGrid className="mb-5">
        <StatCard label="Pacchetti attivi" value={stats.active} />
        <StatCard label="Sedute configurate" value={stats.sessions} />
        <StatCard label="Catalogo" value={items.length} />
      </StatGrid>
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="Nuovo pacchetto" subtitle="Definisci numero sedute, validitÃ  e regole operative visibili al team.">
          <div className="grid gap-4">
            <FormField label="Nome pacchetto">
              <input value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="Percorso viso 5 sedute" />
            </FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Sedute incluse">
                <input min={1} type="number" value={form.included_sessions} onChange={(event) => setForm((value) => ({ ...value, included_sessions: Number(event.target.value) || 1 }))} />
              </FormField>
              <FormField label="ValiditÃ  giorni">
                <input min={1} type="number" value={form.validity_days} onChange={(event) => setForm((value) => ({ ...value, validity_days: Number(event.target.value) || 1 }))} />
              </FormField>
            </div>
            <FormField label="Descrizione interna">
              <textarea value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} placeholder="Condizioni, note operative, esclusioni." />
            </FormField>
            <label className="flex items-center justify-between rounded-2xl bg-stone-50 p-4 text-sm font-bold text-stone-800"><span>Vendibile</span><Switch checked={form.active} onCheckedChange={(active: boolean) => setForm((value) => ({ ...value, active }))} /></label>
            <Button disabled={!form.name.trim() || form.included_sessions < 1} onClick={() => void save()} variant="primary">Salva pacchetto</Button>
          </div>
        </SectionCard>
        <SectionCard title="Catalogo pacchetti" subtitle="Usali dalle schede cliente per assegnare percorsi e scalare sedute.">
          {items.length === 0 ? <EmptyState title="Nessun pacchetto" description="Crea il primo percorso a sedute per abilitarne la gestione." /> : (
            <div className="grid gap-3">
              {items.map((item) => (
                <article className="rounded-2xl border border-white/80 bg-white/82 p-4 shadow-sm" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-stone-950">{item.name}</h3>
                      <p className="mt-1 text-sm text-stone-500">{item.description || "Nessuna descrizione."}</p>
                    </div>
                    <StatusBadge status={item.active ? "active" : "archived"}>{item.active ? "Attivo" : "Spento"}</StatusBadge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-stone-600">
                    <span className="rounded-full bg-[#faf3f7] px-3 py-1">{item.includedSessions} sedute</span>
                    <span className="rounded-full bg-[#faf3f7] px-3 py-1">{item.validityDays ?? "âˆž"} giorni</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
      <SaveToast variant={toast?.variant} visible={Boolean(toast)}>{toast?.message ?? ""}</SaveToast>
    </AppPage>
  );
}



