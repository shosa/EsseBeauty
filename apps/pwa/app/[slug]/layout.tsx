import type { ReactNode } from "react";

import { CustomerAuthProvider } from "./_components/CustomerAuthProvider";
import { SalonBottomNav } from "./_components/SalonBottomNav";

export default async function SalonLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <CustomerAuthProvider>
      <div className="pb-24">{children}<SalonBottomNav slug={slug} /></div>
    </CustomerAuthProvider>
  );
}

