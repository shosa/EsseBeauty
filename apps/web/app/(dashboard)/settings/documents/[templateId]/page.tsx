"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, FilePlus2, FileText } from "lucide-react";

import { AppPage, Breadcrumbs, Button, Dialog, EmptyState, FormField, InlineError, PageHeader, PageSkeleton, SaveActionButton, SectionCard, Switch, Select} from "@esse-beauty/ui";
import { MODULE_KEYS, useModuleEnabled } from "@esse-beauty/feature-flags";

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

interface Service { active?: boolean; category?: string | null; id: string; name: string }

export default function DocumentVersionPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const router = useRouter();
  const { salon } = useAuth();
  const documentsEnabled = useModuleEnabled(MODULE_KEYS.DOCUMENTS);
  const [template, setTemplate] = useState<ConsentTemplate>();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [versionError, setVersionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [draft, setDraft] = useState({ active: true, body: "", name: "", requiredForServices: [] as string[], type: "privacy" });

  const load = useCallback(async () => {
    if (!salon?.id) return;
    if (!documentsEnabled) { setLoading(false); return; }
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
  }, [salon?.id, templateId, documentsEnabled]);

  useEffect(() => { void load(); }, [load]);

  const serviceGroups = useMemo(() => {
    const groups: [string, Service[]][] = [];
    for (const service of services) {
      const category = service.category?.trim() || "Senza categoria";
      const group = groups.find(([name]) => name === category);
      if (group) group[1].push(service);
      else groups.push([category, [service]]);
    }
    return groups;
  }, [services]);

  function toggleService(serviceId: string) {
    setDraft((current) => ({ ...current, requiredForServices: current.requiredForServices.includes(serviceId) ? current.requiredForServices.filter((id) => id !== serviceId) : [...current.requiredForServices, serviceId] }));
  }

  async function createVersion() {
    if (!salon?.id || !template) return;
    setSaving(true);
    setSaved(false);
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
      setSaved(true);
      window.setTimeout(() => router.push(`/settings/documents/${created.id}`), 550);
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

  if (!documentsEnabled) {
    return (
      <AppPage maxWidth="max-w-[1600px]">
        <Breadcrumbs items={[{ href: "/settings/documents", label: "Documenti e consensi" }, { label: "Versione" }]} />
        <EmptyState
          action={<Link className="font-bold text-[var(--esse-mulberry,#543147)]" href="/apps">Vai a App e moduli</Link>}
          description="Attiva il modulo Documenti dalla pagina App e moduli per gestire le versioni di questo modello."
          title="Modulo Documenti non attivo"
        />
      </AppPage>
    );
  }

  if (loading) return <PageSkeleton />;

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <Breadcrumbs items={[{ href: "/settings/documents", label: "Documenti e consensi" }, { label: template?.name ?? "Versione" }]} />
      {error && <div className="mb-5"><InlineError>{error}</InlineError></div>}
      {!template ? <EmptyState description="Potrebbe essere stato rimosso o non essere accessibile." title="Documento non trovato" /> : <>
        <PageHeader eyebrow={`${template.type} · versione ${template.version}`} subtitle="Il testo di questa versione resta immutabile per preservare le firme già raccolte." title={template.name} />
        <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <SectionCard icon={FileText} subtitle="Questa è la versione canonica conservata dal server." title="Testo registrato">
            <article className="max-h-[620px] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-stone-50 p-5 text-sm leading-7 text-stone-700">{template.body}</article>
            {template.active && <Button className="mt-5" onClick={() => { setArchiveError(""); setArchiveOpen(true); }} variant="destructive">Archivia questa versione</Button>}
          </SectionCard>
          <SectionCard icon={FilePlus2} subtitle="Il testo firmato in precedenza non cambia: verrà creato un nuovo record con il numero successivo." title="Crea nuova versione">
            <div className="grid gap-4">
              <FormField label="Nome"><input className="w-full" onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} value={draft.name} /></FormField>
              <FormField label="Tipo"><Select className="w-full" onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))} value={draft.type}><option value="privacy">Privacy</option><option value="treatment">Trattamento</option><option value="anamnesis">Anamnesi</option><option value="photo_release">Uso immagini</option></Select></FormField>
              <FormField label="Nuovo testo"><textarea className="w-full resize-y" onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} rows={14} value={draft.body} /></FormField>
              {services.length > 0 && <fieldset><legend className="text-sm font-bold text-stone-700">Obbligatorio per i servizi</legend><div className="mt-3 space-y-2">{serviceGroups.map(([category, groupServices]) => { const selectedCount = groupServices.filter((service) => draft.requiredForServices.includes(service.id)).length; return (
                <details className="group rounded-xl border border-stone-200" key={category}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-bold uppercase tracking-[.08em] text-stone-500 marker:content-none">
                    <span className="flex items-center gap-2"><ChevronRight aria-hidden="true" className="size-3.5 text-stone-400 transition-transform group-open:rotate-90" />{category}</span>
                    {selectedCount > 0 && <span className="rounded-full bg-[var(--esse-petal,#f2e1eb)] px-2 py-0.5 text-[11px] font-bold text-[var(--esse-mulberry,#543147)]">{selectedCount}</span>}
                  </summary>
                  <div className="grid gap-2 border-t border-stone-100 p-3 sm:grid-cols-2">{groupServices.map((service) => <label className="flex items-center justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2 text-sm font-semibold" key={service.id}><span>{service.name}</span><Switch checked={draft.requiredForServices.includes(service.id)} onCheckedChange={() => toggleService(service.id)} /></label>)}</div>
                </details>
              ); })}</div></fieldset>}
              <label className="flex min-h-12 items-center justify-between rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm font-semibold"><span>Nuova versione attiva</span><Switch aria-label="Attiva la nuova versione" checked={draft.active} onCheckedChange={(active: boolean) => setDraft((current) => ({ ...current, active }))} /></label>
              {versionError && <InlineError>{versionError}</InlineError>}
              <SaveActionButton busy={saving} disabled={!draft.name.trim() || !draft.body.trim()} idleLabel="Crea nuova versione" onClick={() => void createVersion()} saved={saved} />
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
