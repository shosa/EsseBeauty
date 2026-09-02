import type { WorkingHours } from "@esse-beauty/shared";

export type StepKey = "identity" | "locations" | "resources" | "services" | "staff" | "assignments" | "review";
export type StepStatus = "not_started" | "in_progress" | "complete" | "needs_attention";

export interface OnboardingIssue { code: string; entity_id?: string; message: string; step_key: StepKey; }
export interface OnboardingStep { description?: string; issues?: OnboardingIssue[]; key: StepKey; label?: string; mode?: "single" | "multiple"; required: boolean; status: StepStatus; }
export interface LocationDraft { active: boolean; address: string; email: string; id?: string; name: string; phone: string; timezone: string; }
export interface ResourceDraft { active: boolean; capacity: number; id?: string; location_id: string; name: string; type: string; }
export interface CategoryDraft { icon: string; id: string; name: string; }
export interface ServiceDraft { active: boolean; buffer_after_minutes: number; buffer_before_minutes: number; category: string; category_id: string; duration_minutes: number; id?: string; name: string; online_booking_enabled: boolean; price_cents: number; }
export interface StaffDraft { active: boolean; color: string; display_name: string; id?: string; job_title: string; linked_to_owner?: boolean; location_id: string; working_hours: WorkingHours; }
export interface PairDraft { service_id: string; staff_id: string; }
export interface ResourcePairDraft { resource_id: string; service_id: string; }

export interface OnboardingPayload {
  locations: LocationDraft[];
  modules: string[];
  readiness: { issues: OnboardingIssue[]; ready: boolean };
  resources: ResourceDraft[];
  salon: { address: string; email: string; id: string; name: string; opening_hours: WorkingHours; phone: string };
  service_categories: CategoryDraft[];
  service_resources: ResourcePairDraft[];
  service_staff: PairDraft[];
  services: ServiceDraft[];
  staff: StaffDraft[];
  steps: OnboardingStep[];
}

export function firstActionableStep(steps: Pick<OnboardingStep, "key" | "required" | "status">[]): StepKey {
  return steps.find((step) => step.required && step.key !== "review" && step.status !== "complete")?.key ?? "review";
}
