export const MODULE_KEYS = {
  REMINDERS: "reminders",
  REVIEWS: "reviews",
  WAITLIST: "waitlist",
  LOYALTY: "loyalty",
  MARKETING: "marketing",
  INVENTORY: "inventory",
  STAFF_PERF: "staff_performance",
  DOCUMENTS: "documents",
  PACKAGES: "packages",
  MULTI_LOCATION: "multi_location",
  AUDIT_COMPLIANCE: "audit_compliance",
} as const;

export type ModuleKey = (typeof MODULE_KEYS)[keyof typeof MODULE_KEYS];

const moduleKeySet = new Set<string>(Object.values(MODULE_KEYS));

export function isModuleKey(value: string): value is ModuleKey {
  return moduleKeySet.has(value);
}
