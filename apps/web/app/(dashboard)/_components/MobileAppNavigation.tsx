"use client";

import Link from "next/link";

import type { AppDefinition } from "./app-registry";
import { CalendarIcon, DashboardIcon, ModuleIcon, SalesIcon } from "./Icons";

const mobileDestinations = [
  { href: "/", icon: DashboardIcon, label: "Home" },
  { href: "/calendar", icon: CalendarIcon, label: "Agenda" },
  { href: "/sales", icon: SalesIcon, label: "Cassa" },
] as const;

export function MobileAppNavigation({ apps, onAppsOpen, pathname }: { apps: readonly AppDefinition[]; onAppsOpen(): void; pathname: string }) {
  return <nav aria-label="Navigazione mobile" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-stone-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">{mobileDestinations.map((item) => apps.some((app) => app.href === item.href) ? <Link aria-current={pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)) ? "page" : undefined} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-semibold ${pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)) ? "text-[#792f59]" : "text-stone-500"}`} href={item.href} key={item.label}><item.icon /><span>{item.label}</span></Link> : <span aria-hidden="true" key={item.label} />)}<button aria-label="Apri tutte le app" className="flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-semibold text-stone-500" onClick={onAppsOpen} type="button"><ModuleIcon /><span>Altro</span></button></nav>;
}
