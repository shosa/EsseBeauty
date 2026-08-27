import type { ReactNode } from "react";

import { SalonBottomNav } from "./_components/SalonBottomNav";

export default async function SalonLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <div className="pb-24">{children}<SalonBottomNav slug={slug} /></div>;
}

