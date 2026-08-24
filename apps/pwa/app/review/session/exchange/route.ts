import { type NextRequest, NextResponse } from "next/server";

import {
  encryptReviewSession,
  REVIEW_SESSION_COOKIE,
  REVIEW_SESSION_MAX_AGE_SECONDS,
} from "../../../../lib/review-session";

const secureHeaders = {
  "Cache-Control": "no-store, private",
  "Referrer-Policy": "no-referrer",
};

export async function POST(request: NextRequest) {
  const secret = process.env.REVIEW_SESSION_SECRET;
  const body = await request.json().catch(() => undefined) as { token?: unknown } | undefined;
  if (
    !secret ||
    typeof body?.token !== "string" ||
    body.token.length > 512 ||
    !body.token.startsWith("v1.review.")
  ) {
    return NextResponse.json(
      { error: "TOKEN_INVALID" },
      { headers: secureHeaders, status: 404 },
    );
  }
  const response = NextResponse.json(
    { exchanged: true },
    { headers: secureHeaders, status: 201 },
  );
  response.cookies.set({
    httpOnly: true,
    maxAge: REVIEW_SESSION_MAX_AGE_SECONDS,
    name: REVIEW_SESSION_COOKIE,
    path: "/review",
    sameSite: "strict",
    secure: request.nextUrl.protocol === "https:",
    value: await encryptReviewSession(body.token, secret),
  });
  return response;
}
