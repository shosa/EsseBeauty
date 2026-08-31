"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import {
  AppPage,
  EmptyState,
  FormField,
  InlineError,
  PageHeader,
  SaveActionButton,
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

interface Service {
  active?: boolean;
  id: string;
  name: string;
}

const documentTypes = [
  { label: "Privacy", value: "privacy" },
  { label: "Trattamento", value: "treatment" },
  { label: "Anamnesi", value: "anamnesis" },
  { label: "Uso immagini", value: "photo_release" },
];

export default function DocumentsSettingsPage() {
  const { salon } = useAuth();
  const [items, setItems] = useState<ConsentTemplate[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: "error" | "success" }>();
  const [form, setForm] = useState({ active: true, body: "", name: "", requiredForServices: [] as string[], type: "privacy" });

  const load = useCallback(async () => {
    if (!salon?.id) return;
    try {
      const [templateResponse, serviceResponse] = await Promise.all([
        fetch(`${api}/api/salons/${salon.id}/consent-templates`, { credentials: "include" }),
        fetch(`${api}/api/salons/${salon.id}/services`, { credentials: "include" }),
      ]);
      if (!templateResponse.ok) throw new Error("Documenti non disponibili.");
      setItems(await templateResponse.json() as ConsentTemplate[]);
      setServices(serviceResponse.ok ? (await serviceResponse.json() as Service[]).filter((service) => service.active !== false) : []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Documenti non disponibili.");
    }
  }, [salon?.id]);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!salon?.id) return;
    setSaving(true);
    setSaved(false);
    setFormError("");
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/consent-templates`, {
        body: JSON.stringify({ active: form.active, body: form.body.trim(), name: form.name.trim(), required_for_services: form.requiredForServices, type: form.type }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => undefined) as { error?: string } | undefined;
        setFormError(body?.error === "CONSENT_TEMPLATE_VERSION_CONFLICT"
          ? "Un'altra versione è stata creata nello stesso momento. Ricarica e riprova."
          : "Documento non salvato. Controlla i campi e riprova.");
        setToast({ message: "Documento non salvato.", variant: "error" });
        return;
      }
      setForm({ active: true, body: "", name: "", requiredForServices: [], type: "privacy" });
      setToast({ message: "Documento salvato.", variant: "success" });
      setSaved(true);
      await load();
    } catch {
      setFormError("Documento non salvato. Controlla la connessione e riprova.");
      setToast({ message: "Documento non salvato.", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  function toggleService(serviceId: string) {
    setForm((current) => ({ ...current, requiredForServices: current.requiredForServices.includes(serviceId) ? current.requiredForServices.filter((id) => id !== serviceId) : [...current.requiredForServices, serviceId] }));
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageHeader eyebrow="Moduli" subtitle="Modelli versionati, richieste di firma ed evidenze verificabili per ogni cliente." title="Documenti e consensi" />
      {error && <InlineError className="mb-5">{error}</InlineError>}
      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <SectionCard subtitle="Crea il testo iniziale. Le versioni firmate non verranno mai modificate in place." title="Nuovo modello">
          <div className="grid gap-4">
            <FormField label="Nome documento"><input onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="Consenso trattamento viso" value={form.name} /></FormField>
            <FormField label="Tipo"><select onChange={(event) => setForm((value) => ({ ...value, type: event.target.value }))} value={form.type}>{documentTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></FormField>
            <FormField label="Testo"><textarea onChange={(event) => setForm((value) => ({ ...value, body: event.target.value }))} placeholder="Scrivi il testo che il cliente dovrà accettare o firmare." rows={10} value={form.body} /></FormField>
            {services.length > 0 && <fieldset><legend className="text-sm font-bold text-stone-700">Obbligatorio per i servizi</legend><p className="mt-1 text-xs text-stone-500">Lascia vuoto per un modello non associato automaticamente a servizi.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{services.map((service) => <label className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 text-sm font-semibold" key={service.id}><input checked={form.requiredForServices.includes(service.id)} onChange={() => toggleService(service.id)} type="checkbox" />{service.name}</label>)}</div></fieldset>}
            <label className="flex min-h-12 items-center justify-between rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm font-semibold text-stone-800"><span>Attivo subito</span><Switch aria-label="Attiva subito il modello" checked={form.active} onCheckedChange={(active: boolean) => setForm((value) => ({ ...value, active }))} /></label>
            {formError && <InlineError>{formError}</InlineError>}
            <SaveActionButton busy={saving} disabled={!form.name.trim() || !form.body.trim()} idleLabel="Salva modello" onClick={() => void save()} saved={saved} />
          </div>
        </SectionCard>
        <SectionCard subtitle="Apri una versione per consultarne il testo, crearne una nuova o archiviarla." title="Archivio documenti">
          {items.length === 0 ? <EmptyState description="Crea il primo modello di consenso per attivare il flusso." title="Nessun documento" /> : <div aria-label="Archivio documenti" className="space-y-3" role="list">{items.map((item) => <article className="rounded-xl border border-stone-200 bg-white p-4" key={item.id} role="listitem"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-[#792f59]">{item.type} · v{item.version}</p><h3 className="mt-1 font-semibold text-stone-950">{item.name}</h3></div><StatusBadge status={item.active ? "active" : "archived"}>{item.active ? "Attivo" : "Archiviato"}</StatusBadge></div><p className="mt-3 line-clamp-3 text-sm leading-6 text-stone-600">{item.body}</p><div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-3 text-sm font-semibold"><Link className="min-h-10 rounded-lg px-3 py-2 text-[#6f3556] hover:bg-[#faf3f7]" href={`/settings/documents/${item.id}`}>Apri versione</Link>{item.active && <Link className="min-h-10 rounded-lg px-3 py-2 text-stone-700 hover:bg-stone-100" href={`/settings/documents/${item.id}`}>Crea nuova versione</Link>}</div></article>)}</div>}
        </SectionCard>
      </div>
      <SaveToast variant={toast?.variant} visible={Boolean(toast)}>{toast?.message ?? ""}</SaveToast>
    </AppPage>
  );
}
