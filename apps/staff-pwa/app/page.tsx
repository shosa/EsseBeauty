"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";

import { APPOINTMENT_STATUS_PALETTE, appointmentStatusLabel, PERMISSION_KEYS, type PermissionKey, type WorkingHours } from "@esse-beauty/shared";
import { Button, EmptyState, FormField, InlineError, SaveToast, StatusBadge } from "@esse-beauty/ui";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

type Tab = "today" | "agenda" | "requests" | "profile";

interface StaffSession {
  modules: { staff_performance: boolean };
  permissions: PermissionKey[];
  salon_id: string;
  staff: {
    color: string;
    display_name: string;
    id: string;
    job_title?: string | null;
    working_hours: WorkingHours;
  };
}

interface Appointment {
  customer_name: string;
  customer_notes?: string | null;
  ends_at: string;
  id: string;
  notes?: string | null;
  service_name: string;
  starts_at: string;
  status: string;
}

interface AvailabilityRequest {
  ends_at: string;
  id: string;
  reason?: string | null;
  review_note?: string | null;
  starts_at: string;
  status: string;
}

interface CalendarBlock {
  ends_at: string;
  id: string;
  reason?: string | null;
  starts_at: string;
}

interface Report {
  appointment_count: number;
  completed_count: number;
  no_show_count: number;
  unique_customers: number;
}

function dayRange(days = 1) {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + days);
  return new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
}

function weekRange(offset: number) {
  const from = new Date();
  const weekdayOffset = (from.getDay() + 6) % 7;
  from.setDate(from.getDate() - weekdayOffset + offset * 7);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  return {
    from,
    label: `${from.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })} - ${new Date(to.getTime() - 1).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}`,
    params: new URLSearchParams({ from: from.toISOString(), to: to.toISOString() }),
    to,
  };
}

function time(value: string) {
  return new Date(value).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(value: string) {
  return new Date(value).toLocaleDateString("it-IT", { day: "2-digit", month: "short", weekday: "short" }).toUpperCase();
}

function dateTime(value: string) {
  return new Date(value).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });
}

const weekdayKeys: Array<keyof WorkingHours> = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function minutes(value: string) {
  const [hours = "0", minute = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minute);
}

function sameDate(value: string, day: Date) {
  return new Date(value).toDateString() === day.toDateString();
}

function Icon({ children }: { children: ReactNode }) {
  return <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" width="22">{children}</svg>;
}

const stroke = { stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.8 };
const TodayIcon = () => <Icon><path {...stroke} d="M6 3v3m12-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" /><path {...stroke} d="M8 13h3v3H8z" /></Icon>;
const AgendaIcon = () => <Icon><path {...stroke} d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></Icon>;
const RequestIcon = () => <Icon><path {...stroke} d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /></Icon>;
const ProfileIcon = () => <Icon><path {...stroke} d="M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm8 8a8 8 0 0 0-16 0" /></Icon>;
const BackIcon = () => <Icon><path {...stroke} d="m15 18-6-6 6-6" /></Icon>;

const tabs: Array<{ icon: () => ReactNode; key: Tab; label: string }> = [
  { icon: TodayIcon, key: "today", label: "Oggi" },
  { icon: AgendaIcon, key: "agenda", label: "Agenda" },
  { icon: RequestIcon, key: "requests", label: "Richieste" },
  { icon: ProfileIcon, key: "profile", label: "Profilo" },
];

