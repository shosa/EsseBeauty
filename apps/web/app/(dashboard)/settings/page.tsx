"use client";

import { useEffect, useState } from "react";

import type { WorkingHours } from "@esse-beauty/shared";
import { AppPage, Button, FormField, PageHeader, SaveToast, ScheduleEditor, SectionCard, Switch } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Settings {
  cancellationPolicyHours: number;
  locale: string;
  name: string;
  onlineBookingEnabled: boolean;
  openingHours?: WorkingHours;
  timezone: string;
}

interface CalendarControl {
  allowOverbooking?: boolean;
  bufferMinutes?: number;
  cancellationPolicyHours?: number;
  defaultView?: string;
  enableResourceView?: boolean;
  minBookingNoticeHours?: number;
  minSlotMinutes?: number;
  overbookingLimit?: number;
}

interface BrandingControl {
  accentColor?: string;
  bookingSuccessText?: string;
  heroSubtitle?: string;
  heroTitle?: string;
  installPromptEnabled?: boolean;
  logoUrl?: string;
  primaryColor?: string;
  welcomeText?: string;
}

const emptyOpeningHours: WorkingHours = {
  mon: [],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
  sun: [],
};

interface SalonClosure {
  date: string;
  id: string;
  reason?: string | null;
  recurringYearly: boolean;
}

