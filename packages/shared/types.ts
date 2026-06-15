export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type WorkingHours = Record<
  Weekday,
  Array<{ from: string; to: string }>
>;

export interface TimeRange {
  startsAt: string | Date;
  endsAt: string | Date;
}

export interface TimeSlot {
  starts_at: string;
  ends_at: string;
  available: boolean;
}

export interface ComputeAvailableSlotsInput {
  date: string;
  timezone: string;
  workingHours: WorkingHours;
  durationMinutes: number;
  appointments?: TimeRange[];
  blocks?: TimeRange[];
  intervalMinutes?: number;
}

export interface AppointmentWithRelations {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  customer_name: string;
  service_name: string;
  staff_name: string;
  staff_id: string;
  color: string;
}

export interface PublicSalonProfile {
  salon: { id: string; name: string; slug: string; timezone: string; locale: string };
  services: Array<{ id: string; name: string; category: string; durationMinutes: number; priceCents: number }>;
  staff: Array<{ id: string; displayName: string; color: string; workingHours: WorkingHours }>;
  opening_hours: WorkingHours;
}

export interface PublicBookingRequest {
  service_id: string;
  staff_id?: string;
  starts_at: string;
  customer: { full_name: string; email?: string; phone?: string };
}
