"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";

import { staffNavItems } from "./StaffNav";

export function StaffBottomNav({ pendingRequestCount }: { pendingRequestCount: number }) {
  const pathname = usePathname();
  if (pathname.startsWith("/agenda/")) return null;
  return (
    <nav aria-label="Navigazione staff" className="fixed inset-x-0 bottom-0 z-30 mx-auto grid h-[76px] max-w-[430px] grid-cols-4 border-t border-stone-200 bg-white/95 backdrop-blur-xl lg:hidden">
      {staffNavItems.map(({ href, icon: Icon, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`relative flex min-w-0 flex-col items-center justify-center gap-1.5 text-[10.5px] font-bold transition-colors active:scale-95 ${active ? "text-stone-950" : "text-stone-400"}`}
            href={href}
            key={href}
          >
            {active && (
              <motion.span
                aria-hidden="true"
                className="absolute top-2 size-1 rounded-full bg-stone-950"
                layoutId="staff-nav-active-dot"
                transition={{ damping: 32, stiffness: 420, type: "spring" }}
              />
            )}
            <span className="relative">
              <Icon className="size-[21px]" strokeWidth={active ? 2.2 : 1.8} />
              {href === "/requests" && pendingRequestCount > 0 && <span className="absolute -right-1.5 -top-1 size-2 rounded-full border border-white bg-red-600" />}
            </span>
            <span className="relative max-w-full truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
