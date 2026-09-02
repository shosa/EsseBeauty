export type OnboardingStepKey =
  | "identity"
  | "locations"
  | "resources"
  | "services"
  | "staff"
  | "assignments"
  | "review";

export type OnboardingStepStatus = "not_started" | "in_progress" | "complete" | "needs_attention";

export interface OnboardingIssue {
  code: string;
  entity_id?: string;
  message: string;
  step_key: OnboardingStepKey;
}

export interface OnboardingStep {
  description: string;
  issues: OnboardingIssue[];
  key: OnboardingStepKey;
  label: string;
  mode?: "single" | "multiple";
  module_key?: string;
  required: boolean;
  status: OnboardingStepStatus;
}
