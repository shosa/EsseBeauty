import type { ModuleKey } from "@esse-beauty/feature-flags";

export type View = "overview" | "tenants" | "plans" | "modules" | "templates" | "settings" | "services" | "audit";
export type TenantTab = "profile" | "owner" | "plan" | "modules" | "danger";
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
export interface PlanAlignment {
  enabled_modules: ModuleKey[];
  extra_modules: ModuleKey[];
  missing_modules: ModuleKey[];
  module_rows: Array<{ enabled: boolean; module_key: ModuleKey; updated_at: string }>;
  plan: { code: string; included_modules: ModuleKey[]; limits: Record<string, unknown>; name: string } | null;
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
export interface PlatformEmailSettings {
  defaultFromEmail: string;
  defaultFromName: string;
  enabled: boolean;
  host: string;
  id: string | null;
  lastHealthCheckAt: string | null;
  passwordPresent: boolean;
  port: number;
  provider: "smtp";
  secure: boolean;
  username: string | null;
}

export interface PlatformEmailTestResult {
  checkedAt: string;
  message: string;
  ok: boolean;
}
export type ServiceHealthStatus = "operational" | "degraded" | "offline";
export interface PlatformServiceStatus {
  checkedAt: string;
  error?: string;
  healthUrl: string;
  key: string;
  latencyMs: number;
  name: string;
  owner: string;
  status: ServiceHealthStatus;
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
