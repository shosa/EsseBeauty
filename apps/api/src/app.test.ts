import { afterEach, describe, expect, it } from "vitest";

import type { DrizzleDB } from "@esse-beauty/db";

import { createApp } from "./app.js";

const apps: Array<ReturnType<typeof createApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("API", () => {
  it("returns health status", async () => {
    const app = createApp({
      db: {} as DrizzleDB,
      env: { API_CORS_ORIGIN: "http://localhost:3000" },
    });
    apps.push(app);
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok" });
  });

  it("allows credentialed CORS requests", async () => {
    const app = createApp({
      db: {} as DrizzleDB,
      env: { API_CORS_ORIGIN: "http://localhost:3000" },
    });
    apps.push(app);
    const response = await app.inject({
      headers: { origin: "http://localhost:3000" },
      method: "OPTIONS",
      url: "/health",
    });
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });
});
