export const APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "cancelled",
  "no_show",
  "completed",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  cancelled: "Annullato",
  completed: "Completo",
  confirmed: "Confermato",
  no_show: "No-show",
  pending: "In attesa",
};

export const APPOINTMENT_STATUS_PALETTE: Record<Exclude<AppointmentStatus, "confirmed">, {
  background: string;
  border: string;
  text: string;
}> = {
  cancelled: { background: "#fee2e2", border: "#fca5a5", text: "#7f1d1d" },
  completed: { background: "#e7e5e4", border: "#a8a29e", text: "#292524" },
  no_show: { background: "#ffedd5", border: "#fdba74", text: "#7c2d12" },
  pending: { background: "#fef3c7", border: "#fcd34d", text: "#78350f" },
};

export function appointmentStatusLabel(status: string): string {
  return APPOINTMENT_STATUS_LABELS[status as AppointmentStatus] ?? status;
}

const APPOINTMENT_STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  cancelled: ["pending", "confirmed"],
  completed: [],
  confirmed: ["no_show", "cancelled"],
  no_show: ["pending", "confirmed"],
  pending: ["confirmed", "cancelled"],
};

export function nextAppointmentStatuses(status: string): AppointmentStatus[] {
  return APPOINTMENT_STATUS_TRANSITIONS[status as AppointmentStatus] ?? [];
}

export function canTransitionAppointmentStatus(from: string, to: string): boolean {
  return nextAppointmentStatuses(from).includes(to as AppointmentStatus);
}

export function isAppointmentDragDisabled(status?: string): boolean {
  return status === "completed" || status === "no_show" || status === "cancelled";
}

export const WEEK_DAYS_IT = [
  { key: "mon", label: "Lunedi", shortLabel: "LUN" },
  { key: "tue", label: "Martedi", shortLabel: "MAR" },
  { key: "wed", label: "Mercoledi", shortLabel: "MER" },
  { key: "thu", label: "Giovedi", shortLabel: "GIO" },
  { key: "fri", label: "Venerdi", shortLabel: "VEN" },
  { key: "sat", label: "Sabato", shortLabel: "SAB" },
  { key: "sun", label: "Domenica", shortLabel: "DOM" },
] as const;

export type WeekdayIt = (typeof WEEK_DAYS_IT)[number];

export function formatWeekdayIt(key: WeekdayIt["key"]): string {
  return WEEK_DAYS_IT.find((day) => day.key === key)?.shortLabel ?? key.toUpperCase();
}

export function formatPrice(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    currency: "EUR",
    style: "currency",
  }).format(cents / 100);
}

export {
  ALL_PERMISSIONS,
  clearPermissionCache,
  DEFAULT_PERMISSIONS,
  hasPermission,
  invalidatePermissionCache,
  isPermissionKey,
  PERMISSION_KEYS,
  resolvePermissions,
  USER_ROLES,
} from "./permissions.js";
export type { PermissionKey, UserRole } from "./permissions.js";
export { computeAvailableSlots } from "./utils/slots.js";
export type {
  ComputeAvailableSlotsInput,
  AppointmentWithRelations,
  PublicBookingRequest,
  PublicSalonProfile,
  TimeRange,
  TimeSlot,
  Weekday,
  WorkingHours,
} from "./types.js";
