"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { AppIconTile, AppLauncherPanel } from "@esse-beauty/ui";

import { APP_DOMAINS, type AppDefinition } from "./app-registry";

export function AppLauncher({ apps, onClose, open, pathname }: { apps: readonly AppDefinition[]; onClose(): void; open: boolean; pathname: string }) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => apps.filter((app) => `${app.label} ${app.description}`.toLowerCase().includes(query.trim().toLowerCase())), [apps, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    window.setTimeout(() => searchRef.current?.focus(), 0);
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div aria-label="Launcher applicazioni" aria-modal="true" className="fixed inset-0 z-50 overflow-y-auto bg-[#2d1d27]/45 p-3 backdrop-blur-sm md:p-8" onMouseDown={onClose} role="dialog">
      <div className="mx-auto max-w-5xl" onMouseDown={(event) => event.stopPropagation()}>
        <AppLauncherPanel title="Tutte le app">
          <div className="flex items-center gap-3"><input aria-label="Cerca app" className="min-h-12 flex-1 rounded-xl border border-stone-200 bg-white px-4" onChange={(event) => setQuery(event.target.value)} placeholder="Cerca Agenda, Clienti, Inventario…" ref={searchRef} value={query} /><button className="min-h-12 rounded-xl px-4 text-sm font-semibold text-stone-500 hover:bg-stone-100" onClick={onClose} type="button">Chiudi</button></div>
          <div className="mt-6 space-y-6">{APP_DOMAINS.map((domain) => { const domainApps = filtered.filter((app) => app.domain === domain.key); if (!domainApps.length) return null; return <section key={domain.key}><h3 className="mb-2 text-[11px] font-bold uppercase tracking-[.14em] text-stone-500">{domain.label}</h3><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{domainApps.map((app) => <AppIconTile accent={app.accent} active={pathname === app.href || (app.href !== "/" && pathname.startsWith(`${app.href}/`))} description={app.description} href={app.href} icon={<app.icon />} key={app.key} label={app.label} onClick={onClose} />)}</div></section>; })}</div>
        </AppLauncherPanel>
      </div>
    </div>
  );
}
