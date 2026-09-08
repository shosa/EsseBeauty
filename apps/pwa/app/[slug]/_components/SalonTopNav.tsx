"use client";

import { CalendarDays, CalendarPlus, Gift, Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";

const items = [
  { icon: Home, label: "Home", suffix: "" },
  { icon: CalendarPlus, label: "Prenota", suffix: "/book" },
  { icon: CalendarDays, label: "Appuntamenti", suffix: "/appointments" },
  { icon: Gift, label: "Fedeltà", suffix: "/loyalty" },
];

// Desktop-only (lg+) horizontal chrome; SalonBottomNav keeps serving mobile. Hidden on the
// standalone message and consent-signing views for the same reason the bottom nav is: they
// read as a focused dismiss-and-go flow, not another app screen with chrome around it.
export function SalonTopNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  if (pathname.includes("/messages/") || pathname.includes("/consents/")) return null;
  return (
    <nav aria-label="Navigazione cliente" className="fixed inset-x-0 top-0 z-30 hidden h-16 border-b border-stone-200 bg-white/95 backdrop-blur-xl lg:block">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-8">
        <Link aria-label="Torna alla ricerca saloni" className="grid size-9 place-items-center rounded-xl bg-stone-950" href="/">
          <img alt="EsseBeauty" className="h-4 w-auto brightness-0 invert" src="/esse-logo.svg" />
        </Link>
        <div className="flex items-center gap-1">
          {items.map(({ icon: Icon, label, suffix }) => {
            const href = `/${slug}${suffix}`;
            const active = suffix ? pathname.startsWith(href) : pathname === href;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors ${active ? "text-stone-950" : "text-stone-400 hover:text-stone-700"}`}
                href={href}
                key={suffix || "home"}
              >
                {active && (
                  <motion.span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-stone-100"
                    layoutId="salon-top-nav-active-pill"
                    transition={{ damping: 32, stiffness: 420, type: "spring" }}
                  />
                )}
                <Icon className="relative size-4" strokeWidth={active ? 2.4 : 1.8} />
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        </div>
        <div className="w-9" aria-hidden="true" />
      </div>
    </nav>
  );
}
