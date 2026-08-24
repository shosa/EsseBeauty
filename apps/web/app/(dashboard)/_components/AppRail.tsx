"use client";

import Link from "next/link";

import type { AppDefinition } from "./app-registry";
import { BellIcon, DashboardIcon, LogoutIcon, ModuleIcon, SettingsIcon } from "./Icons";

function activePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppRail({
  apps,
  logout,
  onNotificationsOpen,
  pathname,
  unreadCount,
  userName,
}: {
  apps: readonly AppDefinition[];
  logout(): void;
  onNotificationsOpen(): void;
  pathname: string;
  unreadCount: number;
  userName: string;
}) {
  const pinnedKeys = new Set(["home", "calendar", "sales"]);
  const pinned = apps.filter((app) => pinnedKeys.has(app.key));
  const current = apps.find((app) => activePath(pathname, app.href));
  const settings = apps.find((app) => app.key === "settings");
  const initials = userName.split(" ").map((part) => part[0]).join("").slice(0, 2);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[76px] flex-col items-center border-r border-white/10 bg-[#2d1d27] px-2 py-3 text-white shadow-[8px_0_28px_rgb(45_29_39_/_0.12)] md:flex">
      <Link aria-label="EsseBeauty Home" className="grid size-12 place-items-center rounded-xl bg-white text-lg font-black text-[#792f59]" href="/">E</Link>
      <nav aria-label="App fissate" className="mt-4 flex flex-1 flex-col items-center gap-1.5">
        <Link aria-label="Apri tutte le app" className="grid size-12 place-items-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" href="/apps" title="Tutte le app"><ModuleIcon /></Link>
        <span className="my-1 h-px w-8 bg-white/10" />
        {pinned.map((app) => <Link aria-current={activePath(pathname, app.href) ? "page" : undefined} aria-label={app.label} className={`grid size-12 place-items-center rounded-xl transition ${activePath(pathname, app.href) ? "bg-white text-[#792f59] shadow-md" : "text-white/65 hover:bg-white/10 hover:text-white"}`} href={app.href} key={app.key} title={app.label}><app.icon /></Link>)}
        {current && !pinnedKeys.has(current.key) && <><span className="my-1 h-px w-8 bg-white/10" /><Link aria-current="page" aria-label={current.label} className="grid size-12 place-items-center rounded-xl bg-white text-[#792f59] shadow-md" href={current.href} title={current.label}><current.icon /></Link></>}
      </nav>
      <div className="flex flex-col items-center gap-1.5">
        <button aria-label="Apri notifiche" className="relative grid size-12 place-items-center rounded-xl text-white/65 hover:bg-white/10 hover:text-white" onClick={onNotificationsOpen} type="button"><BellIcon />{unreadCount > 0 && <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-red-600 text-[10px] font-black">{Math.min(unreadCount, 9)}</span>}</button>
        {settings && <Link aria-label="Impostazioni" className="grid size-12 place-items-center rounded-xl text-white/65 hover:bg-white/10 hover:text-white" href={settings.href}><SettingsIcon /></Link>}
        <button aria-label="Esci" className="group relative grid size-12 place-items-center rounded-xl bg-white/10 text-xs font-black text-white hover:bg-white hover:text-[#792f59]" onClick={logout} title="Esci" type="button"><span className="group-hover:hidden">{initials}</span><LogoutIcon className="hidden group-hover:block" /></button>
      </div>
    </aside>
  );
}
