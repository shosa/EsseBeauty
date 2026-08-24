import { type NextRequest, NextResponse } from "next/server";

import {
  encryptReviewSession,
  REVIEW_SESSION_COOKIE,
  REVIEW_SESSION_MAX_AGE_SECONDS,
} from "./lib/review-session";

export async function exchangeReviewIngress(
  request: NextRequest,
  secret: string,
): Promise<NextResponse> {
  const encodedToken = request.nextUrl.pathname.slice("/review/".length);
  const token = decodeURIComponent(encodedToken);
  const encrypted = await encryptReviewSession(token, secret);
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/review";
  redirectUrl.search = "";
  const response = NextResponse.redirect(redirectUrl, 307);
  response.headers.set("Cache-Control", "no-store, private");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.cookies.set({
    httpOnly: true,
    maxAge: REVIEW_SESSION_MAX_AGE_SECONDS,
    name: REVIEW_SESSION_COOKIE,
    path: "/review",
    sameSite: "strict",
    secure: request.nextUrl.protocol === "https:",
    value: encrypted,
  });
  return response;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (request.nextUrl.pathname === "/review/session") {
    return NextResponse.next();
  }
  const secret = process.env.REVIEW_SESSION_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "REVIEW_SESSION_UNAVAILABLE" },
      { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }, status: 503 },
    );
  }
  return exchangeReviewIngress(request, secret);
}

export const config = { matcher: ["/review/:token"] };
