"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { MODULE_KEYS, type ModuleKey } from "@esse-beauty/feature-flags";
import {
  AppPage,
  Button,
  FormField,
  InlineError,
  PageHeader,
  SectionCard,
  StatCard,
  StatGrid,
  StatusBadge,
  Switch,
} from "@esse-beauty/ui";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

const moduleCatalog: Array<{ description: string; key: ModuleKey; name: string }> = [
  { key: MODULE_KEYS.REMINDERS, name: "Promemoria", description: "Email e SMS automatici prima degli appuntamenti." },
  { key: MODULE_KEYS.REVIEWS, name: "Recensioni", description: "Raccolta feedback, pubblicazione e risposte." },
  { key: MODULE_KEYS.WAITLIST, name: "Lista d'attesa", description: "Gestione richieste quando non ci sono slot liberi." },
  { key: MODULE_KEYS.LOYALTY, name: "Fedeltà", description: "Punti, premi e profili fedeltà del cliente." },
  { key: MODULE_KEYS.MARKETING, name: "Marketing", description: "Campagne email e SMS per segmenti clienti." },
  { key: MODULE_KEYS.INVENTORY, name: "Inventario", description: "Prodotti, movimenti e soglie di riordino." },
  { key: MODULE_KEYS.STAFF_PERF, name: "Performance staff", description: "Report operativi sul lavoro del team." },
];

type ModuleState = Record<ModuleKey, boolean>;

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

