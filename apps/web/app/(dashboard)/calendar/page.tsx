"use client";

import Link from "next/link";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { APPOINTMENT_STATUS_PALETTE, appointmentStatusLabel, isAppointmentDragDisabled, nextAppointmentStatuses, PERMISSION_KEYS, WEEK_DAYS_IT, type WorkingHours } from "@esse-beauty/shared";
import { AppPage, Badge, Button, Dialog, InlineError, PageHeader, PageTransition, SectionCard, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";
import AppointmentDetailPanel from "./_components/AppointmentDetailPanel";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

type CalendarView = "day" | "week" | "month" | "agenda" | "staff_columns" | "resources";

interface Appointment {
  color: string;
  customer_name: string;
  ends_at: string;
  id: string;
  location_id?: string | null;
  resource_id?: string | null;
  resource_name?: string | null;
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
  { key: "resources", label: "Cabine" },
  { key: "week", label: "Settimana" },
  { key: "month", label: "Mese" },
  { key: "agenda", label: "Agenda" },
  { key: "staff_columns", label: "Staff" },
];

const statuses = ["pending", "confirmed", "completed", "no_show", "cancelled"] as const;
const appointmentStatusInitial: Record<string, string> = {
  cancelled: "X",
  completed: "F",
  confirmed: "C",
  no_show: "N",
  pending: "A",
};
const appointmentStatusLegend = [
  ["C", "Confermato"],
  ["A", "In attesa"],
  ["N", "No-show"],
  ["X", "Annullato"],
] as const;

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
  return views.some((item) => item.key === value) ? value as CalendarView : "day";
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

interface ResourceOption {
  active: boolean;
  id: string;
  locationId?: string | null;
  name: string;
  type: string;
}

interface PendingAppointmentMove {
  appointment: Appointment;
  resourceId?: string;
  staffId?: string;
  startsAt: string;
  conflicts: Array<{ code: string; forceable: boolean; message: string }>;
}

interface AppointmentMoveDraft {
  appointment: Appointment;
  date: string;
  resourceId: string;
  staffId: string;
  time: string;
}

function localDateValue(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localTimeValue(value: string) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function DraggableAppointment({
  children,
  item,
  onContextMenu,
  style,
}: {
  children: React.ReactNode;
  item: Appointment;
  onContextMenu: React.MouseEventHandler<HTMLDivElement>;
  style: React.CSSProperties;
}) {
  const dragDisabled = isAppointmentDragDisabled(item.status);
  const draggable = useDraggable({ id: `appointment:${item.id}`, data: { item }, disabled: isAppointmentDragDisabled(item.status) });
  const x = draggable.transform?.x ?? 0;
  const y = draggable.transform?.y ?? 0;
  return (
    <div
      className="absolute z-10 min-w-0 text-xs hover:z-20"
      onContextMenu={onContextMenu}
      ref={draggable.setNodeRef}
      {...draggable.attributes}
      {...draggable.listeners}
      style={{
        ...style,
        boxShadow: draggable.isDragging ? "0 18px 38px rgba(45, 29, 39, .24)" : undefined,
        cursor: dragDisabled ? "default" : draggable.isDragging ? "grabbing" : "grab",
        opacity: draggable.isDragging ? 0.92 : 1,
        transform: `translate3d(${x}px, ${y}px, 0) ${draggable.isDragging ? "scale(1.025)" : "scale(1)"}`,
        transition: draggable.isDragging ? "box-shadow 140ms ease, opacity 140ms ease" : "box-shadow 160ms ease, opacity 160ms ease",
        willChange: "transform",
        zIndex: draggable.isDragging ? 40 : 10,
      }}
    >
      {children}
    </div>
  );
}

function DroppableTimeline({ children, id, onContextMenu, style }: { children: React.ReactNode; id: string; onContextMenu: React.MouseEventHandler<HTMLDivElement>; style: React.CSSProperties }) {
  const droppable = useDroppable({ id });
  return (
    <div
      className={`relative border-r border-stone-100 bg-white last:border-r-0 ${droppable.isOver ? "bg-rose-50/60" : ""}`}
      onContextMenu={onContextMenu}
      ref={droppable.setNodeRef}
      style={style}
    >
      {children}
    </div>
  );
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
  const [view, setView] = useState<CalendarView>("day");
  const [periodOffset, setPeriodOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [resources, setResources] = useState<ResourceOption[]>([]);
  const [rules, setRules] = useState<CalendarRules>({
    allowOverbooking: false,
    bufferMinutes: 0,
    defaultView: "day",
    enableResourceView: false,
    minBookingNoticeHours: 2,
    minSlotMinutes: 15,
    overbookingLimit: 0,
  });
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [curtainShake, setCurtainShake] = useState(false);
  const [pendingMove, setPendingMove] = useState<PendingAppointmentMove>();
  const [moveDraft, setMoveDraft] = useState<AppointmentMoveDraft>();
  const [deleteTarget, setDeleteTarget] = useState<Appointment>();
  const [moveSaving, setMoveSaving] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ appointment?: Appointment; resourceId?: string; staffId?: string; startsAt?: string; x: number; y: number }>();
  const suppressClickUntilRef = useRef(0);
  const { hasPermission, salon } = useAuth();
  const canCreate =
    hasPermission(PERMISSION_KEYS.CALENDAR_MANAGE_OTHERS) ||
    hasPermission(PERMISSION_KEYS.CALENDAR_MANAGE_OWN);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    if (!salon) return;
    void fetch(`${api}/api/salons/${salon.id}/settings/control-center`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json() as { calendar?: Partial<CalendarRules> | null; resources?: ResourceOption[] };
        setResources((data.resources ?? []).filter((resource) => resource.active));
        const calendar = data.calendar;
        if (!calendar) return;
        const defaultView = clampView(String(calendar.defaultView ?? "day"));
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
    if (view === "day" || view === "staff_columns" || view === "resources") {
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
    if (view === "day" || view === "staff_columns" || view === "resources") return [range.from];
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
  const resourceColumns = resources.filter((resource) =>
    !locationFilter || !resource.locationId || resource.locationId === locationFilter,
  );
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
    setView(view === "resources" ? "resources" : "day");
    setPeriodOffset(Math.round((startOfDay(day).getTime() - today.getTime()) / 86_400_000));
  }

  const timelineStartHour = timelineRange.startHour;
  const timelineEndHour = Math.max(timelineStartHour + 1, timelineRange.endHour);
  const hourHeight = 112;
  const timelineHours = Array.from({ length: timelineEndHour - timelineStartHour + 1 }, (_, index) => timelineStartHour + index);

  function timelinePosition(startsAt: string, endsAt: string) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    return timelineMinutesPosition(
      start.getHours() * 60 + start.getMinutes(),
      end.getHours() * 60 + end.getMinutes(),
      66,
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

  function slotStartsAt(clientY: number, element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const rawMinutes = timelineStartHour * 60 + ((clientY - rect.top) / hourHeight) * 60;
    const roundedMinutes = Math.max(0, Math.round(rawMinutes / rules.minSlotMinutes) * rules.minSlotMinutes);
    const date = new Date(range.from);
    date.setHours(Math.floor(roundedMinutes / 60), roundedMinutes % 60, 0, 0);
    return date.toISOString();
  }

  function openSlotContext(event: React.MouseEvent<HTMLDivElement>, target: { resourceId?: string; staffId?: string }) {
    event.preventDefault();
    setContextMenu({
      ...target,
      startsAt: slotStartsAt(event.clientY, event.currentTarget),
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    suppressClickUntilRef.current = Date.now() + 750;
    if (!event.over) return;
    const appointment = event.active.data.current?.item as Appointment | undefined;
    if (!appointment) return;
    const [kind, targetId] = String(event.over.id).split(":");
    const translated = event.active.rect.current.translated;
    if (!translated) return;
    const relativeTop = Math.max(0, translated.top - event.over.rect.top);
    const rawMinutes = timelineStartHour * 60 + relativeTop / hourHeight * 60;
    const roundedMinutes = Math.round(rawMinutes / rules.minSlotMinutes) * rules.minSlotMinutes;
    const targetDate = new Date(range.from);
    targetDate.setHours(Math.floor(roundedMinutes / 60), roundedMinutes % 60, 0, 0);
    const startsAt = targetDate.toISOString();
    setPendingMove({
      appointment,
      conflicts: [],
      resourceId: kind === "resource" ? targetId : appointment.resource_id ?? undefined,
      staffId: kind === "staff" ? targetId : appointment.staff_id,
      startsAt,
    });
  }

  function openMoveEditor(appointment: Appointment) {
    setMoveDraft({
      appointment,
      date: localDateValue(appointment.starts_at),
      resourceId: appointment.resource_id ?? "",
      staffId: appointment.staff_id,
      time: localTimeValue(appointment.starts_at),
    });
    setContextMenu(undefined);
  }

  function prepareMoveConfirmation() {
    const draft = moveDraft;
    if (!draft || !draft.date || !draft.time || !draft.staffId) return;
    const startsAt = new Date(`${draft.date}T${draft.time}:00`).toISOString();
    setPendingMove({
      appointment: draft.appointment,
      conflicts: [],
      resourceId: draft.resourceId || undefined,
      staffId: draft.staffId,
      startsAt,
    });
    setMoveDraft(undefined);
  }

  async function confirmMove(forceConflicts = false) {
    if (!salon || !pendingMove || moveSaving) return;
    setMoveSaving(true);
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/appointments/${pendingMove.appointment.id}`, {
        body: JSON.stringify({
          confirm_overlap: forceConflicts,
          force_conflicts: forceConflicts,
          resource_id: pendingMove.resourceId,
          staff_id: pendingMove.staffId,
          starts_at: pendingMove.startsAt,
        }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });
      const payload = await response.json().catch(() => ({})) as { conflicts?: PendingAppointmentMove["conflicts"]; error?: string };
      if (!response.ok) {
        if (payload.error === "SCHEDULING_CONFLICTS" || payload.error === "APPOINTMENT_OVERLAP_CONFIRMATION_REQUIRED") {
          const conflicts = payload.error === "SCHEDULING_CONFLICTS"
            ? payload.conflicts ?? []
            : [{ code: "STAFF_OVERLAP", forceable: true, message: "Il collaboratore ha già un appuntamento in questa fascia." }];
          setPendingMove((current) => current ? { ...current, conflicts } : current);
          return;
        }
        throw new Error(payload.error === "SALON_CLOSED" ? "Il salone è chiuso." : "Spostamento non riuscito.");
      }
      setPendingMove(undefined);
      setRefreshToken((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Spostamento non riuscito.");
    } finally {
      setMoveSaving(false);
    }
  }

  async function updateAppointment(appointmentId: string, body: Record<string, unknown>) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/appointments/${appointmentId}`, {
      body: JSON.stringify(body),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    if (!response.ok) throw new Error("Operazione non riuscita.");
    setContextMenu(undefined);
    setRefreshToken((value) => value + 1);
  }

  async function deleteAppointment(appointmentId: string) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/appointments/${appointmentId}`, {
      credentials: "include",
      method: "DELETE",
    });
    if (!response.ok) return setError("Eliminazione non riuscita.");
    setContextMenu(undefined);
    setRefreshToken((value) => value + 1);
  }

  function closeContextMenuAnd(action: () => void | Promise<void>) {
    setContextMenu(undefined);
    void action();
  }

  const appointmentCard = (item: Appointment, compact = false) => (
    <Link
      key={item.id}
      href={appointmentHref(item.id)}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenu({ appointment: item, x: event.clientX, y: event.clientY });
      }}
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

  function timelineAppointmentCard(
    item: Appointment,
    layout: { column: number; columnCount: number },
  ) {
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
      <DraggableAppointment
        item={item}
        key={item.id}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setContextMenu({ appointment: item, x: event.clientX, y: event.clientY });
        }}
        style={{ ...position, ...horizontal }}
      >
      <Link
        className="block h-full"
        href={appointmentHref(item.id)}
        onClickCapture={(event) => {
          if (!(Date.now() < suppressClickUntilRef.current)) return;
          event.preventDefault();
          event.stopPropagation();
        }}
        scroll={false}
        title={`${formatTime(item.starts_at)} · ${item.customer_name} · ${item.service_name} · ${item.resource_name ?? "Nessuna cabina"}`}
      >
        <span className="block h-4 pl-1 text-[10px] font-black leading-4 text-stone-700">{formatTime(item.starts_at)}</span>
        <span
          className={`relative block h-[calc(100%-16px)] min-h-14 overflow-hidden rounded-lg border px-2.5 py-1.5 shadow-sm ${confirmedAppointment ? "text-white" : ""}`}
          style={confirmedAppointment
            ? {
              background: `linear-gradient(135deg, ${item.color || "#792f59"}, color-mix(in srgb, ${item.color || "#792f59"} 72%, white))`,
              borderColor: item.color || "#792f59",
            }
            : {
              background: palette?.background,
              borderColor: palette?.border,
              color: palette?.text,
            }}
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
          <span
            aria-label={appointmentStatusLabel(item.status ?? "confirmed")}
            className={`absolute bottom-1.5 right-2 text-[11px] font-black ${confirmedAppointment ? "text-white" : ""}`}
            title={appointmentStatusLabel(item.status ?? "confirmed")}
          >
            {appointmentStatusInitial[item.status ?? "confirmed"] ?? "?"}
          </span>
        </span>
      </Link>
      </DraggableAppointment>
    );
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <DndContext
        onDragCancel={() => { suppressClickUntilRef.current = 0; }}
        onDragEnd={handleDragEnd}
        onDragStart={() => { suppressClickUntilRef.current = Number.POSITIVE_INFINITY; }}
        sensors={sensors}
      >
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
                const active = sameDay(day, range.from) && (view === "day" || view === "staff_columns" || view === "resources");
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
            <div aria-label="Legenda stati appuntamento" className="flex shrink-0 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-[10px] font-bold text-stone-500">
              {appointmentStatusLegend.map(([initial, label]) => (
                <span className="whitespace-nowrap" key={initial}><b className="text-stone-950">{initial}</b> {label}</span>
              ))}
            </div>
            <div className="flex shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-50 p-1">
              {views.filter((item) => item.key !== "resources" || rules.enableResourceView || resources.length > 0).map((item) => (
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
        ) : view === "resources" ? (
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="min-w-[980px]">
              <div className="sticky top-0 z-20 grid border-b border-stone-200 bg-white" style={{ gridTemplateColumns: `76px repeat(${Math.max(resourceColumns.length, 1)}, minmax(220px, 1fr))` }}>
                <div className="border-r border-stone-200 p-3 text-center text-[10px] font-black uppercase tracking-[.16em] text-stone-400">Ora</div>
                {(resourceColumns.length ? resourceColumns : [{ id: "", name: "Nessuna cabina" }]).map((resource) => (
                  <div className="border-r border-stone-100 p-3 text-center last:border-r-0" key={resource.id}>
                    <p className="font-black uppercase text-stone-950">{resource.name}</p>
                    <p className="text-xs font-semibold text-stone-400">
                      {filteredItems.filter((item) => item.resource_id === resource.id).length} appuntamenti
                    </p>
                  </div>
                ))}
              </div>
              <div className="grid" style={{ gridTemplateColumns: `76px repeat(${Math.max(resourceColumns.length, 1)}, minmax(220px, 1fr))` }}>
                <div className="relative border-r border-stone-200 bg-[#faf9f7]" style={{ height: (timelineEndHour - timelineStartHour) * hourHeight }}>
                  {timelineHours.map((hour, index) => (
                    <div className="absolute left-0 right-0 z-10 pr-3 text-right text-xs font-black text-stone-500" key={hour} style={{ top: index === 0 ? 8 : index === timelineHours.length - 1 ? (timelineEndHour - timelineStartHour) * hourHeight - 22 : (hour - timelineStartHour) * hourHeight - 8 }}>
                      {String(hour).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>
                {(resourceColumns.length ? resourceColumns : [{ id: "", name: "Nessuna cabina" }]).map((resource) => {
                  const resourceAppointments = filteredItems.filter((item) => item.resource_id === resource.id);
                  const layouts = collisionLayout(
                    resourceAppointments,
                    (item) => timelinePosition(item.starts_at, item.ends_at).top,
                    (item) => {
                      const position = timelinePosition(item.starts_at, item.ends_at);
                      return position.top + position.height;
                    },
                  );
                  return (
                    <DroppableTimeline id={`resource:${resource.id}`} key={resource.id} onContextMenu={(event) => openSlotContext(event, { resourceId: resource.id })} style={{ height: (timelineEndHour - timelineStartHour) * hourHeight }}>
                      {timelineHours.slice(0, -1).map((hour) => <div className="absolute left-0 right-0 border-t border-stone-100" key={hour} style={{ top: (hour - timelineStartHour) * hourHeight }} />)}
                      {timelineHours.slice(0, -1).flatMap((hour) => [15, 30, 45].map((minute) => <div className="absolute left-0 right-0 border-t border-dashed border-stone-100" key={`${hour}-${minute}`} style={{ top: ((hour - timelineStartHour) * 60 + minute) / 60 * hourHeight }} />))}
                      {resourceAppointments.map((item) => timelineAppointmentCard(item, layouts.get(item.id) ?? { column: 0, columnCount: 1 }))}
                    </DroppableTimeline>
                  );
                })}
              </div>
            </div>
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
                  <DroppableTimeline id={`staff:${staffId}`} key={staffId} onContextMenu={(event) => openSlotContext(event, { staffId })} style={{ height: (timelineEndHour - timelineStartHour) * hourHeight }}>
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
                    {staffAppointments.map((item) =>
                      timelineAppointmentCard(item, layouts.get(item.id) ?? { column: 0, columnCount: 1 }),
                    )}
                  </DroppableTimeline>
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
      </DndContext>
      <Dialog
        footer={
          <>
            <Button onClick={() => setMoveDraft(undefined)} variant="outline">Annulla</Button>
            <Button
              disabled={!moveDraft?.date || !moveDraft.time || !moveDraft.staffId}
              onClick={prepareMoveConfirmation}
              variant="primary"
            >
              Continua
            </Button>
          </>
        }
        onClose={() => setMoveDraft(undefined)}
        open={Boolean(moveDraft)}
        title="Sposta appuntamento"
      >
        {moveDraft && (
          <div className="space-y-5">
            <div className="rounded-xl bg-stone-50 p-4">
              <b className="block text-stone-950">{moveDraft.appointment.customer_name}</b>
              <span className="text-sm text-stone-500">{moveDraft.appointment.service_name}</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-stone-700">
                Data
                <input
                  aria-label="Nuova data"
                  className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 font-semibold text-stone-950"
                  onChange={(event) => setMoveDraft((current) => current ? { ...current, date: event.target.value } : current)}
                  type="date"
                  value={moveDraft.date}
                />
              </label>
              <label className="text-sm font-bold text-stone-700">
                Ora
                <input
                  aria-label="Nuovo orario"
                  className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 font-semibold text-stone-950"
                  onChange={(event) => setMoveDraft((current) => current ? { ...current, time: event.target.value } : current)}
                  step={rules.minSlotMinutes * 60}
                  type="time"
                  value={moveDraft.time}
                />
              </label>
              <label className="text-sm font-bold text-stone-700">
                Collaboratore
                <select
                  aria-label="Nuovo collaboratore"
                  className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 font-semibold text-stone-950"
                  onChange={(event) => setMoveDraft((current) => current ? { ...current, staffId: event.target.value } : current)}
                  value={moveDraft.staffId}
                >
                  {staffOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-stone-700">
                Cabina
                <select
                  aria-label="Nuova cabina"
                  className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 font-semibold text-stone-950"
                  onChange={(event) => setMoveDraft((current) => current ? { ...current, resourceId: event.target.value } : current)}
                  value={moveDraft.resourceId}
                >
                  <option value="">Assegnazione automatica</option>
                  {resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}
                </select>
              </label>
            </div>
          </div>
        )}
      </Dialog>
      <Dialog
        footer={
          <>
            <Button onClick={() => setPendingMove(undefined)} variant="outline">Annulla</Button>
            <Button
              disabled={moveSaving || pendingMove?.conflicts.some((conflict) => !conflict.forceable)}
              onClick={() => void confirmMove(Boolean(pendingMove?.conflicts.length))}
              variant="primary"
            >
              {moveSaving ? "Spostamento..." : pendingMove?.conflicts.length ? "Forza e sposta" : "Conferma spostamento"}
            </Button>
          </>
        }
        onClose={() => setPendingMove(undefined)}
        open={Boolean(pendingMove)}
        title="Conferma spostamento"
      >
        {pendingMove && (
          <div className="space-y-4 text-sm">
            <p>Verifica il movimento prima di salvare. Nessuna modifica viene applicata senza questa conferma.</p>
            <div className="grid gap-2 rounded-xl bg-stone-50 p-4 sm:grid-cols-2">
              <div><span className="text-stone-500">Prima</span><b className="mt-1 block">{new Date(pendingMove.appointment.starts_at).toLocaleString("it-IT")}</b><small>{pendingMove.appointment.staff_name} · {pendingMove.appointment.resource_name ?? "Nessuna cabina"}</small></div>
              <div><span className="text-stone-500">Dopo</span><b className="mt-1 block">{new Date(pendingMove.startsAt).toLocaleString("it-IT")}</b><small>{staffMembers.find((item) => item.id === pendingMove.staffId)?.display_name ?? pendingMove.appointment.staff_name} · {resources.find((item) => item.id === pendingMove.resourceId)?.name ?? "Nessuna cabina"}</small></div>
            </div>
            {pendingMove.conflicts.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                <b>Avvisi da confermare</b>
                <ul className="mt-2 list-disc pl-5">{pendingMove.conflicts.map((conflict) => <li key={conflict.code}>{conflict.message}{!conflict.forceable ? " (non forzabile)" : ""}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </Dialog>
      <Dialog
        footer={<><Button onClick={() => setDeleteTarget(undefined)} variant="outline">Annulla</Button><Button onClick={() => deleteTarget && void deleteAppointment(deleteTarget.id)} variant="primary">Elimina</Button></>}
        onClose={() => setDeleteTarget(undefined)}
        open={Boolean(deleteTarget)}
        title="Elimina appuntamento"
      >
        <p className="text-sm text-stone-600">Confermi l’eliminazione dell’appuntamento di <b>{deleteTarget?.customer_name}</b>?</p>
      </Dialog>
      {contextMenu && (
        <>
          <button aria-label="Chiudi menu contestuale" className="fixed inset-0 z-40 cursor-default" onClick={() => setContextMenu(undefined)} onContextMenu={(event) => event.preventDefault()} type="button" />
          <div className="fixed z-50 min-w-56 overflow-hidden rounded-xl border border-stone-200 bg-white p-1.5 text-sm shadow-2xl" onContextMenu={(event) => event.preventDefault()} onMouseLeave={() => setContextMenu(undefined)} style={{ left: contextMenu.x, top: contextMenu.y }}>
            {contextMenu.appointment ? (
              <>
                <button className="block w-full rounded-lg px-3 py-2 text-left font-bold hover:bg-stone-50" onClick={() => closeContextMenuAnd(() => router.push(appointmentHref(contextMenu.appointment!.id)))} type="button">Apri</button>
                {!isAppointmentDragDisabled(contextMenu.appointment.status) && <button className="block w-full rounded-lg px-3 py-2 text-left font-bold hover:bg-stone-50" onClick={() => openMoveEditor(contextMenu.appointment!)} type="button">Sposta</button>}
                <button className="block w-full rounded-lg px-3 py-2 text-left font-bold hover:bg-stone-50" onClick={() => closeContextMenuAnd(() => {
                  const item = contextMenu.appointment!;
                  const params = new URLSearchParams({ duplicate: item.id, staffId: item.staff_id, startsAt: item.starts_at });
                  if (item.resource_id) params.set("resourceId", item.resource_id);
                  router.push(`/calendar/appointments/new?${params}`);
                })} type="button">Duplica</button>
                <div className="my-1 border-t border-stone-100" />
                <p className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-stone-400">Cambia stato</p>
                <div className="grid grid-cols-5 gap-1 px-2 pb-2">
                  {nextAppointmentStatuses(contextMenu.appointment.status ?? "confirmed").map((status) => <button className="rounded-lg bg-stone-50 py-2 font-black hover:bg-rose-50" key={status} onClick={() => closeContextMenuAnd(() => updateAppointment(contextMenu.appointment!.id, { status }))} title={appointmentStatusLabel(status)} type="button">{appointmentStatusInitial[status]}</button>)}
                </div>
                <button className="block w-full rounded-lg px-3 py-2 text-left font-bold text-red-700 hover:bg-red-50" onClick={() => { setDeleteTarget(contextMenu.appointment); setContextMenu(undefined); }} type="button">Elimina</button>
              </>
            ) : (
              <button className="block w-full rounded-lg px-3 py-2 text-left font-bold hover:bg-rose-50" onClick={() => closeContextMenuAnd(() => {
                const params = new URLSearchParams();
                if (contextMenu.startsAt) params.set("startsAt", contextMenu.startsAt);
                if (contextMenu.staffId) params.set("staffId", contextMenu.staffId);
                if (contextMenu.resourceId) params.set("resourceId", contextMenu.resourceId);
                router.push(`/calendar/appointments/new?${params}`);
              })} type="button">Nuovo appuntamento qui</button>
            )}
          </div>
        </>
      )}
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
