import { NextResponse } from "next/server";

import { serverApiBaseUrl } from "../../../lib/server-api";

/**
 * A per-salon manifest, not the file-convention manifest.ts — that convention's
 * generated handler drops route params (Next.js only threads params through the
 * sitemap/image metadata routes, not manifest/robots), so it can't vary by :slug.
 * A plain route handler gets params like any other route.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const scope = `/${slug}`;
  const salonName = await fetch(`${serverApiBaseUrl()}/api/public/${slug}`, { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) return "Esse Beauty";
      const body = await response.json() as { salon?: { name?: string } };
      return body.salon?.name?.trim() || "Esse Beauty";
    })
    .catch(() => "Esse Beauty");

  return NextResponse.json({
    background_color: "#ffffff",
    description: "Prenota e gestisci i tuoi appuntamenti",
    display: "standalone",
    icons: [
      { sizes: "192x192", src: "/icon-192.png", type: "image/png" },
      { sizes: "512x512", src: "/icon-512.png", type: "image/png" },
    ],
    id: scope,
    lang: "it",
    name: salonName,
    dir: "ltr",
    scope,
    short_name: salonName,
    start_url: scope,
    theme_color: "#ffffff",
  }, {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