export default function GeneralSettingsPage() {
  const { salon } = useAuth();
  const [settings, setSettings] = useState<Settings>();
  const [calendar, setCalendar] = useState<CalendarControl>({});
  const [branding, setBranding] = useState<BrandingControl>({});
  const [closures, setClosures] = useState<SalonClosure[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!salon) return;
    void Promise.all([
      fetch(`${api}/api/salons/${salon.id}/settings`, { credentials: "include" }).then((response) => response.json()),
      fetch(`${api}/api/salons/${salon.id}/settings/control-center`, { credentials: "include" }).then((response) => response.json()),
      fetch(`${api}/api/salons/${salon.id}/settings/closures`, { credentials: "include" }).then((response) => response.ok ? response.json() : []),
    ]).then(([salonSettings, control, closureRows]) => {
      setSettings(salonSettings as Settings);
      setCalendar({
        allowOverbooking: control.calendar?.allowOverbooking ?? false,
        bufferMinutes: control.calendar?.bufferMinutes ?? 0,
        cancellationPolicyHours: control.calendar?.cancellationPolicyHours ?? salonSettings.cancellationPolicyHours,
        defaultView: control.calendar?.defaultView ?? "week",
        enableResourceView: control.calendar?.enableResourceView ?? false,
        minBookingNoticeHours: control.calendar?.minBookingNoticeHours ?? 2,
        minSlotMinutes: control.calendar?.minSlotMinutes ?? 15,
        overbookingLimit: control.calendar?.overbookingLimit ?? 0,
      });
      setBranding({
        accentColor: control.branding?.accentColor ?? "#f4d8a8",
        bookingSuccessText: control.branding?.bookingSuccessText ?? "Prenotazione ricevuta. Ti aspettiamo.",
        heroSubtitle: control.branding?.heroSubtitle ?? "Prenota il tuo trattamento in pochi passaggi.",
        heroTitle: control.branding?.heroTitle ?? salonSettings.name,
        installPromptEnabled: control.branding?.installPromptEnabled ?? true,
        logoUrl: control.branding?.logoUrl ?? "",
        primaryColor: control.branding?.primaryColor ?? "#792f59",
        welcomeText: control.branding?.welcomeText ?? "Benvenuta nel nostro salone.",
      });
      setClosures(Array.isArray(closureRows) ? closureRows as SalonClosure[] : []);
    });
  }, [salon]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [message]);

  async function saveSalon() {
    if (!settings || !salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/settings`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cancellation_policy_hours: settings.cancellationPolicyHours,
        locale: settings.locale,
        name: settings.name,
        online_booking_enabled: settings.onlineBookingEnabled,
        opening_hours: settings.openingHours,
        timezone: settings.timezone,
      }),
    });
    setMessage(response.ok ? "Dati salone salvati." : "Salvataggio non riuscito.");
  }

  async function saveCalendar() {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/settings/calendar`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        allow_overbooking: calendar.allowOverbooking,
        buffer_minutes: calendar.bufferMinutes,
        cancellation_policy_hours: calendar.cancellationPolicyHours,
        default_view: calendar.defaultView,
        enable_resource_view: calendar.enableResourceView,
        min_booking_notice_hours: calendar.minBookingNoticeHours,
        min_slot_minutes: calendar.minSlotMinutes,
        overbooking_limit: calendar.overbookingLimit,
        printable_fields: ["staff", "service", "customer", "status"],
      }),
    });
    setMessage(response.ok ? "Regole agenda salvate." : "Salvataggio non riuscito.");
  }

  async function saveBranding() {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/settings/pwa-branding`, {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accent_color: branding.accentColor,
        booking_success_text: branding.bookingSuccessText,
        hero_subtitle: branding.heroSubtitle,
        hero_title: branding.heroTitle,
        install_prompt_enabled: branding.installPromptEnabled,
        logo_url: branding.logoUrl,
        primary_color: branding.primaryColor,
        welcome_text: branding.welcomeText,
      }),
    });
    setMessage(response.ok ? "Brand PWA salvato." : "Salvataggio non riuscito.");
  }

  async function reloadClosures() {
    if (!salon) return;
    const rows = await fetch(`${api}/api/salons/${salon.id}/settings/closures`, { credentials: "include" }).then((response) => response.json());
    setClosures(Array.isArray(rows) ? rows as SalonClosure[] : []);
  }

  async function addClosure(formData: FormData) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/settings/closures`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        date: formData.get("date"),
        reason: formData.get("reason") || undefined,
        recurring_yearly: formData.get("recurring_yearly") === "on",
      }),
    });
    setMessage(response.ok ? "Giorno di chiusura salvato." : "Chiusura non salvata.");
    if (response.ok) await reloadClosures();
  }

  async function removeClosure(closureId: string) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/settings/closures/${closureId}`, {
      method: "DELETE",
      credentials: "include",
    });
    setMessage(response.ok ? "Giorno di chiusura rimosso." : "Chiusura non rimossa.");
    if (response.ok) setClosures((current) => current.filter((item) => item.id !== closureId));
  }

  if (!settings) {
    return <AppPage><SectionCard><div className="h-96 animate-pulse rounded-[2rem] bg-stone-100" /></SectionCard></AppPage>;
  }

  return (
    <AppPage maxWidth="max-w-[1500px]">
      <SaveToast variant={message.includes("non riuscito") ? "error" : "success"} visible={Boolean(message)}>{message}</SaveToast>
      <PageHeader
        eyebrow="Centro controllo"
        title="Impostazioni"
        subtitle="Qui si configurano regole, automazioni, agenda, dati e PWA. Le viste operative consumano queste impostazioni."
      />


      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Salone" subtitle="Dati principali e orari ufficiali usati da dashboard e PWA.">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Nome salone"><input value={settings.name} onChange={(event) => setSettings({ ...settings, name: event.target.value })} /></FormField>
            <FormField label="Fuso orario"><input value={settings.timezone} onChange={(event) => setSettings({ ...settings, timezone: event.target.value })} /></FormField>
            <FormField label="Lingua"><select value={settings.locale} onChange={(event) => setSettings({ ...settings, locale: event.target.value })}><option value="it-IT">Italiano</option><option value="en-GB">English</option></select></FormField>
            <label className="flex items-center justify-between rounded-2xl border border-[#ead1df] bg-[#fffafd] p-4 text-sm font-bold text-stone-800">
              Prenotazione online
              <Switch checked={settings.onlineBookingEnabled} onCheckedChange={(onlineBookingEnabled) => setSettings({ ...settings, onlineBookingEnabled })} />
            </label>
          </div>
          <div className="mt-5"><ScheduleEditor onChange={(openingHours) => setSettings({ ...settings, openingHours })} value={settings.openingHours ?? emptyOpeningHours} /></div>
          <Button className="mt-5" onClick={() => void saveSalon()} variant="primary">Salva dati salone</Button>
        </SectionCard>

        <SectionCard title="Calendario e agenda" subtitle="Regole enterprise usate da calendario web, PWA clienti e PWA staff.">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Slot minimo"><input min={5} type="number" value={calendar.minSlotMinutes ?? 15} onChange={(event) => setCalendar({ ...calendar, minSlotMinutes: Number(event.target.value) })} /></FormField>
            <FormField label="Buffer tra appuntamenti"><input min={0} type="number" value={calendar.bufferMinutes ?? 0} onChange={(event) => setCalendar({ ...calendar, bufferMinutes: Number(event.target.value) })} /></FormField>
            <FormField label="Anticipo minimo prenotazione"><input min={0} type="number" value={calendar.minBookingNoticeHours ?? 2} onChange={(event) => setCalendar({ ...calendar, minBookingNoticeHours: Number(event.target.value) })} /></FormField>
            <FormField label="Cancellazione entro ore"><input min={0} type="number" value={calendar.cancellationPolicyHours ?? 24} onChange={(event) => setCalendar({ ...calendar, cancellationPolicyHours: Number(event.target.value) })} /></FormField>
            <FormField label="Vista predefinita"><select value={calendar.defaultView ?? "week"} onChange={(event) => setCalendar({ ...calendar, defaultView: event.target.value })}><option value="day">Giorno</option><option value="week">Settimana</option><option value="month">Mese</option><option value="agenda">Agenda</option><option value="staff_columns">Colonne staff</option><option value="resources">Risorse</option></select></FormField>
            <FormField label="Limite overbooking"><input min={0} type="number" value={calendar.overbookingLimit ?? 0} onChange={(event) => setCalendar({ ...calendar, overbookingLimit: Number(event.target.value) })} /></FormField>
            <label className="flex items-center justify-between rounded-2xl border border-[#ead1df] bg-[#fffafd] p-4 text-sm font-bold text-stone-800">Overbooking controllato<Switch checked={Boolean(calendar.allowOverbooking)} onCheckedChange={(allowOverbooking) => setCalendar({ ...calendar, allowOverbooking })} /></label>
            <label className="flex items-center justify-between rounded-2xl border border-[#ead1df] bg-[#fffafd] p-4 text-sm font-bold text-stone-800">Vista risorse<Switch checked={Boolean(calendar.enableResourceView)} onCheckedChange={(enableResourceView) => setCalendar({ ...calendar, enableResourceView })} /></label>
          </div>
          <Button className="mt-5" onClick={() => void saveCalendar()} variant="primary">Salva regole agenda</Button>
        </SectionCard>

        <SectionCard title="Brand e PWA cliente" subtitle="Testi, colori e installazione della superficie pubblica.">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Logo URL"><input value={branding.logoUrl ?? ""} onChange={(event) => setBranding({ ...branding, logoUrl: event.target.value })} /></FormField>
            <FormField label="Colore principale"><input value={branding.primaryColor ?? ""} onChange={(event) => setBranding({ ...branding, primaryColor: event.target.value })} /></FormField>
            <FormField label="Titolo hero"><input value={branding.heroTitle ?? ""} onChange={(event) => setBranding({ ...branding, heroTitle: event.target.value })} /></FormField>
            <FormField label="Sottotitolo hero"><input value={branding.heroSubtitle ?? ""} onChange={(event) => setBranding({ ...branding, heroSubtitle: event.target.value })} /></FormField>
            <FormField className="md:col-span-2" label="Messaggio benvenuto"><textarea value={branding.welcomeText ?? ""} onChange={(event) => setBranding({ ...branding, welcomeText: event.target.value })} /></FormField>
            <label className="flex items-center justify-between rounded-2xl border border-[#ead1df] bg-[#fffafd] p-4 text-sm font-bold text-stone-800 md:col-span-2">Prompt installazione PWA<Switch checked={branding.installPromptEnabled ?? true} onCheckedChange={(installPromptEnabled) => setBranding({ ...branding, installPromptEnabled })} /></label>
          </div>
          <Button className="mt-5" onClick={() => void saveBranding()} variant="primary">Salva brand PWA</Button>
        </SectionCard>

        <SectionCard title="Giorni di chiusura" subtitle="Festivita, ferie e chiusure straordinarie bloccano la prenotazione online e sono visibili in agenda.">
          <form action={addClosure} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <FormField label="Data chiusura" required><input name="date" type="date" required /></FormField>
            <FormField label="Motivo"><input name="reason" placeholder="Ferie, festivita, formazione..." /></FormField>
            <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-[#ead1df] bg-[#fffafd] px-4 text-sm font-bold">
              <input name="recurring_yearly" type="checkbox" />
              Ogni anno
            </label>
            <div className="md:col-span-3"><Button type="submit" variant="primary">Aggiungi chiusura</Button></div>
          </form>
          <div className="mt-4 grid gap-2">
            {closures.length === 0 && <p className="text-sm font-semibold text-stone-500">Nessun giorno di chiusura configurato.</p>}
            {closures.map((closure) => (
              <article className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-100 bg-white p-3 text-sm" key={closure.id}>
                <span><b>{new Date(`${closure.date}T00:00:00`).toLocaleDateString("it-IT", { dateStyle: "full" })}</b>{closure.recurringYearly ? " - ogni anno" : ""}<br />{closure.reason || "Chiusura salone"}</span>
                <Button size="sm" variant="destructive" onClick={() => void removeClosure(closure.id)}>Elimina</Button>
              </article>
            ))}
          </div>
        </SectionCard>

      </div>
    </AppPage>
  );
}
