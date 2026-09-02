import { MODULE_KEYS } from "@esse-beauty/feature-flags";

import type { OnboardingStep, OnboardingStepKey, OnboardingStepStatus } from "./types.js";

type StepDraft = Omit<OnboardingStep, "issues" | "status">;

const baseSteps: StepDraft[] = [
  { key: "identity", label: "Salone", description: "Identità e contatti del salone.", required: true },
  { key: "locations", label: "Sedi e orari", description: "Sede operativa e orari di apertura.", required: true },
  { key: "services", label: "Servizi", description: "Categorie e catalogo dei trattamenti.", required: true },
  { key: "staff", label: "Staff", description: "Team, ruoli, sede e disponibilità.", required: true },
  { key: "assignments", label: "Competenze", description: "Assegna servizi e risorse al team.", required: true },
  { key: "review", label: "Verifica", description: "Controlla che il salone sia pronto a lavorare.", required: true },
];

const resourcesStep: StepDraft = {
  description: "Configura cabine e risorse per ogni sede.",
  key: "resources",
  label: "Cabine",
  module_key: MODULE_KEYS.MULTI_LOCATION,
  required: false,
};

export function buildOnboardingSteps(
  enabledModules: ReadonlySet<string>,
  statuses: Readonly<Partial<Record<OnboardingStepKey, OnboardingStepStatus>>>,
): OnboardingStep[] {
  const drafts = baseSteps.map((step) => ({ ...step }));
  const locations = drafts.find((step) => step.key === "locations");
  if (locations) locations.mode = enabledModules.has(MODULE_KEYS.MULTI_LOCATION) ? "multiple" : "single";
  if (enabledModules.has(MODULE_KEYS.MULTI_LOCATION)) drafts.splice(2, 0, resourcesStep);
  return drafts.map((step) => ({ ...step, issues: [], status: statuses[step.key] ?? "not_started" }));
}
