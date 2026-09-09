"use client";

import { useEffect, useMemo, useState } from "react";

import { APPOINTMENT_STATUS_PALETTE, appointmentStatusLabel, type WorkingHours } from "@esse-beauty/shared";
import { EmptyState, InlineError, Select } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";
import { buildTimelineCompression } from "../timelineCompression";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

const statuses = ["pending", "confirmed", "completed", "no_show", "cancelled"] as const;
const appointmentStatusInitial: Record<string, string> = {
  cancelled: "X",
  completed: "F",
  confirmed: "C",
  no_show: "N",
  pending: "A",
};
const weekdayKeys: Array<keyof WorkingHours> = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

interface PreviewAppointment {
  color: string;
  customer_name: string;
  ends_at: string;
  id: string;
  resource_name?: string | null;
  service_name: string;
  staff_id: string;
  staff_name: string;
  starts_at: string;
  status?: string;
}

interface PreviewAvailabilityBlock {
  ends_at: string;
  id: string;
  reason?: string | null;
  staff_id: string;
  starts_at: string;
}

interface PreviewClosure {
  date: string;
  reason?: string | null;
  recurringYearly: boolean;
}

interface PreviewTimePeriod {
  from: string;
  to: string;
}

interface PreviewSpecialOpening {
  date: string;
  periods: PreviewTimePeriod[];
  staff: Array<{ periods: PreviewTimePeriod[] | null; staff_id: string }>;
}

interface PreviewStaff {
  color: string;
  display_name: string;
  id: string;
  working_hours: WorkingHours;
}

function clockMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function closureMatchesDate(closure: PreviewClosure, dateKey: string) {
  return closure.date === dateKey || (closure.recurringYearly && closure.date.slice(5) === dateKey.slice(5));
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("it-IT", { hour: "2-digit", hour12: false, minute: "2-digit" });
}

function formatResourceLabel(name?: string | null) {
  return name?.trim().slice(0, 4).toUpperCase() || "—";
}

