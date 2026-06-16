"use client";

import { useState } from "react";

import { MODULE_KEYS, type ModuleKey, useModules } from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { useAuth } from "../../../../lib/auth-context";
import { ModuleIcon } from "../../_components/Icons";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
const modules: Array<{ key: ModuleKey; name: string; description: string; destination: string }> = [
  { key: MODULE_KEYS.REMINDERS, name: "Promemoria", description: "Invia email o SMS automatici prima degli appuntamenti.", destination: "Impostazioni promemoria" },
  { key: MODULE_KEYS.REVIEWS, name: "Recensioni", description: "Raccoglie feedback, pubblica recensioni e consente le risposte.", destination: "Area recensioni" },
  { key: MODULE_KEYS.WAITLIST, name: "Lista d'attesa", description: "Registra richieste quando un orario non è disponibile.", destination: "Gestione lista d'attesa" },
  { key: MODULE_KEYS.LOYALTY, name: "Fedeltà", description: "Assegna punti per appuntamento e configura premi.", destination: "Programma fedeltà" },
  { key: MODULE_KEYS.MARKETING, name: "Marketing", description: "Crea campagne email e SMS per segmenti di clienti.", destination: "Campagne" },
  { key: MODULE_KEYS.INVENTORY, name: "Inventario", description: "Monitora prodotti, movimenti e soglie di riordino.", destination: "Magazzino" },
  { key: MODULE_KEYS.STAFF_PERF, name: "Performance staff", description: "Mostra report su appuntamenti, servizi e risultati del team.", destination: "Report" },
];

export default function ModulesPage() {
  const { hasPermission, salon, user } = useAuth();
  const { modules: state, setModule } = useModules();
  const [pending, setPending] = useState<ModuleKey>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canManage = user?.role === "owner" && hasPermission(PERMISSION_KEYS.SETTINGS_MODULES);

  async function toggle(moduleKey: ModuleKey, enabled: boolean) {
    if (!salon || !canManage) return;
    setPending(moduleKey);
    setError("");
    setMessage("");
    const response = await fetch(`${api}/api/salons/${salon.id}/modules/${moduleKey}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled }),
    }).catch(() => null);
    setPending(undefined);
    if (!response) {
      setError("API non raggiungibile o richiesta bloccata dal browser.");
      return;
    }
    if (!response.ok) {
      setError(response.status === 403 ? "Solo il proprietario può modificare i moduli." : "La modifica non è stata salvata.");
      return;
    }
    setModule(moduleKey, enabled);
    const name = modules.find((item) => item.key === moduleKey)?.name ?? "Modulo";
    setMessage(`${name} ${enabled ? "attivato" : "disattivato"}. La navigazione è stata aggiornata.`);
  }

  return <main className="min-h-screen bg-[#f6f2f4] p-5 md:p-10"><div className="mx-auto max-w-5xl">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#792f59]">Funzionalità</p><h1 className="mt-2 text-3xl font-bold">Moduli del salone</h1><p className="mt-2 max-w-2xl text-stone-500">Ogni modulo attivato compare subito nella sidebar e rende disponibili le relative API e schermate.</p></div><div className="rounded-2xl bg-white px-4 py-3 text-sm shadow-sm"><b>{Object.values(state).filter(Boolean).length}</b> moduli attivi</div></header>
    {!canManage && <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Accesso in sola lettura. Per modificare i moduli serve un account proprietario con il permesso “Impostazioni moduli”.</p>}
    {message && <p className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
    {error && <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <section className="mt-7 grid gap-4 md:grid-cols-2">{modules.map((item) => {
      const enabled = state[item.key] ?? false;
      const busy = pending === item.key;
      return <article key={item.key} className={`flex min-h-52 flex-col rounded-2xl border p-5 shadow-sm transition ${enabled ? "border-[#d7a6c1] bg-white" : "border-stone-200 bg-white/70"}`}>
        <div className="flex items-start justify-between gap-4"><span className={`grid size-11 place-items-center rounded-xl ${enabled ? "bg-[#f3e2eb] text-[#792f59]" : "bg-stone-100 text-stone-400"}`}><ModuleIcon /></span><span className={`rounded-full px-3 py-1 text-xs font-bold ${enabled ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>{enabled ? "Attivo" : "Disattivato"}</span></div>
        <h2 className="mt-4 text-lg font-bold">{item.name}</h2><p className="mt-2 flex-1 text-sm leading-6 text-stone-500">{item.description}</p><p className="mt-3 text-xs font-semibold uppercase tracking-wider text-stone-400">{item.destination}</p>
        <button disabled={!canManage || busy} onClick={() => void toggle(item.key, !enabled)} className={`mt-4 min-h-11 rounded-xl px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${enabled ? "border border-stone-300 bg-white text-stone-700 hover:border-red-300 hover:text-red-700" : "bg-[#402334] text-white hover:bg-[#5a3048]"}`}>{busy ? "Salvataggio..." : enabled ? "Disattiva modulo" : "Attiva modulo"}</button>
      </article>;
    })}</section>
  </div></main>;
}