function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[1.75rem] border border-white/80 bg-white/88 p-5 shadow-[0_18px_50px_rgb(45_29_39_/_0.09)] backdrop-blur ${className}`}>{children}</section>;
}

export default function StaffPwaHome() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [todayItems, setTodayItems] = useState<Appointment[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRequest[]>([]);
  const [calendarBlocks, setCalendarBlocks] = useState<CalendarBlock[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [report, setReport] = useState<Report>();
  const [selectedId, setSelectedId] = useState("");
  const [session, setSession] = useState<StaffSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("today");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => (new Date().getDay() + 6) % 7);

  const permissionSet = useMemo(() => new Set(session?.permissions ?? []), [session?.permissions]);
  const canViewAgenda = permissionSet.has(PERMISSION_KEYS.CALENDAR_VIEW_OWN);
  const canManageAgenda = permissionSet.has(PERMISSION_KEYS.CALENDAR_MANAGE_OWN);
  const canViewReports = permissionSet.has(PERMISSION_KEYS.REPORTS_VIEW_OWN) && session?.modules.staff_performance;
  const selected = [...todayItems, ...appointments].find((item) => item.id === selectedId);
  const todayAppointments = todayItems;
  const nextAppointment = todayAppointments.find((item) => new Date(item.ends_at).getTime() > Date.now());
  const selectedWeek = useMemo(() => weekRange(weekOffset), [weekOffset]);
  const selectedDay = useMemo(() => {
    const day = new Date(selectedWeek.from);
    day.setDate(day.getDate() + selectedDayIndex);
    return day;
  }, [selectedDayIndex, selectedWeek.from]);

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${api}${path}`, {
      credentials: "include",
      headers: { "content-type": "application/json", "x-esse-client": "staff", ...init?.headers },
      ...init,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(typeof body.error === "string" ? body.error : "REQUEST_FAILED");
    }
    return (await response.json()) as T;
  }

  async function loadSession() {
    setSession(await request<StaffSession>("/api/staff-app/me"));
  }

  async function loadWork() {
    const todayParams = dayRange(1);
    const [rows, todayRows, requests, blocks] = await Promise.all([
      request<Appointment[]>(`/api/staff-app/appointments?${selectedWeek.params}`),
      request<Appointment[]>(`/api/staff-app/appointments?${todayParams}`),
      request<AvailabilityRequest[]>("/api/staff-app/availability-requests"),
      request<CalendarBlock[]>(`/api/staff-app/calendar-blocks?${selectedWeek.params}`),
    ]);
    setAppointments(rows);
    setTodayItems(todayRows);
    setAvailability(requests);
    setCalendarBlocks(blocks);
    if (canViewReports) setReport(await request<Report>(`/api/staff-app/reports?${selectedWeek.params}`));
  }

  useEffect(() => {
    void loadSession().catch(() => setSession(null)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!session || !canViewAgenda) return;
    void loadWork().catch(() => setError("Agenda non disponibile."));
  }, [session, canViewAgenda, canViewReports, weekOffset]);

  useEffect(() => {
    setSelectedDayIndex(weekOffset === 0 ? (new Date().getDay() + 6) % 7 : 0);
  }, [weekOffset]);

  useEffect(() => {
    if (!session || tab !== "requests") return;
    void request<AvailabilityRequest[]>("/api/staff-app/availability-requests")
      .then(setAvailability)
      .catch(() => setError("Richieste non disponibili."));
  }, [session, tab]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await request("/api/auth/login", {
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
        method: "POST",
      });
      await loadSession();
    } catch {
      setError("Credenziali non valide o profilo staff non collegato.");
    }
  }

  async function logout() {
    await request("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setSession(null);
    setAppointments([]);
    setTodayItems([]);
  }

  async function setStatus(appointment: Appointment, status: "confirmed" | "completed" | "no_show") {
    try {
      await request(`/api/staff-app/appointments/${appointment.id}/status`, {
        body: JSON.stringify({ status }),
        method: "PATCH",
      });
      setAppointments((current) => current.map((item) => item.id === appointment.id ? { ...item, status } : item));
      setMessage("Appuntamento aggiornato.");
    } catch {
      setError("Non puoi aggiornare questo appuntamento.");
    }
  }

  async function requestAvailability(formData: FormData) {
    try {
      await request("/api/staff-app/availability-requests", {
        body: JSON.stringify({
          ends_at: formData.get("ends_at"),
          reason: formData.get("reason"),
          starts_at: formData.get("starts_at"),
        }),
        method: "POST",
      });
      setMessage("Richiesta inviata.");
      setAvailability(await request<AvailabilityRequest[]>("/api/staff-app/availability-requests"));
    } catch {
      setError("Richiesta non inviata.");
    }
  }

  async function changePassword(formData: FormData) {
    try {
      await request("/api/auth/change-password", {
        body: JSON.stringify({
          current_password: formData.get("current_password"),
          new_password: formData.get("new_password"),
        }),
        method: "POST",
      });
      setMessage("Password aggiornata.");
    } catch {
      setError("Cambio password non riuscito.");
    }
  }

  function openAppointment(id: string) {
    setSelectedId(id);
  }

  if (loading) {
    return <main className="grid min-h-[100dvh] place-items-center"><div className="size-10 animate-spin rounded-full border-4 border-[#ead1df] border-t-[#792f59]" /></main>;
  }

  if (!session) {
    return (
      <main className="grid min-h-[100dvh] place-items-end overflow-hidden p-4 sm:place-items-center">
        <div aria-hidden="true" className="fixed -right-20 -top-20 size-72 rounded-full bg-[#e8bfd4]/55 blur-3xl" />
        <section className="relative w-full max-w-sm rounded-[2.25rem] border border-white/80 bg-white/90 p-7 shadow-[0_30px_90px_rgb(45_29_39_/_0.18)] backdrop-blur">
          <div className="grid size-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,#402334,#8f3a68)] text-xl font-black text-white shadow-[0_16px_34px_rgb(121_47_89_/_0.28)]">E</div>
          <p className="mt-8 text-[11px] font-black uppercase tracking-[.22em] text-[#8f3a68]">EsseBeauty Staff</p>
          <h1 className="staff-page-title mt-2 text-4xl font-bold leading-tight tracking-[-.025em] text-[#2d1d27]">Il tuo lavoro,<br />senza rumore.</h1>
          <p className="mt-3 text-sm leading-6 text-stone-500">Agenda, clienti e richieste in un’app pensata per la giornata in salone.</p>
          {error && <InlineError className="mt-5">{error}</InlineError>}
          <form className="mt-6 space-y-4" onSubmit={login}>
            <FormField label="Email" required><input autoComplete="email" name="email" required type="email" /></FormField>
            <FormField label="Password" required><input autoComplete="current-password" name="password" required type="password" /></FormField>
            <Button className="mt-2 w-full" type="submit" variant="primary">Accedi</Button>
          </form>
        </section>
      </main>
    );
  }

  if (selected) {
    return (
      <main className="staff-shell staff-screen">
        <SaveToast visible={Boolean(message)}>{message}</SaveToast>
        <header className="sticky top-0 z-20 border-b border-white/80 bg-white/80 px-4 py-3 backdrop-blur-xl">
          <button className="flex min-h-11 items-center gap-2 font-bold text-[#792f59]" onClick={() => setSelectedId("")} type="button"><BackIcon /> Agenda</button>
        </header>
        <div className="space-y-4 p-4">
          {error && <InlineError>{error}</InlineError>}
          <Surface className="relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#792f59,#d99aba,#f4d8a8)]" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[.15em] text-[#792f59]">{dayLabel(selected.starts_at)} · {time(selected.starts_at)}-{time(selected.ends_at)}</p>
                <h1 className="staff-page-title mt-3 text-4xl font-bold leading-none tracking-[-.025em] text-[#2d1d27]">{selected.customer_name}</h1>
                <p className="mt-2 font-semibold text-stone-500">{selected.service_name}</p>
              </div>
              <StatusBadge status={selected.status}>{appointmentStatusLabel(selected.status)}</StatusBadge>
            </div>
          </Surface>
          <Surface>
            <p className="text-xs font-black uppercase tracking-[.15em] text-stone-400">Note cliente</p>
            <p className="mt-3 text-sm leading-6 text-stone-700">{selected.customer_notes || "Nessuna nota cliente."}</p>
          </Surface>
          <Surface>
            <p className="text-xs font-black uppercase tracking-[.15em] text-stone-400">Note interne</p>
            <p className="mt-3 text-sm leading-6 text-stone-700">{selected.notes || "Nessuna nota interna."}</p>
          </Surface>
          <div className="sticky bottom-4 grid grid-cols-3 gap-2 rounded-[1.5rem] border border-white/80 bg-white/90 p-2 shadow-[0_20px_60px_rgb(45_29_39_/_0.18)] backdrop-blur">
            <Button disabled={!canManageAgenda} onClick={() => void setStatus(selected, "confirmed")} size="sm" variant="outline">Check-in</Button>
            <Button disabled={!canManageAgenda} onClick={() => void setStatus(selected, "completed")} size="sm" variant="primary">Completa</Button>
            <Button disabled={!canManageAgenda} onClick={() => void setStatus(selected, "no_show")} size="sm" variant="outline">No-show</Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="staff-shell">
      <SaveToast visible={Boolean(message)}>{message}</SaveToast>
      <header className="sticky top-0 z-20 border-b border-white/70 bg-white/78 px-5 py-4 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#8f3a68]">{session.staff.job_title ?? "Staff"}</p>
            <h1 className="staff-page-title mt-1 text-2xl font-bold tracking-[-.025em] text-[#2d1d27]">Ciao, {session.staff.display_name.split(" ")[0]}</h1>
          </div>
          <div className="grid size-11 place-items-center rounded-full font-black text-white shadow-md" style={{ backgroundColor: session.staff.color }}>{session.staff.display_name.slice(0, 1)}</div>
        </div>
      </header>

      <div className="staff-screen space-y-4 p-4" key={tab}>
        {error && <InlineError>{error}</InlineError>}

        {tab === "today" && (
          <>
            <section className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#402334_0%,#792f59_65%,#b85888_100%)] p-6 text-white shadow-[0_24px_65px_rgb(121_47_89_/_0.28)]">
              <div aria-hidden="true" className="absolute -right-12 -top-12 size-40 rounded-full bg-white/10 blur-2xl" />
              <p className="text-[11px] font-black uppercase tracking-[.2em] text-white/65">La tua giornata</p>
              <div className="mt-5 flex items-end justify-between gap-4">
                <div><span className="text-6xl font-black leading-none tracking-[-.04em]">{todayAppointments.length}</span><p className="mt-2 text-sm font-semibold text-white/75">appuntamenti oggi</p></div>
                <div className="rounded-2xl bg-white/12 px-4 py-3 text-right backdrop-blur"><b className="block text-xl">{todayAppointments.filter((item) => item.status === "completed").length}</b><span className="text-xs text-white/70">completati</span></div>
              </div>
            </section>

            <div>
              <div className="mb-3 flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#8f3a68]">In evidenza</p><h2 className="text-xl font-bold tracking-[-.015em]">Prossimo cliente</h2></div><button className="text-xs font-black text-[#792f59]" onClick={() => setTab("agenda")}>Vedi agenda</button></div>
              {!nextAppointment ? <Surface><EmptyState title="Nessun appuntamento imminente" description="La giornata è libera oppure hai già completato tutto." /></Surface> : (
                <button className="w-full text-left" onClick={() => openAppointment(nextAppointment.id)} type="button">
                  <Surface className="transition active:scale-[.98]">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="text-xs font-black text-[#792f59]">{time(nextAppointment.starts_at)} - {time(nextAppointment.ends_at)}</p><h3 className="mt-2 text-2xl font-bold tracking-[-.015em]">{nextAppointment.customer_name}</h3><p className="mt-1 text-sm font-semibold text-stone-500">{nextAppointment.service_name}</p></div>
                      <span className="grid size-11 place-items-center rounded-full bg-[#faf3f7] text-xl text-[#792f59]">›</span>
                    </div>
                  </Surface>
                </button>
              )}
            </div>

            <div>
              <h2 className="mb-3 text-xl font-bold tracking-[-.015em]">A seguire</h2>
              <div className="space-y-2">
                {todayAppointments.filter((item) => item.id !== nextAppointment?.id).slice(0, 3).map((item) => (
                  <AppointmentRow item={item} key={item.id} onOpen={() => openAppointment(item.id)} />
                ))}
              </div>
            </div>
          </>
        )}

        {tab === "agenda" && (
          <>
            <ScreenTitle eyebrow="Calendario personale" title="La tua agenda" subtitle={`${appointments.length} appuntamenti · ${selectedWeek.label}`} />
            <div className="grid grid-cols-[48px_1fr_48px] gap-2 rounded-[1.4rem] border border-white/80 bg-white/88 p-2 shadow-sm">
              <button aria-label="Settimana precedente" className="grid min-h-11 place-items-center rounded-xl text-2xl font-bold text-[#792f59] transition active:bg-[#f3e2eb]" onClick={() => setWeekOffset((value) => value - 1)} type="button">‹</button>
              <button className="min-h-11 rounded-xl bg-[#faf3f7] px-3 text-sm font-black text-[#792f59] transition active:scale-[.98]" onClick={() => setWeekOffset(0)} type="button">
                {weekOffset === 0 ? "Questa settimana" : "Torna a oggi"}
              </button>
              <button aria-label="Settimana successiva" className="grid min-h-11 place-items-center rounded-xl text-2xl font-bold text-[#792f59] transition active:bg-[#f3e2eb]" onClick={() => setWeekOffset((value) => value + 1)} type="button">›</button>
            </div>
            <div className="grid grid-cols-7 gap-1 rounded-[1.4rem] border border-white/80 bg-white/88 p-2 shadow-sm">
              {Array.from({ length: 7 }, (_, index) => {
                const day = new Date(selectedWeek.from);
                day.setDate(day.getDate() + index);
                const count = appointments.filter((item) => sameDate(item.starts_at, day)).length;
                const active = selectedDayIndex === index;
                return (
                  <button className={`min-w-0 rounded-xl py-2 text-center transition ${active ? "text-white shadow-md" : "text-stone-500"}`} key={day.toISOString()} onClick={() => setSelectedDayIndex(index)} style={active ? { background: session.staff.color } : undefined} type="button">
                    <span className="block text-[9px] font-black uppercase">{day.toLocaleDateString("it-IT", { weekday: "short" })}</span>
                    <strong className="mt-1 block text-base">{day.getDate()}</strong>
                    <span className={`mx-auto mt-1 block size-1.5 rounded-full ${count ? active ? "bg-white" : "bg-[#792f59]" : "bg-transparent"}`} />
                  </button>
                );
              })}
            </div>
            <StaffDayTimeline
              appointments={appointments.filter((item) => sameDate(item.starts_at, selectedDay))}
              blocks={calendarBlocks.filter((item) => sameDate(item.starts_at, selectedDay))}
              color={session.staff.color}
              day={selectedDay}
              name={session.staff.display_name}
              onOpen={openAppointment}
              workingHours={session.staff.working_hours}
            />
          </>
        )}

        {tab === "requests" && (
          <>
            <ScreenTitle eyebrow="Disponibilità" title="Richieste" subtitle="Ferie, permessi e indisponibilità" />
            <Surface>
              <form action={requestAvailability} className="space-y-4">
                <FormField label="Dal" required><input name="starts_at" required type="datetime-local" /></FormField>
                <FormField label="Al" required><input name="ends_at" required type="datetime-local" /></FormField>
                <FormField label="Motivo"><textarea name="reason" placeholder="Ferie, visita, permesso..." /></FormField>
                <Button className="w-full" disabled={!canManageAgenda} type="submit" variant="primary">Invia richiesta</Button>
              </form>
            </Surface>
            <div>
              <h2 className="mb-3 text-xl font-bold tracking-[-.015em]">Le tue richieste</h2>
              <div className="space-y-2">
                {availability.length === 0 && <Surface><p className="text-sm text-stone-500">Non hai ancora inviato richieste.</p></Surface>}
                {availability.map((item) => (
                  <Surface className="p-4" key={item.id}>
                    <div className="flex items-start justify-between gap-3"><div><b className="text-sm">{dateTime(item.starts_at)}</b><p className="mt-1 text-xs text-stone-500">fino a {dateTime(item.ends_at)}</p></div><StatusBadge status={item.status}>{item.status}</StatusBadge></div>
                    {item.reason && <p className="mt-3 text-sm text-stone-600">{item.reason}</p>}
                  </Surface>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === "profile" && (
          <>
            <ScreenTitle eyebrow="Account" title="Profilo" subtitle={session.staff.display_name} />
            {canViewReports && (
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Appuntamenti" value={report?.appointment_count ?? 0} />
                <Metric label="Completati" value={report?.completed_count ?? 0} />
                <Metric label="No-show" value={report?.no_show_count ?? 0} />
                <Metric label="Clienti" value={report?.unique_customers ?? 0} />
              </div>
            )}
            <Surface>
              <h2 className="text-xl font-bold tracking-[-.015em]">Sicurezza</h2>
              <p className="mt-1 text-sm text-stone-500">Aggiorna la password del tuo account.</p>
              <form action={changePassword} className="mt-5 space-y-4">
                <FormField label="Password attuale" required><input name="current_password" required type="password" /></FormField>
                <FormField label="Nuova password" required description="Minimo 10 caratteri."><input minLength={10} name="new_password" required type="password" /></FormField>
                <Button className="w-full" type="submit" variant="outline">Cambia password</Button>
              </form>
            </Surface>
            <Button className="w-full" onClick={() => void logout()} variant="destructive">Esci dall’app</Button>
          </>
        )}
      </div>

      <nav className="staff-bottom-nav fixed inset-x-0 bottom-0 z-30 mx-auto grid max-w-[520px] grid-cols-4 border-t border-white/80 bg-white/88 px-2 pt-2 shadow-[0_-16px_45px_rgb(45_29_39_/_0.10)] backdrop-blur-xl">
        {tabs.map((item) => {
          const active = tab === item.key;
          const TabIcon = item.icon;
          return <button className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-black transition ${active ? "text-[#792f59]" : "text-stone-400"}`} key={item.key} onClick={() => setTab(item.key)} type="button">{active && <span className="absolute inset-x-5 top-0 h-1 rounded-full bg-[#792f59]" />}<TabIcon />{item.label}</button>;
        })}
      </nav>
    </main>
  );
}

function StaffDayTimeline({
  appointments,
  blocks,
  color,
  day,
  name,
  onOpen,
  workingHours,
}: {
  appointments: Appointment[];
  blocks: CalendarBlock[];
  color: string;
  day: Date;
  name: string;
  onOpen(id: string): void;
  workingHours: WorkingHours;
}) {
  const dayKey = weekdayKeys[day.getDay()] ?? "mon";
  const schedule = (workingHours?.[dayKey] ?? [])
    .map((period) => ({ from: minutes(period.from), to: minutes(period.to) }))
    .sort((left, right) => left.from - right.from);
  const eventMinutes = [
    ...appointments.flatMap((item) => {
      const start = new Date(item.starts_at);
      const end = new Date(item.ends_at);
      return [start.getHours() * 60 + start.getMinutes(), end.getHours() * 60 + end.getMinutes()];
    }),
    ...blocks.flatMap((item) => {
      const start = new Date(item.starts_at);
      const end = new Date(item.ends_at);
      return [start.getHours() * 60 + start.getMinutes(), end.getHours() * 60 + end.getMinutes()];
    }),
  ];
  const bounds = [...schedule.flatMap((period) => [period.from, period.to]), ...eventMinutes];
  const startHour = bounds.length ? Math.max(0, Math.floor(Math.min(...bounds) / 60)) : 9;
  const endHour = bounds.length ? Math.min(24, Math.ceil(Math.max(...bounds) / 60)) : 19;
  const safeEndHour = Math.max(startHour + 1, endHour);
  const hourHeight = 78;
  const height = (safeEndHour - startHour) * hourHeight;
  const hours = Array.from({ length: safeEndHour - startHour + 1 }, (_, index) => startHour + index);

  function position(from: number, to: number, minimumHeight = 0) {
    const top = Math.max(0, (from - startHour * 60) / 60 * hourHeight);
    const bottom = Math.min(height, (to - startHour * 60) / 60 * hourHeight);
    return { height: Math.max(minimumHeight, bottom - top), top };
  }

  function itemPosition(startsAt: string, endsAt: string) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    return position(start.getHours() * 60 + start.getMinutes(), end.getHours() * 60 + end.getMinutes(), 40);
  }

  const gaps: Array<{ from: number; to: number }> = [];
  let cursor = startHour * 60;
  for (const period of schedule) {
    const from = Math.max(cursor, period.from);
    if (from > cursor) gaps.push({ from: cursor, to: from });
    cursor = Math.max(cursor, Math.min(safeEndHour * 60, period.to));
  }
  if (cursor < safeEndHour * 60) gaps.push({ from: cursor, to: safeEndHour * 60 });

  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-stone-200 bg-white shadow-[0_18px_50px_rgb(45_29_39_/_0.09)]">
      <header className="grid grid-cols-[58px_1fr] border-b border-stone-200 bg-white">
        <span className="border-r border-stone-200 py-4 text-center text-[9px] font-black uppercase tracking-[.16em] text-stone-400">Ora</span>
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="grid size-9 place-items-center rounded-full text-sm font-black text-white" style={{ background: color }}>{name.slice(0, 1).toUpperCase()}</span>
          <div><b className="block text-sm">{name}</b><span className="text-[10px] font-semibold text-stone-400">{appointments.length} appuntamenti</span></div>
        </div>
      </header>
      <div className="grid grid-cols-[58px_1fr]">
        <div className="relative border-r border-stone-200 bg-[#faf9f7]" style={{ height }}>
          {hours.map((hour, index) => (
            <span className="absolute left-0 right-0 pr-2 text-right text-[10px] font-black text-stone-500" key={hour} style={{ top: index === 0 ? 7 : index === hours.length - 1 ? height - 18 : (hour - startHour) * hourHeight - 7 }}>
              {String(hour).padStart(2, "0")}:00
            </span>
          ))}
        </div>
        <div className="relative bg-white" style={{ height }}>
          {hours.slice(0, -1).map((hour) => <span className="absolute left-0 right-0 border-t border-stone-100" key={hour} style={{ top: (hour - startHour) * hourHeight }} />)}
          {hours.slice(0, -1).flatMap((hour) => [15, 30, 45].map((minute) => <span className="absolute left-0 right-0 border-t border-dashed border-stone-100" key={`${hour}-${minute}`} style={{ top: ((hour - startHour) * 60 + minute) / 60 * hourHeight }} />))}
          {gaps.map((gap) => (
            <div className="absolute left-0 right-0 z-[1] flex items-center justify-center overflow-hidden border-y border-stone-300/80" key={`${gap.from}-${gap.to}`} style={{ ...position(gap.from, gap.to), background: "repeating-linear-gradient(135deg, rgba(120,113,108,.08) 0, rgba(120,113,108,.08) 8px, rgba(120,113,108,.20) 8px, rgba(120,113,108,.20) 10px)" }}>
              <span className="rounded-full bg-white/90 px-3 py-1 text-[9px] font-black uppercase tracking-[.14em] text-stone-500 shadow-sm">Non lavorativo</span>
            </div>
          ))}
          {blocks.map((block) => (
            <div className="absolute left-2 right-2 z-10 overflow-hidden rounded-xl border border-amber-300 px-3 py-2 text-[10px] font-black text-amber-950 shadow-sm" key={block.id} style={{ ...itemPosition(block.starts_at, block.ends_at), background: "repeating-linear-gradient(135deg, #fffbeb 0, #fffbeb 8px, #fde68a 8px, #fde68a 11px)" }}>
              <span>{time(block.starts_at)}–{time(block.ends_at)}</span>
              <span className="ml-2 uppercase">{block.reason || "Assenza / non disponibile"}</span>
            </div>
          ))}
          {appointments.map((item) => {
            const duration = (new Date(item.ends_at).getTime() - new Date(item.starts_at).getTime()) / 60000;
            const short = duration < 30;
            const confirmed = item.status === "confirmed";
            const palette = APPOINTMENT_STATUS_PALETTE[item.status as keyof typeof APPOINTMENT_STATUS_PALETTE];
            return (
              <button className={`absolute left-2 right-2 z-10 overflow-hidden rounded-xl border pr-20 text-left active:scale-[.99] ${confirmed ? "border-white/80 text-white shadow-[0_8px_22px_rgb(45_29_39_/_0.16)]" : "shadow-[0_6px_16px_rgb(68_64_60_/_0.10)]"} ${short ? "flex items-center gap-2 py-1.5 pl-3" : "py-2 pl-3"}`} key={item.id} onClick={() => onOpen(item.id)} style={{ ...itemPosition(item.starts_at, item.ends_at), background: confirmed ? `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 72%, white))` : palette?.background, borderColor: confirmed ? undefined : palette?.border, color: confirmed ? undefined : palette?.text }} title={`${time(item.starts_at)}–${time(item.ends_at)} · ${item.customer_name} · ${item.service_name} · ${appointmentStatusLabel(item.status)}`} type="button">
                <span className="shrink-0 text-[10px] font-black">{time(item.starts_at)}–{time(item.ends_at)}</span>
                <strong className={`${short ? "min-w-0 truncate text-xs" : "mt-1 block truncate text-sm"} uppercase`}>{item.customer_name}</strong>
                <span className={`${short ? "hidden min-w-0 truncate text-[10px] font-semibold opacity-75 sm:block" : "mt-1 block truncate text-[10px] font-semibold opacity-75"}`}>{short ? `· ${item.service_name}` : item.service_name}</span>
                <span className={`absolute right-2 top-1/2 max-w-16 -translate-y-1/2 truncate rounded-full border px-2 py-1 text-[7px] font-black uppercase tracking-[.06em] backdrop-blur-sm ${confirmed ? "border-white/20 bg-black/16 text-white" : "border-current/20 bg-white/55"}`}>{appointmentStatusLabel(item.status)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ScreenTitle({ eyebrow, subtitle, title }: { eyebrow: string; subtitle: string; title: string }) {
  return <header className="px-1 pt-2"><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#8f3a68]">{eyebrow}</p><h1 className="staff-page-title mt-1 text-4xl font-bold leading-tight tracking-[-.025em] text-[#2d1d27]">{title}</h1><p className="mt-2 text-sm leading-6 text-stone-500">{subtitle}</p></header>;
}

function AppointmentRow({ item, onOpen }: { item: Appointment; onOpen(): void }) {
  const confirmed = item.status === "confirmed";
  const palette = APPOINTMENT_STATUS_PALETTE[item.status as keyof typeof APPOINTMENT_STATUS_PALETTE];
  return (
    <button className={`w-full rounded-[1.4rem] border p-4 text-left shadow-[0_12px_34px_rgb(45_29_39_/_0.07)] transition active:scale-[.98] ${confirmed ? "border-white/80 text-white" : ""}`} onClick={onOpen} style={{ background: confirmed ? "linear-gradient(135deg,#792f59,#b85888)" : palette?.background, borderColor: confirmed ? undefined : palette?.border, color: confirmed ? undefined : palette?.text }} type="button">
      <div className="flex items-center gap-4">
        <div className="w-14 shrink-0 text-center"><b className="block text-xl font-black tracking-[-.02em]">{time(item.starts_at)}</b><span className="text-[10px] font-bold opacity-65">{time(item.ends_at)}</span></div>
        <div className="min-w-0 flex-1 border-l border-current/15 pl-4"><h3 className="truncate font-black">{item.customer_name}</h3><p className="truncate text-xs font-semibold opacity-70">{item.service_name}</p></div>
        <StatusBadge status={item.status}>{appointmentStatusLabel(item.status)}</StatusBadge>
      </div>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Surface className="p-4"><b className="block text-3xl font-black tracking-[-.03em] text-[#2d1d27]">{value}</b><span className="text-xs font-bold text-stone-400">{label}</span></Surface>;
}
