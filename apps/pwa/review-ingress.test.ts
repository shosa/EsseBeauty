import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import * as reviewSubmission from "./app/review/review-submission.js";
import { decryptReviewSession, REVIEW_SESSION_COOKIE } from "./lib/review-session.js";

describe("review token ingress", () => {
  it("removes the bearer fragment before exchanging it in a request body", async () => {
    const rawToken = "v1.review.mt77vshc.abcdefghijklmnopqrstuvwxyzABCDEFGH123456789";
    const events: string[] = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      events.push("fetch");
      expect(String(url)).toBe("/review/session/exchange");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({ token: rawToken });
      return new Response(JSON.stringify({ exchanged: true }), { status: 201 });
    }) as typeof fetch;
    const exchange = (reviewSubmission as unknown as {
      exchangeReviewFragment?: (
        fetcher: typeof fetch,
        currentUrl: string,
        replace: (url: string) => void,
      ) => Promise<{ hadToken: boolean; ok: boolean }>;
    }).exchangeReviewFragment;
    expect(exchange).toBeTypeOf("function");
    if (!exchange) return;

    const result = await exchange(
      fetcher,
      `https://pwa.example.test/review#token=${encodeURIComponent(rawToken)}`,
      (url) => { events.push("replace"); expect(url).toBe("/review"); },
    );

    expect(events).toEqual(["replace", "fetch"]);
    expect(result).toEqual({ hadToken: true, ok: true });
    expect(fetcher.mock.calls[0]?.[0]).not.toContain(rawToken);
  });

  it("stores a body bearer in an encrypted HttpOnly session without a token URL", async () => {
    const rawToken = "v1.review.mt77vshc.exchange-body-secret-bearer";
    const secret = "review-session-test-secret-with-at-least-32-characters";
    process.env.REVIEW_SESSION_SECRET = secret;
    const exchangeRoute = await import("./app/review/session/exchange/route.js").catch(() => undefined);
    expect(exchangeRoute?.POST).toBeTypeOf("function");
    if (!exchangeRoute?.POST) return;

    const request = new NextRequest("https://pwa.example.test/review/session/exchange", {
      body: JSON.stringify({ token: rawToken }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const response = await exchangeRoute.POST(request);

    expect(request.nextUrl.pathname).toBe("/review/session/exchange");
    expect(request.nextUrl.href).not.toContain(rawToken);
    expect(response.status).toBe(201);
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${REVIEW_SESSION_COOKIE}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).not.toContain(rawToken);
    const encrypted = /esse-review-session=([^;]+)/.exec(setCookie)?.[1];
    expect(await decryptReviewSession(encrypted!, secret)).toBe(rawToken);
  });
});
