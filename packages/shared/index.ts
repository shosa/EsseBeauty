export const APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "cancelled",
  "no_show",
  "completed",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

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
