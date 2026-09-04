"use client";

import Link from "next/link";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import { EmptyState } from "@esse-beauty/ui";

import { APP_DOMAINS, drawerApps, type AppDefinition } from "./app-registry";

export function AppDrawerOverlay({ apps, badgeCounts, onClose, open }: { apps: readonly AppDefinition[]; badgeCounts?: Record<string, number>; onClose(): void; open: boolean }) {
  const drawerRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const availableApps = useMemo(() => drawerApps(apps), [apps]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("it");
    if (!normalized) return availableApps;
    return availableApps.filter((app) => `${app.label} ${app.description}`.toLocaleLowerCase("it").includes(normalized));
  }, [availableApps, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0]!; const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    window.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", keydown);
      previousFocus?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 left-0 right-0 z-[100] bg-[#1c1118]/55 backdrop-blur-sm md:left-[76px]" onMouseDown={onClose}>
      <section aria-label="Tutte le app" aria-modal="true" className="esse-app-drawer-overlay absolute inset-y-0 left-0 w-full overflow-y-auto bg-[radial-gradient(circle_at_18%_0%,#98577c_0%,transparent_35%),linear-gradient(145deg,#34202d_0%,#5f2948_58%,#7e3a61_100%)] px-4 py-6 text-white shadow-[28px_0_90px_rgb(24_12_19_/_0.38)] md:w-[min(1120px,calc(100vw-76px))] md:px-8 lg:px-10" onMouseDown={(event) => event.stopPropagation()} ref={drawerRef} role="dialog">
        <header className="sticky top-0 z-10 -mx-1 flex items-start gap-4 rounded-xl bg-[#402334]/88 px-4 py-4 shadow-lg backdrop-blur-xl">
          <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.2em] text-white/70">Workspace EsseBeauty</p><h1 className="mt-1 text-2xl font-black tracking-[-.035em]">Le tue app</h1><p className="mt-1 text-xs text-white/70">Apri uno strumento senza lasciare il contesto corrente.</p></div>
          <button aria-label="Chiudi app drawer" className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-white/75 transition hover:bg-white hover:text-[#792f59]" onClick={onClose} type="button"><X className="size-5" /></button>
        </header>

        <label className="relative mx-auto mt-5 block max-w-2xl"><Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-stone-400" /><span className="sr-only">Cerca app</span><input className="min-h-12 w-full rounded-2xl border border-white/20 bg-white/95 py-3 pl-11 pr-4 text-sm font-semibold text-stone-900 shadow-[0_14px_34px_rgb(26_13_21_/_0.2)] outline-none placeholder:text-stone-400 focus:border-[#e9b8d2] focus:ring-4 focus:ring-white/15" onChange={(event) => setQuery(event.target.value)} placeholder="Cerca app…" type="search" value={query} /></label>

        {filtered.length === 0 ? <div className="mx-auto mt-10 max-w-xl rounded-xl bg-white p-4 text-stone-900"><EmptyState description="Prova a cercare un altro strumento." title="Nessuna app trovata" /></div> : <div className="mt-7 space-y-7 pb-8">{APP_DOMAINS.map((domain) => {
          const domainApps = filtered.filter((app) => app.domain === domain.key);
          if (domainApps.length === 0) return null;
          return <section key={domain.key}><div className="mb-3 flex items-center gap-3 border-b border-white/10 pb-2"><h2 className="text-[10px] font-black uppercase tracking-[.18em] text-white/60">{domain.label}</h2><span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/55">{domainApps.length}</span></div><div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">{domainApps.map((app) => {
            const animationIndex = filtered.findIndex((candidate) => candidate.key === app.key);
            const badge = badgeCounts?.[app.key] ?? 0;
            return <Link className="esse-app-drawer-item group relative flex aspect-square min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border border-transparent px-2 text-center transition hover:-translate-y-1 hover:border-white/15 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/25" href={app.href} key={app.key} onClick={onClose} style={{ "--app-delay": `${Math.max(0, animationIndex) * 34}ms` } as CSSProperties} title={app.description}><span className="relative grid size-14 place-items-center rounded-2xl text-white shadow-[0_12px_26px_rgb(24_12_19_/_0.3)] transition group-hover:scale-105 sm:size-16" style={{ backgroundColor: app.accent }}><app.icon className="size-6 sm:size-7" />{badge > 0 && <span className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full border-2 border-[#402334] bg-red-600 text-xs font-black leading-none text-white">{Math.min(badge, 99)}</span>}</span><strong className="line-clamp-2 text-xs font-bold leading-4 text-white sm:text-sm">{app.label}</strong></Link>;
          })}</div></section>;
        })}</div>}
      </section>
    </div>
  );
}
