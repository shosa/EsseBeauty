"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, LoaderCircle } from "lucide-react";

import type { WorkingHours } from "@esse-beauty/shared";
import { AppPage, Button, DateField, FormField, InlineError, PageHeader, PageSkeleton, ScheduleEditor, SectionCard, Switch } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Settings {
  address?: string | null;
  cancellationPolicyHours: number;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  locale: string;
  longitude?: number | null;
  name: string;
  onlineBookingEnabled: boolean;
  openingHours?: WorkingHours;
  postalCode?: string | null;
  province?: string | null;
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

const emptyOpeningHours: WorkingHours = {
  mon: [],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
  sun: [],
};

const timezoneOptions = [
  { label: "Roma — Europa centrale", value: "Europe/Rome" },
  { label: "Londra — Regno Unito", value: "Europe/London" },
  { label: "Parigi — Europa centrale", value: "Europe/Paris" },
  { label: "Berlino — Europa centrale", value: "Europe/Berlin" },
  { label: "Madrid — Europa centrale", value: "Europe/Madrid" },
  { label: "Zurigo — Europa centrale", value: "Europe/Zurich" },
];

const slotOptions = [5, 10, 15, 20, 30, 45, 60];
const bufferOptions = [0, 5, 10, 15, 20, 30, 45, 60];
const noticeOptions = [0, 1, 2, 4, 6, 12, 24, 48, 72];
const cancellationOptions = [0, 2, 4, 6, 12, 24, 48, 72];
const overbookingOptions = [1, 2, 3, 4, 5];
const countryOptions = ["Italia", "Svizzera", "Francia", "Germania", "Spagna", "Regno Unito"];

interface SalonClosure {
  date: string;
  id: string;
  reason?: string | null;
  recurringYearly: boolean;
}

type SavingSection = "calendar" | "closure" | "location" | "salon";

function SaveActionButton({
  busy,
  disabled = false,
  idleLabel,
  saved,
  type = "button",
  onClick,
}: {
  busy: boolean;
  disabled?: boolean;
  idleLabel: string;
  onClick?: () => void;
  saved: boolean;
  type?: "button" | "submit";
}) {
  return (
    <span aria-live="polite" className="inline-flex">
      <Button
        aria-busy={busy}
        className={saved ? "save-action-confirmed" : "transition-[background-color,border-color,transform] duration-200"}
        disabled={disabled || busy}
        onClick={onClick}
        type={type}
        variant="primary"
      >
        {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : saved ? <Check aria-hidden="true" className="size-4" /> : null}
        {busy ? "Salvataggio…" : saved ? "Salvato" : idleLabel}
      </Button>
    </span>
  );
}

export default function SettingsView({ view }: { view: "agenda" | "salon" }) {
  const { salon } = useAuth();
  const [settings, setSettings] = useState<Settings>();
  const [calendar, setCalendar] = useState<CalendarControl>({});
  const [closures, setClosures] = useState<SalonClosure[]>([]);
  const [closureDate, setClosureDate] = useState("");
  const [loadError, setLoadError] = useState("");
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState<SavingSection>();
  const [saved, setSaved] = useState<SavingSection>();
  const [saveErrors, setSaveErrors] = useState<Partial<Record<SavingSection, string>>>({});
  const [locationNotice, setLocationNotice] = useState<{ error?: boolean; text: string }>();
  const [deletingClosureId, setDeletingClosureId] = useState<string>();

  useEffect(() => {
    if (!salon) return;
    const controller = new AbortController();
    setLoadError("");
    const readJson = async (url: string, fallback?: unknown) => {
      const response = await fetch(url, { credentials: "include", signal: controller.signal });
      if (!response.ok) {
        if (fallback !== undefined) return fallback;
        throw new Error("LOAD_FAILED");
      }
      return response.json();
    };
    void Promise.all([
      readJson(`${api}/api/salons/${salon.id}/settings`),
      view === "agenda" ? readJson(`${api}/api/salons/${salon.id}/settings/control-center`) : Promise.resolve({ calendar: {} }),
      view === "agenda" ? readJson(`${api}/api/salons/${salon.id}/settings/closures`, []) : Promise.resolve([]),
    ]).then(([salonSettings, control, closureRows]) => {
      setSettings(salonSettings as Settings);
      setCalendar({
        allowOverbooking: control.calendar?.allowOverbooking ?? false,
        bufferMinutes: control.calendar?.bufferMinutes ?? 0,
        cancellationPolicyHours: control.calendar?.cancellationPolicyHours ?? salonSettings.cancellationPolicyHours,
        defaultView: control.calendar?.defaultView ?? "day",
        enableResourceView: control.calendar?.enableResourceView ?? false,
        minBookingNoticeHours: control.calendar?.minBookingNoticeHours ?? 2,
        minSlotMinutes: control.calendar?.minSlotMinutes ?? 15,
        overbookingLimit: control.calendar?.overbookingLimit ?? 0,
      });
      setClosures(Array.isArray(closureRows) ? closureRows as SalonClosure[] : []);
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) setLoadError("Impossibile caricare le impostazioni. Verifica la connessione e riprova.");
    });
    return () => controller.abort();
  }, [salon, view]);

  async function requestWithFeedback(
    section: SavingSection,
    request: () => Promise<Response>,
    errorMessage: string,
  ) {
    if (saving) return null;
    setSaved(undefined);
    setSaveErrors((current) => ({ ...current, [section]: undefined }));
    setSaving(section);
    try {
      const response = await request();
      if (response.ok) {
        setSaved(section);
        window.setTimeout(() => setSaved((current) => current === section ? undefined : current), 1800);
      } else {
        setSaveErrors((current) => ({ ...current, [section]: errorMessage }));
      }
      return response;
    } catch {
      setSaveErrors((current) => ({ ...current, [section]: errorMessage }));
      return null;
    } finally {
      setSaving(undefined);
    }
  }

  async function saveSalon() {
    if (!settings || !salon) return;
    await requestWithFeedback("salon", () => fetch(`${api}/api/salons/${salon.id}/settings`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cancellation_policy_hours: settings.cancellationPolicyHours,
        locale: settings.locale,
        name: settings.name,
        opening_hours: settings.openingHours,
        timezone: settings.timezone,
      }),
    }), "Impossibile salvare i dati del salone. Riprova.");
  }

  async function saveLocation() {
    if (!settings || !salon) return;
    await requestWithFeedback("location", () => fetch(`${api}/api/salons/${salon.id}/settings`, {
      body: JSON.stringify({
        address: settings.address,
        city: settings.city,
        country: settings.country,
        latitude: settings.latitude,
        longitude: settings.longitude,
        postal_code: settings.postalCode,
        province: settings.province,
      }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    }), "Impossibile salvare la posizione. Riprova.");
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationNotice({ error: true, text: "Geolocalizzazione non disponibile su questo dispositivo." });
      return;
    }
    setLocationNotice(undefined);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSettings((current) => current ? {
          ...current,
          latitude: Number(position.coords.latitude.toFixed(7)),
          longitude: Number(position.coords.longitude.toFixed(7)),
        } : current);
        setLocating(false);
        setLocationNotice({ text: "Coordinate rilevate. Salva la posizione per confermare." });
      },
      () => {
        setLocating(false);
        setLocationNotice({ error: true, text: "Non è stato possibile rilevare la posizione." });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function saveCalendar() {
    if (!salon) return;
    await requestWithFeedback("calendar", () => fetch(`${api}/api/salons/${salon.id}/settings/calendar`, {
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
    }), "Impossibile salvare le regole dell’agenda. Riprova.");
  }

  async function reloadClosures() {
    if (!salon) return;
    const rows = await fetch(`${api}/api/salons/${salon.id}/settings/closures`, { credentials: "include" }).then((response) => response.json());
    setClosures(Array.isArray(rows) ? rows as SalonClosure[] : []);
  }

  async function addClosure(formData: FormData) {
    if (!salon) return;
    const response = await requestWithFeedback("closure", () => fetch(`${api}/api/salons/${salon.id}/settings/closures`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        date: formData.get("date"),
        reason: formData.get("reason") || undefined,
        recurring_yearly: formData.get("recurring_yearly") === "on",
      }),
    }), "Impossibile salvare il giorno di chiusura. Riprova.");
    if (response?.ok) {
      setClosureDate("");
      await reloadClosures();
    }
  }

  async function removeClosure(closureId: string) {
    if (!salon || deletingClosureId) return;
    setDeletingClosureId(closureId);
    setSaveErrors((current) => ({ ...current, closure: undefined }));
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/settings/closures/${closureId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (response.ok) setClosures((current) => current.filter((item) => item.id !== closureId));
      else setSaveErrors((current) => ({ ...current, closure: "Impossibile rimuovere il giorno di chiusura. Riprova." }));
    } catch {
      setSaveErrors((current) => ({ ...current, closure: "Impossibile rimuovere il giorno di chiusura. Riprova." }));
    } finally {
      setDeletingClosureId(undefined);
    }
  }

  if (loadError) {
    return <AppPage maxWidth="max-w-[1600px]"><InlineError>{loadError}</InlineError></AppPage>;
  }

  if (!settings) {
    return <AppPage maxWidth="max-w-[1600px]"><PageSkeleton /></AppPage>;
  }

  const currentTimezoneIsListed = timezoneOptions.some((option) => option.value === settings.timezone);

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageHeader
        eyebrow={view === "salon" ? "Impostazioni" : "Organizzazione"}
        title={view === "salon" ? "Salone" : "Agenda e chiusure"}
        subtitle={view === "salon" ? "Identità, orari e posizione del salone." : "Regole operative dell’agenda e giorni in cui le prenotazioni sono sospese."}
      />

      <div className="grid items-start gap-5 xl:grid-cols-2">
        {view === "salon" && <>
        <SectionCard title="Dati del salone" subtitle="Informazioni generali e orari di apertura usati in tutto il gestionale.">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField className="md:col-span-2" label="Nome salone"><input className="w-full" value={settings.name} onChange={(event) => setSettings({ ...settings, name: event.target.value })} /></FormField>
            <FormField label="Lingua"><select className="w-full" value={settings.locale} onChange={(event) => setSettings({ ...settings, locale: event.target.value })}><option value="it-IT">Italiano</option><option value="en-GB">English</option></select></FormField>
            <FormField description="Gli orari vengono adeguati automaticamente all’ora legale." label="Fuso orario">
              <select className="w-full" value={settings.timezone} onChange={(event) => setSettings({ ...settings, timezone: event.target.value })}>
                {!currentTimezoneIsListed && <option value={settings.timezone}>{settings.timezone}</option>}
                {timezoneOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </FormField>
          </div>
          <div className="mt-6 border-t border-stone-200 pt-5">
            <h3 className="text-sm font-bold text-stone-900">Orari di apertura</h3>
            <p className="mb-4 mt-1 text-sm leading-5 text-stone-500">Definiscono la disponibilità ordinaria del salone.</p>
            <ScheduleEditor onChange={(openingHours) => setSettings({ ...settings, openingHours })} value={settings.openingHours ?? emptyOpeningHours} />
          </div>
          <div className="mt-5 border-t border-stone-200 pt-4">
            {saveErrors.salon && <div className="mb-3"><InlineError>{saveErrors.salon}</InlineError></div>}
            <div className="flex justify-end"><SaveActionButton busy={saving === "salon"} disabled={Boolean(saving && saving !== "salon")} idleLabel="Salva dati salone" onClick={() => void saveSalon()} saved={saved === "salon"} /></div>
          </div>
        </SectionCard>

        <SectionCard title="Indirizzo e geolocalizzazione" subtitle="Questi dati permettono ai clienti di trovare il salone dall’App Clienti.">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField className="md:col-span-2" label="Indirizzo">
              <input autoComplete="street-address" className="w-full" onChange={(event) => setSettings({ ...settings, address: event.target.value })} value={settings.address ?? ""} />
            </FormField>
            <FormField label="CAP">
              <input autoComplete="postal-code" className="w-full" inputMode="numeric" onChange={(event) => setSettings({ ...settings, postalCode: event.target.value })} value={settings.postalCode ?? ""} />
            </FormField>
            <FormField label="Città">
              <input autoComplete="address-level2" className="w-full" onChange={(event) => setSettings({ ...settings, city: event.target.value })} value={settings.city ?? ""} />
            </FormField>
            <FormField label="Provincia">
              <input autoComplete="address-level1" className="w-full" maxLength={2} onChange={(event) => setSettings({ ...settings, province: event.target.value.toUpperCase() })} value={settings.province ?? ""} />
            </FormField>
            <FormField label="Paese">
              <select autoComplete="country-name" className="w-full" onChange={(event) => setSettings({ ...settings, country: event.target.value })} value={settings.country ?? "Italia"}>
                {!countryOptions.includes(settings.country ?? "Italia") && <option value={settings.country ?? ""}>{settings.country}</option>}
                {countryOptions.map((country) => <option key={country} value={country}>{country}</option>)}
              </select>
            </FormField>
            <details className="group rounded-xl border border-stone-200 bg-stone-50 md:col-span-2">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold text-stone-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20">
                Coordinate avanzate
                <span className="flex items-center gap-2 text-xs font-medium text-stone-500">{settings.latitude != null && settings.longitude != null ? "Configurate" : "Non configurate"}<ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" /></span>
              </summary>
              <div className="grid gap-4 border-t border-stone-200 p-4 md:grid-cols-2">
                <FormField description="Valore decimale, per esempio 45.4642." label="Latitudine">
                  <input className="w-full" onChange={(event) => setSettings({ ...settings, latitude: event.target.value ? Number(event.target.value) : null })} step="any" type="number" value={settings.latitude ?? ""} />
                </FormField>
                <FormField description="Valore decimale, per esempio 9.1900." label="Longitudine">
                  <input className="w-full" onChange={(event) => setSettings({ ...settings, longitude: event.target.value ? Number(event.target.value) : null })} step="any" type="number" value={settings.longitude ?? ""} />
                </FormField>
              </div>
            </details>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-stone-200 pt-4">
            {locationNotice && <p aria-live={locationNotice.error ? "assertive" : "polite"} className={`w-full text-sm font-semibold ${locationNotice.error ? "text-red-700" : "text-stone-600"}`} role={locationNotice.error ? "alert" : "status"}>{locationNotice.text}</p>}
            {saveErrors.location && <div className="w-full"><InlineError>{saveErrors.location}</InlineError></div>}
            <Button aria-busy={locating} disabled={locating || Boolean(saving)} onClick={useCurrentLocation} variant="outline">{locating ? <><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />Rilevamento…</> : "Usa posizione attuale"}</Button>
            <SaveActionButton busy={saving === "location"} disabled={Boolean(saving && saving !== "location")} idleLabel="Salva posizione" onClick={() => void saveLocation()} saved={saved === "location"} />
          </div>
        </SectionCard>
        </>}

        {view === "agenda" && <>
        <SectionCard title="Calendario e agenda" subtitle="Regole condivise da gestionale, App Clienti e App Staff.">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField description="Griglia usata per posizionare gli appuntamenti." label="Intervallo agenda">
              <select className="w-full" value={calendar.minSlotMinutes ?? 15} onChange={(event) => setCalendar({ ...calendar, minSlotMinutes: Number(event.target.value) })}>{!slotOptions.includes(calendar.minSlotMinutes ?? 15) && <option value={calendar.minSlotMinutes}>{calendar.minSlotMinutes} minuti — valore attuale</option>}{slotOptions.map((minutes) => <option key={minutes} value={minutes}>{minutes} minuti</option>)}</select>
            </FormField>
            <FormField description="Tempo libero aggiunto dopo ogni appuntamento." label="Pausa automatica">
              <select className="w-full" value={calendar.bufferMinutes ?? 0} onChange={(event) => setCalendar({ ...calendar, bufferMinutes: Number(event.target.value) })}>{!bufferOptions.includes(calendar.bufferMinutes ?? 0) && <option value={calendar.bufferMinutes}>{calendar.bufferMinutes} minuti — valore attuale</option>}{bufferOptions.map((minutes) => <option key={minutes} value={minutes}>{minutes === 0 ? "Nessuna pausa" : `${minutes} minuti`}</option>)}</select>
            </FormField>
            <FormField description="Quanto prima deve essere effettuata una prenotazione." label="Preavviso minimo">
              <select className="w-full" value={calendar.minBookingNoticeHours ?? 2} onChange={(event) => setCalendar({ ...calendar, minBookingNoticeHours: Number(event.target.value) })}>{!noticeOptions.includes(calendar.minBookingNoticeHours ?? 2) && <option value={calendar.minBookingNoticeHours}>{calendar.minBookingNoticeHours} ore — valore attuale</option>}{noticeOptions.map((hours) => <option key={hours} value={hours}>{hours === 0 ? "Nessun limite" : hours === 1 ? "1 ora" : `${hours} ore`}</option>)}</select>
            </FormField>
            <FormField description="Termine oltre il quale il cliente non può annullare." label="Termine di cancellazione">
              <select className="w-full" value={calendar.cancellationPolicyHours ?? 24} onChange={(event) => setCalendar({ ...calendar, cancellationPolicyHours: Number(event.target.value) })}>{!cancellationOptions.includes(calendar.cancellationPolicyHours ?? 24) && <option value={calendar.cancellationPolicyHours}>{calendar.cancellationPolicyHours} ore prima — valore attuale</option>}{cancellationOptions.map((hours) => <option key={hours} value={hours}>{hours === 0 ? "Fino all’inizio" : hours === 1 ? "1 ora prima" : `${hours} ore prima`}</option>)}</select>
            </FormField>
            <FormField className="md:col-span-2" label="Vista iniziale"><select className="w-full" value={calendar.defaultView ?? "day"} onChange={(event) => setCalendar({ ...calendar, defaultView: event.target.value })}><option value="day">Giorno</option><option value="week">Settimana</option><option value="month">Mese</option><option value="agenda">Agenda</option><option value="staff_columns">Colonne staff</option><option value="resources">Risorse</option></select></FormField>
            <label className="flex min-h-16 items-center justify-between gap-4 rounded-xl border border-stone-200 px-4 py-3 md:col-span-2"><span><span className="block text-sm font-bold text-stone-900">Overbooking controllato</span><span className="mt-0.5 block text-xs font-medium leading-5 text-stone-500">Consente più appuntamenti nello stesso intervallo.</span></span><Switch aria-label="Overbooking controllato" checked={Boolean(calendar.allowOverbooking)} onCheckedChange={(allowOverbooking) => setCalendar({ ...calendar, allowOverbooking })} /></label>
            {calendar.allowOverbooking && <FormField className="md:col-span-2" description="Numero massimo di appuntamenti aggiuntivi nello stesso intervallo." label="Limite overbooking"><select className="w-full" value={Math.max(1, calendar.overbookingLimit ?? 1)} onChange={(event) => setCalendar({ ...calendar, overbookingLimit: Number(event.target.value) })}>{overbookingOptions.map((limit) => <option key={limit} value={limit}>{limit === 1 ? "1 appuntamento aggiuntivo" : `${limit} appuntamenti aggiuntivi`}</option>)}</select></FormField>}
            <label className="flex min-h-16 items-center justify-between gap-4 rounded-xl border border-stone-200 px-4 py-3 md:col-span-2"><span><span className="block text-sm font-bold text-stone-900">Vista risorse</span><span className="mt-0.5 block text-xs font-medium leading-5 text-stone-500">Mostra cabine e altre risorse nelle viste compatibili.</span></span><Switch aria-label="Vista risorse" checked={Boolean(calendar.enableResourceView)} onCheckedChange={(enableResourceView) => setCalendar({ ...calendar, enableResourceView })} /></label>
          </div>
          <div className="mt-5 border-t border-stone-200 pt-4">
            {saveErrors.calendar && <div className="mb-3"><InlineError>{saveErrors.calendar}</InlineError></div>}
            <div className="flex justify-end"><SaveActionButton busy={saving === "calendar"} disabled={Boolean(saving && saving !== "calendar")} idleLabel="Salva regole agenda" onClick={() => void saveCalendar()} saved={saved === "calendar"} /></div>
          </div>
        </SectionCard>
        <SectionCard title="Giorni di chiusura" subtitle="Festività, ferie e chiusure straordinarie bloccano le prenotazioni e sono visibili in agenda.">
          <form action={addClosure} className="grid gap-4 md:grid-cols-2">
            <FormField label="Data chiusura" required><DateField aria-label="Data chiusura" name="date" onChange={setClosureDate} required value={closureDate} /></FormField>
            <FormField label="Motivo"><input className="w-full" name="reason" placeholder="Ferie, festività, formazione…" /></FormField>
            <label className="flex min-h-12 items-center gap-3 rounded-xl border border-stone-200 px-4 text-sm font-bold">
              <input name="recurring_yearly" type="checkbox" />
              Ripeti ogni anno
            </label>
            <div className="flex items-center justify-end"><SaveActionButton busy={saving === "closure"} disabled={!closureDate || Boolean(saving && saving !== "closure")} idleLabel="Aggiungi chiusura" saved={saved === "closure"} type="submit" /></div>
          </form>
          {saveErrors.closure && <div className="mt-4"><InlineError>{saveErrors.closure}</InlineError></div>}
          <div className="mt-5 grid gap-2 border-t border-stone-200 pt-4">
            {closures.length === 0 && <p className="text-sm font-semibold text-stone-500">Nessun giorno di chiusura configurato.</p>}
            {closures.map((closure) => (
              <article className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-3 text-sm" key={closure.id}>
                <span><b>{new Date(`${closure.date}T00:00:00`).toLocaleDateString("it-IT", { dateStyle: "full" })}</b>{closure.recurringYearly ? " - ogni anno" : ""}<br />{closure.reason || "Chiusura salone"}</span>
                <Button aria-busy={deletingClosureId === closure.id} disabled={Boolean(saving) || Boolean(deletingClosureId)} size="sm" variant="destructive" onClick={() => void removeClosure(closure.id)}>{deletingClosureId === closure.id ? <><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />Eliminazione…</> : "Elimina"}</Button>
              </article>
            ))}
          </div>
        </SectionCard>
        </>}

      </div>
    </AppPage>
  );
}
