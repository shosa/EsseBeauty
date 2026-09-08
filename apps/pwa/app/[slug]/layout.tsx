import type { Metadata } from "next";
import type { ReactNode } from "react";

import { serverApiBaseUrl } from "../../lib/server-api";
import { CustomerAuthProvider } from "./_components/CustomerAuthProvider";
import { PageTransition } from "./_components/PageTransition";
import { SalonBottomNav } from "./_components/SalonBottomNav";
import { SalonTopNav } from "./_components/SalonTopNav";

async function fetchSalonName(slug: string): Promise<string | undefined> {
  try {
    const response = await fetch(`${serverApiBaseUrl()}/api/public/${slug}`, { cache: "no-store" });
    if (!response.ok) return undefined;
    const body = await response.json() as { salon?: { name?: string } };
    return body.salon?.name?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const salonName = await fetchSalonName(slug);
  return {
    // iOS Safari's "Add to Home Screen" ignores the web manifest's name/short_name — it
    // labels the icon from apple-mobile-web-app-title (falling back to the page <title>),
    // so both need the salon's own name, not the generic app title from the root layout.
    appleWebApp: salonName ? { capable: true, statusBarStyle: "default", title: salonName } : undefined,
    // Scopes "Add to Home Screen" to this salon so the installed icon reopens straight to
    // it instead of the root salon-search page every visitor would otherwise land on.
    manifest: `/${slug}/manifest.webmanifest`,
    title: salonName,
  };
}

export default async function SalonLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <CustomerAuthProvider>
      <SalonTopNav slug={slug} />
      <div className="pb-24 lg:pb-0 lg:pt-16"><PageTransition>{children}</PageTransition><SalonBottomNav slug={slug} /></div>
    </CustomerAuthProvider>
  );
}

