export const APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "cancelled",
  "no_show",
  "completed",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

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
