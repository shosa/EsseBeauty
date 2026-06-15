"use client";

import { useEffect, useState } from "react";

import {
  MODULE_KEYS,
  type ModuleKey,
  useModules,
} from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";
import { Switch } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
const modules: Array<{ key: ModuleKey; name: string; description: string }> = [
  { key: MODULE_KEYS.REMINDERS, name: "Promemoria", description: "Invia notifiche automatiche prima degli appuntamenti." },
  { key: MODULE_KEYS.REVIEWS, name: "Recensioni", description: "Raccoglie feedback e permette allo staff di rispondere." },
  { key: MODULE_KEYS.WAITLIST, name: "Lista d'attesa", description: "Gestisce richieste quando gli orari sono esauriti." },
  { key: MODULE_KEYS.LOYALTY, name: "Fedeltà", description: "Assegna punti e rende disponibili premi ai clienti." },
  { key: MODULE_KEYS.MARKETING, name: "Marketing", description: "Invia campagne email e SMS a segmenti selezionati." },
  { key: MODULE_KEYS.INVENTORY, name: "Inventario", description: "Monitora prodotti, movimenti e scorte basse." },
  { key: MODULE_KEYS.STAFF_PERF, name: "Performance staff", description: "Mostra report operativi su staff e servizi." },
];

export default function ModulesPage() {
  const { hasPermission, salon } = useAuth();
  const { modules: state, setModule } = useModules();
  const [pending, setPending] = useState<ModuleKey>();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => setLoaded(true), []);
  const canManage = hasPermission(PERMISSION_KEYS.SETTINGS_MODULES);

  async function toggle(moduleKey: ModuleKey, enabled: boolean) {
    if (!salon) return;
    setPending(moduleKey);
    const response = await fetch(
      `${api}/api/salons/${salon.id}/modules/${moduleKey}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled }),
      },
    );
    if (response.ok) setModule(moduleKey, enabled);
    setPending(undefined);
  }

  return <main className="min-h-screen bg-[#f6f2f4] p-5 md:p-10"><div className="mx-auto max-w-5xl"><header><p className="text-xs font-bold uppercase tracking-[.2em] text-[#792f59]">Funzionalità</p><h1 className="mt-2 text-3xl font-bold">Moduli del salone</h1><p className="mt-2 text-stone-500">Attiva solo gli strumenti che vuoi mostrare al team.</p></header>
    {!canManage && <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Solo il proprietario può modificare i moduli.</p>}
    <section className="mt-7 grid gap-4 md:grid-cols-2">{modules.map((item) => <article key={item.key} className="flex min-h-36 items-start justify-between gap-5 rounded-2xl bg-white p-5 shadow-sm"><div><h2 className="font-bold">{item.name}</h2><p className="mt-2 max-w-sm text-sm leading-6 text-stone-500">{item.description}</p></div>{loaded ? <Switch checked={state[item.key] ?? false} disabled={!canManage || pending === item.key} onCheckedChange={(enabled) => void toggle(item.key, enabled)} /> : <div className="h-6 w-11 animate-pulse rounded-full bg-stone-200" />}</article>)}</section>
  </div></main>;
}
