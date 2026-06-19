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
  StatusBadge,
  Switch,
} from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface ConsentTemplate {
  active: boolean;
  body: string;
  createdAt?: string;
  id: string;
  name: string;
  requiredForServices?: string[];
  type: string;
  version: number;
}

export default function DocumentsSettingsPage() {
  const { salon } = useAuth();
  const [items, setItems] = useState<ConsentTemplate[]>([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ message: string; variant: "error" | "success" }>();
  const [form, setForm] = useState({ active: true, body: "", name: "", type: "privacy", version: 1 });

  const activeCount = useMemo(() => items.filter((item) => item.active).length, [items]);

  function load() {
    if (!salon?.id) return;
    void fetch(`${api}/api/salons/${salon.id}/consent-templates`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Documenti non disponibili.");
        setItems(await response.json());
        setError("");
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Documenti non disponibili."));
  }

  useEffect(load, [salon?.id]);

  async function save() {
    if (!salon?.id) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/consent-templates`, {
      body: JSON.stringify(form),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      setToast({ message: "Documento non salvato.", variant: "error" });
      return;
    }
    setForm({ active: true, body: "", name: "", type: "privacy", version: 1 });
    setToast({ message: "Documento salvato.", variant: "success" });
    load();
  }

  return (
    <AppPage maxWidth="max-w-[1500px]">
      <PageHeader
        eyebrow="Moduli"
        meta={<><StatusBadge status="active">{activeCount} attivi</StatusBadge><StatusBadge status="waiting">{items.length} versioni</StatusBadge></>}
        subtitle="Modelli di consenso e informative firmabili dai clienti prima del trattamento."
        title="Documenti e consensi"
      />
      {error && <InlineError className="mb-5">{error}</InlineError>}
      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Nuovo modello" subtitle="Crea testi riutilizzabili per privacy, anamnesi, consenso trattamento o autorizzazioni foto.">
          <div className="grid gap-4">
            <FormField label="Nome documento">
              <input value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="Consenso trattamento viso" />
            </FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Tipo">
                <select value={form.type} onChange={(event) => setForm((value) => ({ ...value, type: event.target.value }))}>
                  <option value="privacy">Privacy</option>
                  <option value="treatment">Trattamento</option>
                  <option value="anamnesis">Anamnesi</option>
                  <option value="photo_release">Uso immagini</option>
                </select>
              </FormField>
              <FormField label="Versione">
                <input min={1} type="number" value={form.version} onChange={(event) => setForm((value) => ({ ...value, version: Number(event.target.value) || 1 }))} />
              </FormField>
            </div>
            <FormField label="Testo">
              <textarea value={form.body} onChange={(event) => setForm((value) => ({ ...value, body: event.target.value }))} placeholder="Scrivi il testo che il cliente dovrÃ  accettare o firmare." />
            </FormField>
            <label className="flex items-center justify-between rounded-2xl bg-stone-50 p-4 text-sm font-bold text-stone-800"><span>Attivo subito</span><Switch checked={form.active} onCheckedChange={(active: boolean) => setForm((value) => ({ ...value, active }))} /></label>
            <Button disabled={!form.name.trim() || !form.body.trim()} onClick={() => void save()} variant="primary">Salva modello</Button>
          </div>
        </SectionCard>
        <SectionCard title="Archivio documenti" subtitle="I modelli restano versionati: non modificare un testo giÃ  firmato, crea una nuova versione.">
          {items.length === 0 ? <EmptyState title="Nessun documento" description="Crea il primo modello di consenso per attivare il flusso." /> : (
            <div className="space-y-3">
              {items.map((item) => (
                <article className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[.16em] text-[#792f59]">{item.type} Â· v{item.version}</p>
                      <h3 className="mt-1 font-bold text-stone-950">{item.name}</h3>
                    </div>
                    <StatusBadge status={item.active ? "active" : "archived"}>{item.active ? "Attivo" : "Spento"}</StatusBadge>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-stone-500">{item.body}</p>
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



