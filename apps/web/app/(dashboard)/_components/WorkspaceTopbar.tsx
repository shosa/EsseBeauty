"use client";

import Link from "next/link";

import { ContextTabs } from "@esse-beauty/ui";

import type { AppDefinition, AppQuickAction, AppTab } from "./app-registry";
import { BellIcon, ModuleIcon } from "./Icons";

export function WorkspaceTopbar({ actions, app, onLauncherOpen, onNotificationsOpen, onSearchOpen, pathname, tabs, unreadCount }: { actions: readonly AppQuickAction[]; app?: AppDefinition; onLauncherOpen(): void; onNotificationsOpen(): void; onSearchOpen(): void; pathname: string; tabs: readonly AppTab[]; unreadCount: number }) {
  const action = actions[0];
  const Icon = app?.icon;
  return (
    <header className="fixed left-0 right-0 top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur md:left-[76px]">
      <div className="flex h-16 items-center gap-3 px-3 md:px-5">
        <button aria-label="Apri tutte le app" className="grid size-11 place-items-center rounded-xl border border-stone-200 text-[#792f59] md:hidden" onClick={onLauncherOpen} type="button"><ModuleIcon /></button>
        {Icon && <span className="hidden size-9 place-items-center rounded-lg text-white sm:grid" style={{ backgroundColor: app.accent }}><Icon className="size-4" /></span>}
        <div className="min-w-0"><p className="truncate text-sm font-bold text-stone-950">{app?.label ?? "EsseBeauty"}</p><p className="hidden truncate text-xs text-stone-500 sm:block">{app?.description ?? "Gestione salone"}</p></div>
        <button className="ml-auto hidden min-h-10 w-full max-w-sm rounded-xl border border-stone-200 bg-stone-50 px-4 text-left text-sm text-stone-500 lg:block" onClick={onSearchOpen} type="button">Cerca cliente, appuntamento, servizio… <kbd className="float-right">Ctrl+K</kbd></button>
        {action && <Link className="hidden min-h-10 items-center rounded-xl bg-[#792f59] px-4 text-sm font-semibold text-white hover:bg-[#66264b] sm:inline-flex" href={action.href}>{action.label}</Link>}
        <button aria-label="Cerca" className="grid size-11 place-items-center rounded-xl border border-stone-200 text-stone-600 lg:hidden" onClick={onSearchOpen} type="button">⌕</button>
        <button aria-label="Apri notifiche" className="relative grid size-11 place-items-center rounded-xl border border-stone-200 text-[#792f59]" onClick={onNotificationsOpen} type="button"><BellIcon />{unreadCount > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-red-600 text-[10px] font-black text-white">{Math.min(unreadCount, 9)}</span>}</button>
      </div>
      <ContextTabs className="px-3 md:px-5" currentPath={pathname} items={tabs} />
    </header>
  );
}
