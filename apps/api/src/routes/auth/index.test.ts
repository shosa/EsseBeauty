import { afterEach, describe, expect, it, vi } from "vitest";

import type { DrizzleDB } from "@esse-beauty/db";
import {
  clearPermissionCache,
  DEFAULT_PERMISSIONS,
  hasPermission,
  PERMISSION_KEYS,
} from "@esse-beauty/shared";

import { createApp } from "../../app.js";
import type { SupabaseAdmin } from "./supabase-admin.js";

const ownerId = "c12f16d5-0114-4e41-80f9-7f0466711f2a";
const salonId = "55ffce6d-a01a-478f-9369-325017768034";

function createDatabase(selectResults: unknown[][]) {
  const where = vi.fn();
  for (const result of selectResults) {
    where.mockResolvedValueOnce(result);
  }
  const insertValues = vi.fn().mockResolvedValue(undefined);
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn(() => ({ where: updateWhere }));

  return {
    db: {
      insert: () => ({
        values: (value: unknown) => {
          insertValues(value);
          return { onConflictDoUpdate };
        },
      }),
      select: () => ({
        from: () => ({ where }),
      }),
      update: () => ({ set }),
    } as unknown as DrizzleDB,
    insertValues,
    onConflictDoUpdate,
    set,
  };
}

function createAdmin(): SupabaseAdmin {
  return {
    deleteUser: vi.fn().mockResolvedValue(undefined),
    getUsers: vi.fn().mockResolvedValue([]),
    inviteUser: vi.fn().mockResolvedValue({
      id: "75f55fe1-0df2-486d-8e15-8f8f6078ee51",
      email: "new@example.com",
    }),
  };
}

function environment() {
  return {
    API_CORS_ORIGIN: "http://localhost:3000",
    SUPABASE_JWT_SECRET: "test-secret-with-at-least-32-characters",
  };
}

const apps: Array<ReturnType<typeof createApp>> = [];

