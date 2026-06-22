"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { APPOINTMENT_STATUS_PALETTE, appointmentStatusLabel, PERMISSION_KEYS, WEEK_DAYS_IT, type WorkingHours } from "@esse-beauty/shared";
import { AppPage, Badge, Button, InlineError, PageHeader, PageTransition, SectionCard, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";
import AppointmentDetailPanel from "./_components/AppointmentDetailPanel";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

type CalendarView = "day" | "week" | "month" | "agenda" | "staff_columns";

interface Appointment {
  color: string;
  customer_name: string;
  ends_at: string;
  id: string;
  location_id?: string | null;
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
  location_id?: string | null;
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

interface StaffOption {
  color: string;
  display_name: string;
  id: string;
  location_id?: string | null;
  working_hours: WorkingHours;
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

const statuses = ["pending", "confirmed", "completed", "no_show", "cancelled"] as const;

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
  return views.some((item) => item.key === value) ? value as CalendarView : "staff_columns";
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

const weekdayKeys: Array<keyof WorkingHours> = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function clockMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

interface LocationOption {
  id: string;
  name: string;
}

function collisionLayout<T extends { id: string }>(
  items: T[],
  startOf: (item: T) => number,
  endOf: (item: T) => number,
) {
  const result = new Map<string, { column: number; columnCount: number }>();
  const sorted = [...items].sort((left, right) =>
    startOf(left) - startOf(right) || endOf(left) - endOf(right),
  );
  const groups: T[][] = [];
  let current: T[] = [];
  let currentEnd = -Infinity;

  for (const item of sorted) {
    const start = startOf(item);
    if (current.length > 0 && start >= currentEnd) {
      groups.push(current);
      current = [];
      currentEnd = -Infinity;
    }
    current.push(item);
    currentEnd = Math.max(currentEnd, endOf(item));
  }
  if (current.length > 0) groups.push(current);

  for (const group of groups) {
    const columnEnds: number[] = [];
    const assignments = new Map<string, number>();
    for (const item of group) {
      const start = startOf(item);
      let column = columnEnds.findIndex((end) => end <= start);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(endOf(item));
      } else {
        columnEnds[column] = endOf(item);
      }
      assignments.set(item.id, column);
    }
    const columnCount = Math.max(1, columnEnds.length);
    for (const item of group) {
      result.set(item.id, { column: assignments.get(item.id) ?? 0, columnCount });
    }
  }
  return result;
}

export default function CalendarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedAppointmentId = searchParams.get("appointment");
  const [items, setItems] = useState<Appointment[]>([]);
  const [availabilityBlocks, setAvailabilityBlocks] = useState<AvailabilityBlock[]>([]);
  const [salonClosures, setSalonClosures] = useState<SalonClosure[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffOption[]>([]);
  const [view, setView] = useState<CalendarView>("staff_columns");
  const [periodOffset, setPeriodOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [rules, setRules] = useState<CalendarRules>({
    allowOverbooking: false,
    bufferMinutes: 0,
    defaultView: "staff_columns",
    enableResourceView: false,
    minBookingNoticeHours: 2,
    minSlotMinutes: 15,
    overbookingLimit: 0,
  });
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [curtainShake, setCurtainShake] = useState(false);
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
        const defaultView = clampView(String(calendar.defaultView ?? "staff_columns"));
        setRules({
          allowOverbooking: Boolean(calendar.allowOverbooking),
          bufferMinutes: Number(calendar.bufferMinutes ?? 0),
          defaultView,
          enableResourceView: Boolean(calendar.enableResourceView),
          minBookingNoticeHours: Number(calendar.minBookingNoticeHours ?? 2),
          minSlotMinutes: Number(calendar.minSlotMinutes ?? 15),
          overbookingLimit: Number(calendar.overbookingLimit ?? 0),
        });
        setView(defaultView);
      });
  }, [salon]);

  useEffect(() => {
    if (!salon) return;
    void fetch(`${api}/api/salons/${salon.id}/settings/locations`, { credentials: "include" })
      .then(async (response) => {
        if (response.ok) setLocations(await response.json() as LocationOption[]);
      });
  }, [salon?.id]);

  const range = useMemo(() => {
    const now = new Date();
    if (view === "day" || view === "staff_columns") {
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
    void Promise.all([
      fetch(`${api}/api/salons/${salon.id}/calendar-events?from=${range.from.toISOString()}&to=${range.to.toISOString()}`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/operations/staff?from=${range.from.toISOString()}&to=${range.to.toISOString()}`, { credentials: "include" }),
    ])
      .then(async ([eventsResponse, staffResponse]) => {
        if (!eventsResponse.ok) throw new Error("Impossibile caricare il calendario.");
        const data = await eventsResponse.json() as { appointments?: Appointment[]; availability_blocks?: AvailabilityBlock[]; salon_closures?: SalonClosure[] };
        setItems(data.appointments ?? []);
        setAvailabilityBlocks(data.availability_blocks ?? []);
        setSalonClosures(data.salon_closures ?? []);
        if (staffResponse.ok) setStaffMembers(await staffResponse.json() as StaffOption[]);
        setError("");
      })
      .catch((reason: Error) => setError(reason.message));
  }, [range.from, range.to, salon?.id, refreshToken]);

  useEffect(() => {
    if (!selectedAppointmentId) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeAppointment();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedAppointmentId]);

  function appointmentHref(appointmentId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("appointment", appointmentId);
    return `/calendar?${next.toString()}`;
  }

  function closeAppointment() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("appointment");
    router.replace(next.size ? `/calendar?${next.toString()}` : "/calendar", { scroll: false });
  }

  function rejectBackdropClose() {
    setCurtainShake(false);
    window.requestAnimationFrame(() => setCurtainShake(true));
  }

  const filteredItems = useMemo(
    () => items.filter((item) =>
      (!locationFilter || item.location_id === locationFilter)
      && appointmentMatches(item, query.trim(), statusFilter, staffFilter),
    ),
    [items, locationFilter, query, staffFilter, statusFilter],
  );
  const days = useMemo(() => {
    if (view === "day" || view === "staff_columns") return [range.from];
    if (view === "month") {
      const monthStart = range.from;
      const gridStart = startOfWeek(monthStart);
      return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
    }
    return Array.from({ length: view === "agenda" ? 14 : 7 }, (_, index) => addDays(range.from, index));
  }, [range.from, view]);
  const staffOptions = useMemo(
    () => staffMembers.length
      ? staffMembers.filter((item) => !locationFilter || item.location_id === locationFilter).map((item) => [item.id, item.display_name] as [string, string])
      : Array.from(new Map(items.map((item) => [item.staff_id, item.staff_name])).entries()),
    [items, locationFilter, staffMembers],
  );
  const visibleStaff = staffFilter ? staffOptions.filter(([id]) => id === staffFilter) : staffOptions;
  const navigatorWeekStart = useMemo(() => startOfWeek(range.from), [range.from]);
  const navigatorDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(navigatorWeekStart, index)),
    [navigatorWeekStart],
  );
  const timelineRange = useMemo(() => {
    const dayKey = weekdayKeys[range.from.getDay()] ?? "mon";
    const visibleIds = new Set(visibleStaff.map(([id]) => id));
    const scheduleMinutes = staffMembers
      .filter((member) => visibleIds.has(member.id))
      .flatMap((member) => member.working_hours?.[dayKey] ?? [])
      .flatMap((period) => [clockMinutes(period.from), clockMinutes(period.to)]);
    const eventMinutes = [
      ...filteredItems.flatMap((item) => {
        const start = new Date(item.starts_at);
        const end = new Date(item.ends_at);
        return [start.getHours() * 60 + start.getMinutes(), end.getHours() * 60 + end.getMinutes()];
      }),
      ...availabilityBlocks
        .filter((item) => !staffFilter || item.staff_id === staffFilter)
        .flatMap((item) => {
          const start = new Date(item.starts_at);
          const end = new Date(item.ends_at);
          return [start.getHours() * 60 + start.getMinutes(), end.getHours() * 60 + end.getMinutes()];
        }),
    ];
    const allMinutes = [...scheduleMinutes, ...eventMinutes];
    if (allMinutes.length === 0) return { endHour: 19, startHour: 9 };
    return {
      endHour: Math.max(1, Math.min(24, Math.ceil(Math.max(...allMinutes) / 60))),
      startHour: Math.max(0, Math.min(23, Math.floor(Math.min(...allMinutes) / 60))),
    };
  }, [availabilityBlocks, filteredItems, range.from, staffFilter, staffMembers, visibleStaff]);

  function itemsForDay(day: Date) {
    return filteredItems.filter((item) => sameDay(new Date(item.starts_at), day));
  }

  function blocksForDay(day: Date) {
    return availabilityBlocks.filter((item) =>
      (!staffFilter || item.staff_id === staffFilter) &&
      (!locationFilter || item.location_id === locationFilter) &&
      sameDay(new Date(item.starts_at), day) &&
      (!query.trim() || `${item.reason ?? "Non disponibile"} ${item.staff_name}`.toLowerCase().includes(query.trim().toLowerCase())),
    );
  }

  function closuresForDay(day: Date) {
    return salonClosures.filter((closure) => closureMatchesDay(closure, day));
  }

  function selectNavigatorDay(day: Date) {
    const today = startOfDay(new Date());
    setView("staff_columns");
    setPeriodOffset(Math.round((startOfDay(day).getTime() - today.getTime()) / 86_400_000));
  }

  const timelineStartHour = timelineRange.startHour;
  const timelineEndHour = Math.max(timelineStartHour + 1, timelineRange.endHour);
  const hourHeight = 92;
  const timelineHours = Array.from({ length: timelineEndHour - timelineStartHour + 1 }, (_, index) => timelineStartHour + index);

  function timelinePosition(startsAt: string, endsAt: string) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    return timelineMinutesPosition(
      start.getHours() * 60 + start.getMinutes(),
      end.getHours() * 60 + end.getMinutes(),
      40,
    );
  }

  function timelineMinutesPosition(fromMinutes: number, toMinutes: number, minimumHeight = 0) {
    const startMinutes = fromMinutes - timelineStartHour * 60;
    const endMinutes = toMinutes - timelineStartHour * 60;
    const top = Math.max(0, startMinutes / 60 * hourHeight);
    const bottom = Math.min((timelineEndHour - timelineStartHour) * hourHeight, endMinutes / 60 * hourHeight);
    return { height: Math.max(minimumHeight, bottom - top), top };
  }

  function nonWorkingPeriods(staffId: string) {
    const member = staffMembers.find((item) => item.id === staffId);
    const dayKey = weekdayKeys[range.from.getDay()] ?? "mon";
    const rangeStart = timelineStartHour * 60;
    const rangeEnd = timelineEndHour * 60;
    const working = (member?.working_hours?.[dayKey] ?? [])
      .map((period) => ({
        from: Math.max(rangeStart, clockMinutes(period.from)),
        to: Math.min(rangeEnd, clockMinutes(period.to)),
      }))
      .filter((period) => period.to > period.from)
      .sort((left, right) => left.from - right.from);
    const gaps: Array<{ from: number; to: number }> = [];
    let cursor = rangeStart;
    for (const period of working) {
      if (period.from > cursor) gaps.push({ from: cursor, to: period.from });
      cursor = Math.max(cursor, period.to);
    }
    if (cursor < rangeEnd) gaps.push({ from: cursor, to: rangeEnd });
    return gaps;
  }

  const appointmentCard = (item: Appointment, compact = false) => (
    <Link
      key={item.id}
      href={appointmentHref(item.id)}
      scroll={false}
      className={`group block rounded-xl border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${item.status === "confirmed" ? "text-white" : ""}`}
      style={item.status === "confirmed"
        ? { background: `linear-gradient(135deg, ${item.color || "#792f59"}, color-mix(in srgb, ${item.color || "#792f59"} 72%, white))`, borderColor: item.color || "#792f59" }
        : { background: APPOINTMENT_STATUS_PALETTE[item.status as keyof typeof APPOINTMENT_STATUS_PALETTE]?.background, borderColor: APPOINTMENT_STATUS_PALETTE[item.status as keyof typeof APPOINTMENT_STATUS_PALETTE]?.border, color: APPOINTMENT_STATUS_PALETTE[item.status as keyof typeof APPOINTMENT_STATUS_PALETTE]?.text }}
    >
      <div className="flex items-start justify-between gap-2">
        <strong className="text-xs font-black">{formatTime(item.starts_at)} - {formatTime(item.ends_at)}</strong>
        <StatusBadge status={item.status ?? "confirmed"}>{appointmentStatusLabel(item.status ?? "confirmed")}</StatusBadge>
      </div>
      <span className={`mt-2 block truncate font-black ${compact ? "text-sm" : "text-base"}`}>{item.customer_name}</span>
      <span className="mt-1 block truncate text-xs font-semibold opacity-75">{item.service_name} con {item.staff_name}</span>
      {!compact && <span className="mt-2 inline-flex rounded-full bg-white/55 px-2 py-1 text-[11px] font-bold">{minutesBetween(item.starts_at, item.ends_at)} min</span>}
    </Link>
  );

  const blockCard = (item: AvailabilityBlock, compact = false) => (
    <div
      key={item.id}
      className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-left shadow-sm"
      style={{ borderLeft: `5px solid ${item.color || "#92400e"}` }}
    >
      <strong className="text-xs font-black text-amber-800">{formatTime(item.starts_at)} - {formatTime(item.ends_at)}</strong>
      <span className={`mt-2 block truncate font-black text-amber-950 ${compact ? "text-sm" : "text-base"}`}>Non disponibile</span>
      <span className="mt-1 block truncate text-xs font-semibold text-amber-800">{item.staff_name} - {item.reason || "Blocco disponibilita"}</span>
    </div>
  );

  const closureCard = (item: SalonClosure) => (
    <div key={item.id} className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm shadow-sm">
      <b className="block text-red-800">Chiusura salone</b>
      <span className="text-red-700">{item.reason || "Giorno non prenotabile"}{item.recurringYearly ? " - ogni anno" : ""}</span>
    </div>
  );

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageTransition>
        <PageHeader
          eyebrow="Agenda"
          title="Agenda operativa"
          subtitle={`${range.label}. Orari, team e appuntamenti nello stesso quadro di lavoro.`}
          actions={canCreate ? <Link href="/calendar/appointments/new" className="inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-stone-800">Nuovo appuntamento</Link> : undefined}
        />

        {error && <InlineError className="mb-4">{error}</InlineError>}

        <section className="mb-4 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="grid grid-cols-[48px_1fr_48px] items-stretch border-b border-stone-200">
            <button aria-label="Settimana precedente" className="grid place-items-center border-r border-stone-200 text-2xl font-black text-[#792f59] transition hover:bg-[#faf3f7]" onClick={() => setPeriodOffset((value) => value - 7)} type="button">‹</button>
            <div className="grid grid-cols-7">
              {navigatorDays.map((day) => {
                const active = sameDay(day, range.from) && (view === "day" || view === "staff_columns");
                const count = itemsForDay(day).length;
                return (
                  <button className={`relative min-w-0 border-r border-stone-100 px-2 py-3 text-center transition last:border-r-0 ${active ? "bg-[#5f2447] text-white" : "text-stone-600 hover:bg-[#fff8fc]"}`} key={day.toISOString()} onClick={() => selectNavigatorDay(day)} type="button">
                    <span className={`block text-[10px] font-black uppercase tracking-[.12em] ${active ? "text-white/65" : "text-stone-400"}`}>{day.toLocaleDateString("it-IT", { weekday: "short" })}</span>
                    <strong className="mt-1 block text-xl">{day.getDate()}</strong>
                    <span className={`mx-auto mt-1.5 block size-1.5 rounded-full ${count ? active ? "bg-white" : "bg-[#b85888]" : "bg-transparent"}`} />
                  </button>
                );
              })}
            </div>
            <button aria-label="Settimana successiva" className="grid place-items-center text-2xl font-black text-[#792f59] transition hover:bg-[#faf3f7]" onClick={() => setPeriodOffset((value) => value + 7)} type="button">›</button>
          </div>

          <div className="flex flex-col gap-3 p-3 xl:flex-row xl:items-center">
            <input
              aria-label="Cerca appuntamenti"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-stone-200 bg-[#fbfaf8] px-4 text-sm font-semibold outline-none transition focus:border-[#792f59] focus:ring-4 focus:ring-[#b85888]/15"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca cliente, servizio o collaboratore"
              value={query}
            />
            {locations.length > 1 && <div className="flex flex-wrap gap-1 rounded-xl border border-stone-200 bg-white p-1">
              <button className={`min-h-9 rounded-lg px-3 text-xs font-black ${!locationFilter ? "bg-[#faf3f7] text-[#792f59]" : "text-stone-500"}`} onClick={() => { setLocationFilter(""); setStaffFilter(""); }} type="button">Tutte le sedi</button>
              {locations.map((location) => <button className={`min-h-9 rounded-lg px-3 text-xs font-black ${locationFilter === location.id ? "bg-[#faf3f7] text-[#792f59]" : "text-stone-500"}`} key={location.id} onClick={() => { setLocationFilter(location.id); setStaffFilter(""); }} type="button">{location.name}</button>)}
            </div>}
            <select aria-label="Filtra per stato" className="min-h-11 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="">Tutti gli stati</option>
              {statuses.map((status) => <option key={status} value={status}>{appointmentStatusLabel(status)}</option>)}
            </select>
            <select aria-label="Filtra per staff" className="min-h-11 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold" onChange={(event) => setStaffFilter(event.target.value)} value={staffFilter}>
              <option value="">Tutto lo staff</option>
              {staffOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <div className="flex shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-50 p-1">
              {views.map((item) => (
                <button className={`min-h-9 rounded-lg px-3 text-xs font-black transition ${view === item.key ? "bg-white text-[#792f59] shadow-sm" : "text-stone-500 hover:text-stone-900"}`} key={item.key} onClick={() => {
                  setView(item.key);
                  setPeriodOffset(0);
                }} type="button">{item.label}</button>
              ))}
            </div>
            <button className="min-h-10 shrink-0 rounded-xl px-3 text-xs font-black text-[#792f59] hover:bg-[#faf3f7]" onClick={() => {
              setQuery("");
              setStatusFilter("");
              setStaffFilter("");
              setLocationFilter("");
              setPeriodOffset(0);
            }} type="button">Oggi · Azzera</button>
          </div>
        </section>

        {view === "agenda" ? (
          <div className="grid gap-3">
            {filteredItems.length === 0 && availabilityBlocks.length === 0 && salonClosures.length === 0 && <SectionCard>Nessun appuntamento con questi filtri.</SectionCard>}
            {days.flatMap((day) => closuresForDay(day).map((closure) => closureCard(closure)))}
            {filteredItems.map((item) => appointmentCard(item))}
            {availabilityBlocks.filter((block) => !staffFilter || block.staff_id === staffFilter).map((block) => blockCard(block))}
          </div>
        ) : view === "staff_columns" || view === "day" ? (
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="min-w-[980px]">
              <div className="sticky top-0 z-20 grid border-b border-stone-200 bg-white" style={{ gridTemplateColumns: `76px repeat(${Math.max(visibleStaff.length, 1)}, minmax(220px, 1fr))` }}>
                <div className="border-r border-stone-200 p-3 text-center text-[10px] font-black uppercase tracking-[.16em] text-stone-400">Ora</div>
                {(visibleStaff.length ? visibleStaff : [["", "Nessuno staff"]]).map(([staffId, staffName]) => {
                  const member = staffMembers.find((item) => item.id === staffId);
                  const displayName = staffName ?? "Nessuno staff";
                  return (
                    <div className="flex items-center justify-center gap-3 border-r border-stone-100 p-3 last:border-r-0" key={staffId}>
                      <span className="grid h-9 w-9 place-items-center rounded-full text-sm font-black text-white" style={{ background: member?.color || "#792f59" }}>{displayName.slice(0, 1).toUpperCase()}</span>
                      <div><p className="font-black text-stone-950">{displayName}</p><p className="text-xs font-semibold text-stone-400">{filteredItems.filter((item) => item.staff_id === staffId).length} appuntamenti</p></div>
                    </div>
                  );
                })}
              </div>
              {closuresForDay(range.from).length > 0 && (
                <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-800">Chiusura salone · {closuresForDay(range.from).map((item) => item.reason || "Giorno non prenotabile").join(", ")}</div>
              )}
              <div className="grid" style={{ gridTemplateColumns: `76px repeat(${Math.max(visibleStaff.length, 1)}, minmax(220px, 1fr))` }}>
                <div className="relative border-r border-stone-200 bg-[#faf9f7]" style={{ height: (timelineEndHour - timelineStartHour) * hourHeight }}>
                  {timelineHours.map((hour, index) => (
                    <div
                      className="absolute left-0 right-0 z-10 pr-3 text-right text-xs font-black text-stone-500"
                      key={hour}
                      style={{
                        top: index === 0
                          ? 8
                          : index === timelineHours.length - 1
                            ? (timelineEndHour - timelineStartHour) * hourHeight - 22
                            : (hour - timelineStartHour) * hourHeight - 8,
                      }}
                    >
                      {String(hour).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>
                {(visibleStaff.length ? visibleStaff : [["", "Nessuno staff"]]).map(([staffId]) => {
                  const staffAppointments = filteredItems.filter((item) => item.staff_id === staffId);
                  const layouts = collisionLayout(
                    staffAppointments,
                    (item) => timelinePosition(item.starts_at, item.ends_at).top,
                    (item) => {
                      const position = timelinePosition(item.starts_at, item.ends_at);
                      return position.top + position.height;
                    },
                  );
                  return (
                  <div className="relative border-r border-stone-100 bg-white last:border-r-0" key={staffId} style={{ height: (timelineEndHour - timelineStartHour) * hourHeight }}>
                    {timelineHours.slice(0, -1).map((hour) => <div className="absolute left-0 right-0 border-t border-stone-100" key={hour} style={{ top: (hour - timelineStartHour) * hourHeight }} />)}
                    {timelineHours.slice(0, -1).flatMap((hour) => [15, 30, 45].map((minute) => <div className="absolute left-0 right-0 border-t border-dashed border-stone-100" key={`${hour}-${minute}`} style={{ top: ((hour - timelineStartHour) * 60 + minute) / 60 * hourHeight }} />))}
                    {nonWorkingPeriods(staffId ?? "").map((period) => (
                      <div
                        className="absolute left-0 right-0 z-[1] flex items-center justify-center overflow-hidden border-y border-stone-300/80 text-[10px] font-black uppercase tracking-[.18em] text-stone-500"
                        key={`${period.from}-${period.to}`}
                        style={{
                          ...timelineMinutesPosition(period.from, period.to),
                          background: "repeating-linear-gradient(135deg, rgba(120,113,108,.08) 0, rgba(120,113,108,.08) 8px, rgba(120,113,108,.20) 8px, rgba(120,113,108,.20) 10px)",
                        }}
                      >
                        <span className="rounded-full bg-white/85 px-3 py-1 shadow-sm">Non lavorativo</span>
                      </div>
                    ))}
                    {availabilityBlocks.filter((item) => item.staff_id === staffId).map((item) => {
                      const position = timelinePosition(item.starts_at, item.ends_at);
                      return <div className="absolute left-2 right-2 z-10 overflow-hidden rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-950 shadow-sm" key={item.id} style={{ ...position, background: "repeating-linear-gradient(135deg, #fffbeb 0, #fffbeb 8px, #fde68a 8px, #fde68a 11px)" }}><span className="block">{formatTime(item.starts_at)}–{formatTime(item.ends_at)}</span><span className="mt-1 block truncate uppercase">{item.reason || "Assenza / non disponibile"}</span></div>;
                    })}
                    {staffAppointments.map((item) => {
                      const position = timelinePosition(item.starts_at, item.ends_at);
                      const layout = layouts.get(item.id) ?? { column: 0, columnCount: 1 };
                      const short = minutesBetween(item.starts_at, item.ends_at) < 30;
                      const confirmed = item.status === "confirmed";
                      const palette = APPOINTMENT_STATUS_PALETTE[item.status as keyof typeof APPOINTMENT_STATUS_PALETTE];
                      const horizontal = layout.columnCount === 1
                        ? { left: "8px", right: "8px" }
                        : {
                          left: `calc(${layout.column / layout.columnCount * 100}% + 4px)`,
                          right: `calc(${(layout.columnCount - layout.column - 1) / layout.columnCount * 100}% + 4px)`,
                        };
                      return (
                        <Link className={`absolute z-10 overflow-hidden rounded-lg border text-xs transition hover:z-20 hover:-translate-y-0.5 hover:shadow-lg ${confirmed ? "border-white/80 text-white shadow-sm" : "shadow-sm"} ${layout.columnCount > 1 ? "px-2" : "pr-24"} ${short ? "flex items-center gap-2 py-1.5 pl-3" : "py-2 pl-3"}`} href={appointmentHref(item.id)} key={item.id} scroll={false} style={{ ...position, ...horizontal, background: confirmed ? `linear-gradient(135deg, ${item.color || "#792f59"} 0%, color-mix(in srgb, ${item.color || "#792f59"} 72%, white) 100%)` : palette?.background, borderColor: confirmed ? undefined : palette?.border, color: confirmed ? undefined : palette?.text }} title={`${formatTime(item.starts_at)}–${formatTime(item.ends_at)} · ${item.customer_name} · ${item.service_name} · ${appointmentStatusLabel(item.status ?? "confirmed")}`}>
                          <span className="shrink-0 font-black">{formatTime(item.starts_at)}–{formatTime(item.ends_at)}</span>
                          <strong className={`${short ? "min-w-0 truncate text-sm" : "mt-1 block truncate text-sm"} uppercase`}>{item.customer_name}</strong>
                          <span className={`${short ? "hidden min-w-0 truncate font-semibold opacity-75 xl:block" : "mt-1 block truncate font-semibold opacity-75"}`}>{short ? `· ${item.service_name}` : item.service_name}</span>
                          {layout.columnCount === 1 && <span className={`absolute right-2 top-1/2 max-w-20 -translate-y-1/2 truncate rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[.08em] backdrop-blur-sm ${confirmed ? "border-white/20 bg-black/16 text-white" : "border-current/20 bg-white/55"}`}>{appointmentStatusLabel(item.status ?? "confirmed")}</span>}
                        </Link>
                      );
                    })}
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
            <div className={`grid min-w-[920px] gap-3 ${view === "month" ? "grid-cols-7" : "grid-cols-7"}`}>
              {days.map((day) => {
                const dayItems = itemsForDay(day);
                const dayBlocks = blocksForDay(day);
                const dayClosures = closuresForDay(day);
                const outsideMonth = view === "month" && day.getMonth() !== range.from.getMonth();
                return (
                  <section key={day.toISOString()} className={`${view === "month" ? "min-h-[170px]" : "min-h-[620px]"} rounded-xl border border-stone-100 bg-white p-3 ${outsideMonth ? "opacity-45" : ""}`}>
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
      {selectedAppointmentId && (
        <div aria-label="Dettaglio appuntamento" aria-modal="true" className="fixed inset-x-0 bottom-0 top-[57px] z-30 bg-[#201820]/28 p-2 backdrop-blur-[2px] md:left-[var(--shell-nav-width)] md:px-4 md:pb-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) rejectBackdropClose();
        }} role="dialog">
          <div className={`appointment-curtain mx-auto h-full max-w-[1540px] overflow-y-auto rounded-xl border border-white/80 bg-[#f7f6f3] shadow-[0_24px_72px_rgb(32_24_32_/_0.28)] ${curtainShake ? "appointment-curtain-shake" : ""}`} onAnimationEnd={() => setCurtainShake(false)}>
            <AppointmentDetailPanel appointmentId={selectedAppointmentId} onChanged={() => setRefreshToken((value) => value + 1)} onClose={closeAppointment} />
          </div>
        </div>
      )}
    </AppPage>
  );
}
