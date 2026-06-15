"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

import {
  MODULE_KEYS,
  ModuleProvider,
  useModuleEnabled,
} from "@esse-beauty/feature-flags";

import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

const primary = [
  { href: "/", icon: "⌂", label: "Dashboard" },
  { href: "/calendar", icon: "□", label: "Calendario" },
  { href: "/clients", icon: "◎", label: "Clienti" },
  { href: "/services", icon: "◇", label: "Servizi" },
  { href: "/staff", icon: "◉", label: "Staff" },
];

const moduleLinks = [
  { moduleKey: MODULE_KEYS.REMINDERS, href: "/settings/reminders", label: "Promemoria" },
  { moduleKey: MODULE_KEYS.REVIEWS, href: "/reviews", label: "Recensioni" },
  { moduleKey: MODULE_KEYS.WAITLIST, href: "/waitlist", label: "Lista attesa" },
  { moduleKey: MODULE_KEYS.LOYALTY, href: "/settings/loyalty", label: "Fedeltà" },
  { moduleKey: MODULE_KEYS.MARKETING, href: "/marketing", label: "Marketing" },
  { moduleKey: MODULE_KEYS.INVENTORY, href: "/inventory", label: "Inventario" },
  { moduleKey: MODULE_KEYS.STAFF_PERF, href: "/reports", label: "Report" },
];

function NavLink({
  href,
  icon,
  label,
  onClick,
}: {
  href: string;
  icon?: string;
  label: string;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return <Link href={href} onClick={onClick} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${active ? "bg-[#f3e2eb] text-[#792f59]" : "text-stone-600 hover:bg-stone-50"}`}><span className="grid w-6 place-items-center text-lg">{icon ?? "·"}</span>{label}</Link>;
}

function ModuleNav({ close }: { close?: () => void }) {
  return <div className="space-y-1">{moduleLinks.map((item) => <ModuleNavItem key={item.moduleKey} {...item} close={close} />)}</div>;
}

function ModuleNavItem({
  close,
  href,
  moduleKey,
  label,
}: {
  close?: () => void;
  href: string;
  moduleKey: (typeof MODULE_KEYS)[keyof typeof MODULE_KEYS];
  label: string;
}) {
  const enabled = useModuleEnabled(moduleKey);
  return enabled ? <NavLink href={href} label={label} onClick={close} /> : null;
}

function ShellContent({ children }: { children: ReactNode }) {
  const { salon, user } = useAuth();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  async function logout() {
    await fetch(`${api}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    router.push("/login");
    router.refresh();
  }

  return <div className="min-h-screen bg-[#f6f2f4] md:pl-72">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-stone-200 bg-white p-5 md:flex">
      <Link href="/" className="flex items-center gap-3 border-b border-stone-100 pb-5"><span className="grid size-11 place-items-center rounded-2xl bg-[#402334] text-lg font-black text-white">E</span><span><b className="block text-lg">{salon?.name ?? "Esse Beauty"}</b><small className="text-stone-400">Gestione salone</small></span></Link>
      <nav className="mt-5 space-y-1">{primary.map((item) => <NavLink key={item.href} {...item} />)}</nav>
      <div className="mt-6"><p className="mb-2 px-3 text-xs font-bold uppercase tracking-[.18em] text-stone-400">Moduli</p><ModuleNav /></div>
      <div className="mt-auto border-t border-stone-100 pt-4"><NavLink href="/settings" icon="⚙" label="Impostazioni" /><div className="mt-3 flex items-center gap-3 rounded-2xl bg-stone-50 p-3"><span className="grid size-10 place-items-center rounded-full bg-[#d9a5c2] font-bold text-[#402334]">{user?.full_name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><div className="min-w-0 flex-1"><b className="block truncate text-sm">{user?.full_name}</b><small className="text-stone-500">{user?.role}</small></div><button onClick={() => void logout()} title="Esci" className="text-stone-500">↗</button></div></div>
    </aside>

    <div className="pb-20 md:pb-0">{children}</div>

    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-stone-200 bg-white px-2 py-2 md:hidden">{primary.slice(0, 5).map((item) => <Link key={item.href} href={item.href} className="grid place-items-center gap-1 text-[10px] font-semibold text-stone-600"><span className="text-lg">{item.icon}</span>{item.label}</Link>)}<button onClick={() => setMoreOpen(true)} className="grid place-items-center gap-1 text-[10px] font-semibold"><span className="text-lg">•••</span>Altro</button></nav>

    {moreOpen && <div className="fixed inset-0 z-50 bg-black/30 md:hidden" onClick={() => setMoreOpen(false)}><aside className="absolute inset-y-0 right-0 w-[85%] max-w-sm overflow-y-auto bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Navigazione</h2><button onClick={() => setMoreOpen(false)}>Chiudi</button></div><nav className="mt-6 space-y-1"><ModuleNav close={() => setMoreOpen(false)} /><NavLink href="/settings" icon="⚙" label="Impostazioni" onClick={() => setMoreOpen(false)} /></nav><button onClick={() => void logout()} className="mt-8 w-full rounded-xl border border-stone-200 py-3 font-semibold text-red-700">Esci</button></aside></div>}
  </div>;
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { salon } = useAuth();
  if (!salon) return <>{children}</>;
  return <ModuleProvider apiBaseUrl={api} salonId={salon.id}><ShellContent>{children}</ShellContent></ModuleProvider>;
}
