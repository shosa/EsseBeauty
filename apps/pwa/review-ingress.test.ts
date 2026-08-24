import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { exchangeReviewIngress, middleware } from "./middleware.js";
import {
  decryptReviewSession,
  REVIEW_SESSION_COOKIE,
} from "./lib/review-session.js";

describe("review token ingress", () => {
  it("exchanges the raw path for an encrypted HttpOnly cookie and token-free redirect", async () => {
    const rawToken = "v1.review.mt77vshc.abcdefghijklmnopqrstuvwxyzABCDEFGH123456789";
    const secret = "review-session-test-secret-with-at-least-32-characters";
    const response = await exchangeReviewIngress(
      new NextRequest(`https://pwa.example.test/review/${rawToken}`),
      secret,
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://pwa.example.test/review");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("cache-control")).toBe("no-store, private");
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${REVIEW_SESSION_COOKIE}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/review");
    expect(setCookie).not.toContain(rawToken);
    const encrypted = /esse-review-session=([^;]+)/.exec(setCookie)?.[1];
    expect(await decryptReviewSession(encrypted!, secret)).toBe(rawToken);
    expect(response.headers.get("location")).not.toContain(rawToken);
  });

  it("passes the token-free review session endpoint through unchanged", async () => {
    const response = await middleware(new NextRequest("https://pwa.example.test/review/session"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
