"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { AppPage, Button, EmptyState, PageHeader, PageTransition, SectionCard, StatGrid, StatCard, StatusBadge } from "@esse-beauty/ui";
import { useAuth } from "../../../lib/auth-context";
import { BellIcon, CalendarIcon, InventoryIcon, StaffIcon } from "../_components/Icons";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

const categoryLabels: Record<string, string> = {
  calendar: "Calendario & prenotazioni",
  inventory: "Magazzino",
  staff: "Staff",
};

const categoryIcons: Record<string, typeof BellIcon> = {
  calendar: CalendarIcon,
  inventory: InventoryIcon,
  staff: StaffIcon,
};

const statusTabs = [
  { key: "all", label: "Tutte" },
  { key: "unread", label: "Non lette" },
  { key: "read", label: "Lette" },
  { key: "archived", label: "Archiviate" },
] as const;
type StatusFilter = (typeof statusTabs)[number]["key"];

interface NotificationRow {
  action_pending: boolean;
  body: string | null;
  category: string;
  created_at: string;
  href: string | null;
  id: string;
  priority: string;
  read_at: string | null;
  title: string;
  type: string;
}

interface Summary { archived: number; high_priority: number; total: number; unread: number }

function formatWhen(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function groupLabel(iso: string) {
  const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000);
  if (diffDays <= 0) return "Oggi";
  if (diffDays === 1) return "Ieri";
  if (diffDays <= 7) return "Questa settimana";
  return "Più vecchie";
}

