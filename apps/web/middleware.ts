import { NextResponse } from "next/server";

export function middleware() {
  // La sessione appartiene all'API e può vivere su un host o una porta
  // differenti dalla Web. La verifica autorevole viene quindi eseguita
  // client-side tramite /api/auth/me nell'AuthProvider.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/calendar/:path*",
    "/clients/:path*",
    "/inventory/:path*",
    "/marketing/:path*",
    "/onboarding/:path*",
    "/reports/:path*",
    "/reviews/:path*",
    "/services/:path*",
    "/settings/:path*",
    "/staff/:path*",
    "/waitlist/:path*",
  ],
};
