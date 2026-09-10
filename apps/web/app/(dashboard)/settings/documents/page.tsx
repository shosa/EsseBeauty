"use client";

import { Archive, ChevronDown, FileSignature, Link2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  Select,
  StatusBadge,
  Switch,
} from "@esse-beauty/ui";
import { MODULE_KEYS, useModuleEnabled } from "@esse-beauty/feature-flags";

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
  category: string;
  categoryId?: string | null;
  id: string;
  name: string;
}

interface ServiceCategory {
  active: boolean;
  id: string;
  name: string;
}

const documentTypes = [
  { label: "Privacy", value: "privacy" },
  { label: "Trattamento", value: "treatment" },
  { label: "Anamnesi", value: "anamnesis" },
  { label: "Uso immagini", value: "photo_release" },
];

const documentTypeLabel = new Map(documentTypes.map((type) => [type.value, type.label]));
const dateFormatter = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" });

export default function DocumentsSettingsPage() {
  const { salon } = useAuth();
  const documentsEnabled = useModuleEnabled(MODULE_KEYS.DOCUMENTS);
  const [items, setItems] = useState<ConsentTemplate[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [openCategoryIds, setOpenCategoryIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: "error" | "success" }>();
  const [form, setForm] = useState({ active: true, body: "", name: "", requiredForServices: [] as string[], type: "privacy" });

  const load = useCallback(async () => {
    if (!salon?.id || !documentsEnabled) return;
    try {
      const [templateResponse, serviceResponse, categoryResponse] = await Promise.all([
        fetch(`${api}/api/salons/${salon.id}/consent-templates`, { credentials: "include" }),
        fetch(`${api}/api/salons/${salon.id}/services`, { credentials: "include" }),
        fetch(`${api}/api/salons/${salon.id}/service-categories`, { credentials: "include" }),
      ]);
      if (!templateResponse.ok) throw new Error("Documenti non disponibili.");
      setItems(await templateResponse.json() as ConsentTemplate[]);
      const nextServices = serviceResponse.ok ? (await serviceResponse.json() as Service[]).filter((service) => service.active !== false) : [];
      setServices(nextServices);
      const nextCategories = categoryResponse.ok ? (await categoryResponse.json() as ServiceCategory[]).filter((category) => category.active !== false) : [];
      setCategories(nextCategories);
      setOpenCategoryIds((current) => current);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Documenti non disponibili.");
    }
  }, [salon?.id, documentsEnabled]);

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

  function toggleCategory(categoryId: string) {
    setOpenCategoryIds((current) => current.includes(categoryId) ? current.filter((id) => id !== categoryId) : [...current, categoryId]);
  }

  const serviceGroups = useMemo(() => {
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const groups = categories.map((category) => ({
      id: category.id,
      name: category.name,
      services: services.filter((service) => service.categoryId === category.id),
    })).filter((group) => group.services.length > 0);
    const uncategorized = services.filter((service) => !service.categoryId || !categoryById.has(service.categoryId));
    return uncategorized.length > 0 ? [...groups, { id: "uncategorized", name: "Senza categoria", services: uncategorized }] : groups;
  }, [categories, services]);

  if (!documentsEnabled) {
    return (
      <AppPage maxWidth="max-w-[1600px]">
        <PageHeader eyebrow="Moduli" subtitle="Modelli versionati, richieste di firma ed evidenze verificabili per ogni cliente." title="Documenti e consensi" />
        <EmptyState
          action={<Link className="font-bold text-[#792f59]" href="/apps">Vai a App e moduli</Link>}
          description="Attiva il modulo Documenti dalla pagina App e moduli per creare modelli di consenso e raccogliere firme."
          title="Modulo Documenti non attivo"
        />
      </AppPage>
    );
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageHeader eyebrow="Moduli" subtitle="Modelli versionati, richieste di firma ed evidenze verificabili per ogni cliente." title="Documenti e consensi" />
      {error && <InlineError className="mb-5">{error}</InlineError>}
      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard className="xl:order-2" icon={Archive} subtitle="Apri una versione per consultarne il testo, crearne una nuova o archiviarla." title="Archivio documenti">
          {items.length === 0 ? (
            <EmptyState description="Crea il primo modello di consenso per attivare il flusso." title="Nessun documento" />
          ) : (
            <div aria-label="Archivio documenti" className="space-y-2.5" role="list">
              {items.map((item) => (
                <article className="esse-panel rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm" key={item.id} role="listitem">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${item.active ? "bg-[#faf3f7] text-[#792f59]" : "bg-stone-100 text-stone-500"}`}>
                      {item.active ? <FileSignature aria-hidden="true" className="size-4" /> : <Archive aria-hidden="true" className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold text-stone-950">{item.name}</h3>
                          <p className="mt-0.5 text-xs font-semibold text-stone-500">{documentTypeLabel.get(item.type) ?? item.type} · v{item.version}</p>
                        </div>
                        <StatusBadge status={item.active ? "active" : "archived"}>{item.active ? "Attivo" : "Archiviato"}</StatusBadge>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-5 text-stone-600">{item.body}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-stone-500">
                        <span>{(item.requiredForServices?.length ?? 0) > 0 ? `${item.requiredForServices?.length} servizi` : "Nessun servizio automatico"}</span>
                        {item.createdAt && <span>{dateFormatter.format(new Date(item.createdAt))}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap justify-end gap-2 pl-11 text-sm font-semibold">
                    <Link className="inline-flex min-h-10 items-center rounded-lg px-3 py-2 text-[#6f3556] transition hover:bg-[#faf3f7] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20" href={`/settings/documents/${item.id}`}>Apri versione</Link>
                    {item.active && <Link className="inline-flex min-h-10 items-center rounded-lg px-3 py-2 text-stone-700 transition hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20" href={`/settings/documents/${item.id}`}>Crea nuova versione</Link>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          className="xl:order-1"
          actions={<span className="inline-flex items-center gap-2 rounded-full bg-[#faf3f7] px-3 py-1.5 text-xs font-bold text-[#792f59]"><FileSignature aria-hidden="true" className="size-4" />Versione iniziale</span>}
          icon={FileSignature}
          subtitle="Prepara il testo iniziale, scegli quando attivarlo e collegalo solo ai servizi che lo richiedono."
          title="Nuovo modello"
        >
          <div className="grid gap-4">
            <div className="grid gap-4">
              <FormField label="Nome documento" required>
                <input
                  className="w-full"
                  onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))}
                  placeholder="Consenso trattamento viso"
                  value={form.name}
                />
              </FormField>
              <FormField label="Tipo">
                <Select className="w-full" onChange={(event) => setForm((value) => ({ ...value, type: event.target.value }))} value={form.type}>
                  {documentTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </Select>
              </FormField>
            </div>

            <FormField
              description="Le versioni già firmate restano immutabili; le modifiche future partiranno da una nuova versione."
              label="Testo da firmare"
              required
            >
              <textarea
                className="min-h-[180px] w-full"
                onChange={(event) => setForm((value) => ({ ...value, body: event.target.value }))}
                placeholder="Scrivi il testo che il cliente dovrà accettare o firmare."
                rows={7}
                value={form.body}
              />
            </FormField>

            {serviceGroups.length > 0 && (
              <fieldset className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
                <legend className="sr-only">Obbligatorio per i servizi</legend>
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-[#792f59] shadow-sm">
                    <Link2 aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-stone-900">Obbligatorio per i servizi</p>
                    <p className="mt-1 text-xs leading-5 text-stone-500">Lascia tutto spento per un modello non associato automaticamente.</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {serviceGroups.map((group) => {
                    const open = openCategoryIds.includes(group.id);
                    const selectedCount = group.services.filter((service) => form.requiredForServices.includes(service.id)).length;
                    return (
                      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white" key={group.id}>
                        <button
                          aria-expanded={open}
                          className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-[#fffafd] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20"
                          onClick={() => toggleCategory(group.id)}
                          type="button"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-stone-900">{group.name}</span>
                            <span className="mt-0.5 block text-xs font-medium text-stone-500">{selectedCount > 0 ? `${selectedCount} selezionati su ${group.services.length}` : `${group.services.length} servizi`}</span>
                          </span>
                          <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-stone-400 transition-transform ${open ? "rotate-180 text-[#792f59]" : ""}`} />
                        </button>
                        {open && (
                          <div className="space-y-1 border-t border-stone-100 bg-stone-50/60 p-2">
                            {group.services.map((service) => {
                              const selected = form.requiredForServices.includes(service.id);
                              return (
                                <label
                                  className={`flex min-h-11 items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2 text-sm font-semibold transition-colors ${selected ? "border-[#792f59]/55 text-stone-950" : "border-transparent text-stone-700"}`}
                                  key={service.id}
                                >
                                  <span className="min-w-0 truncate">{service.name}</span>
                                  <Switch aria-label={`Richiedi ${form.name || "questo documento"} per ${service.name}`} checked={selected} onCheckedChange={() => toggleService(service.id)} />
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <div className="grid gap-3 border-t border-stone-100 pt-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm font-semibold text-stone-800">
                <span>
                  <span className="block">Attivo subito</span>
                  <span className="mt-0.5 block text-xs font-medium text-stone-500">Disponibile appena salvato per nuove richieste.</span>
                </span>
                <Switch aria-label="Attiva subito il modello" checked={form.active} onCheckedChange={(active: boolean) => setForm((value) => ({ ...value, active }))} />
              </label>
              <SaveActionButton busy={saving} disabled={!form.name.trim() || !form.body.trim()} idleLabel="Salva modello" onClick={() => void save()} saved={saved} />
            </div>
            {formError && <InlineError>{formError}</InlineError>}
          </div>
        </SectionCard>
      </div>
      <SaveToast variant={toast?.variant} visible={Boolean(toast)}>{toast?.message ?? ""}</SaveToast>
    </AppPage>
  );
}
