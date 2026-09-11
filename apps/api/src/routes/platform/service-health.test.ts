import { describe, expect, it, vi } from "vitest";

import { checkServiceHealth, platformServices } from "./service-health.js";

describe("platform service health", () => {
  it("checks every backend service without going through the gateway", async () => {
    const requested: string[] = [];
    const fetcher = vi.fn(async (url: string) => {
      requested.push(url);
      return new Response(null, { status: 204 });
    });

    const result = await checkServiceHealth({ fetcher, now: () => 1_000 });

    expect(result.map((item) => item.key)).toEqual(platformServices.map((item) => item.key));
    expect(requested).toEqual(platformServices.map((item) => item.healthUrl));
    expect(result.every((item) => item.status === "operational")).toBe(true);
    expect(result.every((item) => item.checkedAt === "1970-01-01T00:00:01.000Z")).toBe(true);
  });

  it("marks failing services offline and slow services degraded", async () => {
    let clock = 10_000;
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("3013")) throw new Error("connection refused");
      if (url.includes("3017")) return new Response(null, { status: 503 });
      return new Response(null, { status: 204 });
    });
    const now = () => {
      clock += 900;
      return clock;
    };

    const result = await checkServiceHealth({ fetcher, now, slowAfterMs: 700 });

    expect(result.find((item) => item.key === "communications")).toMatchObject({
      error: "connection refused",
      status: "offline",
    });
    expect(result.find((item) => item.key === "booking")).toMatchObject({
      error: "HTTP 503",
      status: "offline",
    });
    expect(result.find((item) => item.key === "api")).toMatchObject({
      latencyMs: 900,
      status: "degraded",
    });
  });
});
