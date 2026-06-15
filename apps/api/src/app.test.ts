import { afterEach, describe, expect, it, vi } from "vitest";

import type { DrizzleDB } from "@esse-beauty/db";
import { MODULE_KEYS } from "@esse-beauty/feature-flags";

import { createApp } from "./app.js";

const salonId = "55ffce6d-a01a-478f-9369-325017768034";

function createFakeDatabase(
  role: "owner" | "manager" | "receptionist" | "employee" = "manager",
) {
  const selectWhere = vi
    .fn()
    .mockResolvedValueOnce([
      {
        active: true,
        id: "c12f16d5-0114-4e41-80f9-7f0466711f2a",
        role,
        salonId,
      },
    ])
    .mockResolvedValue([
      { module_key: MODULE_KEYS.REMINDERS, enabled: true },
    ]);
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn(() => ({ onConflictDoUpdate }));

  return {
    db: {
      insert: () => ({ values }),
      select: () => ({
        from: () => ({
          where: selectWhere,
        }),
      }),
    } as unknown as DrizzleDB,
    onConflictDoUpdate,
    selectWhere,
    values,
  };
}

const apps: Array<ReturnType<typeof createApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("API", () => {
  it("returns health status", async () => {
    const { db } = createFakeDatabase();
    const app = createApp({
      db,
      env: {
        API_CORS_ORIGIN: "http://localhost:3000",
        SUPABASE_JWT_SECRET: "test-secret-with-at-least-32-characters",
      },
    });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok" });
    expect(response.json()).toHaveProperty("timestamp");
  });

  it("lists modules for the authenticated salon", async () => {
    const { db } = createFakeDatabase();
    const app = createApp({
      db,
      env: {
        API_CORS_ORIGIN: "http://localhost:3000",
        SUPABASE_JWT_SECRET: "test-secret-with-at-least-32-characters",
      },
    });
    apps.push(app);
    await app.ready();
    const token = app.jwt.sign({
      sub: "c12f16d5-0114-4e41-80f9-7f0466711f2a",
    });

    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "GET",
      url: `/api/salons/${salonId}/modules`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      { module_key: MODULE_KEYS.REMINDERS, enabled: true },
    ]);
  });

  it("allows an owner to toggle a known module", async () => {
    const { db, values } = createFakeDatabase("owner");
    const app = createApp({
      db,
      env: {
        API_CORS_ORIGIN: "http://localhost:3000",
        SUPABASE_JWT_SECRET: "test-secret-with-at-least-32-characters",
      },
    });
    apps.push(app);
    await app.ready();
    const token = app.jwt.sign({
      sub: "c12f16d5-0114-4e41-80f9-7f0466711f2a",
    });

    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "PATCH",
      payload: { enabled: false },
      url: `/api/salons/${salonId}/modules/${MODULE_KEYS.REMINDERS}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      module_key: MODULE_KEYS.REMINDERS,
      enabled: false,
    });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
        moduleKey: MODULE_KEYS.REMINDERS,
        salonId,
      }),
    );
  });

  it("rejects module toggles from non-owners", async () => {
    const { db } = createFakeDatabase("manager");
    const app = createApp({
      db,
      env: {
        API_CORS_ORIGIN: "http://localhost:3000",
        SUPABASE_JWT_SECRET: "test-secret-with-at-least-32-characters",
      },
    });
    apps.push(app);
    await app.ready();
    const token = app.jwt.sign({
      sub: "c12f16d5-0114-4e41-80f9-7f0466711f2a",
    });

    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "PATCH",
      payload: { enabled: true },
      url: `/api/salons/${salonId}/modules/${MODULE_KEYS.REVIEWS}`,
    });

    expect(response.statusCode).toBe(403);
  });
});
