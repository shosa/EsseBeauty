import type { OnboardingIssue, OnboardingStepKey, OnboardingStepStatus } from "./types.js";

interface LocationSnapshot { active: boolean; id: string; }
interface ResourceSnapshot { active: boolean; id: string; locationId: string | null; }
interface ServiceSnapshot { active: boolean; id: string; onlineBookingEnabled: boolean; }
interface StaffSnapshot { active: boolean; id: string; locationId: string | null; }
interface ServiceStaffSnapshot { serviceId: string; staffId: string; }
interface ServiceResourceSnapshot { resourceId: string; serviceId: string; }

export interface OnboardingReadinessInput {
  enabledModules: ReadonlySet<string>;
  identityComplete: boolean;
  locations: LocationSnapshot[];
  resources: ResourceSnapshot[];
  services: ServiceSnapshot[];
  staff: StaffSnapshot[];
  serviceStaff: ServiceStaffSnapshot[];
  serviceResources: ServiceResourceSnapshot[];
}

export interface OnboardingReadiness {
  issues: OnboardingIssue[];
  ready: boolean;
  statuses: Record<OnboardingStepKey, OnboardingStepStatus>;
}

export function evaluateOnboardingReadiness(input: OnboardingReadinessInput): OnboardingReadiness {
  const issues: OnboardingIssue[] = [];
  const activeLocations = new Set(input.locations.filter((item) => item.active).map((item) => item.id));
  const activeResources = new Map(input.resources.filter((item) => item.active).map((item) => [item.id, item]));
  const activeServices = input.services.filter((item) => item.active);
  const activeStaff = new Map(input.staff.filter((item) => item.active).map((item) => [item.id, item]));

  if (!input.identityComplete) issue(issues, "IDENTITY_INCOMPLETE", "Completa il nome del salone.", "identity");
  if (activeLocations.size === 0) issue(issues, "NO_ACTIVE_LOCATION", "Configura almeno una sede attiva.", "locations");
  if (activeServices.length === 0) issue(issues, "NO_ACTIVE_SERVICE", "Configura almeno un servizio attivo.", "services");
  if (activeStaff.size === 0) issue(issues, "NO_ACTIVE_STAFF", "Configura almeno un membro dello staff attivo.", "staff");

  for (const member of activeStaff.values()) {
    if (!member.locationId || !activeLocations.has(member.locationId)) {
      issue(issues, "STAFF_LOCATION_INVALID", "Assegna il collaboratore a una sede attiva.", "staff", member.id);
    }
  }

  for (const service of activeServices.filter((item) => item.onlineBookingEnabled)) {
    const covered = input.serviceStaff.some((row) => row.serviceId === service.id && activeStaff.has(row.staffId));
    if (!covered) issue(issues, "SERVICE_WITHOUT_STAFF", "Assegna almeno un operatore attivo al servizio.", "assignments", service.id);
  }

  for (const assignment of input.serviceResources) {
    const resource = activeResources.get(assignment.resourceId);
    if (!resource) {
      issue(issues, "RESOURCE_INACTIVE", "Una risorsa assegnata non è attiva.", "assignments", assignment.resourceId);
    } else if (!resource.locationId || !activeLocations.has(resource.locationId)) {
      issue(issues, "RESOURCE_LOCATION_INACTIVE", "La risorsa assegnata deve appartenere a una sede attiva.", "assignments", resource.id);
    }
  }

  const statuses = Object.fromEntries(
    (["identity", "locations", "resources", "services", "staff", "assignments", "review"] as OnboardingStepKey[])
      .map((key) => [key, statusFor(key, input, issues)]),
  ) as Record<OnboardingStepKey, OnboardingStepStatus>;
  return { issues, ready: issues.length === 0, statuses };
}

function issue(issues: OnboardingIssue[], code: string, message: string, step_key: OnboardingStepKey, entity_id?: string) {
  issues.push({ code, message, step_key, ...(entity_id ? { entity_id } : {}) });
}

function statusFor(key: OnboardingStepKey, input: OnboardingReadinessInput, issues: OnboardingIssue[]): OnboardingStepStatus {
  if (issues.some((item) => item.step_key === key)) return "needs_attention";
  if (key === "identity") return input.identityComplete ? "complete" : "not_started";
  if (key === "locations") return input.locations.length ? "complete" : "not_started";
  if (key === "resources") return input.resources.length ? "complete" : "not_started";
  if (key === "services") return input.services.length ? "complete" : "not_started";
  if (key === "staff") return input.staff.length ? "complete" : "not_started";
  if (key === "assignments") return input.serviceStaff.length || input.serviceResources.length ? "complete" : "not_started";
  return issues.length ? "needs_attention" : "complete";
}
