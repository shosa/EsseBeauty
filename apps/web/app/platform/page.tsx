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
  StatCard,
  StatGrid,
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
type Panel = "overview" | "identity" | "access" | "features" | "catalog" | "new";

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
  plan_id: string | null;
  slug: string;
  timezone: string;
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
  const [panel, setPanel] = useState<Panel>("overview");
  const [pendingFeature, setPendingFeature] = useState<ModuleKey>();
  const [query, setQuery] = useState("");
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
    if (!success) return;
    const timeout = window.setTimeout(() => setSuccess(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [success]);

  function selectSalon(salonId: string) {
    setSelectedSalonId(salonId);
    setError("");
    setSuccess("");
    setPanel("overview");
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
          owner: ownerEmail && ownerName && ownerPassword
            ? {
                email: ownerEmail,
                full_name: ownerName,
                password: ownerPassword,
              }
            : undefined,
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
          plan_id: String(form.get("plan_name") || "") || null,
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

  async function saveOwnerAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSalon) return;
    setError("");
    setSuccess("");
    const form = new FormData(event.currentTarget);
    try {
      await request(`/api/platform/salons/${selectedSalon.id}/owner-access`, {
        body: JSON.stringify({
          email: String(form.get("owner_email")),
          full_name: String(form.get("owner_full_name")),
          password: String(form.get("owner_password")),
        }),
        method: "POST",
      });
      event.currentTarget.reset();
      setSuccess("Accesso titolare aggiornato.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Accesso titolare non aggiornato.");
    }
  }

  function closeSalonCard() {
    setSelectedSalonId("");
    setFeatures(emptyFeatureState());
    setFeaturesLoadedFor("");
    setPanel("overview");
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
      <AppPage maxWidth="max-w-xl">
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
                <input name="full_name" placeholder="Nome e cognome" required />
              </FormField>
            )}
            <FormField label="Email" required>
              <input name="email" placeholder="amministrazione@essebeauty.it" required type="email" />
            </FormField>
            <FormField label="Password" required description="Almeno 10 caratteri.">
              <input name="password" required type="password" />
            </FormField>
            <Button className="w-full" type="submit" variant="primary">
              {bootstrapRequired ? "Crea accesso" : "Entra"}
            </Button>
          </form>
        </SectionCard>
      </AppPage>
    );
  }

  return (
    <AppPage maxWidth="max-w-7xl">
      <PageHeader
        actions={<Button onClick={() => void request("/api/platform/auth/logout", { method: "POST" }).then(() => setSession(null))} variant="outline">Esci</Button>}
        eyebrow="Gestione centrale"
        title="Configurazione applicativo"
        subtitle={`Connesso come ${session.admin.full_name}. Gestisci apertura, stato e moduli inclusi per ogni salone.`}
        status={<StatusBadge status="active">Accesso attivo</StatusBadge>}
      />
      <SaveToast variant="success" visible={Boolean(success)}>{success}</SaveToast>
      {error && <InlineError className="mb-5">{error}</InlineError>}

      <StatGrid className="mb-6 md:grid-cols-3">
        <StatCard label="Saloni gestiti" value={salons.length} detail={`${activeSalons} attivi`} />
        <StatCard label="Salone selezionato" value={selectedSalon?.name ?? "Nessuno"} detail={selectedSalon ? `/${selectedSalon.slug}` : "Seleziona un salone"} />
        <StatCard label="Moduli inclusi" value={panel === "features" ? enabledFeatures : selectedSalon?.modules_enabled ?? 0} detail="Sul salone selezionato" />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <SectionCard>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-stone-950">Saloni</h2>
                <p className="text-sm text-stone-500">Scegli un salone o aprine uno nuovo.</p>
              </div>
              <Button onClick={() => setPanel("new")} size="sm" variant="primary">Nuovo</Button>
            </div>
            <input
              className="mt-4 min-h-11 w-full rounded-xl border border-stone-200 px-3 text-sm"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca salone"
              value={query}
            />
            <div className="mt-4 max-h-[560px] space-y-2 overflow-y-auto pr-1">
              {filteredSalons.length === 0 && <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500">Nessun salone trovato.</p>}
              {filteredSalons.map((salon) => (
                <button
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${salon.id === selectedSalonId ? "border-[#792f59] bg-[#faf3f7]" : "border-stone-100 bg-white"}`}
                  key={salon.id}
                  onClick={() => selectSalon(salon.id)}
                  type="button"
                >
                  <span className="min-w-0">
                    <b className="block truncate text-stone-950">{salon.name}</b>
                    <span className="block truncate text-sm text-stone-500">Pagina prenotazioni: /{salon.slug}</span>
                  </span>
                  <StatusBadge status={salon.active ? "active" : "inactive"}>{salon.active ? "Attivo" : "Pausa"}</StatusBadge>
                </button>
              ))}
            </div>
          </SectionCard>
        </aside>

        <main className="space-y-5">
          {panel !== "new" && selectedSalon && (
            <SectionCard>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.18em] text-[#792f59]">Scheda salone</p>
                  <h2 className="mt-1 text-3xl font-bold text-stone-950">{selectedSalon.name}</h2>
                  <p className="mt-2 text-sm text-stone-500">Pagina prenotazioni: /{selectedSalon.slug}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={selectedSalon.active ? "active" : "inactive"}>{selectedSalon.active ? "Operativo" : "Sospeso"}</StatusBadge>
                  <button
                    aria-label="Chiudi scheda salone"
                    className="grid size-10 place-items-center rounded-full border border-stone-200 text-xl font-semibold text-stone-500 transition hover:border-[#792f59] hover:bg-[#faf3f7] hover:text-[#792f59]"
                    onClick={closeSalonCard}
                    type="button"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="mt-6 grid gap-3 md:grid-cols-5">
                {[
                  ["Riepilogo", "overview"],
                  ["Dati salone", "identity"],
                  ["Accesso titolare", "access"],
                  ["Moduli", "features"],
                  ["Catalogo", "catalog"],
                ].map(([label, value]) => (
                  <button
                    className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${panel === value ? "border-[#792f59] bg-[#f3e2eb] text-[#792f59]" : "border-stone-200 bg-white text-stone-600 hover:border-[#d7a6c1]"}`}
                    key={value}
                    onClick={() => setPanel(value as Panel)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </SectionCard>
          )}

          {panel !== "new" && !selectedSalon && (
            <SectionCard>
              <div className="grid min-h-80 place-items-center text-center">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.18em] text-[#792f59]">Nessun salone selezionato</p>
                  <h2 className="mt-2 text-3xl font-bold text-stone-950">Scegli un salone dall'elenco</h2>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-stone-500">
                    La scheda di configurazione si apre solo dopo aver selezionato un salone. Puoi anche crearne uno nuovo.
                  </p>
                  <Button className="mt-5" onClick={() => setPanel("new")} variant="primary">Apri nuovo salone</Button>
                </div>
              </div>
            </SectionCard>
          )}

          {panel === "new" && (
            <SectionCard title="Apri un nuovo salone" subtitle="Crea la scheda del salone, il primo accesso del titolare e poi scegli i moduli inclusi.">
              <form className="grid gap-4 md:grid-cols-2" onSubmit={createSalon}>
                <FormField label="Nome salone" required>
                  <input name="name" placeholder="OttavoSenso" required />
                </FormField>
                <FormField label="Pagina prenotazioni" description="Testo breve visibile nell'indirizzo pubblico.">
                  <input name="public_address" placeholder="ottavosenso" />
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
                <div className="rounded-2xl bg-stone-50 p-4 md:col-span-2">
                  <p className="mb-3 text-xs font-black uppercase tracking-[.12em] text-stone-500">Primo accesso del titolare</p>
                  <div className="grid gap-3 md:grid-cols-3">
                    <FormField label="Nome titolare">
                      <input name="owner_full_name" placeholder="Nome e cognome" />
                    </FormField>
                    <FormField label="Email titolare">
                      <input name="owner_email" placeholder="titolare@salone.it" type="email" />
                    </FormField>
                    <FormField label="Password iniziale" description="Almeno 10 caratteri se compilata.">
                      <input name="owner_password" type="password" />
                    </FormField>
                  </div>
                </div>
                <div className="flex justify-end gap-3 md:col-span-2">
                  <Button onClick={() => setPanel(selectedSalon ? "overview" : "new")} type="button" variant="outline">Annulla</Button>
                  <Button type="submit" variant="primary">Crea e scegli moduli</Button>
                </div>
              </form>
            </SectionCard>
          )}

          {panel === "overview" && selectedSalon && (
            <SectionCard title="Riepilogo configurazione" subtitle="Mostra solo ciò che serve per capire lo stato del salone.">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-stone-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Stato</p>
                  <p className="mt-2 text-lg font-bold">{selectedSalon.active ? "Operativo" : "Sospeso"}</p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Pagina prenotazioni</p>
                  <p className="mt-2 text-lg font-bold">/{selectedSalon.slug}</p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Moduli inclusi</p>
                  <p className="mt-2 text-lg font-bold">{selectedSalon.modules_enabled}</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button onClick={() => setPanel("identity")} variant="outline">Modifica dati salone</Button>
                <Button onClick={() => setPanel("features")} variant="primary">Gestisci moduli</Button>
                <Button onClick={() => setPanel("catalog")} variant="outline">Catalogo centrale</Button>
              </div>
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
                <FormField label="Piano commerciale" description="Nome o riferimento interno della licenza, visibile solo qui.">
                  <input defaultValue={selectedSalon.plan_id ?? ""} name="plan_name" placeholder="Standard, Pro, Enterprise..." />
                </FormField>
                <label className="flex items-center gap-3 rounded-2xl bg-stone-50 p-4 text-sm font-bold text-stone-800">
                  <input defaultChecked={selectedSalon.active} name="active" type="checkbox" />
                  Salone operativo
                </label>
                <div className="md:col-span-2">
                  <Button type="submit" variant="primary">Salva dati salone</Button>
                </div>
              </form>
            </SectionCard>
          )}

          {panel === "access" && selectedSalon && (
            <SectionCard title="Accesso titolare" subtitle="Crea o aggiorna l'accesso principale del titolare per questo salone.">
              <form className="grid gap-4 md:grid-cols-3" onSubmit={saveOwnerAccess}>
                <FormField label="Nome titolare" required>
                  <input name="owner_full_name" placeholder="Nome e cognome" required />
                </FormField>
                <FormField label="Email titolare" required>
                  <input name="owner_email" placeholder="titolare@salone.it" required type="email" />
                </FormField>
                <FormField label="Nuova password" description="Almeno 10 caratteri. Al primo accesso verrà richiesta la modifica." required>
                  <input name="owner_password" required type="password" />
                </FormField>
                <div className="rounded-2xl border border-[#ead1df] bg-[#fffafd] p-4 md:col-span-3">
                  <p className="text-sm font-semibold text-stone-800">Cosa succede al salvataggio</p>
                  <p className="mt-1 text-sm leading-6 text-stone-500">
                    Se l'email esiste già in questo salone, l'utente viene riattivato, promosso a titolare e la password viene aggiornata. Se non esiste, viene creato un nuovo titolare.
                  </p>
                </div>
                <div className="flex justify-end md:col-span-3">
                  <Button type="submit" variant="primary">Salva accesso titolare</Button>
                </div>
              </form>

            </SectionCard>
          )}
          {panel === "catalog" && selectedSalon && (
            <SectionCard title="Catalogo moduli" subtitle="Panoramica funzionale dei moduli disponibili per il salone selezionato.">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {featureCatalog.map((item) => {
                  const Icon = moduleIcons[item.key];
                  const enabled = features[item.key] || selectedSalon.modules_enabled > 0 && featuresLoadedFor !== selectedSalon.id;
                  return (
                    <article className="rounded-2xl border border-white/80 bg-white/82 p-4 shadow-sm" key={item.key}>
                      <div className="flex items-start gap-3">
                        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#faf3f7] text-[#792f59]">
                          <Icon />
                        </span>
                        <div>
                          <h3 className="font-bold text-stone-950">{item.name}</h3>
                          <p className="mt-1 text-sm leading-6 text-stone-500">{item.description}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <StatusBadge status={enabled ? "active" : "inactive"}>{enabled ? "Incluso" : "Configurabile"}</StatusBadge>
                        <Button onClick={() => setPanel("features")} size="sm" variant="tableAction">Apri</Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </SectionCard>
          )}


          {panel === "features" && selectedSalon && (
            <SectionCard title="Moduli" subtitle="Attiva solo i moduli che il salone deve usare. Le voci compaiono nel gestionale del salone dopo il salvataggio.">
              {featuresLoadedFor !== selectedSalon.id ? (
                <p className="rounded-2xl bg-stone-50 p-5 text-sm text-stone-500">Caricamento moduli...</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {featureCatalog.map((item) => {
                    const enabled = features[item.key];
                    const busy = pendingFeature === item.key;
                    const Icon = moduleIcons[item.key];
                    return (
                      <div className={`rounded-2xl border p-4 transition ${enabled ? "border-[#d7a6c1] bg-[#faf3f7]" : "border-stone-100 bg-white"}`} key={item.key}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 gap-3">
                            <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${enabled ? "bg-white text-[#792f59] shadow-sm" : "bg-stone-100 text-stone-400"}`}>
                              <Icon />
                            </span>
                            <div>
                              <h3 className="font-bold text-stone-950">{item.name}</h3>
                              <p className="mt-1 text-sm leading-6 text-stone-500">{item.description}</p>
                            </div>
                          </div>
                          <Switch
                            checked={enabled}
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



