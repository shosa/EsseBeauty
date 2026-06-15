import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { middleware } from "./middleware.js";

describe("dashboard middleware", () => {
  it("redirects unauthenticated dashboard requests to login", () => {
    const response = middleware(
      new NextRequest("http://localhost:3000/settings/users"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login",
    );
  });

  it("allows requests with a Supabase access token cookie", () => {
    const request = new NextRequest(
      "http://localhost:3000/settings/users",
    );
    request.cookies.set("esse-session", "session-token");

    const response = middleware(request);

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
