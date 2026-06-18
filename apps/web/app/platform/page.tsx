"use client";

import { type ComponentType, type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { MODULE_KEYS, type ModuleKey } from "@esse-beauty/feature-flags";
import {
  AppPage,
  Button,
  FormField,
  InlineError,
  PageHeader,
  SaveToast,
  SectionCard,
  StatusBadge,
  Switch,
} from "@esse-beauty/ui";

import {
  InventoryIcon,
  LoyaltyIcon,
  MarketingIcon,
  RemindersIcon,
  ReportsIcon,
  ReviewsIcon,
  ServicesIcon,
  WaitlistIcon,
} from "../(dashboard)/_components/Icons";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
const adminPrimaryButton = "!border-teal-950 !bg-[linear-gradient(135deg,#083344_0%,#0f766e_58%,#06b6d4_100%)] !shadow-[0_16px_36px_rgb(8_145_178_/_0.22)] hover:!shadow-[0_20px_44px_rgb(8_145_178_/_0.3)]";
const adminOutlineButton = "!border-teal-200 !text-teal-800 hover:!border-teal-600 hover:!bg-cyan-50 hover:!text-teal-950";

const featureCatalog: Array<{ description: string; key: ModuleKey; name: string }> = [
  { key: MODULE_KEYS.REMINDERS, name: "Promemoria", description: "Avvisi automatici prima degli appuntamenti." },
  { key: MODULE_KEYS.REVIEWS, name: "Recensioni", description: "Raccolta feedback e risposte ai clienti." },
  { key: MODULE_KEYS.WAITLIST, name: "Lista d'attesa", description: "Richieste quando non ci sono orari liberi." },
  { key: MODULE_KEYS.LOYALTY, name: "Fedeltà", description: "Punti, premi e vantaggi per i clienti." },
  { key: MODULE_KEYS.MARKETING, name: "Comunicazioni", description: "Messaggi mirati a gruppi di clienti." },
  { key: MODULE_KEYS.INVENTORY, name: "Magazzino", description: "Prodotti, scorte e movimenti." },
  { key: MODULE_KEYS.STAFF_PERF, name: "Risultati team", description: "Andamento del lavoro e dei servizi." },
  { key: MODULE_KEYS.DOCUMENTS, name: "Documenti e consensi", description: "Consensi informati e privacy collegati a clienti e appuntamenti." },
  { key: MODULE_KEYS.PACKAGES, name: "Pacchetti servizi", description: "Conteggio sedute incluse, utilizzate e residue." },
  { key: MODULE_KEYS.MULTI_LOCATION, name: "Multi-sede", description: "Sedi, risorse, stanze e attrezzature per calendario avanzato." },
  { key: MODULE_KEYS.AUDIT_COMPLIANCE, name: "Audit e compliance", description: "Registro azioni sensibili consultabile dal titolare." },
];

const moduleIcons: Record<ModuleKey, ComponentType<{ className?: string }>> = {
  [MODULE_KEYS.INVENTORY]: InventoryIcon,
  [MODULE_KEYS.LOYALTY]: LoyaltyIcon,
  [MODULE_KEYS.MARKETING]: MarketingIcon,
  [MODULE_KEYS.REMINDERS]: RemindersIcon,
  [MODULE_KEYS.REVIEWS]: ReviewsIcon,
  [MODULE_KEYS.STAFF_PERF]: ReportsIcon,
  [MODULE_KEYS.WAITLIST]: WaitlistIcon,
  [MODULE_KEYS.DOCUMENTS]: ReviewsIcon,
  [MODULE_KEYS.PACKAGES]: ServicesIcon,
  [MODULE_KEYS.MULTI_LOCATION]: InventoryIcon,
  [MODULE_KEYS.AUDIT_COMPLIANCE]: ReportsIcon,
};

type FeatureState = Record<ModuleKey, boolean>;
type Panel = "identity" | "access" | "features" | "new";

interface PlatformSession {
  admin: {
    email: string;
    full_name: string;
    id: string;
  };
}

interface PlatformSalon {
  active: boolean;
  id: string;
  locale: string;
  modules_enabled: number;
  name: string;
  onboarding_completed: boolean;
  onboarding_step: number;
  plan_id: string | null;
  slug: string;
  timezone: string;
}

interface SalonOwner {
  active: boolean;
  created_at: string;
  email: string;
  full_name: string;
  id: string;
  last_login: string | null;
  must_change_password: boolean;
  role: "owner";
}

function emptyFeatureState(): FeatureState {
  return Object.fromEntries(
    featureCatalog.map((item) => [item.key, false]),
  ) as FeatureState;
}

function publicAddress(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function friendlyError(value: string): string {
  const dictionary: Record<string, string> = {
    BOOTSTRAP_ALREADY_COMPLETED: "Il primo accesso è già stato configurato.",
    INVALID_CREDENTIALS: "Email o password non corretti.",
    NAME_REQUIRED: "Inserisci il nome del salone.",
    OWNER_REQUIRED: "Inserisci nome ed email del titolare.",
    OWNER_NOT_FOUND: "Il titolare del salone non è disponibile.",
    PASSWORD_TOO_SHORT: "La password deve avere almeno 10 caratteri.",
    SALON_NOT_FOUND: "Il salone selezionato non è più disponibile.",
    UNAUTHENTICATED: "Sessione scaduta. Accedi di nuovo.",
  };
  return dictionary[value] ?? "Operazione non riuscita. Controlla i dati e riprova.";
}

export default function PlatformPage() {
  const [bootstrapRequired, setBootstrapRequired] = useState(false);
  const [error, setError] = useState("");
  const [features, setFeatures] = useState<FeatureState>(emptyFeatureState);
  const [featuresLoadedFor, setFeaturesLoadedFor] = useState("");
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<Panel>("identity");
  const [pendingFeature, setPendingFeature] = useState<ModuleKey>();
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState<SalonOwner | null>(null);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [salons, setSalons] = useState<PlatformSalon[]>([]);
  const [selectedSalonId, setSelectedSalonId] = useState("");
  const [session, setSession] = useState<PlatformSession | null>(null);
  const [success, setSuccess] = useState("");

  const selectedSalon = useMemo(
    () => salons.find((salon) => salon.id === selectedSalonId),
    [salons, selectedSalonId],
  );
  const filteredSalons = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? salons.filter((salon) =>
          `${salon.name} ${salon.slug}`.toLowerCase().includes(needle),
        )
      : salons;
  }, [query, salons]);
  const activeSalons = salons.filter((salon) => salon.active).length;
  const pendingOnboarding = salons.filter((salon) => !salon.onboarding_completed).length;
  const enabledFeatures = Object.values(features).filter(Boolean).length;

  const request = useCallback(async <T,>(
    path: string,
    init?: RequestInit,
  ): Promise<T> => {
    const response = await fetch(`${api}${path}`, {
      credentials: "include",
      headers: { "content-type": "application/json", ...init?.headers },
      ...init,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        friendlyError(typeof body.error === "string" ? body.error : "REQUEST_FAILED"),
      );
    }
    return (await response.json()) as T;
  }, []);

  const loadSalons = useCallback(async () => {
    const rows = await request<PlatformSalon[]>("/api/platform/salons");
    setSalons(rows);
  }, [request]);

  const loadFeatures = useCallback(async (salonId: string) => {
    const rows = await request<Array<{ enabled: boolean; module_key: ModuleKey }>>(
      `/api/platform/salons/${salonId}/modules`,
    );
    const next = emptyFeatureState();
    for (const row of rows) {
      next[row.module_key] = row.enabled;
    }
    setFeatures(next);
    setFeaturesLoadedFor(salonId);
  }, [request]);

  const loadOwner = useCallback(async (salonId: string) => {
    setOwnerLoading(true);
    try {
      setOwner(await request<SalonOwner>(`/api/platform/salons/${salonId}/owner-access`));
    } finally {
      setOwnerLoading(false);
    }
  }, [request]);

  useEffect(() => {
    async function boot() {
      try {
        const current = await request<PlatformSession>("/api/platform/auth/me");
        setSession(current);
        await loadSalons();
      } catch {
        const status = await request<{ required: boolean }>("/api/platform/auth/bootstrap/status");
        setBootstrapRequired(status.required);
      } finally {
        setLoading(false);
      }
    }
    void boot();
  }, [loadSalons, request]);

  useEffect(() => {
    if (panel === "features" && selectedSalon?.id && featuresLoadedFor !== selectedSalon.id) {
      void loadFeatures(selectedSalon.id).catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Impossibile caricare i moduli."),
      );
    }
  }, [featuresLoadedFor, loadFeatures, panel, selectedSalon?.id]);

  useEffect(() => {
    if (panel === "access" && selectedSalon?.id) {
      void loadOwner(selectedSalon.id).catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Anagrafica titolare non disponibile."),
      );
    }
  }, [loadOwner, panel, selectedSalon?.id]);

  useEffect(() => {
    if (!success) return;
    const timeout = window.setTimeout(() => setSuccess(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [success]);

  function selectSalon(salonId: string) {
    setSelectedSalonId(salonId);
    setOwner(null);
    setError("");
    setSuccess("");
    setPanel("identity");
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const form = new FormData(event.currentTarget);
    try {
      const endpoint = bootstrapRequired ? "bootstrap" : "login";
      const payload = bootstrapRequired
        ? {
            email: String(form.get("email")),
            full_name: String(form.get("full_name")),
            password: String(form.get("password")),
          }
        : {
            email: String(form.get("email")),
            password: String(form.get("password")),
          };
      await request(`/api/platform/auth/${endpoint}`, {
        body: JSON.stringify(payload),
        method: "POST",
      });
      const current = await request<PlatformSession>("/api/platform/auth/me");
      setSession(current);
      await loadSalons();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Accesso non riuscito.");
    }
  }

  async function createSalon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name"));
    const ownerEmail = String(form.get("owner_email"));
    const ownerName = String(form.get("owner_full_name"));
    const ownerPassword = String(form.get("owner_password"));
    try {
      const created = await request<PlatformSalon>("/api/platform/salons", {
        body: JSON.stringify({
          active: true,
          locale: String(form.get("locale") || "it-IT"),
          name,
          owner: {
            email: ownerEmail,
            full_name: ownerName,
            password: ownerPassword,
          },
          slug: String(form.get("public_address") || publicAddress(name)),
          timezone: String(form.get("timezone") || "Europe/Rome"),
        }),
        method: "POST",
      });
      event.currentTarget.reset();
      setSelectedSalonId(created.id);
      setPanel("features");
      setSuccess("Salone creato. Ora scegli i moduli da includere.");
      await loadSalons();
      await loadFeatures(created.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Creazione salone non riuscita.");
    }
  }

  async function saveSalon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSalon) return;
    setError("");
    setSuccess("");
    const form = new FormData(event.currentTarget);
    try {
      await request(`/api/platform/salons/${selectedSalon.id}`, {
        body: JSON.stringify({
          active: form.get("active") === "on",
          locale: String(form.get("locale")),
          name: String(form.get("name")),
          plan_id: String(form.get("plan_name") || "").trim() || null,
          slug: String(form.get("public_address")),
          timezone: String(form.get("timezone")),
        }),
        method: "PATCH",
      });
      setSuccess("Configurazione salvata.");
      await loadSalons();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Salvataggio non riuscito.");
    }
  }

  async function toggleFeature(featureKey: ModuleKey, enabled: boolean) {
    if (!selectedSalon) return;
    setPendingFeature(featureKey);
    setError("");
    setSuccess("");
    try {
      await request(`/api/platform/salons/${selectedSalon.id}/modules/${featureKey}`, {
        body: JSON.stringify({ enabled }),
        method: "PATCH",
      });
      setFeatures((current) => ({ ...current, [featureKey]: enabled }));
      setSuccess("Moduli del salone aggiornati.");
      await loadSalons();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Modulo non aggiornato.");
    } finally {
      setPendingFeature(undefined);
    }
  }

  async function saveOwnerProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSalon || !owner) return;
    setError("");
    setSuccess("");
    const form = new FormData(event.currentTarget);
    try {
      const updated = await request<SalonOwner>(`/api/platform/salons/${selectedSalon.id}/owner-access`, {
        body: JSON.stringify({
          email: String(form.get("owner_email")),
          full_name: String(form.get("owner_full_name")),
          active: form.get("owner_active") === "on",
        }),
        method: "PATCH",
      });
      setOwner((current) => current ? { ...current, ...updated } : current);
      setSuccess("Anagrafica titolare aggiornata.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Anagrafica titolare non aggiornata.");
    }
  }

  async function resetOwnerPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSalon) return;
    setError("");
    setSuccess("");
    const form = new FormData(event.currentTarget);
    try {
      await request(`/api/platform/salons/${selectedSalon.id}/owner-access/reset-password`, {
        body: JSON.stringify({ password: String(form.get("owner_password")) }),
        method: "POST",
      });
      event.currentTarget.reset();
      setOwner((current) => current ? { ...current, must_change_password: true } : current);
      setSuccess("Password reimpostata. Le sessioni del titolare sono state chiuse.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Password non reimpostata.");
    }
  }

  function closeSalonCard() {
    setSelectedSalonId("");
    setFeatures(emptyFeatureState());
    setFeaturesLoadedFor("");
    setOwner(null);
    setPanel("identity");
    setError("");
    setSuccess("");
  }

  if (loading) {
    return (
      <AppPage>
        <SectionCard>Preparazione area di gestione...</SectionCard>
      </AppPage>
    );
  }

  if (!session) {
    return (
      <AppPage className="platform-admin" maxWidth="max-w-xl">
        <PageHeader
          eyebrow="Area centrale"
          title={bootstrapRequired ? "Crea il primo amministratore" : "Accedi alla gestione centrale"}
          subtitle={bootstrapRequired ? "Configura l'accesso principale per gestire saloni e licenze." : "Accesso riservato alla gestione dei saloni."}
        />
        {error && <InlineError className="mb-5">{error}</InlineError>}
        <SectionCard>
          <form className="space-y-4" onSubmit={submitAuth}>
            {bootstrapRequired && (
              <FormField label="Nome amministratore" required>
                <input name="full_name" required />
              </FormField>
            )}
            <FormField label="Email" required>
              <input name="email" required type="email" />
            </FormField>
            <FormField label="Password" required description="Almeno 10 caratteri.">
              <input name="password" required type="password" />
            </FormField>
            <Button className={`w-full ${adminPrimaryButton}`} type="submit" variant="primary">
              {bootstrapRequired ? "Crea accesso" : "Entra"}
            </Button>
          </form>
        </SectionCard>
      </AppPage>
    );
  }

  return (
    <AppPage className="platform-admin" maxWidth="max-w-7xl">
      <PageHeader
        actions={<Button className={adminOutlineButton} onClick={() => void request("/api/platform/auth/logout", { method: "POST" }).then(() => setSession(null))} variant="outline">Esci</Button>}
        eyebrow="Amministrazione EsseBeauty"
        title="Saloni e accessi"
        subtitle="Apri saloni, controlla il primo avvio, gestisci licenza, credenziali del titolare e moduli abilitati."
        status={<span className="text-sm font-semibold text-stone-500">{session.admin.full_name}</span>}
      />
      <SaveToast variant="success" visible={Boolean(success)}>{success}</SaveToast>
      {error && <InlineError className="mb-5">{error}</InlineError>}

      <div className="mb-6 flex flex-wrap gap-3">
        <span className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-bold text-stone-700">{salons.length} saloni</span>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800">{activeSalons} operativi</span>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-900">{pendingOnboarding} da configurare</span>
      </div>

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside>
          <section className="sticky top-6 overflow-hidden rounded-2xl border border-[#e8dfe4] bg-white shadow-[0_10px_30px_rgb(45_29_39_/_0.055)]">
            <div className="border-b border-stone-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                  <h2 className="font-bold text-stone-950">Saloni</h2>
                  <p className="text-xs text-stone-500">Seleziona una sede da amministrare.</p>
              </div>
                <Button className={adminPrimaryButton} onClick={() => { setSelectedSalonId(""); setPanel("new"); }} size="sm" variant="primary">Nuovo salone</Button>
            </div>
            <input
              className="mt-4 min-h-11 w-full rounded-xl border border-stone-200 px-3 text-sm"
              onChange={(event) => setQuery(event.target.value)}
                aria-label="Cerca salone"
              value={query}
            />
            </div>
            <div className="max-h-[calc(100vh-290px)] overflow-y-auto p-2">
              {filteredSalons.length === 0 && <p className="p-4 text-sm text-stone-500">Nessun salone trovato.</p>}
              {filteredSalons.map((salon) => (
                <button
                  className={`mb-1 w-full rounded-xl border p-3 text-left transition ${salon.id === selectedSalonId ? "border-cyan-500 bg-cyan-50 shadow-sm" : "border-transparent hover:border-stone-200 hover:bg-stone-50"}`}
                  key={salon.id}
                  onClick={() => selectSalon(salon.id)}
                  type="button"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <b className="block truncate text-sm text-stone-950">{salon.name}</b>
                      <span className="block truncate text-xs text-stone-500">/{salon.slug} · {salon.plan_id || "Nessun piano"}</span>
                    </span>
                    <span className={`mt-1 size-2.5 shrink-0 rounded-full ${salon.active ? "bg-emerald-500" : "bg-stone-300"}`} />
                  </span>
                  <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${salon.onboarding_completed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                    {salon.onboarding_completed ? "Configurato" : `Primo avvio · step ${salon.onboarding_step}`}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <main className="space-y-5">
          {selectedSalon && panel !== "new" && (
            <section className="overflow-hidden rounded-2xl border border-[#e8dfe4] bg-white shadow-[0_10px_30px_rgb(45_29_39_/_0.055)]">
              <div className="flex flex-wrap items-start justify-between gap-4 p-5 md:p-6">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.18em] text-teal-700">{selectedSalon.plan_id || "Piano non assegnato"}</p>
                  <h2 className="mt-1 text-2xl font-bold text-stone-950">{selectedSalon.name}</h2>
                  <p className="mt-1 text-sm text-stone-500">/{selectedSalon.slug} · {selectedSalon.timezone}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <StatusBadge status={selectedSalon.onboarding_completed ? "active" : "pending"}>
                    {selectedSalon.onboarding_completed ? "Onboarding completato" : `Onboarding step ${selectedSalon.onboarding_step}`}
                  </StatusBadge>
                  <StatusBadge status={selectedSalon.active ? "active" : "inactive"}>{selectedSalon.active ? "Operativo" : "Sospeso"}</StatusBadge>
                  <button
                    aria-label="Chiudi scheda salone"
                    className="grid size-10 place-items-center rounded-full border border-stone-200 text-xl font-semibold text-stone-500 transition hover:border-teal-600 hover:bg-cyan-50 hover:text-teal-800"
                    onClick={closeSalonCard}
                    type="button"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 border-t border-stone-100 bg-stone-50/70 p-2">
                {[
                  ["Dati e licenza", "identity"],
                  ["Credenziali titolare", "access"],
                  ["Moduli", "features"],
                ].map(([label, value]) => (
                  <button
                    className={`rounded-xl px-3 py-3 text-sm font-bold transition ${panel === value ? "bg-white text-teal-800 shadow-sm ring-1 ring-cyan-200" : "text-stone-500 hover:bg-white/60 hover:text-stone-800"}`}
                    key={value}
                    onClick={() => setPanel(value as Panel)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {panel !== "new" && !selectedSalon && (
            <section className="grid min-h-[520px] place-items-center rounded-2xl border border-dashed border-cyan-300 bg-white p-8 text-center">
              <div className="grid min-h-80 place-items-center text-center">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.18em] text-teal-700">Console amministrativa</p>
                  <h2 className="mt-2 text-3xl font-bold text-stone-950">Seleziona un salone</h2>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-stone-500">
                    Da qui controlli configurazione iniziale, licenza, accesso del titolare e moduli abilitati.
                  </p>
                  <Button className={`mt-5 ${adminPrimaryButton}`} onClick={() => setPanel("new")} variant="primary">Crea un nuovo salone</Button>
                </div>
              </div>
            </section>
          )}

          {panel === "new" && (
            <SectionCard title="Nuovo salone" subtitle="Crea in un unico passaggio la sede e le credenziali iniziali del titolare. Al primo login partirà l'onboarding.">
              <form className="grid gap-5 md:grid-cols-2" onSubmit={createSalon}>
                <div className="md:col-span-2">
                  <p className="text-xs font-black uppercase tracking-[.16em] text-teal-700">Identità del salone</p>
                </div>
                <FormField label="Nome salone" required>
                  <input name="name" required />
                </FormField>
                <FormField label="Indirizzo pagina pubblica" description="Lascia vuoto per generarlo automaticamente dal nome.">
                  <input name="public_address" />
                </FormField>
                <FormField label="Fuso orario" required>
                  <input defaultValue="Europe/Rome" name="timezone" required />
                </FormField>
                <FormField label="Lingua" required>
                  <select defaultValue="it-IT" name="locale" required>
                    <option value="it-IT">Italiano</option>
                    <option value="en-GB">English</option>
                  </select>
                </FormField>
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-5 md:col-span-2">
                  <p className="mb-1 text-xs font-black uppercase tracking-[.16em] text-teal-700">Credenziali titolare</p>
                  <p className="mb-4 text-sm text-stone-500">Questi dati verranno usati per il primo login alla Web App.</p>
                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField label="Nome titolare" required>
                      <input name="owner_full_name" required />
                    </FormField>
                    <FormField label="Email titolare" required>
                      <input name="owner_email" required type="email" />
                    </FormField>
                    <FormField label="Password iniziale" description="Minimo 10 caratteri." required>
                      <input minLength={10} name="owner_password" required type="password" />
                    </FormField>
                  </div>
                </div>
                <div className="flex justify-end gap-3 md:col-span-2">
                  <Button className={adminOutlineButton} onClick={() => setPanel(selectedSalon ? "identity" : "new")} type="button" variant="outline">Annulla</Button>
                  <Button className={adminPrimaryButton} type="submit" variant="primary">Crea salone</Button>
                </div>
              </form>
            </SectionCard>
          )}

          {panel === "identity" && selectedSalon && (
            <SectionCard title="Dati salone" subtitle="Informazioni principali usate dal gestionale e dalla pagina prenotazioni.">
              <form className="grid gap-4 md:grid-cols-2" onSubmit={saveSalon}>
                <FormField label="Nome salone" required>
                  <input defaultValue={selectedSalon.name} name="name" required />
                </FormField>
                <FormField label="Pagina prenotazioni" required>
                  <input defaultValue={selectedSalon.slug} name="public_address" required />
                </FormField>
                <FormField label="Fuso orario" required>
                  <input defaultValue={selectedSalon.timezone} name="timezone" required />
                </FormField>
                <FormField label="Lingua" required>
                  <select defaultValue={selectedSalon.locale} name="locale" required>
                    <option value="it-IT">Italiano</option>
                    <option value="en-GB">English</option>
                  </select>
                </FormField>
                <FormField label="Piano commerciale" description="Nome libero della licenza o dell'accordo commerciale.">
                  <input defaultValue={selectedSalon.plan_id ?? ""} name="plan_name" />
                </FormField>
                <label className="flex items-center gap-3 rounded-2xl bg-stone-50 p-4 text-sm font-bold text-stone-800">
                  <input defaultChecked={selectedSalon.active} name="active" type="checkbox" />
                  Salone operativo
                </label>
                <div className="md:col-span-2">
                  <Button className={adminPrimaryButton} type="submit" variant="primary">Salva dati salone</Button>
                </div>
              </form>
            </SectionCard>
          )}

          {panel === "access" && selectedSalon && (
            <div className="space-y-5">
              <SectionCard title="Anagrafica titolare" subtitle="Unico account owner associato al salone.">
                {ownerLoading || !owner ? (
                  <div className="h-48 animate-pulse rounded-2xl bg-stone-100" />
                ) : (
                  <>
                    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl bg-stone-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Ruolo</p>
                        <p className="mt-1 font-bold text-stone-900">Titolare</p>
                      </div>
                      <div className="rounded-xl bg-stone-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Creato il</p>
                        <p className="mt-1 font-bold text-stone-900">{new Date(owner.created_at).toLocaleDateString("it-IT")}</p>
                      </div>
                      <div className="rounded-xl bg-stone-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Ultimo accesso</p>
                        <p className="mt-1 font-bold text-stone-900">{owner.last_login ? new Date(owner.last_login).toLocaleString("it-IT") : "Mai"}</p>
                      </div>
                      <div className="rounded-xl bg-stone-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Password</p>
                        <p className="mt-1 font-bold text-stone-900">{owner.must_change_password ? "Cambio richiesto" : "Configurata"}</p>
                      </div>
                    </div>
                    <form className="grid gap-4 md:grid-cols-2" onSubmit={saveOwnerProfile}>
                      <FormField label="Nome e cognome" required>
                        <input defaultValue={owner.full_name} key={`${owner.id}-name-${owner.full_name}`} name="owner_full_name" required />
                      </FormField>
                      <FormField label="Email" required>
                        <input defaultValue={owner.email} key={`${owner.id}-email-${owner.email}`} name="owner_email" required type="email" />
                      </FormField>
                      <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm font-bold text-stone-800">
                        <input defaultChecked={owner.active} key={`${owner.id}-active-${owner.active}`} name="owner_active" type="checkbox" />
                        Account attivo
                      </label>
                      <div className="flex items-end justify-end">
                        <Button className={adminPrimaryButton} type="submit" variant="primary">Salva anagrafica</Button>
                      </div>
                    </form>
                  </>
                )}
              </SectionCard>

              <SectionCard title="Reimposta password" subtitle="La nuova password invalida tutte le sessioni aperte del titolare.">
                <form className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end" onSubmit={resetOwnerPassword}>
                  <FormField label="Nuova password" description="Minimo 10 caratteri. Al prossimo accesso verrà richiesto il cambio." required>
                    <input minLength={10} name="owner_password" required type="password" />
                  </FormField>
                  <Button className={adminPrimaryButton} type="submit" variant="primary">Reimposta password</Button>
                </form>
              </SectionCard>
            </div>
          )}
          {panel === "features" && selectedSalon && (
            <SectionCard title="Moduli abilitati" subtitle={`${enabledFeatures} moduli attivi per questo salone. Le modifiche sono immediate.`}>
              {featuresLoadedFor !== selectedSalon.id ? (
                <p className="rounded-2xl bg-stone-50 p-5 text-sm text-stone-500">Caricamento moduli...</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {featureCatalog.map((item) => {
                    const enabled = features[item.key];
                    const busy = pendingFeature === item.key;
                    const Icon = moduleIcons[item.key];
                    return (
                      <div className={`rounded-2xl border p-4 transition ${enabled ? "border-cyan-300 bg-cyan-50/70" : "border-stone-100 bg-white"}`} key={item.key}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 gap-3">
                            <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${enabled ? "bg-white text-teal-700 shadow-sm" : "bg-stone-100 text-stone-400"}`}>
                              <Icon />
                            </span>
                            <div>
                              <h3 className="font-bold text-stone-950">{item.name}</h3>
                              <p className="mt-1 text-sm leading-6 text-stone-500">{item.description}</p>
                            </div>
                          </div>
                          <Switch
                            checked={enabled}
                            className={enabled ? "!border-teal-700 !bg-[linear-gradient(135deg,#083344,#06b6d4)]" : ""}
                            disabled={busy}
                            onCheckedChange={(checked) => void toggleFeature(item.key, checked)}
                          />
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <StatusBadge status={enabled ? "active" : "inactive"}>{enabled ? "Inclusa" : "Non inclusa"}</StatusBadge>
                          {busy && <span className="text-xs font-semibold text-stone-500">Salvataggio...</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          )}
        </main>
      </div>
    </AppPage>
  );
}



