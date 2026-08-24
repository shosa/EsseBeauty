import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { encryptReviewSession, REVIEW_SESSION_COOKIE } from "./lib/review-session.js";

const cookieStore = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

import { GET } from "./app/review/session/route.js";

describe("review session server routing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.API_INTERNAL_URL = "http://api:3001";
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
    process.env.REVIEW_SESSION_SECRET = "review-session-test-secret-with-at-least-32-characters";
  });

  it("resolves through the internal API with the bearer only in the JSON body", async () => {
    const rawToken = "v1.review.mt77vshc.server-routing-secret-bearer";
    const encrypted = await encryptReviewSession(rawToken, process.env.REVIEW_SESSION_SECRET!);
    cookieStore.get.mockReturnValue({ name: REVIEW_SESSION_COOKIE, value: encrypted });
    const upstream = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ salon_name: "Salon", service_name: "Viso", starts_at: "2026-08-24T08:00:00.000Z" }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );

    const response = await GET(new NextRequest("http://pwa:3002/review/session"));

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(1);
    const [url, init] = upstream.mock.calls[0]!;
    expect(String(url)).toBe("http://api:3001/api/public/reviews/resolve");
    expect(String(url)).not.toContain(rawToken);
    expect(init).toMatchObject({ method: "POST", cache: "no-store" });
    expect(JSON.parse(String(init?.body))).toEqual({ token: rawToken });
  });
});
