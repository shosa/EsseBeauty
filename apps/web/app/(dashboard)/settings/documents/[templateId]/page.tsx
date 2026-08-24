"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { AppPage, Breadcrumbs, Button, Dialog, EmptyState, FormField, InlineError, PageHeader, PageSkeleton, SectionCard, StatusBadge, Switch } from "@esse-beauty/ui";

import { useAuth } from "../../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface ConsentTemplate {
  active: boolean;
  body: string;
  id: string;
  name: string;
  requiredForServices?: string[];
  type: string;
  version: number;
}

interface Service { active?: boolean; id: string; name: string }

export default function DocumentVersionPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const router = useRouter();
  const { salon } = useAuth();
  const [template, setTemplate] = useState<ConsentTemplate>();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [versionError, setVersionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [draft, setDraft] = useState({ active: true, body: "", name: "", requiredForServices: [] as string[], type: "privacy" });

  const load = useCallback(async () => {
    if (!salon?.id) return;
    setLoading(true);
    try {
      const [templateResponse, serviceResponse] = await Promise.all([
        fetch(`${api}/api/salons/${salon.id}/consent-templates`, { credentials: "include" }),
        fetch(`${api}/api/salons/${salon.id}/services`, { credentials: "include" }),
      ]);
      if (!templateResponse.ok) throw new Error("Documento non disponibile.");
      const templates = await templateResponse.json() as ConsentTemplate[];
      const current = templates.find((item) => item.id === templateId);
      setTemplate(current);
      if (current) setDraft({ active: current.active, body: current.body, name: current.name, requiredForServices: current.requiredForServices ?? [], type: current.type });
      setServices(serviceResponse.ok ? (await serviceResponse.json() as Service[]).filter((service) => service.active !== false) : []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Documento non disponibile.");
    } finally {
      setLoading(false);
    }
  }, [salon?.id, templateId]);

  useEffect(() => { void load(); }, [load]);

  function toggleService(serviceId: string) {
    setDraft((current) => ({ ...current, requiredForServices: current.requiredForServices.includes(serviceId) ? current.requiredForServices.filter((id) => id !== serviceId) : [...current.requiredForServices, serviceId] }));
  }

  async function createVersion() {
    if (!salon?.id || !template) return;
    setSaving(true);
    setVersionError("");
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/consent-templates/${template.id}/versions`, {
        body: JSON.stringify({ active: draft.active, body: draft.body.trim(), name: draft.name.trim(), required_for_services: draft.requiredForServices, type: draft.type }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => undefined) as { error?: string } | undefined;
        setVersionError(body?.error === "CONSENT_TEMPLATE_VERSION_CONFLICT" ? "Versione creata in parallelo. Ricarica la pagina e riprova." : "Nuova versione non salvata. Controlla i campi e riprova.");
        return;
      }
      const created = await response.json() as ConsentTemplate;
      router.push(`/settings/documents/${created.id}`);
    } catch {
      setVersionError("Nuova versione non salvata. Controlla la connessione e riprova.");
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!salon?.id || !template) return;
    setArchiving(true);
    setArchiveError("");
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/consent-templates/${template.id}/archive`, {
        body: JSON.stringify({}),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });
      if (!response.ok) {
        setArchiveError("Documento non archiviato. Riprova.");
        return;
      }
      setTemplate(await response.json() as ConsentTemplate);
      setArchiveOpen(false);
    } catch {
      setArchiveError("Documento non archiviato. Controlla la connessione e riprova.");
    } finally {
      setArchiving(false);
    }
  }

  if (loading) return <PageSkeleton />;

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <Breadcrumbs items={[{ href: "/settings/documents", label: "Documenti e consensi" }, { label: template?.name ?? "Versione" }]} />
      {error && <div className="mb-5"><InlineError>{error}</InlineError></div>}
      {!template ? <EmptyState description="Potrebbe essere stato rimosso o non essere accessibile." title="Documento non trovato" /> : <>
        <PageHeader eyebrow={`${template.type} · versione ${template.version}`} meta={<StatusBadge status={template.active ? "active" : "archived"}>{template.active ? "Attivo" : "Archiviato"}</StatusBadge>} subtitle="Il testo di questa versione resta immutabile per preservare le firme già raccolte." title={template.name} />
        <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <SectionCard subtitle="Questa è la versione canonica conservata dal server." title="Testo registrato">
            <article className="max-h-[620px] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-stone-50 p-5 text-sm leading-7 text-stone-700">{template.body}</article>
            {template.active && <Button className="mt-5" onClick={() => { setArchiveError(""); setArchiveOpen(true); }} variant="destructive">Archivia questa versione</Button>}
          </SectionCard>
          <SectionCard subtitle="Il testo firmato in precedenza non cambia: verrà creato un nuovo record con il numero successivo." title="Crea nuova versione">
            <div className="grid gap-4">
              <FormField label="Nome"><input onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} value={draft.name} /></FormField>
              <FormField label="Tipo"><select onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))} value={draft.type}><option value="privacy">Privacy</option><option value="treatment">Trattamento</option><option value="anamnesis">Anamnesi</option><option value="photo_release">Uso immagini</option></select></FormField>
              <FormField label="Nuovo testo"><textarea onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} rows={14} value={draft.body} /></FormField>
              {services.length > 0 && <fieldset><legend className="text-sm font-bold text-stone-700">Obbligatorio per i servizi</legend><div className="mt-3 grid gap-2 sm:grid-cols-2">{services.map((service) => <label className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 text-sm font-semibold" key={service.id}><input checked={draft.requiredForServices.includes(service.id)} onChange={() => toggleService(service.id)} type="checkbox" />{service.name}</label>)}</div></fieldset>}
              <label className="flex items-center justify-between rounded-2xl bg-stone-50 p-4 text-sm font-bold"><span>Nuova versione attiva</span><Switch checked={draft.active} onCheckedChange={(active: boolean) => setDraft((current) => ({ ...current, active }))} /></label>
              {versionError && <InlineError>{versionError}</InlineError>}
              <Button disabled={saving || !draft.name.trim() || !draft.body.trim()} onClick={() => void createVersion()} variant="primary">{saving ? "Creazione…" : "Crea nuova versione"}</Button>
            </div>
          </SectionCard>
        </div>
      </>}
      <Dialog footer={<><Button disabled={archiving} onClick={() => setArchiveOpen(false)} variant="outline">Annulla</Button><Button disabled={archiving} onClick={() => void archive()} variant="destructive">{archiving ? "Archiviazione…" : "Archivia"}</Button></>} onClose={() => { if (!archiving) setArchiveOpen(false); }} open={archiveOpen} title="Archiviare questa versione?">
        <p className="text-sm leading-6 text-stone-600">Non sarà più disponibile per nuove richieste. Le firme e le evidenze esistenti restano conservate.</p>
        {archiveError && <InlineError className="mt-4">{archiveError}</InlineError>}
      </Dialog>
    </AppPage>
  );
}
