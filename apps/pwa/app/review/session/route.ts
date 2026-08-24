import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import {
  decryptReviewSession,
  REVIEW_SESSION_COOKIE,
} from "../../../lib/review-session";
import { serverApiBaseUrl } from "../../../lib/server-api";

async function proxyReview(request: NextRequest, method: "GET" | "POST") {
  const secret = process.env.REVIEW_SESSION_SECRET;
  const session = (await cookies()).get(REVIEW_SESSION_COOKIE)?.value;
  const token = secret && session ? await decryptReviewSession(session, secret) : undefined;
  if (!token) {
    return NextResponse.json(
      { error: "TOKEN_INVALID" },
      { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }, status: 404 },
    );
  }
  const submittedBody = method === "POST"
    ? await request.json().catch(() => ({})) as Record<string, unknown>
    : {};
  const upstreamUrl = `${serverApiBaseUrl()}/api/public/reviews/${method === "GET" ? "resolve" : "submit"}`;
  const upstream = await fetch(upstreamUrl, {
    body: JSON.stringify({ ...submittedBody, token }),
    cache: "no-store",
    headers: { "content-type": "application/json" },
    method: "POST",
    redirect: "manual",
    referrerPolicy: "no-referrer",
  });
  const response = new NextResponse(await upstream.text(), {
    headers: {
      "Cache-Control": "no-store, private",
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "Referrer-Policy": "no-referrer",
    },
    status: upstream.status,
  });
  if (method === "POST" && upstream.ok) {
    response.cookies.set({
      httpOnly: true,
      maxAge: 0,
      name: REVIEW_SESSION_COOKIE,
      path: "/review",
      sameSite: "strict",
      value: "",
    });
  }
  return response;
}

export function GET(request: NextRequest) {
  return proxyReview(request, "GET");
}

export function POST(request: NextRequest) {
  return proxyReview(request, "POST");
}
