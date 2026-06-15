import { NextResponse, type NextRequest } from "next/server";

function hasAccessToken(request: NextRequest): boolean {
  return Boolean(request.cookies.get("esse-session")?.value);
}

export function middleware(request: NextRequest) {
  if (!hasAccessToken(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/calendar/:path*",
    "/clients/:path*",
    "/inventory/:path*",
    "/marketing/:path*",
    "/reports/:path*",
    "/reviews/:path*",
    "/services/:path*",
    "/settings/:path*",
    "/staff/:path*",
    "/waitlist/:path*",
  ],
};
