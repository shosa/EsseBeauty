import { NextResponse, type NextRequest } from "next/server";

function hasAccessToken(request: NextRequest): boolean {
  return Boolean(request.cookies.get("sb-access-token")?.value);
}

export function middleware(request: NextRequest) {
  if (!hasAccessToken(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*"],
};
