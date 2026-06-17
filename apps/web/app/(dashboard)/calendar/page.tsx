"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PERMISSION_KEYS, WEEK_DAYS_IT } from "@esse-beauty/shared";
import { AppPage, Badge, Button, InlineError, PageHeader, PageTransition, SectionCard, StatCard, StatGrid, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

type CalendarView = "day" | "week" | "month" | "agenda" | "staff_columns";

interface Appointment {
  color: string;
  customer_name: string;
  ends_at: string;
  id: string;
  service_name: string;
  staff_id: string;
  staff_name: string;
  starts_at: string;
  status?: string;
}

interface AvailabilityBlock {
  color: string;
  ends_at: string;
  id: string;
  reason?: string | null;
  staff_id: string;
  staff_name: string;
  starts_at: string;
}

interface SalonClosure {
  date: string;
  id: string;
  reason?: string | null;
  recurringYearly: boolean;
}

interface CalendarRules {
  allowOverbooking: boolean;
  bufferMinutes: number;
  defaultView: CalendarView;
  enableResourceView: boolean;
  minBookingNoticeHours: number;
  minSlotMinutes: number;
  overbookingLimit: number;
}

const views: Array<{ key: CalendarView; label: string }> = [
  { key: "day", label: "Giorno" },
  { key: "week", label: "Settimana" },
  { key: "month", label: "Mese" },
  { key: "agenda", label: "Agenda" },
  { key: "staff_columns", label: "Staff" },
];

const statuses = ["confirmed", "completed", "no_show", "cancelled"] as const;

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const offset = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - offset);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months, 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function clampView(value: string | undefined): CalendarView {
  return views.some((item) => item.key === value) ? value as CalendarView : "week";
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function minutesBetween(from: string, to: string) {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
}

function appointmentMatches(item: Appointment, query: string, status: string, staffId: string) {
  const text = `${item.customer_name} ${item.service_name} ${item.staff_name}`.toLowerCase();
  return (!query || text.includes(query.toLowerCase())) && (!status || item.status === status) && (!staffId || item.staff_id === staffId);
}

function sameDay(left: Date, right: Date) {
  return left.toDateString() === right.toDateString();
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function weekdayShortLabel(date: Date) {
  return WEEK_DAYS_IT[(date.getDay() + 6) % 7]?.shortLabel ?? "";
}

function closureMatchesDay(closure: SalonClosure, day: Date) {
  const key = dateKey(day);
  return closure.date === key || (closure.recurringYearly && closure.date.slice(5) === key.slice(5));
}

export default function CalendarPage() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [availabilityBlocks, setAvailabilityBlocks] = useState<AvailabilityBlock[]>([]);
  const [salonClosures, setSalonClosures] = useState<SalonClosure[]>([]);
  const [view, setView] = useState<CalendarView>("week");
  const [periodOffset, setPeriodOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [rules, setRules] = useState<CalendarRules>({
    allowOverbooking: false,
    bufferMinutes: 0,
    defaultView: "week",
    enableResourceView: false,
    minBookingNoticeHours: 2,
    minSlotMinutes: 15,
    overbookingLimit: 0,
  });
  const [error, setError] = useState("");
  const { hasPermission, salon } = useAuth();
  const canCreate =
    hasPermission(PERMISSION_KEYS.CALENDAR_MANAGE_OTHERS) ||
    hasPermission(PERMISSION_KEYS.CALENDAR_MANAGE_OWN);

  useEffect(() => {
    if (!salon) return;
    void fetch(`${api}/api/salons/${salon.id}/settings/control-center`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json() as { calendar?: Partial<CalendarRules> | null };
        const calendar = data.calendar;
        if (!calendar) return;
        const defaultView = clampView(String(calendar.defaultView ?? "week"));
        setRules({
          allowOverbooking: Boolean(calendar.allowOverbooking),
          bufferMinutes: Number(calendar.bufferMinutes ?? 0),
          defaultView,
          enableResourceView: Boolean(calendar.enableResourceView),
          minBookingNoticeHours: Number(calendar.minBookingNoticeHours ?? 2),
          minSlotMinutes: Number(calendar.minSlotMinutes ?? 15),
          overbookingLimit: Number(calendar.overbookingLimit ?? 0),
        });
        setView(defaultView === "staff_columns" && !calendar.enableResourceView ? "week" : defaultView);
      });
  }, [salon]);

  const range = useMemo(() => {
    const now = new Date();
    if (view === "day") {
      const from = addDays(startOfDay(now), periodOffset);
      return { from, to: addDays(from, 1), label: from.toLocaleDateString("it-IT", { dateStyle: "full" }) };
    }
    if (view === "month") {
      const from = addMonths(now, periodOffset);
      const to = addMonths(from, 1);
      return { from, to, label: from.toLocaleDateString("it-IT", { month: "long", year: "numeric" }) };
    }
    const from = addDays(startOfWeek(now), periodOffset * 7);
    const to = addDays(from, view === "agenda" ? 14 : 7);
    return { from, to, label: `${from.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })} - ${addDays(to, -1).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}` };
  }, [periodOffset, view]);

  useEffect(() => {
    if (!salon) return;
    void fetch(`${api}/api/salons/${salon.id}/calendar-events?from=${range.from.toISOString()}&to=${range.to.toISOString()}`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Impossibile caricare il calendario.");
        const data = await response.json() as { appointments?: Appointment[]; availability_blocks?: AvailabilityBlock[]; salon_closures?: SalonClosure[] };
        setItems(data.appointments ?? []);
        setAvailabilityBlocks(data.availability_blocks ?? []);
        setSalonClosures(data.salon_closures ?? []);
        setError("");
      })
      .catch((reason: Error) => setError(reason.message));
  }, [range.from, range.to, salon?.id]);

  const filteredItems = useMemo(
    () => items.filter((item) => appointmentMatches(item, query.trim(), statusFilter, staffFilter)),
    [items, query, staffFilter, statusFilter],
  );
  const days = useMemo(() => {
    if (view === "day") return [range.from];
    if (view === "month") {
      const monthStart = range.from;
      const gridStart = startOfWeek(monthStart);
      return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
    }
    return Array.from({ length: view === "agenda" ? 14 : 7 }, (_, index) => addDays(range.from, index));
  }, [range.from, view]);
  const staffOptions = useMemo(() => Array.from(new Map(items.map((item) => [item.staff_id, item.staff_name])).entries()), [items]);
  const todayCount = items.filter((item) => new Date(item.starts_at).toDateString() === new Date().toDateString()).length;
  const completedCount = items.filter((item) => item.status === "completed").length;
  const visibleStaff = staffFilter ? staffOptions.filter(([id]) => id === staffFilter) : staffOptions;

  function itemsForDay(day: Date) {
    return filteredItems.filter((item) => sameDay(new Date(item.starts_at), day));
  }

  function blocksForDay(day: Date) {
    return availabilityBlocks.filter((item) =>
      (!staffFilter || item.staff_id === staffFilter) &&
      sameDay(new Date(item.starts_at), day) &&
      (!query.trim() || `${item.reason ?? "Non disponibile"} ${item.staff_name}`.toLowerCase().includes(query.trim().toLowerCase())),
    );
  }

  function closuresForDay(day: Date) {
    return salonClosures.filter((closure) => closureMatchesDay(closure, day));
  }

  const appointmentCard = (item: Appointment, compact = false) => (
    <Link
      key={item.id}
      href={`/calendar/appointments/${item.id}`}
      className="group block rounded-2xl border border-white/80 bg-white/92 p-3 text-left shadow-[0_10px_28px_rgb(45_29_39_/_0.08)] ring-1 ring-stone-950/5 transition hover:-translate-y-0.5 hover:border-[#d7a6c1] hover:shadow-[0_18px_42px_rgb(45_29_39_/_0.14)]"
      style={{ borderLeft: `5px solid ${item.color || "#792f59"}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <strong className="text-xs font-black text-[#792f59]">{formatTime(item.starts_at)} - {formatTime(item.ends_at)}</strong>
        <StatusBadge status={item.status ?? "confirmed"} />
      </div>
      <span className={`mt-2 block truncate font-black text-stone-950 ${compact ? "text-sm" : "text-base"}`}>{item.customer_name}</span>
      <span className="mt-1 block truncate text-xs font-semibold text-stone-500">{item.service_name} con {item.staff_name}</span>
      {!compact && <span className="mt-2 inline-flex rounded-full bg-[#faf3f7] px-2 py-1 text-[11px] font-bold text-[#792f59]">{minutesBetween(item.starts_at, item.ends_at)} min</span>}
    </Link>
  );

  const blockCard = (item: AvailabilityBlock, compact = false) => (
    <div
      key={item.id}
      className="rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-left shadow-sm"
      style={{ borderLeft: `5px solid ${item.color || "#92400e"}` }}
    >
      <strong className="text-xs font-black text-amber-800">{formatTime(item.starts_at)} - {formatTime(item.ends_at)}</strong>
      <span className={`mt-2 block truncate font-black text-amber-950 ${compact ? "text-sm" : "text-base"}`}>Non disponibile</span>
      <span className="mt-1 block truncate text-xs font-semibold text-amber-800">{item.staff_name} - {item.reason || "Blocco disponibilita"}</span>
    </div>
  );

  const closureCard = (item: SalonClosure) => (
    <div key={item.id} className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm shadow-sm">
      <b className="block text-red-800">Chiusura salone</b>
      <span className="text-red-700">{item.reason || "Giorno non prenotabile"}{item.recurringYearly ? " - ogni anno" : ""}</span>
    </div>
  );

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageTransition>
        <PageHeader
          eyebrow="Agenda"
          title="Calendario"
          subtitle={`Vista ${views.find((item) => item.key === view)?.label.toLowerCase()} - ${range.label}. Le regole agenda configurate sono applicate a slot, buffer e conflitti.`}
          meta={<>
            <Badge>Slot {rules.minSlotMinutes} min</Badge>
            <Badge variant={rules.allowOverbooking ? "success" : "muted"}>{rules.allowOverbooking ? `Overbooking max ${rules.overbookingLimit}` : "Overbooking spento"}</Badge>
            <Badge>Buffer {rules.bufferMinutes} min</Badge>
            <Badge>Anticipo {rules.minBookingNoticeHours}h</Badge>
          </>}
          actions={<div className="flex flex-wrap items-center gap-2">
            {canCreate && <Link href="/calendar/appointments/new" className="inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-stone-800">Nuovo appuntamento</Link>}
            <Button onClick={() => setPeriodOffset((value) => value - 1)} variant="outline">Prec.</Button>
            <Button onClick={() => setPeriodOffset(0)} variant="secondary">Oggi</Button>
            <Button onClick={() => setPeriodOffset((value) => value + 1)} variant="outline">Succ.</Button>
          </div>}
        />

        {error && <InlineError className="mb-4">{error}</InlineError>}

        <StatGrid className="mb-5 md:grid-cols-4">
          <StatCard label="Visibili" value={filteredItems.length} detail={`${items.length} nel periodo`} />
          <StatCard label="Oggi" value={todayCount} detail="Appuntamenti in giornata" />
          <StatCard label="Completati" value={completedCount} detail="Nel periodo caricato" />
          <StatCard label="Staff attivi" value={staffOptions.length || "-"} detail={rules.enableResourceView ? "Vista risorse abilitata" : "Vista risorse disattiva"} />
        </StatGrid>

        <SectionCard className="mb-5" title="Controlli agenda" subtitle="Filtra senza cambiare contesto; ogni appuntamento resta cliccabile per azioni operative.">
          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr]">
            <input
              aria-label="Cerca appuntamenti"
              className="min-h-12 rounded-2xl border border-[#ead1df] bg-white px-4 text-sm font-semibold outline-none transition focus:border-[#792f59] focus:ring-4 focus:ring-[#b85888]/15"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca cliente, servizio o collaboratore"
              value={query}
            />
            <select className="min-h-12 rounded-2xl border border-[#ead1df] bg-white px-4 text-sm font-semibold" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="">Tutti gli stati</option>
              {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <select className="min-h-12 rounded-2xl border border-[#ead1df] bg-white px-4 text-sm font-semibold" onChange={(event) => setStaffFilter(event.target.value)} value={staffFilter}>
              <option value="">Tutto lo staff</option>
              {staffOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {views.map((item) => (
              <Button
                active={view === item.key}
                disabled={item.key === "staff_columns" && !rules.enableResourceView}
                key={item.key}
                onClick={() => {
                  setView(item.key);
                  setPeriodOffset(0);
                }}
                size="sm"
                variant={view === item.key ? "primary" : "outline"}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </SectionCard>

        {view === "agenda" ? (
          <div className="grid gap-3">
            {filteredItems.length === 0 && availabilityBlocks.length === 0 && salonClosures.length === 0 && <SectionCard>Nessun appuntamento con questi filtri.</SectionCard>}
            {days.flatMap((day) => closuresForDay(day).map((closure) => closureCard(closure)))}
            {filteredItems.map((item) => appointmentCard(item))}
            {availabilityBlocks.filter((block) => !staffFilter || block.staff_id === staffFilter).map((block) => blockCard(block))}
          </div>
        ) : view === "staff_columns" ? (
          <div className="overflow-x-auto rounded-[2rem] border border-white/80 bg-white/75 p-3 shadow-[0_22px_70px_rgb(45_29_39_/_0.10)] ring-1 ring-stone-950/5 backdrop-blur">
            <div className="grid min-w-[980px] gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(visibleStaff.length, 1)}, minmax(240px, 1fr))` }}>
              {(visibleStaff.length ? visibleStaff : [["", "Nessuno staff"]]).map(([staffId, staffName]) => (
                <section className="rounded-3xl border border-stone-100 bg-[#fbf8fa] p-3" key={staffId}>
                  <h2 className="mb-3 text-sm font-black uppercase tracking-[.16em] text-[#792f59]">{staffName}</h2>
                  <div className="space-y-2">
                    {filteredItems.filter((item) => item.staff_id === staffId).map((item) => appointmentCard(item, true))}
                    {availabilityBlocks.filter((item) => item.staff_id === staffId).map((item) => blockCard(item, true))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[2rem] border border-white/80 bg-white/75 p-3 shadow-[0_22px_70px_rgb(45_29_39_/_0.10)] ring-1 ring-stone-950/5 backdrop-blur">
            <div className={`grid min-w-[920px] gap-3 ${view === "month" ? "grid-cols-7" : view === "day" ? "grid-cols-1" : "grid-cols-7"}`}>
              {days.map((day) => {
                const dayItems = itemsForDay(day);
                const dayBlocks = blocksForDay(day);
                const dayClosures = closuresForDay(day);
                const outsideMonth = view === "month" && day.getMonth() !== range.from.getMonth();
                return (
                  <section key={day.toISOString()} className={`${view === "month" ? "min-h-[170px]" : "min-h-[620px]"} rounded-3xl border border-stone-100 bg-white/82 p-3 ${outsideMonth ? "opacity-45" : ""}`}>
                    <header className="mb-3 flex items-center justify-between gap-2 border-b border-stone-100 pb-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[.18em] text-stone-400">{weekdayShortLabel(day)}</p>
                        <strong className="text-2xl text-[#2d1d27]">{day.getDate()}</strong>
                      </div>
                      <Badge>{dayItems.length + dayBlocks.length + dayClosures.length}</Badge>
                    </header>
                    <div className="space-y-2">
                      {dayClosures.map((item) => closureCard(item))}
                      {dayItems.map((item) => appointmentCard(item, view === "month"))}
                      {dayBlocks.map((item) => blockCard(item, view === "month"))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </PageTransition>
    </AppPage>
  );
}
