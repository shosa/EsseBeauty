"use client";

import { CheckCircle2, MessageCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import {
  AppPage,
  Button,
  FormField,
  InlineError,
  PageHeader,
  SaveToast,
  SectionCard,
} from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface ProviderSettings {
  business_portfolio_id: string | null;
  credential_present: boolean;
  display_phone_number_masked: string | null;
  enabled: boolean;
  graph_api_version: string;
  last_error_code: string | null;
  last_health_check_at: string | null;
  last_webhook_at: string | null;
  phone_number_id: string | null;
  provider: "meta_cloud_api";
  ready: boolean;
  status: "not_configured" | "pending_verification" | "ready" | "degraded" | "revoked" | "disabled";
  token_expires_at: string | null;
  waba_id: string | null;
  webhook_credential_present: boolean;
  webhook_subscription_status: string;
}

const emptySettings: ProviderSettings = {
  business_portfolio_id: null,
  credential_present: false,
  display_phone_number_masked: null,
  enabled: false,
  graph_api_version: "v23.0",
  last_error_code: null,
  last_health_check_at: null,
  last_webhook_at: null,
  phone_number_id: null,
  provider: "meta_cloud_api",
  ready: false,
  status: "not_configured",
  token_expires_at: null,
  waba_id: null,
  webhook_credential_present: false,
  webhook_subscription_status: "not_subscribed",
};

export default function CommunicationsSettingsPage() {
  const { salon } = useAuth();
  const [settings, setSettings] = useState(emptySettings);
  const [form, setForm] = useState({
    accessToken: "",
    businessPortfolioId: "",
    displayPhoneNumber: "",
    enabled: false,
    graphApiVersion: "v23.0",
    phoneNumberId: "",
    wabaId: "",
    webhookVerifyToken: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!salon) return;
    setLoading(true);
    void fetch(`${api}/api/salons/${salon.id}/communications/provider`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 403 ? "Non hai accesso alle comunicazioni." : "Configurazione non disponibile.");
        return response.json() as Promise<ProviderSettings>;
      })
      .then((data) => {
        setSettings(data);
        setForm((current) => ({
          ...current,
          businessPortfolioId: data.business_portfolio_id ?? "",
          enabled: data.enabled,
          graphApiVersion: data.graph_api_version,
          phoneNumberId: data.phone_number_id ?? "",
          wabaId: data.waba_id ?? "",
        }));
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Configurazione non disponibile."))
      .finally(() => setLoading(false));
  }, [salon?.id]);

  async function save() {
    if (!salon) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/communications/provider`, {
        body: JSON.stringify({
          ...(form.accessToken && { access_token: form.accessToken }),
          business_portfolio_id: form.businessPortfolioId || null,
          display_phone_number: form.displayPhoneNumber || null,
          enabled: form.enabled,
          graph_api_version: form.graphApiVersion,
          phone_number_id: form.phoneNumberId,
          waba_id: form.wabaId,
          ...(form.webhookVerifyToken && { webhook_verify_token: form.webhookVerifyToken }),
        }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "PUT",
      });
      const body = await response.json().catch(() => ({})) as ProviderSettings & { error?: string };
      if (!response.ok) {
        if (response.status === 403) throw new Error("Solo owner e manager autorizzati possono modificare il provider.");
        if (body.error === "PROVIDER_IDENTIFIERS_ALREADY_IN_USE") throw new Error("Questo account Meta o numero è già collegato a un altro salone.");
        throw new Error("Impossibile salvare la configurazione WhatsApp.");
      }
      setSettings(body);
      setForm((current) => ({ ...current, accessToken: "", webhookVerifyToken: "" }));
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossibile salvare la configurazione WhatsApp.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <SaveToast visible={saved}>Credenziali protette e configurazione aggiornata.</SaveToast>
      <PageHeader
        eyebrow="Comunicazioni"
        subtitle="Collega il numero aziendale attraverso la WhatsApp Business Cloud API ufficiale di Meta."
        title="WhatsApp Business"
      />

      {error && <InlineError className="mb-5">{error}</InlineError>}
      {loading ? <div className="h-56 animate-pulse rounded-2xl bg-stone-100" /> : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)]">
          <SectionCard title="Account Meta" subtitle="Gli identificativi restano separati dai segreti cifrati.">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="WhatsApp Business Account ID" required>
                <input autoComplete="off" onChange={(event) => setForm((value) => ({ ...value, wabaId: event.target.value }))} placeholder="WABA ID" value={form.wabaId} />
              </FormField>
              <FormField label="Phone Number ID" required>
                <input autoComplete="off" onChange={(event) => setForm((value) => ({ ...value, phoneNumberId: event.target.value }))} placeholder="Phone Number ID" value={form.phoneNumberId} />
              </FormField>
              <FormField label="Business Portfolio ID">
                <input autoComplete="off" onChange={(event) => setForm((value) => ({ ...value, businessPortfolioId: event.target.value }))} placeholder="Portfolio ID" value={form.businessPortfolioId} />
              </FormField>
              <FormField label="Numero visualizzato" description={settings.display_phone_number_masked ? `Attuale: ${settings.display_phone_number_masked}` : "Usato solo come riferimento visivo nella chat."}>
                <input autoComplete="tel" onChange={(event) => setForm((value) => ({ ...value, displayPhoneNumber: event.target.value }))} placeholder="+39 333 123 4567" type="tel" value={form.displayPhoneNumber} />
              </FormField>
              <FormField label="Versione Graph API">
                <input onChange={(event) => setForm((value) => ({ ...value, graphApiVersion: event.target.value }))} placeholder="v23.0" value={form.graphApiVersion} />
              </FormField>
              <label className="flex min-h-11 items-center justify-between rounded-xl border border-stone-200 px-4 text-sm font-bold">
                <span>Abilita il provider</span>
                <input checked={form.enabled} className="size-5 accent-[#792f59]" onChange={(event) => setForm((value) => ({ ...value, enabled: event.target.checked }))} type="checkbox" />
              </label>
            </div>

            <div className="mt-6 border-t border-stone-200 pt-5">
              <div className="mb-4 flex items-center gap-2"><ShieldCheck className="size-5 text-[#792f59]" /><h3 className="font-black">Credenziali protette</h3></div>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Access token" description={settings.credential_present ? "Credenziale presente. Lascia vuoto per mantenerla." : "Token permanente o system-user generato in Meta."} required={!settings.credential_present}>
                  <input autoComplete="new-password" onChange={(event) => setForm((value) => ({ ...value, accessToken: event.target.value }))} placeholder={settings.credential_present ? "••••••••••••" : "Incolla il token"} type="password" value={form.accessToken} />
                </FormField>
                <FormField label="Token verifica webhook" description={settings.webhook_credential_present ? "Token presente. Lascia vuoto per mantenerlo." : "Scegli un valore lungo e casuale."} required={!settings.webhook_credential_present}>
                  <input autoComplete="new-password" onChange={(event) => setForm((value) => ({ ...value, webhookVerifyToken: event.target.value }))} placeholder={settings.webhook_credential_present ? "••••••••••••" : "Token di verifica"} type="password" value={form.webhookVerifyToken} />
                </FormField>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button disabled={saving || !form.wabaId.trim() || !form.phoneNumberId.trim() || (!settings.credential_present && !form.accessToken.trim())} onClick={() => void save()}>
                {saving ? "Protezione credenziali…" : "Salva configurazione"}
              </Button>
            </div>
          </SectionCard>

          <div className="space-y-6">
            <SectionCard title="Stato operativo" subtitle="Lo stato diventa operativo dopo test API e webhook.">
              <div className="space-y-3 text-sm">
                {[
                  ["Account configurato", Boolean(settings.waba_id && settings.phone_number_id)],
                  ["Access token cifrato", settings.credential_present],
                  ["Verifica webhook protetta", settings.webhook_credential_present],
                  ["Provider abilitato", settings.enabled],
                ].map(([label, complete]) => (
                  <div className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-3" key={String(label)}>
                    <span>{label as string}</span>
                    <CheckCircle2 className={`size-5 ${complete ? "text-emerald-600" : "text-stone-300"}`} />
                  </div>
                ))}
              </div>
              {settings.last_error_code && <InlineError className="mt-4">Codice provider: {settings.last_error_code}</InlineError>}
            </SectionCard>
            <SectionCard title="Cloud API ufficiale" subtitle="Nessuna automazione o incorporamento di WhatsApp Web.">
              <div className="flex gap-3 rounded-xl bg-[#f5fbf7] p-4 text-sm leading-6 text-stone-700">
                <MessageCircle className="mt-0.5 size-5 shrink-0 text-emerald-700" />
                <p>Messaggi, ricevute e conversazioni saranno registrati in EsseBeauty tramite API e webhook Meta, con isolamento per salone.</p>
              </div>
            </SectionCard>
          </div>
        </div>
      )}
    </AppPage>
  );
}