function emptyModuleState(): ModuleState {
  return Object.fromEntries(
    moduleCatalog.map((item) => [item.key, false]),
  ) as ModuleState;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export default function PlatformPage() {
  const [bootstrapRequired, setBootstrapRequired] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<ModuleState>(emptyModuleState);
  const [pendingModule, setPendingModule] = useState<ModuleKey>();
  const [salons, setSalons] = useState<PlatformSalon[]>([]);
  const [selectedSalonId, setSelectedSalonId] = useState("");
  const [session, setSession] = useState<PlatformSession | null>(null);
  const [success, setSuccess] = useState("");

  const selectedSalon = useMemo(
    () => salons.find((salon) => salon.id === selectedSalonId) ?? salons[0],
    [salons, selectedSalonId],
  );
  const activeSalons = salons.filter((salon) => salon.active).length;
  const enabledModules = Object.values(modules).filter(Boolean).length;

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
      throw new Error(typeof body.error === "string" ? body.error : "REQUEST_FAILED");
    }
    return (await response.json()) as T;
  }, []);

  const loadSalons = useCallback(async () => {
    const rows = await request<PlatformSalon[]>("/api/platform/salons");
    setSalons(rows);
    setSelectedSalonId((current) => current || rows[0]?.id || "");
  }, [request]);

  const loadModules = useCallback(async (salonId: string) => {
    const rows = await request<Array<{ enabled: boolean; module_key: ModuleKey }>>(
      `/api/platform/salons/${salonId}/modules`,
    );
    const next = emptyModuleState();
    for (const row of rows) {
      next[row.module_key] = row.enabled;
    }
    setModules(next);
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
    if (selectedSalon?.id) {
      void loadModules(selectedSalon.id).catch(() => setError("Impossibile caricare i moduli del salone."));
    }
  }, [loadModules, selectedSalon?.id]);

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
      await request("/api/platform/salons", {
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
          slug: String(form.get("slug") || slugify(name)),
          timezone: String(form.get("timezone") || "Europe/Rome"),
        }),
        method: "POST",
      });
      event.currentTarget.reset();
      setSuccess("Salone creato. Ora puoi selezionarlo e concedere i moduli inclusi nella licenza.");
      await loadSalons();
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
          plan_id: String(form.get("plan_id") || "") || null,
          slug: String(form.get("slug")),
          timezone: String(form.get("timezone")),
        }),
        method: "PATCH",
      });
      setSuccess("Salone aggiornato.");
      await loadSalons();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aggiornamento non riuscito.");
    }
  }

  async function toggleModule(moduleKey: ModuleKey, enabled: boolean) {
    if (!selectedSalon) return;
    setPendingModule(moduleKey);
    setError("");
    setSuccess("");
    try {
      await request(`/api/platform/salons/${selectedSalon.id}/modules/${moduleKey}`, {
        body: JSON.stringify({ enabled }),
        method: "PATCH",
      });
      setModules((current) => ({ ...current, [moduleKey]: enabled }));
      setSuccess("Licenza moduli aggiornata.");
      await loadSalons();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Modulo non aggiornato.");
    } finally {
      setPendingModule(undefined);
    }
  }

  if (loading) {
    return (
      <AppPage>
        <SectionCard>Caricamento piattaforma...</SectionCard>
      </AppPage>
    );
  }

  if (!session) {
    return (
      <AppPage maxWidth="max-w-xl">
        <PageHeader
          eyebrow="Platform"
          title={bootstrapRequired ? "Crea admin centrale" : "Accesso piattaforma"}
          subtitle={bootstrapRequired ? "Primo avvio del tier amministrativo CoreSuite." : "Area riservata per licenze, saloni e moduli."}
        />
        {error && <InlineError className="mb-5">{error}</InlineError>}
        <SectionCard>
          <form className="space-y-4" onSubmit={submitAuth}>
            {bootstrapRequired && (
              <FormField label="Nome admin" required>
                <input name="full_name" placeholder="Nome e cognome" required />
              </FormField>
            )}
            <FormField label="Email" required>
              <input name="email" placeholder="admin@coresuite.it" required type="email" />
            </FormField>
            <FormField label="Password" required description="Minimo 10 caratteri.">
              <input name="password" required type="password" />
            </FormField>
            <Button className="w-full" type="submit" variant="primary">
              {bootstrapRequired ? "Crea piattaforma" : "Entra"}
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
        eyebrow="CoreSuite"
        title="Piattaforma amministrativa"
        subtitle={`Connesso come ${session.admin.full_name}. Qui si gestiscono saloni, stato licenza e moduli concessi.`}
        status={<StatusBadge status="active">Tier platform</StatusBadge>}
      />
      {error && <InlineError className="mb-5">{error}</InlineError>}
      {success && <p className="mb-5 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{success}</p>}

      <StatGrid className="mb-6 md:grid-cols-4">
        <StatCard label="Saloni" value={salons.length} detail="Totale in piattaforma" />
        <StatCard label="Attivi" value={activeSalons} detail="Licenze operative" />
        <StatCard label="Selezionato" value={selectedSalon?.name ?? "-"} detail={selectedSalon?.slug ?? "Nessun salone"} />
        <StatCard label="Moduli concessi" value={enabledModules} detail="Sul salone selezionato" />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <div className="space-y-6">
          <SectionCard title="Crea salone" subtitle="Apertura licenza e primo owner del salone.">
            <form className="space-y-4" onSubmit={createSalon}>
              <FormField label="Nome salone" required>
                <input name="name" placeholder="OttavoSenso" required />
              </FormField>
              <FormField label="Slug pubblico">
                <input name="slug" placeholder="ottavosenso" />
              </FormField>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Timezone" required>
                  <input defaultValue="Europe/Rome" name="timezone" required />
                </FormField>
                <FormField label="Locale" required>
                  <input defaultValue="it-IT" name="locale" required />
                </FormField>
              </div>
              <div className="rounded-2xl bg-stone-50 p-4">
                <p className="mb-3 text-xs font-black uppercase tracking-[.12em] text-stone-500">Owner salone</p>
                <div className="space-y-3">
                  <FormField label="Nome owner">
                    <input name="owner_full_name" placeholder="Titolare" />
                  </FormField>
                  <FormField label="Email owner">
                    <input name="owner_email" placeholder="titolare@salone.it" type="email" />
                  </FormField>
                  <FormField label="Password owner" description="Minimo 10 caratteri se compilata.">
                    <input name="owner_password" type="password" />
                  </FormField>
                </div>
              </div>
              <Button className="w-full" type="submit" variant="primary">Crea salone</Button>
            </form>
          </SectionCard>

          <SectionCard title="Saloni" subtitle="Seleziona il salone da modificare.">
            <div className="space-y-2">
              {salons.map((salon) => (
                <button
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${salon.id === selectedSalon?.id ? "border-[#792f59] bg-[#faf3f7]" : "border-stone-100 bg-white"}`}
                  key={salon.id}
                  onClick={() => setSelectedSalonId(salon.id)}
                  type="button"
                >
                  <span>
                    <b className="block text-stone-950">{salon.name}</b>
                    <span className="text-sm text-stone-500">/{salon.slug}</span>
                  </span>
                  <StatusBadge status={salon.active ? "active" : "inactive"} />
                </button>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          {selectedSalon && (
            <>
              <SectionCard title="Anagrafica licenza" subtitle="Dati gestiti centralmente, fuori dal tier salone.">
                <form className="grid gap-4 md:grid-cols-2" onSubmit={saveSalon}>
                  <FormField label="Nome salone" required>
                    <input defaultValue={selectedSalon.name} name="name" required />
                  </FormField>
                  <FormField label="Slug" required>
                    <input defaultValue={selectedSalon.slug} name="slug" required />
                  </FormField>
                  <FormField label="Timezone" required>
                    <input defaultValue={selectedSalon.timezone} name="timezone" required />
                  </FormField>
                  <FormField label="Locale" required>
                    <input defaultValue={selectedSalon.locale} name="locale" required />
                  </FormField>
                  <FormField label="Plan ID" description="Campo tecnico opzionale per collegare piani interni, senza logica di pagamento.">
                    <input defaultValue={selectedSalon.plan_id ?? ""} name="plan_id" placeholder="UUID piano interno" />
                  </FormField>
                  <label className="flex items-center gap-3 rounded-2xl bg-stone-50 p-4 text-sm font-bold text-stone-800">
                    <input defaultChecked={selectedSalon.active} name="active" type="checkbox" />
                    Salone attivo
                  </label>
                  <div className="md:col-span-2">
                    <Button type="submit" variant="primary">Salva anagrafica licenza</Button>
                  </div>
                </form>
              </SectionCard>

              <SectionCard title="Moduli licenza" subtitle="L'unico punto autorizzato ad attivare o disattivare i moduli del salone.">
                <div className="grid gap-3 md:grid-cols-2">
                  {moduleCatalog.map((item) => {
                    const enabled = modules[item.key];
                    const busy = pendingModule === item.key;
                    return (
                      <div className={`rounded-2xl border p-4 transition ${enabled ? "border-[#d7a6c1] bg-[#faf3f7]" : "border-stone-100 bg-white"}`} key={item.key}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-bold text-stone-950">{item.name}</h3>
                            <p className="mt-1 text-sm leading-6 text-stone-500">{item.description}</p>
                          </div>
                          <Switch
                            checked={enabled}
                            disabled={busy}
                            onCheckedChange={(checked) => void toggleModule(item.key, checked)}
                          />
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <StatusBadge status={enabled ? "active" : "inactive"}>{enabled ? "Concesso" : "Non incluso"}</StatusBadge>
                          {busy && <span className="text-xs font-semibold text-stone-500">Salvataggio...</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            </>
          )}
        </div>
      </div>
    </AppPage>
  );
}
