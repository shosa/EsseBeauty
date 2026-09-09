"use client";

import Link from "next/link";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createPortal } from "react-dom";
import { Calendar, CalendarCheck, CalendarDays, CalendarSearch, ChevronLeft, ChevronRight, Columns3, DoorOpen, List, MapPin, Search, SlidersHorizontal, Tag, UsersRound } from "lucide-react";

import { APPOINTMENT_STATUS_PALETTE, appointmentStatusLabel, isAppointmentDragDisabled, nextAppointmentStatuses, PERMISSION_KEYS, WEEK_DAYS_IT, type WorkingHours } from "@esse-beauty/shared";
import { Badge, Button, Dialog, InlineError, SectionCard, StatusBadge, Select} from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";
import AppointmentDetailPanel from "./_components/AppointmentDetailPanel";
import { buildTimelineCompression, type TimelinePeriod } from "./timelineCompression";

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

const viewIcons: Record<CalendarView, typeof CalendarDays> = {
  agenda: List,
  day: CalendarDays,
  month: Calendar,
  resources: DoorOpen,
  staff_columns: UsersRound,
  week: Columns3,
};

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

function clampedContextMenuPosition(x: number, y: number) {
  if (typeof window === "undefined") return { left: x, top: y };
  const margin = 12;
  const menuWidth = 244;
  const menuHeight = 360;
  return {
    left: Math.max(margin, Math.min(x, window.innerWidth - menuWidth - margin)),
    top: Math.max(margin, Math.min(y, window.innerHeight - menuHeight - margin)),
  };
}

const manualContextStatuses = new Set(["pending", "confirmed", "no_show", "cancelled"]);

