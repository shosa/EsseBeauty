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

export function SalonBottomNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  // A push-notification message opens as a standalone full-screen "read this and
  // dismiss" view — the tab bar would make it look like just another app screen.
  if (pathname.includes("/messages/") || pathname.includes("/consents/") || pathname.includes("/notifications/")) return null;
  return (
    <nav aria-label="Navigazione cliente" className="fixed inset-x-0 bottom-0 z-30 mx-auto grid h-[76px] max-w-[430px] grid-cols-4 border-t border-stone-200 bg-white/95 backdrop-blur-xl lg:hidden">
      {items.map(({ icon: Icon, label, suffix }) => {
        const href = `/${slug}${suffix}`;
        const active = suffix ? pathname.startsWith(href) : pathname === href;
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`relative flex min-w-0 flex-col items-center justify-center gap-1.5 text-[10.5px] font-bold transition-colors active:scale-95 ${active ? "text-stone-950" : "text-stone-400"}`}
            href={href}
            key={suffix || "home"}
          >
            {active && (
              <motion.span
                aria-hidden="true"
                className="absolute top-2 size-1 rounded-full bg-stone-950"
                layoutId="salon-nav-active-dot"
                transition={{ damping: 32, stiffness: 420, type: "spring" }}
              />
            )}
            <Icon className="relative size-[21px]" strokeWidth={active ? 2.2 : 1.8} />
            <span className="relative max-w-full truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
