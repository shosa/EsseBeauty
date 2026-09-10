"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";

import type { StaffSession } from "../../lib/staff-auth";
import { staffNavItems } from "./StaffNav";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "—";
}

export function StaffTopNav({ onLogout, pendingRequestCount, session }: { onLogout(): void; pendingRequestCount: number; session: StaffSession }) {
  const pathname = usePathname();
  if (pathname.startsWith("/agenda/")) return null;
  return (
    <nav aria-label="Navigazione staff" className="fixed inset-x-0 top-0 z-30 hidden h-16 border-b border-stone-200 bg-white/95 backdrop-blur-xl lg:block">
      <div className="mx-auto flex h-full max-w-5xl items-center justify-between px-8">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-stone-950"><img alt="EsseBeauty" className="h-4 w-auto brightness-0 invert" src="/esse-logo.svg" /></span>
          <span className="text-sm font-black text-stone-950">Staff</span>
        </div>
        <div className="flex items-center gap-1">
          {staffNavItems.map(({ href, icon: Icon, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors ${active ? "text-stone-950" : "text-stone-400 hover:text-stone-700"}`}
                href={href}
                key={href}
              >
                {active && (
                  <motion.span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-stone-100"
                    layoutId="staff-top-nav-active-pill"
                    transition={{ damping: 32, stiffness: 420, type: "spring" }}
                  />
                )}
                <span className="relative">
                  <Icon className="size-4" strokeWidth={active ? 2.4 : 1.8} />
                  {href === "/requests" && pendingRequestCount > 0 && <span className="absolute -right-1 -top-1 size-1.5 rounded-full bg-red-600" />}
                </span>
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        </div>
        <button className="flex items-center gap-2 rounded-full border border-stone-200 py-1 pl-3 pr-1 text-sm font-bold text-stone-800 transition hover:border-stone-300" onClick={onLogout} type="button">
          {session.staff.display_name.split(" ")[0]}
          <span className="grid size-8 place-items-center rounded-full text-xs font-black text-white" style={{ background: session.staff.color }}>{initials(session.staff.display_name)}</span>
        </button>
      </div>
    </nav>
  );
}