function manualContextStatusActions(status?: string) {
  return nextAppointmentStatuses(status ?? "confirmed").filter((status) => status !== "completed" && manualContextStatuses.has(status));
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
  const reduceMotion = useReducedMotion();
  const selectedAppointmentId = searchParams.get("appointment");
  const [items, setItems] = useState<Appointment[]>([]);
  const [availabilityBlocks, setAvailabilityBlocks] = useState<AvailabilityBlock[]>([]);
  const [salonClosures, setSalonClosures] = useState<SalonClosure[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffOption[]>([]);
  const [isMobile, setIsMobile] = useState(false);
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

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (isMobile && !["day", "agenda"].includes(view)) {
      setView("day");
      setPeriodOffset(0);
    }
  }, [isMobile, view]);
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  const appointmentDialogRef = useRef<HTMLElement>(null);
  const [curtainShake, setCurtainShake] = useState(false);
  const [pendingMove, setPendingMove] = useState<PendingAppointmentMove>();
  const [moveDraft, setMoveDraft] = useState<AppointmentMoveDraft>();
  const [deleteTarget, setDeleteTarget] = useState<Appointment>();
  const [moveSaving, setMoveSaving] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ appointment?: Appointment; resourceId?: string; staffId?: string; startsAt?: string; x: number; y: number }>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersPosition, setFiltersPosition] = useState<{ right: number; top: number }>();
  const filtersButtonRef = useRef<HTMLButtonElement>(null);
  const filtersPanelRef = useRef<HTMLDivElement>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerPosition, setDatePickerPosition] = useState<{ left: number; top: number }>();
  const [datePickerMonth, setDatePickerMonth] = useState(() => new Date());
  const dateTriggerRef = useRef<HTMLButtonElement>(null);
  const datePickerPanelRef = useRef<HTMLDivElement>(null);
  const suppressClickUntilRef = useRef(0);
  const { hasPermission, salon } = useAuth();
  const canCreate =
    hasPermission(PERMISSION_KEYS.CALENDAR_MANAGE_OTHERS) ||
    hasPermission(PERMISSION_KEYS.CALENDAR_MANAGE_OWN);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => setPortalNode(document.body), []);

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
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (appointmentDialogRef.current?.querySelector('[role="dialog"]')) return;
        closeAppointment();
      }
      if (event.key !== "Tab" || !appointmentDialogRef.current) return;
      const focusable = Array.from(appointmentDialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    const focusFrame = window.requestAnimationFrame(() => appointmentDialogRef.current?.querySelector<HTMLElement>("[data-appointment-close]")?.focus());
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      previousFocus?.focus();
    };
  }, [selectedAppointmentId]);

  useEffect(() => {
    if (!filtersOpen) return;
    function closeOnOutsideAction(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setFiltersOpen(false);
        return;
      }
      const target = event.target as Node;
      if (filtersButtonRef.current?.contains(target)) return;
      if (filtersPanelRef.current && !filtersPanelRef.current.contains(target)) setFiltersOpen(false);
    }
    function closeOnScroll() {
      setFiltersOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideAction);
    document.addEventListener("keydown", closeOnOutsideAction);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideAction);
      document.removeEventListener("keydown", closeOnOutsideAction);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [filtersOpen]);

  useEffect(() => {
    if (!datePickerOpen) return;
    function closeOnOutsideAction(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setDatePickerOpen(false);
        return;
      }
      const target = event.target as Node;
      if (dateTriggerRef.current?.contains(target)) return;
      if (datePickerPanelRef.current && !datePickerPanelRef.current.contains(target)) setDatePickerOpen(false);
    }
    function closeOnScroll() {
      setDatePickerOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideAction);
    document.addEventListener("keydown", closeOnOutsideAction);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideAction);
      document.removeEventListener("keydown", closeOnOutsideAction);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [datePickerOpen]);

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
  const selectedMobileStaffIndex = Math.max(0, staffOptions.findIndex(([id]) => id === staffFilter));
  const renderedStaff = isMobile ? staffOptions.slice(selectedMobileStaffIndex, selectedMobileStaffIndex + 1) : visibleStaff;

  function moveMobileStaff(direction: 1 | -1) {
    if (staffOptions.length < 2) return;
    const nextIndex = (selectedMobileStaffIndex + direction + staffOptions.length) % staffOptions.length;
    setStaffFilter(staffOptions[nextIndex]![0]);
  }
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

  function goToToday() {
    setPeriodOffset(0);
  }

  function clearFilters() {
    setStatusFilter("");
    setStaffFilter("");
    setLocationFilter("");
  }

  function stepPeriod(direction: 1 | -1) {
    const dayLike = view === "day" || view === "staff_columns" || view === "resources";
    setPeriodOffset((value) => value + direction * (dayLike ? 7 : 1));
  }

  function periodNavLabel(direction: "prev" | "next") {
    const unit = view === "month" ? "Mese" : "Settimana";
    if (direction === "prev") return `${unit} precedente`;
    return unit === "Settimana" ? "Settimana successiva" : "Mese successivo";
  }

  function goToDate(value: string) {
    if (!value) return;
    const target = startOfDay(new Date(`${value}T00:00:00`));
    const today = startOfDay(new Date());
    if (view === "month") {
      setPeriodOffset((target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth()));
    } else if (view === "day" || view === "staff_columns" || view === "resources") {
      setPeriodOffset(Math.round((target.getTime() - today.getTime()) / 86_400_000));
    } else {
      setPeriodOffset(Math.round((startOfWeek(target).getTime() - startOfWeek(today).getTime()) / (7 * 86_400_000)));
    }
  }

  function openDatePicker() {
    if (datePickerOpen) {
      setDatePickerOpen(false);
      return;
    }
    const rect = dateTriggerRef.current?.getBoundingClientRect();
    if (rect) {
      const panelWidth = 288;
      setDatePickerPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - panelWidth - 12)), top: rect.bottom + 8 });
    }
    setDatePickerMonth(range.from);
    setDatePickerOpen(true);
  }

  function pickDate(day: Date) {
    const year = day.getFullYear();
    const month = String(day.getMonth() + 1).padStart(2, "0");
    const date = String(day.getDate()).padStart(2, "0");
    goToDate(`${year}-${month}-${date}`);
    setDatePickerOpen(false);
  }

  function toggleFilters() {
    if (filtersOpen) {
      setFiltersOpen(false);
      return;
    }
    const rect = filtersButtonRef.current?.getBoundingClientRect();
    if (rect) setFiltersPosition({ right: window.innerWidth - rect.right, top: rect.bottom + 8 });
    setFiltersOpen(true);
  }

  function legendDotColor(initial: string) {
    if (initial === "C") return "#792f59";
    if (initial === "A") return APPOINTMENT_STATUS_PALETTE.pending.border;
    if (initial === "N") return APPOINTMENT_STATUS_PALETTE.no_show.border;
    return APPOINTMENT_STATUS_PALETTE.cancelled.border;
  }

  const timelineStartHour = timelineRange.startHour;
  const timelineEndHour = Math.max(timelineStartHour + 1, timelineRange.endHour);
  const hourHeight = 112;
  const timelineHours = Array.from({ length: timelineEndHour - timelineStartHour + 1 }, (_, index) => timelineStartHour + index);
  const timelineCompression = useMemo(() => {
    const dayKey = weekdayKeys[range.from.getDay()] ?? "mon";
    const visibleIds = new Set(visibleStaff.map(([id]) => id));
    const workingPeriods: TimelinePeriod[] = staffMembers
      .filter((member) => visibleIds.has(member.id))
      .flatMap((member) => member.working_hours?.[dayKey] ?? [])
      .map((period) => ({
        from: clockMinutes(period.from),
        to: clockMinutes(period.to),
      }));
    const occupiedPeriods: TimelinePeriod[] = [
      ...filteredItems.map((item) => {
        const start = new Date(item.starts_at);
        const end = new Date(item.ends_at);
        return {
          from: start.getHours() * 60 + start.getMinutes(),
          to: end.getHours() * 60 + end.getMinutes(),
        };
      }),
      ...availabilityBlocks
        .filter((item) => !staffFilter || item.staff_id === staffFilter)
        .map((item) => {
          const start = new Date(item.starts_at);
          const end = new Date(item.ends_at);
          return {
            from: start.getHours() * 60 + start.getMinutes(),
            to: end.getHours() * 60 + end.getMinutes(),
          };
        }),
    ];
    return buildTimelineCompression({
      compressedHeight: 74,
      hourHeight,
      occupiedPeriods,
      rangeEnd: timelineEndHour * 60,
      rangeStart: timelineStartHour * 60,
      workingPeriods,
    });
  }, [availabilityBlocks, filteredItems, range.from, staffFilter, staffMembers, timelineEndHour, timelineStartHour, visibleStaff]);
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
    return timelineMinutesPosition(
      start.getHours() * 60 + start.getMinutes(),
      end.getHours() * 60 + end.getMinutes(),
      66,
    );
  }

  function timelineMinutesPosition(fromMinutes: number, toMinutes: number, minimumHeight = 0) {
    return timelineCompression.intervalPosition(fromMinutes, toMinutes, minimumHeight);
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
    const rawMinutes = timelineCompression.minutesAtY(clientY - rect.top);
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
    const rawMinutes = timelineCompression.minutesAtY(relativeTop);
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
    setDeleteTarget(undefined);
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

  const activeFilterCount = [locationFilter, statusFilter, staffFilter].filter(Boolean).length;
  const weekdayHeaderLabels = WEEK_DAYS_IT.map((day) => day.shortLabel);
  const datePickerGridStart = startOfWeek(new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth(), 1));
  const datePickerDays = Array.from({ length: 42 }, (_, index) => addDays(datePickerGridStart, index));

  return (
    <main className="esse-workspace-page flex h-[calc(100dvh-4rem)] flex-col overflow-hidden">
      <DndContext
        onDragCancel={() => { suppressClickUntilRef.current = 0; }}
        onDragEnd={handleDragEnd}
        onDragStart={() => { suppressClickUntilRef.current = Number.POSITIVE_INFINITY; }}
        sensors={sensors}
      >
        {/* ── Barra strumenti integrata ── */}
        <div className="flex-none border-b border-stone-200 bg-white">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 lg:flex-nowrap">
            {/* Sede */}
            {locations.length > 1 && (
              <Select
                aria-label="Sede"
                className="h-10 min-w-0 max-w-[calc(50vw-1.5rem)] rounded-lg border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#792f59]/20 lg:h-9 lg:max-w-none"
                onChange={(event) => { setLocationFilter(event.target.value); setStaffFilter(""); }}
                value={locationFilter}
              >
                <option value="">Tutte le sedi</option>
                {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
              </Select>
            )}

            {/* Staff */}
            <Select
              aria-label="Staff"
              className="h-10 min-w-0 max-w-[calc(50vw-1.5rem)] rounded-lg border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#792f59]/20 lg:h-9 lg:max-w-none"
              onChange={(event) => setStaffFilter(event.target.value)}
              value={staffFilter}
            >
              <option value="">Tutto lo staff</option>
              {staffOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </Select>

            <div className="mx-1 hidden h-5 w-px bg-stone-200 lg:block" />

            {/* Navigazione settimana */}
            <div className="order-first flex w-full items-center justify-between lg:contents">
            <button
              aria-label={periodNavLabel("prev")}
              className="grid size-10 shrink-0 place-items-center rounded-lg text-stone-500 transition hover:bg-stone-100 lg:size-8"
              onClick={() => stepPeriod(-1)}
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <div className="grid grid-cols-7 gap-px">
              {navigatorDays.map((day) => {
                const active = sameDay(day, range.from) && (view === "day" || view === "staff_columns" || view === "resources");
                const count = itemsForDay(day).length;
                return (
                  <button
                    className={`flex min-h-11 flex-col items-center gap-0.5 rounded-lg px-1.5 py-1.5 text-center transition lg:min-h-0 lg:px-3 ${active ? "bg-[#5f2447] text-white" : "text-stone-600 hover:bg-stone-50"}`}
                    key={day.toISOString()}
                    onClick={() => selectNavigatorDay(day)}
                    type="button"
                  >
                    <span className={`text-[9px] font-black uppercase tracking-[.08em] ${active ? "text-white/65" : "text-stone-400"}`}>{day.toLocaleDateString("it-IT", { weekday: "short" })}</span>
                    <strong className="text-sm tabular-nums">{day.getDate()}</strong>
                    <span className={`block h-1 w-1 rounded-full ${count ? active ? "bg-white" : "bg-[#b85888]" : "bg-transparent"}`} />
                  </button>
                );
              })}
            </div>
            <button
              aria-label={periodNavLabel("next")}
              className="grid size-10 shrink-0 place-items-center rounded-lg text-stone-500 transition hover:bg-stone-100 lg:size-8"
              onClick={() => stepPeriod(1)}
              type="button"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
            </div>

            <div className="mx-1 hidden h-5 w-px bg-stone-200 lg:block" />

            {/* Oggi */}
            {periodOffset !== 0 && (
              <button
                className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-dashed border-[#b85888] bg-[#faf3f7] px-3 text-[10px] font-black text-[#792f59]"
                onClick={goToToday}
                type="button"
              >
                <CalendarCheck aria-hidden="true" className="size-3.5" />
                Oggi
              </button>
            )}

            {/* Date picker */}
            <button
              aria-expanded={datePickerOpen}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition ${datePickerOpen ? "border-[#b85888] bg-[#faf3f7] text-[#792f59]" : "border-stone-200 text-stone-600 hover:bg-stone-50"}`}
              onClick={openDatePicker}
              ref={dateTriggerRef}
              type="button"
            >
              <CalendarSearch aria-hidden="true" className="size-3.5" />
              Vai a
            </button>

            <div className="flex-1" />

            {/* Ricerca */}
            <div className="relative hidden sm:block">
              <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" />
              <input
                aria-label="Cerca appuntamenti"
                className="h-9 w-44 rounded-lg border border-stone-200 bg-stone-50 pl-8 pr-7 text-xs font-semibold placeholder:text-stone-400 focus:border-[#792f59] focus:outline-none focus:ring-2 focus:ring-[#792f59]/15"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cerca..."
                value={query}
              />
              {query && (
                <button
                  aria-label="Cancella ricerca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                  onClick={() => setQuery("")}
                  type="button"
                >
                  ×
                </button>
              )}
            </div>

            {/* Filtri */}
            <div className="relative">
              <button
                aria-expanded={filtersOpen}
                className={`grid size-9 place-items-center rounded-lg border transition ${filtersOpen || activeFilterCount ? "border-[#b85888] bg-[#faf3f7] text-[#792f59]" : "border-stone-200 text-stone-500 hover:bg-stone-50"}`}
                onClick={toggleFilters}
                ref={filtersButtonRef}
                type="button"
              >
                <SlidersHorizontal aria-hidden="true" className="size-4" />
              </button>
              {activeFilterCount > 0 && (
                <span className="pointer-events-none absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-[#792f59] text-[9px] font-black text-white">
                  {activeFilterCount}
                </span>
              )}
            </div>

            {/* Vista */}
            <div className="flex overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
              {views.filter((item) => (!isMobile || item.key === "day" || item.key === "agenda") && (item.key !== "resources" || rules.enableResourceView || resources.length > 0)).map((item) => {
                const ViewIcon = viewIcons[item.key];
                return (
                  <button
                    className={`inline-flex h-9 items-center gap-1.5 px-3 text-xs font-bold transition ${view === item.key ? "bg-white text-[#792f59] shadow-sm" : "text-stone-500 hover:text-stone-900"}`}
                    key={item.key}
                    onClick={() => { setView(item.key); setPeriodOffset(0); }}
                    type="button"
                  >
                    <ViewIcon aria-hidden="true" className="size-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Nuovo */}
            {canCreate && (
              <Link
                className="inline-flex h-9 items-center rounded-lg bg-stone-950 px-4 text-xs font-bold text-white transition hover:bg-stone-800"
                href="/calendar/appointments/new"
              >
                + Nuovo
              </Link>
            )}
          </div>
        </div>

        {/* ── Pannello filtri (portal) ── */}
        {filtersOpen && filtersPosition && portalNode && createPortal(
          <div className="fixed z-30 w-72 rounded-2xl border border-stone-200 bg-white p-4 shadow-lg" ref={filtersPanelRef} style={{ right: filtersPosition.right, top: filtersPosition.top }}>
            {locations.length > 1 && (
              <div className="mb-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.08em] text-stone-500"><MapPin aria-hidden="true" className="size-3" />Sede</p>
                <div className="flex flex-wrap gap-1.5">
                  <button className={`rounded-full border px-3 py-1 text-xs font-bold ${!locationFilter ? "border-[#792f59] bg-[#792f59] text-white" : "border-stone-200 text-stone-600"}`} onClick={() => { setLocationFilter(""); setStaffFilter(""); }} type="button">Tutte</button>
                  {locations.map((location) => <button className={`rounded-full border px-3 py-1 text-xs font-bold ${locationFilter === location.id ? "border-[#792f59] bg-[#792f59] text-white" : "border-stone-200 text-stone-600"}`} key={location.id} onClick={() => { setLocationFilter(location.id); setStaffFilter(""); }} type="button">{location.name}</button>)}
                </div>
              </div>
            )}
            <div className="mb-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.08em] text-stone-500"><UsersRound aria-hidden="true" className="size-3" />Staff</p>
              <Select aria-label="Filtra per staff" className="min-h-10 w-full rounded-lg border border-stone-200 bg-[#fbfaf8] px-3 text-sm font-semibold" onChange={(event) => setStaffFilter(event.target.value)} value={staffFilter}>
                <option value="">Tutto lo staff</option>
                {staffOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </Select>
            </div>
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.08em] text-stone-500"><Tag aria-hidden="true" className="size-3" />Stato</p>
              <Select aria-label="Filtra per stato" className="min-h-10 w-full rounded-lg border border-stone-200 bg-[#fbfaf8] px-3 text-sm font-semibold" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                <option value="">Tutti gli stati</option>
                {statuses.map((status) => <option key={status} value={status}>{appointmentStatusLabel(status)}</option>)}
              </Select>
            </div>
            <div aria-label="Legenda stati appuntamento" className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-stone-100 pt-3">
              {appointmentStatusLegend.map(([initial, label]) => (
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-stone-500" key={initial}>
                  <span className="size-2 rounded-sm" style={{ background: legendDotColor(initial) }} />
                  {label}
                </span>
              ))}
            </div>
            {activeFilterCount > 0 && <button className="mt-3 w-full border-t border-stone-100 pt-3 text-center text-xs font-black text-[#792f59]" onClick={clearFilters} type="button">Azzera filtri</button>}
          </div>,
          portalNode,
        )}

        {/* ── Date picker (portal) ── */}
        {datePickerOpen && datePickerPosition && portalNode && createPortal(
          <div className="fixed z-30 w-72 rounded-2xl border border-stone-200 bg-white p-4 shadow-lg" ref={datePickerPanelRef} style={{ left: datePickerPosition.left, top: datePickerPosition.top }}>
            <div className="mb-3 flex items-center justify-between">
              <button aria-label="Mese precedente" className="grid size-7 place-items-center rounded-lg text-stone-500 transition hover:bg-stone-100" onClick={() => setDatePickerMonth((current) => addMonths(current, -1))} type="button"><ChevronLeft aria-hidden="true" className="size-4" /></button>
              <strong className="text-xs font-black capitalize text-stone-950">{datePickerMonth.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}</strong>
              <button aria-label="Mese successivo" className="grid size-7 place-items-center rounded-lg text-stone-500 transition hover:bg-stone-100" onClick={() => setDatePickerMonth((current) => addMonths(current, 1))} type="button"><ChevronRight aria-hidden="true" className="size-4" /></button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weekdayHeaderLabels.map((label) => <span className="pb-1 text-center text-[9px] font-black uppercase tracking-[.08em] text-stone-400" key={label}>{label}</span>)}
              {datePickerDays.map((day) => {
                const inMonth = day.getMonth() === datePickerMonth.getMonth();
                const isToday = sameDay(day, new Date());
                const isSelected = sameDay(day, range.from);
                return (
                  <button
                    className={`rounded-lg py-1.5 text-xs font-bold tabular-nums transition ${isSelected ? "bg-[#5f2447] text-white" : isToday ? "bg-[#faf3f7] text-[#792f59]" : inMonth ? "text-stone-700 hover:bg-stone-100" : "text-stone-300 hover:bg-stone-50"}`}
                    key={day.toISOString()}
                    onClick={() => pickDate(day)}
                    type="button"
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </div>,
          portalNode,
        )}

        {/* ── Contenuto calendario ── */}
        <div className="min-h-0 flex-1 overflow-auto">
          {error && <InlineError className="m-3">{error}</InlineError>}

          {view === "agenda" ? (
            <div className="grid gap-3 p-4">
              {filteredItems.length === 0 && availabilityBlocks.length === 0 && salonClosures.length === 0 && <SectionCard>Nessun appuntamento con questi filtri.</SectionCard>}
              {days.flatMap((day) => closuresForDay(day).map((closure) => closureCard(closure)))}
              {filteredItems.map((item) => appointmentCard(item))}
              {availabilityBlocks.filter((block) => !staffFilter || block.staff_id === staffFilter).map((block) => blockCard(block))}
            </div>
          ) : view === "resources" ? (
            <div className="h-full overflow-x-auto bg-white">
              <div className="min-h-full min-w-[980px]">
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
                  <div className="relative border-r border-stone-200 bg-[#faf9f7]" style={{ height: timelineHeight }}>
                    {timelineCompressedGapMarkers.map((gap) => (
                      <div className="absolute left-0 right-0 z-10 flex flex-col items-end justify-center pr-5 text-stone-400" key={`${gap.from}-${gap.to}`} style={{ height: gap.compressedHeight, top: gap.top }}>
                        <span className="leading-3">·</span>
                        <span className="leading-3">·</span>
                        <span className="leading-3">·</span>
                      </div>
                    ))}
                    {visibleTimelineHours.map((hour, index) => (
                      <div className="absolute left-0 right-0 z-10 pr-3 text-right text-xs font-black text-stone-500" key={hour} style={{ top: index === 0 ? 8 : index === visibleTimelineHours.length - 1 ? timelineHeight - 22 : timelineHourTop(hour) - 8 }}>
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
                      <DroppableTimeline id={`resource:${resource.id}`} key={resource.id} onContextMenu={(event) => openSlotContext(event, { resourceId: resource.id })} style={{ height: timelineHeight }}>
                        {visibleTimelineHours.slice(0, -1).map((hour) => <div className="absolute left-0 right-0 border-t border-stone-100" key={hour} style={{ top: timelineHourTop(hour) }} />)}
                        {timelineHours.slice(0, -1).flatMap((hour) => [15, 30, 45].map((minute) => {
                          const minutes = hour * 60 + minute;
                          if (timelineCompression.gaps.some((gap) => gap.from < minutes && minutes < gap.to)) return null;
                          return <div className="absolute left-0 right-0 border-t border-dashed border-stone-100" key={`${hour}-${minute}`} style={{ top: timelineCompression.timelineY(minutes) }} />;
                        }))}
                        {resourceAppointments.map((item) => timelineAppointmentCard(item, layouts.get(item.id) ?? { column: 0, columnCount: 1 }))}
                      </DroppableTimeline>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : view === "staff_columns" || view === "day" ? (
            <div className="h-full overflow-x-auto bg-white">
              <div className="min-h-full min-w-0 lg:min-w-[980px]">
                <div className="sticky top-0 z-20 grid border-b-2 border-stone-200 bg-white shadow-sm" style={{ gridTemplateColumns: `${isMobile ? 58 : 76}px repeat(${Math.max(renderedStaff.length, 1)}, minmax(${isMobile ? 0 : 220}px, 1fr))` }}>
                  <div className="flex items-end justify-center border-r border-stone-200 pb-3 pt-4 text-[10px] font-black uppercase tracking-[.16em] text-stone-400">Ora</div>
                  {(renderedStaff.length ? renderedStaff : [["", "Nessuno staff"]]).map(([staffId, staffName]) => {
                    const member = staffMembers.find((item) => item.id === staffId);
                    const displayName = staffName ?? "Nessuno staff";
                    return (
                      <div className="relative flex flex-col items-center gap-2 border-r border-stone-100 px-14 pb-3 pt-4 last:border-r-0 lg:px-4" key={staffId}>
                        <button aria-label="Staff precedente" className="absolute left-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm disabled:opacity-30 lg:hidden" disabled={staffOptions.length < 2} onClick={() => moveMobileStaff(-1)} type="button"><ChevronLeft aria-hidden="true" className="size-5" /></button>
                        <span className="grid h-12 w-12 place-items-center rounded-full text-base font-black text-white shadow-md ring-2 ring-white" style={{ background: member?.color || "#792f59" }}>{displayName.slice(0, 1).toUpperCase()}</span>
                        <div className="min-w-0 text-center">
                          <p className="text-sm font-black text-stone-950">{displayName}</p>
                          <p className="text-[11px] font-semibold text-stone-400">{filteredItems.filter((item) => item.staff_id === staffId).length} appuntamenti</p>
                        </div>
                        <button aria-label="Staff successivo" className="absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm disabled:opacity-30 lg:hidden" disabled={staffOptions.length < 2} onClick={() => moveMobileStaff(1)} type="button"><ChevronRight aria-hidden="true" className="size-5" /></button>
                      </div>
                    );
                  })}
                </div>
                {closuresForDay(range.from).length > 0 && (
                  <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-800">Chiusura salone · {closuresForDay(range.from).map((item) => item.reason || "Giorno non prenotabile").join(", ")}</div>
                )}
                <div className="grid" style={{ gridTemplateColumns: `${isMobile ? 58 : 76}px repeat(${Math.max(renderedStaff.length, 1)}, minmax(${isMobile ? 0 : 220}px, 1fr))` }}>
                  <div className="relative border-r border-stone-200 bg-[#faf9f7]" style={{ height: timelineHeight }}>
                    {timelineCompressedGapMarkers.map((gap) => (
                      <div className="absolute left-0 right-0 z-10 flex flex-col items-end justify-center pr-5 text-stone-400" key={`${gap.from}-${gap.to}`} style={{ height: gap.compressedHeight, top: gap.top }}>
                        <span className="leading-3">·</span>
                        <span className="leading-3">·</span>
                        <span className="leading-3">·</span>
                      </div>
                    ))}
                    {visibleTimelineHours.map((hour, index) => (
                      <div
                        className="absolute left-0 right-0 z-10 pr-3 text-right text-xs font-black text-stone-500"
                        key={hour}
                        style={{
                          top: index === 0
                            ? 8
                            : index === visibleTimelineHours.length - 1
                              ? timelineHeight - 22
                              : timelineHourTop(hour) - 8,
                        }}
                      >
                        {String(hour).padStart(2, "0")}:00
                      </div>
                    ))}
                  </div>
                  {(renderedStaff.length ? renderedStaff : [["", "Nessuno staff"]]).map(([staffId]) => {
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
                      <DroppableTimeline id={`staff:${staffId}`} key={staffId} onContextMenu={(event) => openSlotContext(event, { staffId })} style={{ height: timelineHeight }}>
                        {visibleTimelineHours.slice(0, -1).map((hour) => <div className="absolute left-0 right-0 border-t border-stone-100" key={hour} style={{ top: timelineHourTop(hour) }} />)}
                        {timelineHours.slice(0, -1).flatMap((hour) => [15, 30, 45].map((minute) => {
                          const minutes = hour * 60 + minute;
                          if (timelineCompression.gaps.some((gap) => gap.from < minutes && minutes < gap.to)) return null;
                          return <div className="absolute left-0 right-0 border-t border-dashed border-stone-100" key={`${hour}-${minute}`} style={{ top: timelineCompression.timelineY(minutes) }} />;
                        }))}
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
            <div className="overflow-x-auto p-3">
              <div className="grid min-w-[920px] grid-cols-7 gap-3">
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
        </div>
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
                  min={localDateValue(new Date().toISOString())}
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
                  min={moveDraft.date === localDateValue(new Date().toISOString()) ? localTimeValue(new Date().toISOString()) : undefined}
                  onChange={(event) => setMoveDraft((current) => current ? { ...current, time: event.target.value } : current)}
                  step={rules.minSlotMinutes * 60}
                  type="time"
                  value={moveDraft.time}
                />
              </label>
              <label className="text-sm font-bold text-stone-700">
                Collaboratore
                <Select
                  aria-label="Nuovo collaboratore"
                  className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 font-semibold text-stone-950"
                  onChange={(event) => setMoveDraft((current) => current ? { ...current, staffId: event.target.value } : current)}
                  value={moveDraft.staffId}
                >
                  {staffOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </Select>
              </label>
              <label className="text-sm font-bold text-stone-700">
                Cabina
                <Select
                  aria-label="Nuova cabina"
                  className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 font-semibold text-stone-950"
                  onChange={(event) => setMoveDraft((current) => current ? { ...current, resourceId: event.target.value } : current)}
                  value={moveDraft.resourceId}
                >
                  <option value="">Assegnazione automatica</option>
                  {resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}
                </Select>
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
            <div className="fixed z-50 min-w-56 overflow-hidden rounded-xl border border-stone-200 bg-white p-1.5 text-sm shadow-2xl" onContextMenu={(event) => event.preventDefault()} onMouseLeave={() => setContextMenu(undefined)} style={clampedContextMenuPosition(contextMenu.x, contextMenu.y)}>
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
                  {manualContextStatusActions(contextMenu.appointment.status).map((status) => <button className="rounded-lg bg-stone-50 py-2 font-black hover:bg-rose-50" key={status} onClick={() => closeContextMenuAnd(() => updateAppointment(contextMenu.appointment!.id, { status }))} title={appointmentStatusLabel(status)} type="button">{appointmentStatusInitial[status]}</button>)}
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
      {portalNode && createPortal(<AnimatePresence>
        {selectedAppointmentId && <motion.div animate={{ opacity: 1 }} className="fixed inset-0 z-[45] bg-stone-950/35 backdrop-blur-[2px]" exit={{ opacity: 0 }} initial={{ opacity: 0 }} onMouseDown={(event) => { if (event.currentTarget === event.target) rejectBackdropClose(); }} transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: "easeOut" }}>
          <motion.aside
            animate={{ opacity: 1, x: 0 }}
            aria-label="Gestione appuntamento"
            aria-modal="true"
            className={`appointment-curtain absolute inset-y-0 right-0 flex w-full max-w-[900px] overflow-hidden border-l border-stone-200 bg-[#f6f4f2] shadow-[-20px_0_64px_rgb(32_24_32_/_0.24)] outline-none ${curtainShake ? "appointment-curtain-shake" : ""}`}
            exit={reduceMotion ? { opacity: 0, x: 0 } : { opacity: 1, x: "100%" }}
            initial={reduceMotion ? { opacity: 0, x: 0 } : { opacity: 1, x: "100%" }}
            onAnimationEnd={() => setCurtainShake(false)}
            ref={appointmentDialogRef}
            role="dialog"
            tabIndex={-1}
            transition={{ duration: reduceMotion ? 0.12 : 0.24, ease: [0.22, 0.9, 0.28, 1] }}
          >
            <AppointmentDetailPanel appointmentId={selectedAppointmentId} onChanged={() => setRefreshToken((value) => value + 1)} onClose={closeAppointment} />
          </motion.aside>
        </motion.div>}
      </AnimatePresence>, portalNode)}
    </main>
  );
}