afterEach(async () => {
  clearPermissionCache();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function ownerToken(app: ReturnType<typeof createApp>) {
  await app.ready();
  return app.jwt.sign({ sub: ownerId });
}

describe("auth routes", () => {
  it("accepts the Supabase access token from the auth cookie", async () => {
    const { db } = createDatabase([
      [{ active: true, id: ownerId, role: "employee", salonId }],
      [
        {
          active: true,
          email: "employee@example.com",
          fullName: "Employee",
          id: ownerId,
          role: "employee",
          salonId,
        },
      ],
      [{ id: salonId, name: "Esse", slug: "esse" }],
      [],
    ]);
    const app = createApp({
      db,
      env: environment(),
      supabaseAdmin: createAdmin(),
    });
    apps.push(app);
    const token = await ownerToken(app);

    const response = await app.inject({
      cookies: { "sb-access-token": token },
      method: "GET",
      url: "/api/auth/me",
    });

    expect(response.statusCode).toBe(200);
  });

  it("invites a user without writing role or salon metadata", async () => {
    const { db, insertValues } = createDatabase([
      [{ active: true, id: ownerId, role: "owner", salonId }],
    ]);
    const admin = createAdmin();
    const app = createApp({ db, env: environment(), supabaseAdmin: admin });
    apps.push(app);
    const token = await ownerToken(app);

    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "POST",
      payload: {
        email: "new@example.com",
        full_name: "New User",
        role: "employee",
      },
      url: "/api/auth/invite",
    });

    expect(response.statusCode).toBe(201);
    expect(admin.inviteUser).toHaveBeenCalledWith("new@example.com");
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "employee",
        salonId,
      }),
    );
  });

  it("returns the current user, salon, and resolved permissions", async () => {
    const { db } = createDatabase([
      [{ active: true, id: ownerId, role: "employee", salonId }],
      [
        {
          active: true,
          email: "employee@example.com",
          fullName: "Employee",
          id: ownerId,
          role: "employee",
          salonId,
        },
      ],
      [{ id: salonId, name: "Esse", slug: "esse" }],
      [],
    ]);
    const app = createApp({
      db,
      env: environment(),
      supabaseAdmin: createAdmin(),
    });
    apps.push(app);
    const token = await ownerToken(app);

    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "GET",
      url: "/api/auth/me",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().permissions).toEqual(
      DEFAULT_PERMISSIONS.employee,
    );
  });

  it("upserts a permission override", async () => {
    const targetId = "75f55fe1-0df2-486d-8e15-8f8f6078ee51";
    const { db, onConflictDoUpdate } = createDatabase([
      [{ active: true, id: ownerId, role: "owner", salonId }],
      [],
      [{ role: "owner" }],
      [{ salonId }],
    ]);
    const app = createApp({
      db,
      env: environment(),
      supabaseAdmin: createAdmin(),
    });
    apps.push(app);
    const token = await ownerToken(app);

    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "PATCH",
      payload: {
        granted: false,
        permission_key: PERMISSION_KEYS.SETTINGS_USERS,
      },
      url: `/api/auth/users/${targetId}/permissions`,
    });

    expect(response.statusCode).toBe(200);
    expect(onConflictDoUpdate).toHaveBeenCalled();
  });

  it("invalidates cached permission results after an override", async () => {
    const targetId = "75f55fe1-0df2-486d-8e15-8f8f6078ee51";
    const deniedDb = createDatabase([[{ granted: false }]]).db;
    await expect(
      hasPermission(targetId, PERMISSION_KEYS.CLIENTS_VIEW, deniedDb),
    ).resolves.toBe(false);

    const { db } = createDatabase([
      [{ active: true, id: ownerId, role: "owner", salonId }],
      [],
      [{ role: "owner" }],
      [{ salonId }],
    ]);
    const app = createApp({
      db,
      env: environment(),
      supabaseAdmin: createAdmin(),
    });
    apps.push(app);
    const token = await ownerToken(app);

    await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "PATCH",
      payload: {
        granted: true,
        permission_key: PERMISSION_KEYS.CLIENTS_VIEW,
      },
      url: `/api/auth/users/${targetId}/permissions`,
    });

    const grantedDb = createDatabase([[{ granted: true }]]).db;
    await expect(
      hasPermission(targetId, PERMISSION_KEYS.CLIENTS_VIEW, grantedDb),
    ).resolves.toBe(true);
  });

  it("lists salon users with overrides and Supabase last login", async () => {
    const { db } = createDatabase([
      [{ active: true, id: ownerId, role: "manager", salonId }],
      [
        {
          active: true,
          email: "manager@example.com",
          fullName: "Manager",
          id: ownerId,
          role: "manager",
        },
      ],
      [
        {
          granted: true,
          permissionKey: PERMISSION_KEYS.SETTINGS_USERS,
          userId: ownerId,
        },
      ],
    ]);
    const admin = createAdmin();
    vi.mocked(admin.getUsers).mockResolvedValue([
      {
        email: "manager@example.com",
        id: ownerId,
        last_sign_in_at: "2026-06-15T12:00:00.000Z",
      },
    ]);
    const app = createApp({ db, env: environment(), supabaseAdmin: admin });
    apps.push(app);
    const token = await ownerToken(app);

    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "GET",
      url: "/api/auth/users",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()[0]).toMatchObject({
      last_login: "2026-06-15T12:00:00.000Z",
      permission_overrides: [
        {
          granted: true,
          permission_key: PERMISSION_KEYS.SETTINGS_USERS,
        },
      ],
    });
  });

  it("prevents users from deactivating themselves", async () => {
    const { db } = createDatabase([
      [{ active: true, id: ownerId, role: "owner", salonId }],
      [],
      [{ role: "owner" }],
    ]);
    const app = createApp({
      db,
      env: environment(),
      supabaseAdmin: createAdmin(),
    });
    apps.push(app);
    const token = await ownerToken(app);

    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "PATCH",
      payload: { active: false },
      url: `/api/auth/users/${ownerId}`,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "SELF_DEACTIVATION_FORBIDDEN" });
  });
});
