"use client";

import { useEffect, useState } from "react";
import { AppPage, Button, FormField, PageHeader, SaveToast, SectionCard, Switch } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface AppClientiSettings {
  accentColor: string;
  allowCancellation: boolean;
  allowReschedule: boolean;
  allowStaffPreference: boolean;
  bookingDefaultStatus: "confirmed" | "pending";
  bookingSuccessText: string;
  cancellationPolicyHours: number;
  heroSubtitle: string;
  heroTitle: string;
  installPromptEnabled: boolean;
  logoUrl: string;
  maxAdvanceDays: number;
  minBookingNoticeHours: number;
  onlineBookingEnabled: boolean;
  primaryColor: string;
  requireEmail: boolean;
  requirePhone: boolean;
  welcomeText: string;
}

const defaults: AppClientiSettings = {
  accentColor: "#f4d8a8",
  allowCancellation: true,
  allowReschedule: true,
  allowStaffPreference: true,
  bookingDefaultStatus: "pending",
  bookingSuccessText: "Prenotazione ricevuta. Ti aspettiamo.",
  cancellationPolicyHours: 24,
  heroSubtitle: "Prenota il tuo trattamento in pochi passaggi.",
  heroTitle: "",
  installPromptEnabled: true,
  logoUrl: "",
  maxAdvanceDays: 90,
  minBookingNoticeHours: 2,
  onlineBookingEnabled: true,
  primaryColor: "#792f59",
  requireEmail: true,
  requirePhone: false,
  welcomeText: "Benvenuta nel nostro salone.",
};

