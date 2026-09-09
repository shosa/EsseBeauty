"use client";

import { useEffect, useState } from "react";
import { Building2, CalendarClock, CalendarOff, ChevronDown, DoorOpen, LoaderCircle, MapPin, X } from "lucide-react";

import type { WorkingHours } from "@esse-beauty/shared";
import { AppPage, Button, DateField, FormField, InlineError, PageHeader, PageSkeleton, SaveActionButton, ScheduleEditor, SectionCard, Switch, Select} from "@esse-beauty/ui";

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

interface StaffRosterItem {
  display_name: string;
  id: string;
}

interface TimePeriod {
  from: string;
  to: string;
}

interface SpecialOpening {
  date: string;
  id: string;
  periods: TimePeriod[];
  reason?: string | null;
  staff: Array<{ periods: TimePeriod[] | null; staffId: string; staffName: string }>;
}

interface SpecialOpeningStaffSelection {
  customHours: boolean;
  periods: TimePeriod[];
  selected: boolean;
}

function periodsLabel(periods: TimePeriod[]) {
  return periods.map((period) => `${period.from}–${period.to}`).join(", ");
}

function PeriodsEditor({ ariaLabelPrefix, periods, onChange }: { ariaLabelPrefix: string; onChange(next: TimePeriod[]): void; periods: TimePeriod[] }) {
  function updatePeriod(index: number, field: "from" | "to", value: string) {
    onChange(periods.map((period, itemIndex) => itemIndex === index ? { ...period, [field]: value } : period));
  }
  function addPeriod() {
    const previous = periods.at(-1);
    onChange([...periods, { from: previous?.to && previous.to < "18:00" ? previous.to : "14:00", to: "18:00" }]);
  }
  function removePeriod(index: number) {
    onChange(periods.filter((_, itemIndex) => itemIndex !== index));
  }
  return (
    <div className="space-y-2">
      {periods.map((period, index) => (
        <div className="flex items-center gap-2" key={index}>
          <input aria-label={`${ariaLabelPrefix}: inizio fascia ${index + 1}`} className="w-full" onChange={(event) => updatePeriod(index, "from", event.target.value)} type="time" value={period.from} />
          <span className="text-stone-400">–</span>
          <input aria-label={`${ariaLabelPrefix}: fine fascia ${index + 1}`} className="w-full" onChange={(event) => updatePeriod(index, "to", event.target.value)} type="time" value={period.to} />
          {periods.length > 1 && <button aria-label={`Rimuovi fascia ${index + 1} di ${ariaLabelPrefix}`} className="shrink-0 rounded-lg p-1.5 text-red-600 hover:bg-red-50" onClick={() => removePeriod(index)} type="button"><X aria-hidden="true" size={14} /></button>}
        </div>
      ))}
      <button className="text-xs font-bold text-[#792f59]" onClick={addPeriod} type="button">+ Aggiungi fascia</button>
    </div>
  );
}

type SavingSection = "calendar" | "closure" | "location" | "salon" | "specialOpening";

