import { describe, expect, it, vi } from "vitest";

import type { DrizzleDB } from "@esse-beauty/db";

import {
  clearPermissionCache,
  DEFAULT_PERMISSIONS,
  hasPermission,
  PERMISSION_KEYS,
} from "./permissions.js";

const userId = "c12f16d5-0114-4e41-80f9-7f0466711f2a";

function createPermissionDatabase(
  override: boolean | undefined,
  role: "owner" | "manager" | "receptionist" | "employee",
) {
  const where = vi
    .fn()
    .mockResolvedValueOnce(
      override === undefined ? [] : [{ granted: override }],
    )
    .mockResolvedValueOnce([{ role }]);

  return {
    db: {
      select: () => ({
        from: () => ({ where }),
      }),
    } as unknown as DrizzleDB,
    where,
  };
}

describe("DEFAULT_PERMISSIONS", () => {
  it("grants every permission to owners", () => {
    expect(DEFAULT_PERMISSIONS.owner).toEqual(
      Object.values(PERMISSION_KEYS),
    );
  });
});

describe("hasPermission", () => {
  it("uses an explicit override before the role default", async () => {
    clearPermissionCache();
    const { db } = createPermissionDatabase(false, "owner");

    await expect(
      hasPermission(userId, PERMISSION_KEYS.SETTINGS_USERS, db),
    ).resolves.toBe(false);
  });

  it("falls back to role defaults when no override exists", async () => {
    clearPermissionCache();
    const { db } = createPermissionDatabase(undefined, "employee");

    await expect(
      hasPermission(userId, PERMISSION_KEYS.CALENDAR_MANAGE_OWN, db),
    ).resolves.toBe(true);
  });

  it("caches the resolved result per user and permission", async () => {
    clearPermissionCache();
    const { db, where } = createPermissionDatabase(undefined, "employee");

    await hasPermission(userId, PERMISSION_KEYS.CLIENTS_VIEW, db);
    await hasPermission(userId, PERMISSION_KEYS.CLIENTS_VIEW, db);

    expect(where).toHaveBeenCalledTimes(2);
  });
});
