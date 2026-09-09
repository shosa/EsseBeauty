export interface Appointment {
  customer_name: string;
  customer_notes?: string | null;
  customer_phone?: string | null;
  ends_at: string;
  id: string;
  notes?: string | null;
  service_name: string;
  service_price_cents?: number | null;
  starts_at: string;
  status: string;
}

export interface AvailabilityRequest {
  ends_at: string;
  id: string;
  reason?: string | null;
  review_note?: string | null;
  starts_at: string;
  status: string;
}

export interface CalendarBlock {
  ends_at: string;
  id: string;
  reason?: string | null;
  starts_at: string;
}

export interface Report {
  appointment_count: number;
  completed_count: number;
  no_show_count: number;
  unique_customers: number;
}