export default function NotificationsPage() {
  const { salon } = useAuth();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [summary, setSummary] = useState<Summary>({ archived: 0, high_priority: 0, total: 0, unread: 0 });
  const [status, setStatus] = useState<StatusFilter>("all");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkPending, setBulkPending] = useState(false);

  const loadSummary = useCallback(async () => {
    if (!salon) return;
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/notifications-summary`, { credentials: "include" });
      if (response.ok) setSummary(await response.json());
    } catch { /* stat tiles are non-critical */ }
  }, [salon]);

  const load = useCallback(async () => {
    if (!salon) return;
    setLoading(true);
    const params = new URLSearchParams({ limit: "100", status });
    if (category !== "all") params.set("category", category);
    if (query.trim()) params.set("q", query.trim());
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/notifications?${params}`, { credentials: "include" });
      if (!response.ok) throw new Error();
      const data = await response.json() as { items: NotificationRow[] };
      setItems(data.items);
      setSelected((current) => current.filter((id) => data.items.some((item) => item.id === id)));
    } catch { setMessage("Impossibile caricare le notifiche. Riprova."); }
    finally { setLoading(false); }
  }, [category, query, salon, status]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadSummary(); }, [loadSummary]);

  async function refreshAll() {
    await Promise.all([load(), loadSummary()]);
  }

  async function markRead(item: NotificationRow) {
    if (!salon || item.read_at) return;
    await fetch(`${api}/api/salons/${salon.id}/notifications/${item.id}/read`, { credentials: "include", method: "PATCH" });
    await refreshAll();
  }

  async function archive(item: NotificationRow) {
    if (!salon) return;
    setMessage("");
    const response = await fetch(`${api}/api/salons/${salon.id}/notifications/${item.id}`, { credentials: "include", method: "DELETE" });
    if (!response.ok) {
      setMessage(response.status === 409 ? "Questa notifica richiede ancora un'azione: non può essere archiviata." : "Impossibile archiviare la notifica.");
      return;
    }
    await refreshAll();
  }

  async function restore(item: NotificationRow) {
    if (!salon) return;
    await fetch(`${api}/api/salons/${salon.id}/notifications/${item.id}/restore`, { credentials: "include", method: "PATCH" });
    await refreshAll();
  }

  async function markAllRead() {
    if (!salon) return;
    await fetch(`${api}/api/salons/${salon.id}/notifications/read-all`, { credentials: "include", method: "PATCH" });
    await refreshAll();
  }

  async function archiveRead() {
    if (!salon) return;
    setMessage("");
    const response = await fetch(`${api}/api/salons/${salon.id}/notifications/archive-read`, { credentials: "include", method: "PATCH" });
    if (response.ok) {
      const data = await response.json() as { skipped?: number };
      if (data.skipped) setMessage(`${data.skipped} notifiche non archiviate perché richiedono ancora un'azione.`);
    }
    await refreshAll();
  }

  function toggleSelect(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]);
  }
  function toggleSelectAll() {
    setSelected((current) => items.every((item) => current.includes(item.id)) ? [] : items.map((item) => item.id));
  }

  async function bulk(action: "archive" | "read" | "restore") {
    if (!salon || selected.length === 0) return;
    setBulkPending(true); setMessage("");
    const responses = await Promise.all(selected.map((id) => {
      if (action === "read") return fetch(`${api}/api/salons/${salon.id}/notifications/${id}/read`, { credentials: "include", method: "PATCH" });
      if (action === "restore") return fetch(`${api}/api/salons/${salon.id}/notifications/${id}/restore`, { credentials: "include", method: "PATCH" });
      return fetch(`${api}/api/salons/${salon.id}/notifications/${id}`, { credentials: "include", method: "DELETE" });
    }));
    const pendingBlocked = action === "archive" ? responses.filter((response) => response.status === 409).length : 0;
    const otherFailures = responses.filter((response) => !response.ok && response.status !== 409).length;
    setBulkPending(false);
    setSelected([]);
    if (pendingBlocked > 0) setMessage(`${pendingBlocked} notifiche non archiviate perché richiedono ancora un'azione.`);
    else if (otherFailures > 0) setMessage("Alcune notifiche non sono state aggiornate. Riprova.");
    await refreshAll();
  }

  const allSelected = items.length > 0 && items.every((item) => selected.includes(item.id));
  const categoryOptions = useMemo(() => {
    const keys = new Set(Object.keys(categoryLabels));
    items.forEach((item) => keys.add(item.category));
    return Array.from(keys);
  }, [items]);
  const groups = useMemo(() => {
    const order = ["Oggi", "Ieri", "Questa settimana", "Più vecchie"];
    const map = new Map<string, NotificationRow[]>();
    for (const item of items) {
      const label = groupLabel(item.created_at);
      map.set(label, [...(map.get(label) ?? []), item]);
    }
    return order.filter((label) => map.has(label)).map((label) => ({ items: map.get(label)!, label }));
  }, [items]);

  const globalActions = (
    <div className="flex flex-wrap gap-2">
      <Button disabled={summary.unread === 0} onClick={() => void markAllRead()} size="sm" variant="outline">Segna tutte lette</Button>
      <Button disabled={summary.total - summary.unread === 0} onClick={() => void archiveRead()} size="sm" variant="outline">Archivia lette</Button>
    </div>
  );

  return <AppPage maxWidth="max-w-[1400px]"><PageTransition>
    <PageHeader actions={globalActions} actionsAlign="right" eyebrow="Operatività" subtitle="Prenotazioni, magazzino, recensioni e staff, in un unico posto." title="Centro notifiche" />

    <StatGrid className="mb-5">
      <StatCard label="Totali" value={summary.total} />
      <StatCard label="Non lette" value={summary.unread} />
      <StatCard detail="da leggere" label="Alta priorità" value={summary.high_priority} />
      <StatCard label="Archiviate" value={summary.archived} />
    </StatGrid>

    <SectionCard>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[220px] flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <span className="sr-only">Cerca notifiche</span>
          <input className="w-full pl-9" onChange={(event) => setQuery(event.target.value)} placeholder="Cerca per cliente, servizio, prodotto…" type="search" value={query} />
        </label>
        <select aria-label="Categoria" className="min-h-11" onChange={(event) => setCategory(event.target.value)} value={category}>
          <option value="all">Tutte le categorie</option>
          {categoryOptions.map((key) => <option key={key} value={key}>{categoryLabels[key] ?? key}</option>)}
        </select>
        <div className="flex flex-wrap gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1">
          {statusTabs.map((tab) => (
            <button
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${status === tab.key ? "bg-white text-[#792f59] shadow-sm" : "text-stone-500 hover:text-stone-800"}`}
              key={tab.key}
              onClick={() => { setStatus(tab.key); setSelected([]); }}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ead1df] bg-[#fffafd] px-4 py-2.5 text-sm">
          <span><strong>{selected.length}</strong> selezionate</span>
          <div className="flex flex-wrap gap-2">
            {status === "archived"
              ? <Button disabled={bulkPending} onClick={() => void bulk("restore")} size="sm" variant="outline">Ripristina</Button>
              : <>
                  <Button disabled={bulkPending} onClick={() => void bulk("read")} size="sm" variant="outline">Segna lette</Button>
                  <Button disabled={bulkPending} onClick={() => void bulk("archive")} size="sm" variant="outline">Archivia</Button>
                </>}
            <Button onClick={() => setSelected([])} size="sm" variant="tableAction">Deseleziona</Button>
          </div>
        </div>
      )}

      {message && <p className="mb-4 rounded-xl bg-stone-100 p-3 text-sm font-semibold" role="status">{message}</p>}

      {loading ? <p className="py-10 text-center text-stone-500">Caricamento notifiche...</p> : items.length === 0 ? (
        <EmptyState description={status === "archived" ? "Le notifiche archiviate appariranno qui." : "Appuntamenti, recensioni, scorte e richieste appariranno qui."} title="Nessuna notifica" />
      ) : <>
        <label className="mb-3 flex items-center gap-2 text-xs font-bold text-stone-500">
          <input checked={allSelected} className="accent-[#792f59]" onChange={toggleSelectAll} type="checkbox" />
          Seleziona tutte
        </label>
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <h2 className="mb-2 text-[11px] font-black uppercase tracking-[.12em] text-stone-400">{group.label}</h2>
              <div className="space-y-2">
                {group.items.map((item) => {
                  const Icon = categoryIcons[item.category] ?? BellIcon;
                  return (
                    <article className={`flex items-start gap-3 rounded-xl border p-4 ${!item.read_at ? "border-[#d7a6c1] bg-[#fffafd]" : "border-stone-100 bg-white"}`} key={item.id}>
                      <input checked={selected.includes(item.id)} className="mt-1.5 accent-[#792f59]" onChange={() => toggleSelect(item.id)} type="checkbox" />
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f3e2eb] text-[#792f59]"><Icon className="size-4" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-bold text-stone-950">{item.title}</h3>
                          <div className="flex shrink-0 items-center gap-2">
                            {(item.priority === "high" || item.priority === "critical") && <StatusBadge status="waiting">{item.priority}</StatusBadge>}
                            <time className="text-xs text-stone-400" dateTime={item.created_at}>{formatWhen(item.created_at)}</time>
                          </div>
                        </div>
                        {item.body && <p className="mt-1 text-sm text-stone-500">{item.body}</p>}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-[.08em] text-stone-400">{categoryLabels[item.category] ?? item.category}</span>
                          {item.action_pending && <StatusBadge status="pending">Da completare</StatusBadge>}
                          {item.href && <Link className="rounded-lg bg-[#402334] px-3 py-1.5 text-xs font-bold text-white" href={item.href}>Apri</Link>}
                          {status !== "archived" && !item.read_at && <Button onClick={() => void markRead(item)} size="sm" variant="outline">Segna letta</Button>}
                          {status === "archived"
                            ? <Button onClick={() => void restore(item)} size="sm" variant="outline">Ripristina</Button>
                            : !item.action_pending && <Button onClick={() => void archive(item)} size="sm" variant="tableAction">Archivia</Button>}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </>}
    </SectionCard>
  </PageTransition></AppPage>;
}
