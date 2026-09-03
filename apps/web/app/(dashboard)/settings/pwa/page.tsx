"use client";

import { useEffect, useState } from "react";
import { ExternalLink, LoaderCircle } from "lucide-react";
import { AppPage, FormField, PageHeader, SaveActionButton, SaveToast, SectionCard, Switch } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
const pwaBaseUrl = (process.env.NEXT_PUBLIC_PWA_URL ?? "").replace(/\/+$/, "");

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

type SavingSection = "appearance" | "autonomy" | "booking";

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

const bookingNoticeOptions = [1, 2, 4, 6, 12, 24, 48];
const bookingWindowOptions = [7, 14, 30, 60, 90, 180];
const cancellationOptions = [0, 2, 4, 6, 12, 24, 48, 72];

function HoursField({
  disabled,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange(value: number): void;
  options: number[];
  value: number;
}) {
  return (
    <FormField label={label}>
      <select className="w-full" disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} value={value}>
        {!options.includes(value) && <option value={value}>{value} ore — valore attuale</option>}
        {options.map((option) => <option key={option} value={option}>{option === 0 ? "Nessun anticipo" : `${option} ${option === 1 ? "ora" : "ore"}`}</option>)}
      </select>
    </FormField>
  );
}

function DaysField({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange(value: number): void;
  options: number[];
  value: number;
}) {
  return (
    <FormField label={label}>
      <select className="w-full" onChange={(event) => onChange(Number(event.target.value))} value={value}>
        {!options.includes(value) && <option value={value}>{value} giorni — valore attuale</option>}
        {options.map((option) => <option key={option} value={option}>{option} giorni</option>)}
      </select>
    </FormField>
  );
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
  const [saving, setSaving] = useState<SavingSection>();
  const [saved, setSaved] = useState<SavingSection>();
  const [previewRevision, setPreviewRevision] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(true);
  const previewUrl = salon && pwaBaseUrl ? `${pwaBaseUrl}/${encodeURIComponent(salon.slug)}` : "";

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

  async function save(section: SavingSection) {
    if (!salon || saving) return;
    setSaving(section);
    setSaved(undefined);
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
      setSaved(section);
      setPreviewLoading(true);
      setPreviewRevision((revision) => revision + 1);
    } catch {
      setMessage("Salvataggio non riuscito. Verifica che il server API sia raggiungibile.");
    } finally {
      setSaving(undefined);
    }
  }

  if (loading) return <AppPage maxWidth="max-w-[1600px]"><div className="h-96 animate-pulse rounded-xl bg-stone-100" /></AppPage>;

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <SaveToast variant={message.includes("non riuscito") || message.includes("Impossibile") ? "error" : "success"} visible={Boolean(message)}>{message}</SaveToast>
      <PageHeader eyebrow="Canale clienti" title="App Clienti" subtitle="Prenotazioni online, autonomia del cliente e identità dell’app in un unico spazio." />
      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title="Prenotazioni online" subtitle="Decidi come entra in agenda una prenotazione inviata dal cliente.">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm font-semibold md:col-span-2">Prenotazioni online attive<Switch aria-label="Prenotazioni online attive" checked={settings.onlineBookingEnabled} onCheckedChange={(onlineBookingEnabled) => setSettings({ ...settings, onlineBookingEnabled })} /></label>
            <FormField className="md:col-span-2" label="Stato iniziale della prenotazione">
              <select className="w-full" value={settings.bookingDefaultStatus} onChange={(event) => setSettings({ ...settings, bookingDefaultStatus: event.target.value as AppClientiSettings["bookingDefaultStatus"] })}>
                <option value="pending">In attesa di conferma</option>
                <option value="confirmed">Confermato direttamente</option>
              </select>
            </FormField>
            <HoursField label="Anticipo minimo" onChange={(minBookingNoticeHours) => setSettings({ ...settings, minBookingNoticeHours })} options={bookingNoticeOptions} value={settings.minBookingNoticeHours} />
            <DaysField label="Prenotabile fino a" onChange={(maxAdvanceDays) => setSettings({ ...settings, maxAdvanceDays })} options={bookingWindowOptions} value={settings.maxAdvanceDays} />
            <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-stone-200 p-4 text-sm font-semibold md:col-span-2">Permetti preferenza collaboratore<Switch aria-label="Preferenza collaboratore" checked={settings.allowStaffPreference} onCheckedChange={(allowStaffPreference) => setSettings({ ...settings, allowStaffPreference })} /></label>
            <div className="flex justify-end border-t border-stone-100 pt-4 md:col-span-2"><SaveActionButton busy={saving === "booking"} disabled={Boolean(saving && saving !== "booking")} idleLabel="Salva prenotazioni" onClick={() => void save("booking")} saved={saved === "booking"} /></div>
          </div>
        </SectionCard>

        <SectionCard title="Autonomia cliente" subtitle="Regole applicate nella sezione I miei appuntamenti.">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-stone-200 p-4 text-sm font-semibold md:col-span-2">Cancellazione autonoma<Switch aria-label="Cancellazione autonoma" checked={settings.allowCancellation} onCheckedChange={(allowCancellation) => setSettings({ ...settings, allowCancellation })} /></label>
            <div className="md:col-span-2"><HoursField disabled={!settings.allowCancellation} label="Cancellazione consentita fino a" onChange={(cancellationPolicyHours) => setSettings({ ...settings, cancellationPolicyHours })} options={cancellationOptions} value={settings.cancellationPolicyHours} /></div>
            <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-stone-200 p-4 text-sm font-semibold md:col-span-2">Richiesta cambio orario<Switch aria-label="Richiesta cambio orario" checked={settings.allowReschedule} onCheckedChange={(allowReschedule) => setSettings({ ...settings, allowReschedule })} /></label>
            <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl bg-stone-50 p-4 text-sm font-semibold">Email obbligatoria<Switch aria-label="Email obbligatoria" checked={settings.requireEmail} onCheckedChange={(requireEmail) => setSettings({ ...settings, requireEmail })} /></label>
            <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl bg-stone-50 p-4 text-sm font-semibold">Telefono obbligatorio<Switch aria-label="Telefono obbligatorio" checked={settings.requirePhone} onCheckedChange={(requirePhone) => setSettings({ ...settings, requirePhone })} /></label>
            <div className="flex justify-end border-t border-stone-100 pt-4 md:col-span-2"><SaveActionButton busy={saving === "autonomy"} disabled={Boolean(saving && saving !== "autonomy")} idleLabel="Salva autonomia" onClick={() => void save("autonomy")} saved={saved === "autonomy"} /></div>
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
            <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-stone-200 p-4 text-sm font-semibold md:col-span-2">Invito a installare l’app<Switch aria-label="Invito a installare l’app" checked={settings.installPromptEnabled} onCheckedChange={(installPromptEnabled) => setSettings({ ...settings, installPromptEnabled })} /></label>
            <div className="flex justify-end border-t border-stone-100 pt-4 md:col-span-2"><SaveActionButton busy={saving === "appearance"} disabled={Boolean(saving && saving !== "appearance")} idleLabel="Salva aspetto" onClick={() => void save("appearance")} saved={saved === "appearance"} /></div>
          </div>
        </SectionCard>

        <SectionCard title="Comportamento scelto" subtitle="Riepilogo operativo e anteprima aggiornata dell’esperienza cliente.">
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(280px,360px)_360px] xl:justify-between">
            <div className="space-y-3 text-sm">
              <p className="rounded-xl bg-sky-50 p-4 font-semibold text-sky-950">Le nuove prenotazioni entrano come <strong>{settings.bookingDefaultStatus === "confirmed" ? "Confermate" : "In attesa"}</strong>.</p>
              <p className="rounded-xl bg-stone-50 p-4 text-stone-700">Finestra prenotabile: da {settings.minBookingNoticeHours} ore a {settings.maxAdvanceDays} giorni in anticipo.</p>
              <p className="rounded-xl bg-stone-50 p-4 text-stone-700">Il cliente {settings.allowCancellation ? `può annullare fino a ${settings.cancellationPolicyHours} ore prima` : "non può annullare autonomamente"} e {settings.allowReschedule ? "può richiedere un cambio orario" : "non può richiedere cambi orario"}.</p>
              <p className="text-xs leading-5 text-stone-500">L’anteprima si aggiorna automaticamente dopo ogni salvataggio riuscito.</p>
            </div>
            <div className="mx-auto w-full max-w-[360px] xl:justify-self-end">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div><h3 className="text-sm font-semibold text-stone-900">Anteprima App Clienti</h3><p className="mt-0.5 truncate text-xs text-stone-500">/{salon?.slug ?? ""}</p></div>
                {previewUrl && <a aria-label="Apri anteprima App Clienti in una nuova scheda" className="grid size-11 shrink-0 place-items-center rounded-xl border border-stone-200 text-stone-600 hover:border-[#792f59] hover:bg-[#faf3f7] hover:text-[#792f59]" href={previewUrl} rel="noreferrer" target="_blank"><ExternalLink aria-hidden="true" className="size-4" /></a>}
              </div>
              {previewUrl ? <div className="relative overflow-hidden rounded-[28px] border-[6px] border-[#2d1d27] bg-stone-100 shadow-[0_18px_44px_rgb(45_29_39_/_0.16)]">
                {previewLoading && <div aria-live="polite" className="absolute inset-0 z-10 grid place-items-center bg-white/90 text-sm font-semibold text-stone-600"><span className="flex items-center gap-2"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />Aggiornamento anteprima…</span></div>}
                <iframe
                  className="block aspect-[390/780] w-full bg-white"
                  key={`${previewUrl}-${previewRevision}`}
                  onLoad={() => setPreviewLoading(false)}
                  sandbox="allow-forms allow-same-origin allow-scripts"
                  src={previewUrl}
                  title={`Anteprima App Clienti di ${salon?.name ?? "salone"}`}
                />
              </div> : <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">Configura <code className="font-semibold">NEXT_PUBLIC_PWA_URL</code> per mostrare l’anteprima dell’app.</div>}
            </div>
          </div>
        </SectionCard>
      </div>
    </AppPage>
  );
}
