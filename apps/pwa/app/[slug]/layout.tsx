import Link from "next/link";
import type { ReactNode } from "react";

export default async function SalonLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <div className="pb-20">{children}<nav className="fixed inset-x-0 bottom-0 z-20 mx-auto grid h-16 max-w-[430px] grid-cols-4 border-t border-stone-200 bg-white/95 text-center text-xs font-black backdrop-blur">
    <Link className="grid place-items-center" href={`/${slug}`}>Home</Link>
    <Link className="grid place-items-center" href={`/${slug}/book`}>Prenota</Link>
    <Link className="grid place-items-center" href={`/${slug}/appointments`}>Appuntamenti</Link>
    <Link className="grid place-items-center" href={`/${slug}/loyalty`}>Fedeltà</Link>
  </nav></div>;
}

