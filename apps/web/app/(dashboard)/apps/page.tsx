"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useModules } from "@esse-beauty/feature-flags";
import { AppPage, EmptyState } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";
import { APP_DOMAINS, drawerApps, visibleApps } from "../_components/app-registry";

export default function AppsPage() {
  const { permissions } = useAuth();
  const { modules } = useModules();
  const [query, setQuery] = useState("");
  const apps = useMemo(
    () => visibleApps(
      new Set(Object.entries(modules).filter(([, enabled]) => enabled).map(([key]) => key)),
      new Set(permissions),
    ),
    [modules, permissions],
  );
  const availableApps = useMemo(() => drawerApps(apps), [apps]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("it");
    if (!normalized) return availableApps;
    return availableApps.filter((app) => `${app.label} ${app.description}`.toLocaleLowerCase("it").includes(normalized));
  }, [availableApps, query]);

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <section
        className="min-h-[calc(100vh-7.5rem)] overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_18%_0%,#98577c_0%,transparent_35%),linear-gradient(145deg,#34202d_0%,#5f2948_58%,#7e3a61_100%)] px-4 py-8 text-white shadow-[0_24px_70px_rgb(45_29_39_/_0.22)] sm:px-7 lg:px-10"
        data-ui="app-drawer"
      >
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-black uppercase tracking-[.22em] text-white/55">Workspace EsseBeauty</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-.04em] sm:text-4xl">Le tue app</h1>
          <p className="mt-2 text-sm text-white/65">Tutti gli strumenti disponibili per il tuo ruolo, in un unico spazio.</p>
          <label className="relative mt-6 block text-left">
            <span className="sr-only">Cerca app</span>
            <input
              autoFocus
              className="min-h-12 w-full rounded-xl border border-white/20 bg-white/95 px-5 text-sm font-semibold text-stone-900 shadow-[0_14px_34px_rgb(26_13_21_/_0.2)] outline-none transition placeholder:text-stone-400 focus:border-[#e9b8d2] focus:ring-4 focus:ring-white/15"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca app…"
              type="search"
              value={query}
            />
          </label>
        </header>

        {filtered.length === 0 ? (
          <div className="mx-auto mt-12 max-w-xl rounded-2xl bg-white p-4 text-stone-900">
            <EmptyState description="Prova a cercare un altro strumento." title="Nessuna app trovata" />
          </div>
        ) : (
          <div className="mx-auto mt-10 max-w-7xl space-y-9">
            {APP_DOMAINS.map((domain) => {
              const domainApps = filtered.filter((app) => app.domain === domain.key);
              if (domainApps.length === 0) return null;
              return (
                <section key={domain.key}>
                  <div className="mb-3 flex items-center gap-3 border-b border-white/10 pb-2">
                    <h2 className="text-[11px] font-black uppercase tracking-[.18em] text-white/65">{domain.label}</h2>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/55">{domainApps.length}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
                    {domainApps.map((app) => (
                      <Link
                        className="group flex aspect-square min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border border-white/0 px-2 text-center transition hover:-translate-y-1 hover:border-white/15 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/25"
                        href={app.href}
                        key={app.key}
                        title={app.description}
                      >
                        <span
                          className="grid size-14 place-items-center rounded-2xl text-white shadow-[0_12px_26px_rgb(24_12_19_/_0.3)] transition group-hover:scale-105 sm:size-16"
                          style={{ backgroundColor: app.accent }}
                        >
                          <app.icon className="size-6 sm:size-7" />
                        </span>
                        <strong className="line-clamp-2 text-xs font-bold leading-4 text-white sm:text-sm">{app.label}</strong>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>
    </AppPage>
  );
}