function collisionLayout<T extends { id: string }>(
  items: T[],
  startOf: (item: T) => number,
  endOf: (item: T) => number,
) {
  const result = new Map<string, { column: number; columnCount: number }>();
  const sorted = [...items].sort((left, right) => startOf(left) - startOf(right) || endOf(left) - endOf(right));
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

export function DayAgendaPreview({ date }: { date: string }) {
  const { salon } = useAuth();
  const [items, setItems] = useState<PreviewAppointment[]>([]);
  const [availabilityBlocks, setAvailabilityBlocks] = useState<PreviewAvailabilityBlock[]>([]);
  const [closures, setClosures] = useState<PreviewClosure[]>([]);
  const [specialOpenings, setSpecialOpenings] = useState<PreviewSpecialOpening[]>([]);
  const [staffMembers, setStaffMembers] = useState<PreviewStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const dayStart = useMemo(() => new Date(`${date}T00:00:00`), [date]);
  const dayEnd = useMemo(() => new Date(dayStart.getTime() + 86_400_000), [dayStart]);

  useEffect(() => {
    if (!salon?.id || !date) return;
    setLoading(true);
    void Promise.all([
      fetch(`${api}/api/salons/${salon.id}/calendar-events?from=${dayStart.toISOString()}&to=${dayEnd.toISOString()}`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/operations/staff?from=${dayStart.toISOString()}&to=${dayEnd.toISOString()}`, { credentials: "include" }),
    ])
      .then(async ([eventsResponse, staffResponse]) => {
        if (!eventsResponse.ok) throw new Error("Impossibile caricare l'agenda.");
        const data = await eventsResponse.json() as {
          appointments?: PreviewAppointment[];
          availability_blocks?: PreviewAvailabilityBlock[];
          salon_closures?: PreviewClosure[];
          special_openings?: PreviewSpecialOpening[];
        };
        setItems(data.appointments ?? []);
        setAvailabilityBlocks(data.availability_blocks ?? []);
        setClosures(data.salon_closures ?? []);
        setSpecialOpenings(data.special_openings ?? []);
        if (staffResponse.ok) setStaffMembers(await staffResponse.json() as PreviewStaff[]);
        setError("");
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [salon?.id, dayStart, dayEnd, date]);

  const filteredItems = useMemo(
    () => items.filter((item) =>
      (!statusFilter || item.status === statusFilter) && (!staffFilter || item.staff_id === staffFilter),
    ),
    [items, statusFilter, staffFilter],
  );

  const staffOptions = useMemo(
    () => staffMembers.length
      ? staffMembers.map((item) => [item.id, item.display_name] as [string, string])
      : Array.from(new Map(items.map((item) => [item.staff_id, item.staff_name])).entries()),
    [items, staffMembers],
  );
  const visibleStaff = staffFilter ? staffOptions.filter(([id]) => id === staffFilter) : staffOptions;
  const specialOpening = specialOpenings.find((opening) => opening.date === date);
  const dayClosures = specialOpening ? [] : closures.filter((closure) => closureMatchesDate(closure, date));

  function workingPeriodsFor(staffId: string): PreviewTimePeriod[] {
    if (specialOpening) {
      const entry = specialOpening.staff.find((item) => item.staff_id === staffId);
      if (entry) return entry.periods ?? specialOpening.periods;
    }
    const member = staffMembers.find((item) => item.id === staffId);
    const dayKey = weekdayKeys[dayStart.getDay()] ?? "mon";
    return member?.working_hours?.[dayKey] ?? [];
  }

  const timelineRange = useMemo(() => {
    const visibleIds = new Set(visibleStaff.map(([id]) => id));
    const scheduleMinutes = staffMembers
      .filter((member) => visibleIds.has(member.id))
      .flatMap((member) => workingPeriodsFor(member.id))
      .flatMap((period) => [clockMinutes(period.from), clockMinutes(period.to)]);
    const eventMinutes = filteredItems.flatMap((item) => {
      const start = new Date(item.starts_at);
      const end = new Date(item.ends_at);
      return [start.getHours() * 60 + start.getMinutes(), end.getHours() * 60 + end.getMinutes()];
    });
    const allMinutes = [...scheduleMinutes, ...eventMinutes];
    if (allMinutes.length === 0) return { endHour: 19, startHour: 9 };
    return {
      endHour: Math.max(1, Math.min(24, Math.ceil(Math.max(...allMinutes) / 60))),
      startHour: Math.max(0, Math.min(23, Math.floor(Math.min(...allMinutes) / 60))),
    };
  }, [dayStart, filteredItems, specialOpening, staffMembers, visibleStaff]);

  const timelineStartHour = timelineRange.startHour;
  const timelineEndHour = Math.max(timelineStartHour + 1, timelineRange.endHour);
  const hourHeight = 96;
  const timelineHours = Array.from({ length: timelineEndHour - timelineStartHour + 1 }, (_, index) => timelineStartHour + index);

  const timelineCompression = useMemo(() => {
    const visibleIds = new Set(visibleStaff.map(([id]) => id));
    const workingPeriods = staffMembers
      .filter((member) => visibleIds.has(member.id))
      .flatMap((member) => workingPeriodsFor(member.id))
      .map((period) => ({ from: clockMinutes(period.from), to: clockMinutes(period.to) }));
    const occupiedPeriods = filteredItems.map((item) => {
      const start = new Date(item.starts_at);
      const end = new Date(item.ends_at);
      return { from: start.getHours() * 60 + start.getMinutes(), to: end.getHours() * 60 + end.getMinutes() };
    });
    return buildTimelineCompression({
      compressedHeight: 64,
      hourHeight,
      occupiedPeriods,
      rangeEnd: timelineEndHour * 60,
      rangeStart: timelineStartHour * 60,
      workingPeriods,
    });
  }, [dayStart, filteredItems, specialOpening, staffMembers, timelineEndHour, timelineStartHour, visibleStaff]);

  const timelineHeight = timelineCompression.height;
  const timelineHourTop = (hour: number) => timelineCompression.timelineY(hour * 60);
  const visibleTimelineHours = timelineHours.filter((hour) =>
    !timelineCompression.gaps.some((gap) => gap.from < hour * 60 && hour * 60 < gap.to),
  );
  const timelineCompressedGapMarkers = timelineCompression.gaps.map((gap) => ({
    ...gap,
    top: timelineCompression.timelineY(gap.from),
  }));

  function timelinePosition(startsAt: string, endsAt: string) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    return timelineCompression.intervalPosition(
      start.getHours() * 60 + start.getMinutes(),
      end.getHours() * 60 + end.getMinutes(),
      60,
    );
  }

  function nonWorkingPeriods(staffId: string) {
    const rangeStart = timelineStartHour * 60;
    const rangeEnd = timelineEndHour * 60;
    const working = workingPeriodsFor(staffId)
      .map((period) => ({ from: Math.max(rangeStart, clockMinutes(period.from)), to: Math.min(rangeEnd, clockMinutes(period.to)) }))
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

  function appointmentCard(item: PreviewAppointment, layout: { column: number; columnCount: number }) {
    const position = timelinePosition(item.starts_at, item.ends_at);
    const horizontal = layout.columnCount === 1
      ? { left: "6px", right: "6px" }
      : {
        left: `calc(${layout.column / layout.columnCount * 100}% + 3px)`,
        right: `calc(${(layout.columnCount - layout.column - 1) / layout.columnCount * 100}% + 3px)`,
      };
    const palette = APPOINTMENT_STATUS_PALETTE[item.status as keyof typeof APPOINTMENT_STATUS_PALETTE];
    const confirmedAppointment = item.status === "confirmed";
    return (
      <div className="absolute z-10 min-w-0 text-xs" key={item.id} style={{ ...position, ...horizontal }}>
        <div className="block h-full" title={`${formatTime(item.starts_at)} · ${item.customer_name} · ${item.service_name} · ${item.resource_name ?? "Nessuna cabina"}`}>
          <span className="block h-4 pl-1 text-[10px] font-black leading-4 text-stone-700">{formatTime(item.starts_at)}</span>
          <span
            className={`relative block h-[calc(100%-16px)] min-h-14 overflow-hidden rounded-lg border px-2.5 py-1.5 shadow-sm ${confirmedAppointment ? "text-white" : ""}`}
            style={confirmedAppointment
              ? { background: `linear-gradient(135deg, ${item.color || "#792f59"}, color-mix(in srgb, ${item.color || "#792f59"} 72%, white))`, borderColor: item.color || "#792f59" }
              : { background: palette?.background, borderColor: palette?.border, color: palette?.text }}
          >
            <span className="flex min-w-0 items-start justify-between gap-2">
              <strong className="min-w-0 truncate text-[12px] font-black uppercase">{item.customer_name}</strong>
              {item.resource_name && (
                <span className={`shrink-0 border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[.08em] ${confirmedAppointment ? "border-white/50 bg-white/15 text-white" : "border-current/50 bg-white/55"}`}>
                  {formatResourceLabel(item.resource_name)}
                </span>
              )}
            </span>
            <span className={`mt-1 block min-w-0 truncate pr-5 text-[11px] font-semibold ${confirmedAppointment ? "text-white/80" : "opacity-75"}`}>{item.service_name}</span>
            <span aria-label={appointmentStatusLabel(item.status ?? "confirmed")} className={`absolute bottom-1.5 right-2 text-[11px] font-black ${confirmedAppointment ? "text-white" : ""}`} title={appointmentStatusLabel(item.status ?? "confirmed")}>
              {appointmentStatusInitial[item.status ?? "confirmed"] ?? "?"}
            </span>
          </span>
        </div>
      </div>
    );
  }

  const renderedStaff = visibleStaff.length ? visibleStaff : ([["", "Nessuno staff"]] as Array<[string, string]>);

  return (
    <div className="rounded-xl border border-stone-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 p-3">
        <Select aria-label="Filtra per staff" className="min-h-10 min-w-[180px] flex-1 rounded-lg border border-stone-200 bg-[#fbfaf8] px-3 text-sm font-semibold" onChange={(event) => setStaffFilter(event.target.value)} value={staffFilter}>
          <option value="">Tutto lo staff</option>
          {staffOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </Select>
        <Select aria-label="Filtra per stato" className="min-h-10 min-w-[160px] flex-1 rounded-lg border border-stone-200 bg-[#fbfaf8] px-3 text-sm font-semibold" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
          <option value="">Tutti gli stati</option>
          {statuses.map((status) => <option key={status} value={status}>{appointmentStatusLabel(status)}</option>)}
        </Select>
      </div>
      {error && <div className="p-3"><InlineError>{error}</InlineError></div>}
      {loading ? (
        <div className="h-64 animate-pulse bg-stone-50" />
      ) : dayClosures.length > 0 ? (
        <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-800">Chiusura salone · {dayClosures.map((item) => item.reason || "Giorno non prenotabile").join(", ")}</div>
      ) : staffOptions.length === 0 && items.length === 0 ? (
        <div className="p-4"><EmptyState description="Nessun collaboratore o appuntamento per questo giorno." title="Agenda vuota" /></div>
      ) : (
        <div className="max-h-[520px] overflow-auto">
          <div className="min-w-0 lg:min-w-[720px]">
            <div className="sticky top-0 z-20 grid border-b-2 border-stone-200 bg-white" style={{ gridTemplateColumns: `64px repeat(${Math.max(renderedStaff.length, 1)}, minmax(160px, 1fr))` }}>
              <div className="flex items-end justify-center border-r border-stone-200 pb-2 pt-3 text-[10px] font-black uppercase tracking-[.16em] text-stone-400">Ora</div>
              {renderedStaff.map(([staffId, staffName]) => {
                const member = staffMembers.find((item) => item.id === staffId);
                return (
                  <div className="flex flex-col items-center gap-1.5 border-r border-stone-100 px-2 pb-2 pt-3 last:border-r-0" key={staffId}>
                    <span className="grid h-9 w-9 place-items-center rounded-full text-xs font-black text-white shadow-sm ring-2 ring-white" style={{ background: member?.color || "#792f59" }}>{staffName.slice(0, 1).toUpperCase()}</span>
                    <p className="truncate text-xs font-black text-stone-950">{staffName}</p>
                  </div>
                );
              })}
            </div>
            <div className="grid" style={{ gridTemplateColumns: `64px repeat(${Math.max(renderedStaff.length, 1)}, minmax(160px, 1fr))` }}>
              <div className="relative border-r border-stone-200 bg-[#faf9f7]" style={{ height: timelineHeight }}>
                {timelineCompressedGapMarkers.map((gap) => (
                  <div className="absolute left-0 right-0 z-10 flex flex-col items-end justify-center pr-4 text-stone-400" key={`${gap.from}-${gap.to}`} style={{ height: gap.compressedHeight, top: gap.top }}>
                    <span className="leading-3">·</span><span className="leading-3">·</span><span className="leading-3">·</span>
                  </div>
                ))}
                {visibleTimelineHours.map((hour, index) => (
                  <div className="absolute left-0 right-0 z-10 pr-2 text-right text-xs font-black text-stone-500" key={hour} style={{ top: index === 0 ? 6 : index === visibleTimelineHours.length - 1 ? timelineHeight - 20 : timelineHourTop(hour) - 8 }}>
                    {String(hour).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
              {renderedStaff.map(([staffId]) => {
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
                  <div className="relative border-r border-stone-100 bg-white last:border-r-0" key={staffId} style={{ height: timelineHeight }}>
                    {visibleTimelineHours.slice(0, -1).map((hour) => <div className="absolute left-0 right-0 border-t border-stone-100" key={hour} style={{ top: timelineHourTop(hour) }} />)}
                    {nonWorkingPeriods(staffId ?? "").map((period) => (
                      <div
                        className="absolute left-0 right-0 z-[1] flex items-center justify-center overflow-hidden border-y border-stone-300/80 text-[9px] font-black uppercase tracking-[.16em] text-stone-500"
                        key={`${period.from}-${period.to}`}
                        style={{
                          ...timelineCompression.intervalPosition(period.from, period.to),
                          background: "repeating-linear-gradient(135deg, rgba(120,113,108,.08) 0, rgba(120,113,108,.08) 8px, rgba(120,113,108,.20) 8px, rgba(120,113,108,.20) 10px)",
                        }}
                      >
                        <span className="rounded-full bg-white/85 px-2 py-0.5 shadow-sm">Non lavorativo</span>
                      </div>
                    ))}
                    {availabilityBlocks.filter((item) => item.staff_id === staffId).map((item) => {
                      const position = timelinePosition(item.starts_at, item.ends_at);
                      return <div className="absolute left-1.5 right-1.5 z-10 overflow-hidden rounded-lg border border-amber-300 px-2 py-1.5 text-[11px] font-bold text-amber-950 shadow-sm" key={item.id} style={{ ...position, background: "repeating-linear-gradient(135deg, #fffbeb 0, #fffbeb 8px, #fde68a 8px, #fde68a 11px)" }}><span className="block">{formatTime(item.starts_at)}–{formatTime(item.ends_at)}</span><span className="mt-0.5 block truncate uppercase">{item.reason || "Assenza"}</span></div>;
                    })}
                    {staffAppointments.map((item) => appointmentCard(item, layouts.get(item.id) ?? { column: 0, columnCount: 1 }))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
