import type { ModuleKey } from "@esse-beauty/feature-flags";

export type View = "overview" | "tenants" | "plans" | "modules" | "templates" | "audit";
export type TenantTab = "profile" | "owner" | "modules" | "danger";
export type TenantStatus = "active" | "suspended" | "trial" | "churn_risk";

export interface PlatformSession { admin: { email: string; full_name: string; id: string } }
export interface PlatformSalon {
  active: boolean;
  created_at: string;
  id: string;
  locale: string;
  modules_enabled: number;
  name: string;
  onboarding_completed: boolean;
  onboarding_step: number;
  plan_id: string | null;
  platform_status: TenantStatus;
  slug: string;
  timezone: string;
  trial_ends_at: string | null;
  updated_at: string;
}
export interface PlatformOverview {
  appointments: number;
  campaigns: number;
  module_usage: Array<{ enabled: number; module_key: string }>;
  salons: { active: number; churnRisk: number; suspended: number; total: number; trial: number };
  sessions: number;
}
export interface PlatformPlan {
  active: boolean;
  code: string;
  description: string | null;
  id: string;
  includedModules: string[];
  limits: Record<string, unknown>;
  name: string;
}
export interface PlatformModule {
  defaultEnabled: boolean;
  description: string | null;
  globallyEnabled: boolean;
  moduleKey: ModuleKey;
  name: string;
}
export interface PlatformAuditItem {
  action: string;
  createdAt: string;
  id: string;
  summary: string;
  targetType: string;
}
export interface PlatformTemplate {
  active: boolean;
  body: string;
  channel: "email" | "in_app" | "push" | "whatsapp";
  id: string;
  key: string;
  subject: string | null;
}
export interface SalonOwner {
  active: boolean;
  created_at: string;
  email: string;
  full_name: string;
  id: string;
  last_login: string | null;
  must_change_password: boolean;
  role: "owner";
}
export type ModuleState = Record<ModuleKey, boolean>;
