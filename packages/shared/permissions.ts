import { and, eq } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import { userPermissions, users } from "@esse-beauty/db/schema";

export const USER_ROLES = [
  "owner",
  "manager",
  "receptionist",
  "employee",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const PERMISSION_KEYS = {
  CALENDAR_VIEW_OWN: "calendar.view_own",
  CALENDAR_MANAGE_OWN: "calendar.manage_own",
  CALENDAR_VIEW_OTHERS: "calendar.view_others",
  CALENDAR_MANAGE_OTHERS: "calendar.manage_others",
  CALENDAR_DELETE: "calendar.delete",
  CLIENTS_VIEW: "clients.view",
  CLIENTS_EDIT: "clients.edit",
  CLIENTS_BLOCK: "clients.block",
  REPORTS_VIEW_OWN: "reports.view_own",
  REPORTS_VIEW_ALL: "reports.view_all",
  REPORTS_EXPORT: "reports.export",
  SETTINGS_SALON: "settings.salon",
  SETTINGS_SERVICES: "settings.services",
  SETTINGS_STAFF: "settings.staff",
  SETTINGS_USERS: "settings.users",
  SETTINGS_MODULES: "settings.modules",
  REVIEWS_REPLY: "reviews.reply",
  MARKETING_SEND: "marketing.send",
  INVENTORY_MANAGE: "inventory.manage",
  WAITLIST_MANAGE: "waitlist.manage",
  LOYALTY_MANAGE: "loyalty.manage",
} as const;

export type PermissionKey =
  (typeof PERMISSION_KEYS)[keyof typeof PERMISSION_KEYS];

export const ALL_PERMISSIONS = Object.values(PERMISSION_KEYS);

export const DEFAULT_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  owner: [...ALL_PERMISSIONS],
  manager: ALL_PERMISSIONS.filter(
    (permission) =>
      permission !== PERMISSION_KEYS.SETTINGS_USERS &&
      permission !== PERMISSION_KEYS.SETTINGS_MODULES,
  ),
  receptionist: [
    PERMISSION_KEYS.CALENDAR_VIEW_OWN,
    PERMISSION_KEYS.CALENDAR_MANAGE_OWN,
    PERMISSION_KEYS.CALENDAR_VIEW_OTHERS,
    PERMISSION_KEYS.CALENDAR_MANAGE_OTHERS,
    PERMISSION_KEYS.CLIENTS_VIEW,
    PERMISSION_KEYS.CLIENTS_EDIT,
    PERMISSION_KEYS.REPORTS_VIEW_OWN,
  ],
  employee: [
    PERMISSION_KEYS.CALENDAR_VIEW_OWN,
    PERMISSION_KEYS.CALENDAR_MANAGE_OWN,
    PERMISSION_KEYS.CLIENTS_VIEW,
    PERMISSION_KEYS.REPORTS_VIEW_OWN,
  ],
};

const permissionSet = new Set<string>(ALL_PERMISSIONS);
const CACHE_TTL_MS = 30_000;
const permissionCache = new Map<
  string,
  { expires: number; value: boolean }
>();

function cacheKey(userId: string, permission: PermissionKey): string {
  return `${userId}:${permission}`;
}

export function isPermissionKey(value: string): value is PermissionKey {
  return permissionSet.has(value);
}

export async function hasPermission(
  userId: string,
  permission: PermissionKey,
  db: DrizzleDB,
): Promise<boolean> {
  const key = cacheKey(userId, permission);
  const cached = permissionCache.get(key);

  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }

  const overrides = await db
    .select({ granted: userPermissions.granted })
    .from(userPermissions)
    .where(
      and(
        eq(userPermissions.userId, userId),
        eq(userPermissions.permissionKey, permission),
      ),
    );
  const override = overrides[0];

  let value: boolean;
  if (override) {
    value = override.granted;
  } else {
    const userRows = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId));
    const role = userRows[0]?.role;
    value = role ? DEFAULT_PERMISSIONS[role].includes(permission) : false;
  }

  permissionCache.set(key, {
    expires: Date.now() + CACHE_TTL_MS,
    value,
  });

  return value;
}

export async function resolvePermissions(
  userId: string,
  role: UserRole,
  db: DrizzleDB,
): Promise<PermissionKey[]> {
  const overrides = await db
    .select({
      permissionKey: userPermissions.permissionKey,
      granted: userPermissions.granted,
    })
    .from(userPermissions)
    .where(eq(userPermissions.userId, userId));
  const resolved = new Set<PermissionKey>(DEFAULT_PERMISSIONS[role]);

  for (const override of overrides) {
    if (!isPermissionKey(override.permissionKey)) {
      continue;
    }
    if (override.granted) {
      resolved.add(override.permissionKey);
    } else {
      resolved.delete(override.permissionKey);
    }
  }

  return ALL_PERMISSIONS.filter((permission) => resolved.has(permission));
}

export function invalidatePermissionCache(userId: string): void {
  const prefix = `${userId}:`;
  for (const key of permissionCache.keys()) {
    if (key.startsWith(prefix)) {
      permissionCache.delete(key);
    }
  }
}

export function clearPermissionCache(): void {
  permissionCache.clear();
}
