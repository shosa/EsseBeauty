import { afterEach, describe, expect, it, vi } from "vitest";

import type { DrizzleDB } from "@esse-beauty/db";

import { createApp } from "../app.js";
import { parseBody, type SafeParseSchema } from "./http-validation.js";

const apps: Array<ReturnType<typeof createApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("parseBody", () => {
  it("returns field details instead of invoking a handler with malformed input", () => {
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
    const schema: SafeParseSchema<{ email: string }> = {
      safeParse: () => ({
        error: { fieldErrors: { email: ["Email obbligatoria"] } },
        success: false,
      }),
    };

    const body = parseBody(schema, { body: {} }, reply as never);

    expect(body).toBeUndefined();
    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      error: "INVALID_REQUEST",
      fields: { email: ["Email obbligatoria"] },
    });
  });
});

describe("authentication request validation", () => {
  it("rejects a missing login email as INVALID_REQUEST", async () => {
    const app = createApp({
      db: {} as DrizzleDB,
      env: { API_CORS_ORIGIN: "http://localhost:3000" },
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      payload: { password: "stefanosolidoro" },
      url: "/api/auth/login",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "INVALID_REQUEST",
      fields: { email: ["Email obbligatoria"] },
    });
  });

  it("rejects an invalid login email before querying the database", async () => {
    const app = createApp({
      db: {} as DrizzleDB,
      env: { API_CORS_ORIGIN: "http://localhost:3000" },
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      payload: { email: "non-una-email", password: "stefanosolidoro" },
      url: "/api/auth/login",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "INVALID_REQUEST",
      fields: { email: ["Email non valida"] },
    });
  });
});
