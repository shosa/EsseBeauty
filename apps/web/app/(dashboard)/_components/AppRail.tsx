"use client";

import Link from "next/link";

import type { AppDefinition } from "./app-registry";
import { BellIcon, DashboardIcon, LogoutIcon, SettingsIcon } from "./Icons";

function activePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function FourDotsIcon() {
  return (
    <span aria-hidden="true" className="grid size-5 grid-cols-2 place-items-center gap-1">
      <span className="size-1.5 rounded-full bg-current" />
      <span className="size-1.5 rounded-full bg-current" />
      <span className="size-1.5 rounded-full bg-current" />
      <span className="size-1.5 rounded-full bg-current" />
    </span>
  );
}

export function AppRail({
  apps,
  logout,
  onAppsOpen,
  onNavigate,
  onNotificationsOpen,
  pathname,
  unreadCount,
  userName,
}: {
  apps: readonly AppDefinition[];
  logout(): void;
  onAppsOpen(): void;
  onNavigate(): void;
  onNotificationsOpen(): void;
  pathname: string;
  unreadCount: number;
  userName: string;
}) {
  const pinnedKeys = new Set(["home", "calendar", "sales"]);
  const pinned = apps.filter((app) => pinnedKeys.has(app.key));
  const settings = apps.find((app) => app.key === "settings");
  const initials = userName.split(" ").map((part) => part[0]).join("").slice(0, 2);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[76px] flex-col items-center border-r border-white/10 bg-[#2d1d27] px-2 py-3 text-white shadow-[8px_0_28px_rgb(45_29_39_/_0.12)] md:flex">
      <Link aria-label="EsseBeauty Home" className="grid size-12 place-items-center rounded-xl bg-white text-lg font-black text-[#792f59]" href="/" onClick={onNavigate}>E</Link>
      <nav aria-label="App fissate" className="mt-4 flex flex-1 flex-col items-center gap-1.5">
        <button aria-label="Apri tutte le app" className="grid size-12 place-items-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" onClick={onAppsOpen} title="Tutte le app" type="button"><FourDotsIcon /></button>
        <span className="my-1 h-px w-8 bg-white/10" />
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5">
          {pinned.map((app) => <Link aria-current={activePath(pathname, app.href) ? "page" : undefined} aria-label={app.label} className={`grid size-12 place-items-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${activePath(pathname, app.href) ? "bg-white text-[#792f59] shadow-md" : "text-white/65 hover:bg-white/10 hover:text-white"}`} href={app.href} key={app.key} onClick={onNavigate} title={app.label}><app.icon /></Link>)}
        </div>
      </nav>
      <div className="flex flex-col items-center gap-1.5">
        <button aria-label="Apri notifiche" className="relative grid size-12 place-items-center rounded-xl text-white/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white hover:bg-white/10 hover:text-white" onClick={() => { onNavigate(); onNotificationsOpen(); }} type="button"><BellIcon />{unreadCount > 0 && <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-red-600 text-[10px] font-black">{Math.min(unreadCount, 9)}</span>}</button>
        {settings && <Link aria-label="Impostazioni" className="grid size-12 place-items-center rounded-xl text-white/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white hover:bg-white/10 hover:text-white" href={settings.href} onClick={onNavigate}><SettingsIcon /></Link>}
        <button aria-label="Esci" className="group relative grid size-12 place-items-center rounded-xl bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white text-xs font-black text-white hover:bg-white hover:text-[#792f59]" onClick={() => { onNavigate(); logout(); }} title="Esci" type="button"><span className="group-hover:hidden">{initials}</span><LogoutIcon className="hidden group-hover:block" /></button>
      </div>
    </aside>
  );
}
