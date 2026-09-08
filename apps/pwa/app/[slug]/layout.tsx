import type { Metadata } from "next";
import type { ReactNode } from "react";

import { CustomerAuthProvider } from "./_components/CustomerAuthProvider";
import { PageTransition } from "./_components/PageTransition";
import { SalonBottomNav } from "./_components/SalonBottomNav";
import { SalonTopNav } from "./_components/SalonTopNav";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  // Scopes "Add to Home Screen" to this salon so the installed icon reopens straight to
  // it instead of the root salon-search page every visitor would otherwise land on.
  return { manifest: `/${slug}/manifest.webmanifest` };
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

