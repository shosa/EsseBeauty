"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, Mail, MessageCircleMore, Search, Send } from "lucide-react";
import { AppPage, Button, EmptyState, InlineError, PageHeader, SaveActionButton, SaveToast, SectionCard, StatusBadge, Switch } from "@esse-beauty/ui";
import { MODULE_KEYS, useModuleEnabled } from "@esse-beauty/feature-flags";
import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
const options = [48, 24, 2, 1];
const channelIcons = { WhatsApp: MessageCircleMore, Email: Mail } as const;
const pageSize = 8;

function paginationPages(current: number, total: number) {
  const candidates = [1, current - 1, current, current + 1, total];
  return [...new Set(candidates.filter((page) => page >= 1 && page <= total))].sort((a, b) => a - b);
}

export default function ReminderSettingsPage() {
  const { salon } = useAuth();
  const moduleEnabled = useModuleEnabled(MODULE_KEYS.REMINDERS);
  const [whatsapp, setWhatsapp] = useState(false);
  const [email, setEmail] = useState(true);
  const [app, setApp] = useState(false);
  const [hours, setHours] = useState<number[]>([24]);
  const [log, setLog] = useState<Array<{ id: string; customer_name: string; channel: string; sent_at?: string; status: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!moduleEnabled || !salon) return;
    setLoading(true);
    setError("");
    void Promise.all([
      fetch(`${api}/api/salons/${salon.id}/reminders/settings`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/reminders`, { credentials: "include" }),
    ]).then(async ([settingsResponse, remindersResponse]) => {
      if (!settingsResponse.ok || !remindersResponse.ok) throw new Error("LOAD_FAILED");
      const settings = await settingsResponse.json();
      const reminders = await remindersResponse.json();
      setWhatsapp(settings.whatsappEnabled); setEmail(settings.emailEnabled); setApp(settings.appEnabled); setHours(settings.hoursBefore); setLog(reminders);
    }).catch(() => setError("Impossibile caricare le impostazioni dei promemoria."))
      .finally(() => setLoading(false));
  }, [moduleEnabled, salon]);

  const filteredLog = useMemo(() => log.filter((item) => `${item.customer_name} ${item.channel} ${item.status}`.toLowerCase().includes(query.toLowerCase())), [log, query]);
  const totalPages = Math.max(1, Math.ceil(filteredLog.length / pageSize));
  const pagedLog = useMemo(() => filteredLog.slice((page - 1) * pageSize, page * pageSize), [filteredLog, page]);

  async function save(nextWhatsapp: boolean, nextEmail: boolean, nextApp: boolean, nextHours: number[]) {
    if (!salon || saving) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/reminders/settings`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ whatsapp_enabled: nextWhatsapp, email_enabled: nextEmail, app_enabled: nextApp, hours_before: nextHours }) });
      if (!response.ok) throw new Error("SAVE_FAILED");
      setSaved(true);
    } catch {
      setError("Salvataggio dei promemoria non riuscito. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  if (!moduleEnabled) {
    return (
      <AppPage maxWidth="max-w-[1600px]">
        <PageHeader eyebrow="Notifiche" title="Promemoria appuntamenti" subtitle="Canali, tempi di invio e storico dei promemoria recenti." />
        <EmptyState
          action={<Link className="font-bold text-[var(--esse-mulberry,#543147)]" href="/apps">Vai ad App e moduli</Link>}
          description="Il modulo Promemoria non è attivo per questo salone. Attivalo dalla pagina App e moduli per configurare canali e invii."
          title="Modulo Promemoria non attivo"
        />
      </AppPage>
    );
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageHeader eyebrow="Notifiche" title="Promemoria appuntamenti" subtitle="Canali, tempi di invio e storico dei promemoria recenti." />
      <SaveToast visible={saved}>Impostazioni promemoria salvate.</SaveToast>
      {error && <InlineError className="mb-5">{error}</InlineError>}
      {loading ? <div aria-label="Caricamento promemoria" className="h-64 animate-pulse rounded-2xl bg-stone-100" role="status" /> : <>
      <SectionCard icon={BellRing} title="Regole promemoria">
        <div className="grid gap-5 md:grid-cols-2">
          <fieldset>
            <legend className="font-semibold">Canali attivi</legend>
            {[["WhatsApp", whatsapp, setWhatsapp], ["Email", email, setEmail]].map(([label, value, setter]) => {
              const Icon = channelIcons[label as keyof typeof channelIcons];
              return <label key={label as string} className="mt-4 flex min-h-12 items-center justify-between rounded-xl border border-stone-200 p-4"><span className="flex items-center gap-2"><Icon aria-hidden="true" className="size-4 text-[var(--esse-mulberry,#543147)]" />{label as string}</span><Switch aria-label={`Promemoria ${label as string}`} checked={value as boolean} disabled={saving} onCheckedChange={(checked) => (setter as (value: boolean) => void)(checked)} /></label>;
            })}
            <label className="mt-4 flex min-h-12 items-center justify-between rounded-xl border border-stone-200 p-4">
              <span>
                <span className="flex items-center gap-2"><Bell aria-hidden="true" className="size-4 text-[var(--esse-mulberry,#543147)]" />App</span>
                <span className="mt-0.5 block text-xs font-normal text-stone-500">Solo per i clienti che hanno l’app installata con le notifiche attive.</span>
              </span>
              <Switch aria-label="Promemoria App" checked={app} disabled={saving} onCheckedChange={(checked) => setApp(checked)} />
            </label>
          </fieldset>
          <fieldset><legend className="font-semibold">Quando inviarli</legend><div className="mt-4 grid grid-cols-2 gap-3">{options.map((value) => <label key={value} className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border p-4 ${hours.includes(value) ? "border-[var(--esse-mulberry,#543147)] bg-[var(--esse-petal,#f2e1eb)]" : "border-stone-200"}`}><span>{value} ore prima</span><Switch checked={hours.includes(value)} disabled={saving} onCheckedChange={() => setHours(hours.includes(value) ? hours.filter((item) => item !== value) : [...hours, value])} /></label>)}</div></fieldset>
        </div>
        <div className="mt-6 flex justify-end border-t border-stone-200 pt-5">
          <SaveActionButton busy={saving} idleLabel="Salva regole promemoria" onClick={() => void save(whatsapp, email, app, hours)} saved={saved} />
        </div>
      </SectionCard>
      <SectionCard className="mt-6" icon={Send} title="Invii recenti">
        <label className="relative mb-4 block max-w-sm">
          <span className="sr-only">Cerca negli invii</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input className="w-full pl-10" onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Cerca per cliente, canale o stato…" value={query} />
        </label>
        {filteredLog.length === 0 ? <EmptyState description={log.length === 0 ? "Gli invii completati o in coda compariranno qui." : "Nessun invio corrisponde alla ricerca."} title="Nessun promemoria recente" /> : <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-stone-500"><tr><th className="p-4">Cliente</th><th>Canale</th><th>Invio</th><th>Stato</th></tr></thead>
              <tbody>{pagedLog.map((item) => <tr key={item.id} className="border-t border-stone-100"><td className="p-4 font-semibold">{item.customer_name}</td><td>{item.channel}</td><td>{item.sent_at ? new Date(item.sent_at).toLocaleString("it-IT") : "In coda"}</td><td><StatusBadge status={item.status} /></td></tr>)}</tbody>
            </table>
          </div>
          {totalPages > 1 && <nav aria-label="Paginazione invii" className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-stone-100 pt-4">
            <p className="text-xs font-semibold text-stone-500">Pagina {page} di {totalPages}</p>
            <div className="flex items-center gap-1">
              <Button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} size="sm" variant="outline">Precedente</Button>
              {paginationPages(page, totalPages).map((item, index, all) => {
                const previous = all[index - 1];
                return <span className="contents" key={item}>{previous && item - previous > 1 && <span className="px-1 text-stone-400">…</span>}<button aria-current={item === page ? "page" : undefined} className={`grid size-9 place-items-center rounded-lg text-sm font-black ${item === page ? "bg-[var(--esse-mulberry,#543147)] text-white" : "text-stone-600 hover:bg-[var(--esse-petal,#f2e1eb)]"}`} onClick={() => setPage(item)} type="button">{item}</button></span>;
              })}
              <Button disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} size="sm" variant="outline">Successiva</Button>
            </div>
          </nav>}
        </>}
      </SectionCard>
      </>}
    </AppPage>
  );
}