export default function SettingsView({ view }: { view: "agenda" | "salon" }) {
  const { salon } = useAuth();
  const [settings, setSettings] = useState<Settings>();
  const [calendar, setCalendar] = useState<CalendarControl>({});
  const [closures, setClosures] = useState<SalonClosure[]>([]);
  const [closureDate, setClosureDate] = useState("");
  const [recurringYearly, setRecurringYearly] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState<SavingSection>();
  const [saved, setSaved] = useState<SavingSection>();
  const [saveErrors, setSaveErrors] = useState<Partial<Record<SavingSection, string>>>({});
  const [locationNotice, setLocationNotice] = useState<{ error?: boolean; text: string }>();
  const [deletingClosureId, setDeletingClosureId] = useState<string>();
  const [staffRoster, setStaffRoster] = useState<StaffRosterItem[]>([]);
  const [specialOpenings, setSpecialOpenings] = useState<SpecialOpening[]>([]);
  const [specialDate, setSpecialDate] = useState("");
  const [specialPeriods, setSpecialPeriods] = useState<TimePeriod[]>([{ from: "09:00", to: "18:00" }]);
  const [specialStaffSelection, setSpecialStaffSelection] = useState<Record<string, SpecialOpeningStaffSelection>>({});
  const [deletingSpecialOpeningId, setDeletingSpecialOpeningId] = useState<string>();

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
      view === "agenda" ? readJson(`${api}/api/salons/${salon.id}/settings/staff-roster`, []) : Promise.resolve([]),
      view === "agenda" ? readJson(`${api}/api/salons/${salon.id}/settings/special-openings`, []) : Promise.resolve([]),
    ]).then(([salonSettings, control, closureRows, staffRosterRows, specialOpeningRows]) => {
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
      setStaffRoster(Array.isArray(staffRosterRows) ? staffRosterRows as StaffRosterItem[] : []);
      setSpecialOpenings(Array.isArray(specialOpeningRows) ? specialOpeningRows as SpecialOpening[] : []);
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
      setRecurringYearly(false);
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

  function toggleSpecialOpeningStaff(staffId: string, selected: boolean) {
    setSpecialStaffSelection((current) => ({
      ...current,
      [staffId]: { customHours: current[staffId]?.customHours ?? false, periods: current[staffId]?.periods ?? [], selected },
    }));
  }

  function toggleSpecialOpeningStaffCustomHours(staffId: string, customHours: boolean) {
    setSpecialStaffSelection((current) => ({
      ...current,
      [staffId]: {
        customHours,
        periods: customHours && (current[staffId]?.periods.length ?? 0) === 0 ? specialPeriods.map((period) => ({ ...period })) : current[staffId]?.periods ?? [],
        selected: current[staffId]?.selected ?? true,
      },
    }));
  }

  function setSpecialOpeningStaffPeriods(staffId: string, periods: TimePeriod[]) {
    setSpecialStaffSelection((current) => ({
      ...current,
      [staffId]: { customHours: current[staffId]?.customHours ?? true, periods, selected: current[staffId]?.selected ?? true },
    }));
  }

  async function reloadSpecialOpenings() {
    if (!salon) return;
    const rows = await fetch(`${api}/api/salons/${salon.id}/settings/special-openings`, { credentials: "include" }).then((response) => response.json());
    setSpecialOpenings(Array.isArray(rows) ? rows as SpecialOpening[] : []);
  }

  async function addSpecialOpening(formData: FormData) {
    if (!salon) return;
    const selectedStaff = Object.entries(specialStaffSelection)
      .filter(([, value]) => value.selected)
      .map(([staffId, value]) => ({ periods: value.customHours && value.periods.length > 0 ? value.periods : null, staff_id: staffId }));
    const response = await requestWithFeedback("specialOpening", () => fetch(`${api}/api/salons/${salon.id}/settings/special-openings`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        date: specialDate,
        periods: specialPeriods,
        reason: formData.get("reason") || undefined,
        staff: selectedStaff,
      }),
    }), "Impossibile salvare l’apertura speciale. Verifica gli orari e riprova.");
    if (response?.ok) {
      setSpecialDate("");
      setSpecialStaffSelection({});
      await reloadSpecialOpenings();
    }
  }

  async function removeSpecialOpening(specialOpeningId: string) {
    if (!salon || deletingSpecialOpeningId) return;
    setDeletingSpecialOpeningId(specialOpeningId);
    setSaveErrors((current) => ({ ...current, specialOpening: undefined }));
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/settings/special-openings/${specialOpeningId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (response.ok) setSpecialOpenings((current) => current.filter((item) => item.id !== specialOpeningId));
      else setSaveErrors((current) => ({ ...current, specialOpening: "Impossibile rimuovere l’apertura speciale. Riprova." }));
    } catch {
      setSaveErrors((current) => ({ ...current, specialOpening: "Impossibile rimuovere l’apertura speciale. Riprova." }));
    } finally {
      setDeletingSpecialOpeningId(undefined);
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

      <div className="grid gap-5 xl:grid-cols-2">
        {view === "salon" && <>
        <SectionCard icon={Building2} title="Dati del salone" subtitle="Informazioni generali e orari di apertura usati in tutto il gestionale.">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField className="md:col-span-2" label="Nome salone"><input className="w-full" value={settings.name} onChange={(event) => setSettings({ ...settings, name: event.target.value })} /></FormField>
            <FormField label="Lingua"><Select className="w-full" value={settings.locale} onChange={(event) => setSettings({ ...settings, locale: event.target.value })}><option value="it-IT">Italiano</option><option value="en-GB">English</option></Select></FormField>
            <FormField description="Gli orari vengono adeguati automaticamente all’ora legale." label="Fuso orario">
              <Select className="w-full" value={settings.timezone} onChange={(event) => setSettings({ ...settings, timezone: event.target.value })}>
                {!currentTimezoneIsListed && <option value={settings.timezone}>{settings.timezone}</option>}
                {timezoneOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
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

        <SectionCard icon={MapPin} title="Indirizzo e geolocalizzazione" subtitle="Questi dati permettono ai clienti di trovare il salone dall’App Clienti.">
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
              <Select autoComplete="country-name" className="w-full" onChange={(event) => setSettings({ ...settings, country: event.target.value })} value={settings.country ?? "Italia"}>
                {!countryOptions.includes(settings.country ?? "Italia") && <option value={settings.country ?? ""}>{settings.country}</option>}
                {countryOptions.map((country) => <option key={country} value={country}>{country}</option>)}
              </Select>
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
        <SectionCard icon={CalendarClock} title="Calendario e agenda" subtitle="Regole condivise da gestionale, App Clienti e App Staff.">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField description="Griglia usata per posizionare gli appuntamenti." label="Intervallo agenda">
              <Select className="w-full" value={calendar.minSlotMinutes ?? 15} onChange={(event) => setCalendar({ ...calendar, minSlotMinutes: Number(event.target.value) })}>{!slotOptions.includes(calendar.minSlotMinutes ?? 15) && <option value={calendar.minSlotMinutes}>{calendar.minSlotMinutes} minuti — valore attuale</option>}{slotOptions.map((minutes) => <option key={minutes} value={minutes}>{minutes} minuti</option>)}</Select>
            </FormField>
            <FormField description="Tempo libero aggiunto dopo ogni appuntamento." label="Pausa automatica">
              <Select className="w-full" value={calendar.bufferMinutes ?? 0} onChange={(event) => setCalendar({ ...calendar, bufferMinutes: Number(event.target.value) })}>{!bufferOptions.includes(calendar.bufferMinutes ?? 0) && <option value={calendar.bufferMinutes}>{calendar.bufferMinutes} minuti — valore attuale</option>}{bufferOptions.map((minutes) => <option key={minutes} value={minutes}>{minutes === 0 ? "Nessuna pausa" : `${minutes} minuti`}</option>)}</Select>
            </FormField>
            <FormField description="Quanto prima deve essere effettuata una prenotazione." label="Preavviso minimo">
              <Select className="w-full" value={calendar.minBookingNoticeHours ?? 2} onChange={(event) => setCalendar({ ...calendar, minBookingNoticeHours: Number(event.target.value) })}>{!noticeOptions.includes(calendar.minBookingNoticeHours ?? 2) && <option value={calendar.minBookingNoticeHours}>{calendar.minBookingNoticeHours} ore — valore attuale</option>}{noticeOptions.map((hours) => <option key={hours} value={hours}>{hours === 0 ? "Nessun limite" : hours === 1 ? "1 ora" : `${hours} ore`}</option>)}</Select>
            </FormField>
            <FormField description="Termine oltre il quale il cliente non può annullare." label="Termine di cancellazione">
              <Select className="w-full" value={calendar.cancellationPolicyHours ?? 24} onChange={(event) => setCalendar({ ...calendar, cancellationPolicyHours: Number(event.target.value) })}>{!cancellationOptions.includes(calendar.cancellationPolicyHours ?? 24) && <option value={calendar.cancellationPolicyHours}>{calendar.cancellationPolicyHours} ore prima — valore attuale</option>}{cancellationOptions.map((hours) => <option key={hours} value={hours}>{hours === 0 ? "Fino all’inizio" : hours === 1 ? "1 ora prima" : `${hours} ore prima`}</option>)}</Select>
            </FormField>
            <FormField className="md:col-span-2" label="Vista iniziale"><Select className="w-full" value={calendar.defaultView ?? "day"} onChange={(event) => setCalendar({ ...calendar, defaultView: event.target.value })}><option value="day">Giorno</option><option value="week">Settimana</option><option value="month">Mese</option><option value="agenda">Agenda</option><option value="staff_columns">Colonne staff</option><option value="resources">Risorse</option></Select></FormField>
            <label className="flex min-h-16 items-center justify-between gap-4 rounded-xl border border-stone-200 px-4 py-3 md:col-span-2"><span><span className="block text-sm font-bold text-stone-900">Overbooking controllato</span><span className="mt-0.5 block text-xs font-medium leading-5 text-stone-500">Consente più appuntamenti nello stesso intervallo.</span></span><Switch aria-label="Overbooking controllato" checked={Boolean(calendar.allowOverbooking)} onCheckedChange={(allowOverbooking) => setCalendar({ ...calendar, allowOverbooking })} /></label>
            {calendar.allowOverbooking && <FormField className="md:col-span-2" description="Numero massimo di appuntamenti aggiuntivi nello stesso intervallo." label="Limite overbooking"><Select className="w-full" value={Math.max(1, calendar.overbookingLimit ?? 1)} onChange={(event) => setCalendar({ ...calendar, overbookingLimit: Number(event.target.value) })}>{overbookingOptions.map((limit) => <option key={limit} value={limit}>{limit === 1 ? "1 appuntamento aggiuntivo" : `${limit} appuntamenti aggiuntivi`}</option>)}</Select></FormField>}
            <label className="flex min-h-16 items-center justify-between gap-4 rounded-xl border border-stone-200 px-4 py-3 md:col-span-2"><span><span className="block text-sm font-bold text-stone-900">Vista risorse</span><span className="mt-0.5 block text-xs font-medium leading-5 text-stone-500">Mostra cabine e altre risorse nelle viste compatibili.</span></span><Switch aria-label="Vista risorse" checked={Boolean(calendar.enableResourceView)} onCheckedChange={(enableResourceView) => setCalendar({ ...calendar, enableResourceView })} /></label>
          </div>
          <div className="mt-5 border-t border-stone-200 pt-4">
            {saveErrors.calendar && <div className="mb-3"><InlineError>{saveErrors.calendar}</InlineError></div>}
            <div className="flex justify-end"><SaveActionButton busy={saving === "calendar"} disabled={Boolean(saving && saving !== "calendar")} idleLabel="Salva regole agenda" onClick={() => void saveCalendar()} saved={saved === "calendar"} /></div>
          </div>
        </SectionCard>
        <SectionCard icon={CalendarOff} title="Giorni di chiusura" subtitle="Festività, ferie e chiusure straordinarie bloccano le prenotazioni e sono visibili in agenda.">
          <form action={addClosure} className="grid gap-4 md:grid-cols-2">
            <FormField label="Data chiusura" required><DateField aria-label="Data chiusura" name="date" onChange={setClosureDate} required value={closureDate} /></FormField>
            <FormField label="Motivo"><input className="w-full" name="reason" placeholder="Ferie, festività, formazione…" /></FormField>
            <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-stone-200 px-4 text-sm font-bold">
              Ripeti ogni anno
              <input name="recurring_yearly" type="hidden" value={recurringYearly ? "on" : ""} />
              <Switch checked={recurringYearly} onCheckedChange={setRecurringYearly} />
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

        <SectionCard className="xl:col-span-2" icon={DoorOpen} title="Aperture speciali" subtitle="Giornate eccezionali fuori dal normale orario: vincono su chiusure e turni configurati per i collaboratori selezionati.">
          <form action={addSpecialOpening} className="grid gap-4 md:grid-cols-2">
            <FormField label="Data apertura" required><DateField aria-label="Data apertura speciale" onChange={setSpecialDate} required value={specialDate} /></FormField>
            <FormField label="Motivo"><input className="w-full" name="reason" placeholder="Evento speciale, promozione…" /></FormField>
            <FormField className="md:col-span-2" description="Fasce usate di default dai collaboratori senza orario personalizzato. Puoi aggiungere più fasce, come per i giorni normali." label="Fasce orarie di apertura">
              <PeriodsEditor ariaLabelPrefix="Fasce di apertura" onChange={setSpecialPeriods} periods={specialPeriods} />
            </FormField>
            <div className="md:col-span-2">
              <h4 className="text-sm font-bold text-stone-900">Collaboratori presenti</h4>
              <p className="mt-1 text-xs leading-5 text-stone-500">Chi non è selezionato non risulterà disponibile in questa data. Attiva l’orario personalizzato per assegnare fasce diverse da quelle di default.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {staffRoster.map((member) => {
                  const selection = specialStaffSelection[member.id];
                  return (
                    <div className={`rounded-xl border p-3 ${selection?.selected ? "border-[#792f59] bg-[#fff8fc]" : "border-stone-200 bg-white"}`} key={member.id}>
                      <label className="flex items-center gap-2 text-sm font-bold text-stone-900">
                        <input checked={Boolean(selection?.selected)} onChange={(event) => toggleSpecialOpeningStaff(member.id, event.target.checked)} type="checkbox" />
                        {member.display_name}
                      </label>
                      {selection?.selected && (
                        <div className="mt-2">
                          <label className="flex items-center gap-2 text-xs font-semibold text-stone-600">
                            <input checked={Boolean(selection.customHours)} onChange={(event) => toggleSpecialOpeningStaffCustomHours(member.id, event.target.checked)} type="checkbox" />
                            Orario personalizzato
                          </label>
                          {selection.customHours && (
                            <div className="mt-2">
                              <PeriodsEditor ariaLabelPrefix={`Orario di ${member.display_name}`} onChange={(periods) => setSpecialOpeningStaffPeriods(member.id, periods)} periods={selection.periods.length > 0 ? selection.periods : specialPeriods} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {staffRoster.length === 0 && <p className="text-sm text-stone-500">Nessun collaboratore attivo trovato.</p>}
              </div>
            </div>
            <div className="flex items-center justify-end md:col-span-2"><SaveActionButton busy={saving === "specialOpening"} disabled={!specialDate || specialPeriods.length === 0 || Boolean(saving && saving !== "specialOpening")} idleLabel="Aggiungi apertura speciale" saved={saved === "specialOpening"} type="submit" /></div>
          </form>
          {saveErrors.specialOpening && <div className="mt-4"><InlineError>{saveErrors.specialOpening}</InlineError></div>}
          <div className="mt-5 grid gap-2 border-t border-stone-200 pt-4">
            {specialOpenings.length === 0 && <p className="text-sm font-semibold text-stone-500">Nessuna apertura speciale configurata.</p>}
            {specialOpenings.map((opening) => (
              <article className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-3 text-sm" key={opening.id}>
                <span>
                  <b>{new Date(`${opening.date}T00:00:00`).toLocaleDateString("it-IT", { dateStyle: "full" })}</b> · {periodsLabel(opening.periods)}
                  <br />{opening.reason || "Apertura speciale"}
                  {opening.staff.length > 0 && <><br /><span className="text-xs text-stone-500">Presenti: {opening.staff.map((item) => `${item.staffName}${item.periods ? ` (${periodsLabel(item.periods)})` : ""}`).join(", ")}</span></>}
                </span>
                <Button aria-busy={deletingSpecialOpeningId === opening.id} disabled={Boolean(saving) || Boolean(deletingSpecialOpeningId)} size="sm" variant="destructive" onClick={() => void removeSpecialOpening(opening.id)}>{deletingSpecialOpeningId === opening.id ? <><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />Eliminazione…</> : "Elimina"}</Button>
              </article>
            ))}
          </div>
        </SectionCard>
        </>}

      </div>
    </AppPage>
  );
}