function validColor(value: string, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function ColorField({
  fallback,
  label,
  onChange,
  value,
}: {
  fallback: string;
  label: string;
  onChange(value: string): void;
  value: string;
}) {
  const pickerValue = validColor(value, fallback);
  return (
    <FormField label={label}>
      <div className="flex min-h-12 items-center gap-3 rounded-xl border border-stone-200 bg-[#fffafd] px-3">
        <label
          className="relative block size-8 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(214_211_209)]"
          style={{ backgroundColor: pickerValue }}
        >
          <span className="sr-only">Scegli {label.toLowerCase()}</span>
          <input
            aria-label={label}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            onChange={(event) => onChange(event.target.value)}
            type="color"
            value={pickerValue}
          />
        </label>
        <span className="text-sm font-bold uppercase text-stone-500">{pickerValue}</span>
      </div>
    </FormField>
  );
}

export default function AppClientiSettingsPage() {
  const { salon } = useAuth();
  const [settings, setSettings] = useState<AppClientiSettings>(defaults);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!salon) return;
    const controller = new AbortController();
    void fetch(`${api}/api/salons/${salon.id}/settings/pwa`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("LOAD_FAILED");
        return response.json();
      })
      .then((data) => {
        setSettings({
          ...defaults,
          ...data,
          ...(data.branding ? {
            accentColor: data.branding.accentColor ?? defaults.accentColor,
            bookingSuccessText: data.branding.bookingSuccessText ?? defaults.bookingSuccessText,
            heroSubtitle: data.branding.heroSubtitle ?? defaults.heroSubtitle,
            heroTitle: data.branding.heroTitle ?? salon.name,
            installPromptEnabled: data.branding.installPromptEnabled ?? true,
            logoUrl: data.branding.logoUrl ?? "",
            primaryColor: data.branding.primaryColor ?? defaults.primaryColor,
            welcomeText: data.branding.welcomeText ?? defaults.welcomeText,
          } : { heroTitle: salon.name }),
        });
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setMessage("Impossibile caricare le impostazioni dell’App Clienti.");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [salon]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [message]);

  async function save() {
    if (!salon || saving) return;
    setSaving(true);
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/settings/pwa`, {
        body: JSON.stringify({
          accent_color: validColor(settings.accentColor, defaults.accentColor),
          allow_cancellation: settings.allowCancellation,
          allow_reschedule: settings.allowReschedule,
          allow_staff_preference: settings.allowStaffPreference,
          booking_default_status: settings.bookingDefaultStatus,
          booking_success_text: settings.bookingSuccessText.trim(),
          cancellation_policy_hours: settings.cancellationPolicyHours,
          hero_subtitle: settings.heroSubtitle.trim(),
          hero_title: settings.heroTitle.trim(),
          install_prompt_enabled: settings.installPromptEnabled,
          logo_url: settings.logoUrl.trim(),
          max_advance_days: settings.maxAdvanceDays,
          min_booking_notice_hours: settings.minBookingNoticeHours,
          online_booking_enabled: settings.onlineBookingEnabled,
          primary_color: validColor(settings.primaryColor, defaults.primaryColor),
          require_email: settings.requireEmail,
          require_phone: settings.requirePhone,
          welcome_text: settings.welcomeText.trim(),
        }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "PUT",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "SAVE_FAILED");
      }
      setSettings((current) => ({
        ...current,
        accentColor: validColor(current.accentColor, defaults.accentColor),
        primaryColor: validColor(current.primaryColor, defaults.primaryColor),
      }));
      setMessage("Impostazioni App Clienti salvate.");
    } catch {
      setMessage("Salvataggio non riuscito. Verifica che il server API sia raggiungibile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AppPage maxWidth="max-w-[1600px]"><div className="h-96 animate-pulse rounded-xl bg-stone-100" /></AppPage>;

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <SaveToast variant={message.includes("non riuscito") || message.includes("Impossibile") ? "error" : "success"} visible={Boolean(message)}>{message}</SaveToast>
      <PageHeader eyebrow="Canale clienti" title="App Clienti" subtitle="Prenotazioni online, autonomia del cliente e identità dell’app in un unico spazio." />
      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title="Prenotazioni online" subtitle="Decidi come entra in agenda una prenotazione inviata dal cliente.">
          <div className="grid gap-4">
            <label className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm font-bold">Prenotazioni online attive<Switch checked={settings.onlineBookingEnabled} onCheckedChange={(onlineBookingEnabled) => setSettings({ ...settings, onlineBookingEnabled })} /></label>
            <FormField label="Stato iniziale della prenotazione">
              <select value={settings.bookingDefaultStatus} onChange={(event) => setSettings({ ...settings, bookingDefaultStatus: event.target.value as AppClientiSettings["bookingDefaultStatus"] })}>
                <option value="pending">In attesa di conferma</option>
                <option value="confirmed">Confermato direttamente</option>
              </select>
            </FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Anticipo minimo (ore)"><input min={0} onChange={(event) => setSettings({ ...settings, minBookingNoticeHours: Number(event.target.value) })} type="number" value={settings.minBookingNoticeHours} /></FormField>
              <FormField label="Prenotabile fino a (giorni)"><input min={1} onChange={(event) => setSettings({ ...settings, maxAdvanceDays: Number(event.target.value) })} type="number" value={settings.maxAdvanceDays} /></FormField>
            </div>
            <label className="flex items-center justify-between rounded-xl border border-stone-200 p-4 text-sm font-bold">Permetti preferenza collaboratore<Switch checked={settings.allowStaffPreference} onCheckedChange={(allowStaffPreference) => setSettings({ ...settings, allowStaffPreference })} /></label>
          </div>
        </SectionCard>

        <SectionCard title="Autonomia cliente" subtitle="Regole applicate nella sezione I miei appuntamenti.">
          <div className="grid gap-4">
            <label className="flex items-center justify-between rounded-xl border border-stone-200 p-4 text-sm font-bold">Cancellazione autonoma<Switch checked={settings.allowCancellation} onCheckedChange={(allowCancellation) => setSettings({ ...settings, allowCancellation })} /></label>
            <FormField label="Cancellazione consentita fino a ore prima"><input disabled={!settings.allowCancellation} min={0} onChange={(event) => setSettings({ ...settings, cancellationPolicyHours: Number(event.target.value) })} type="number" value={settings.cancellationPolicyHours} /></FormField>
            <label className="flex items-center justify-between rounded-xl border border-stone-200 p-4 text-sm font-bold">Richiesta cambio orario<Switch checked={settings.allowReschedule} onCheckedChange={(allowReschedule) => setSettings({ ...settings, allowReschedule })} /></label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center justify-between rounded-xl bg-stone-50 p-4 text-sm font-bold">Email obbligatoria<Switch checked={settings.requireEmail} onCheckedChange={(requireEmail) => setSettings({ ...settings, requireEmail })} /></label>
              <label className="flex items-center justify-between rounded-xl bg-stone-50 p-4 text-sm font-bold">Telefono obbligatorio<Switch checked={settings.requirePhone} onCheckedChange={(requirePhone) => setSettings({ ...settings, requirePhone })} /></label>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Aspetto App Clienti" subtitle="Personalizza la home e il percorso di prenotazione.">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Logo URL"><input className="w-full" onChange={(event) => setSettings({ ...settings, logoUrl: event.target.value })} value={settings.logoUrl} /></FormField>
            <FormField label="Titolo principale"><input className="w-full" onChange={(event) => setSettings({ ...settings, heroTitle: event.target.value })} value={settings.heroTitle} /></FormField>
            <ColorField fallback={defaults.primaryColor} label="Colore principale" onChange={(primaryColor) => setSettings({ ...settings, primaryColor })} value={settings.primaryColor} />
            <ColorField fallback={defaults.accentColor} label="Colore accento" onChange={(accentColor) => setSettings({ ...settings, accentColor })} value={settings.accentColor} />
            <FormField className="md:col-span-2" label="Sottotitolo"><input className="w-full" onChange={(event) => setSettings({ ...settings, heroSubtitle: event.target.value })} value={settings.heroSubtitle} /></FormField>
            <FormField className="md:col-span-2" label="Messaggio di benvenuto"><textarea className="min-h-28 w-full resize-y" onChange={(event) => setSettings({ ...settings, welcomeText: event.target.value })} value={settings.welcomeText} /></FormField>
            <FormField className="md:col-span-2" label="Messaggio dopo la prenotazione"><textarea className="min-h-28 w-full resize-y" onChange={(event) => setSettings({ ...settings, bookingSuccessText: event.target.value })} value={settings.bookingSuccessText} /></FormField>
            <label className="flex items-center justify-between rounded-xl border border-stone-200 p-4 text-sm font-bold md:col-span-2">Invito a installare l’app<Switch checked={settings.installPromptEnabled} onCheckedChange={(installPromptEnabled) => setSettings({ ...settings, installPromptEnabled })} /></label>
          </div>
        </SectionCard>

        <SectionCard title="Comportamento scelto" subtitle="Riepilogo operativo delle regole applicate al cliente.">
          <div className="space-y-3 text-sm">
            <p className="rounded-xl bg-sky-50 p-4 font-semibold text-sky-950">Le nuove prenotazioni entrano come <strong>{settings.bookingDefaultStatus === "confirmed" ? "Confermate" : "In attesa"}</strong>.</p>
            <p className="rounded-xl bg-stone-50 p-4 text-stone-700">Finestra prenotabile: da {settings.minBookingNoticeHours} ore a {settings.maxAdvanceDays} giorni in anticipo.</p>
            <p className="rounded-xl bg-stone-50 p-4 text-stone-700">Il cliente {settings.allowCancellation ? `può annullare fino a ${settings.cancellationPolicyHours} ore prima` : "non può annullare autonomamente"} e {settings.allowReschedule ? "può richiedere un cambio orario" : "non può richiedere cambi orario"}.</p>
          </div>
        </SectionCard>
      </div>
      <div className="mt-5 flex justify-end"><Button disabled={saving} onClick={() => void save()} variant="primary">{saving ? "Salvataggio..." : "Salva App Clienti"}</Button></div>
    </AppPage>
  );
}
