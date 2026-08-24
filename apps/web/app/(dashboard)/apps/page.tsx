"use client";

import { useMemo, useState } from "react";

import { useModules } from "@esse-beauty/feature-flags";
import { AppIconTile, AppPage, EmptyState, PageHeader, SectionCard } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";
import { APP_DOMAINS, visibleApps } from "../_components/app-registry";

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
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("it");
    if (!normalized) return apps;
    return apps.filter((app) => `${app.label} ${app.description}`.toLocaleLowerCase("it").includes(normalized));
  }, [apps, query]);

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageHeader
        eyebrow="Workspace"
        subtitle="Apri gli strumenti disponibili per il tuo ruolo e il tuo salone."
        title="Tutte le app"
      />
      <SectionCard>
        <label className="block max-w-xl text-sm font-bold text-stone-700">
          Cerca app
          <input
            autoFocus
            className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-4 font-normal"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Agenda, Clienti, Inventario…"
            type="search"
            value={query}
          />
        </label>
      </SectionCard>
      {filtered.length === 0 ? (
        <EmptyState description="Prova a cercare un altro strumento." title="Nessuna app trovata" />
      ) : (
        <div className="space-y-5">
          {APP_DOMAINS.map((domain) => {
            const domainApps = filtered.filter((app) => app.domain === domain.key);
            if (domainApps.length === 0) return null;
            return (
              <section key={domain.key}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h2 className="text-xs font-black uppercase tracking-[.14em] text-stone-500">{domain.label}</h2>
                  <span className="text-xs text-stone-400">{domainApps.length} {domainApps.length === 1 ? "app" : "app"}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {domainApps.map((app) => (
                    <AppIconTile
                      accent={app.accent}
                      description={app.description}
                      href={app.href}
                      icon={<app.icon />}
                      key={app.key}
                      label={app.label}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </AppPage>
  );
}
