"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppPage, Button, ConfirmDialog, PageHeader, PageTransition, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Customer {
  blocked: boolean;
  email: string | null;
  full_name: string;
  id: string;
  last_visit: string | null;
  loyalty_points: number;
  phone: string | null;
  tags: string[];
  total_appointments: number;
}

interface CustomerList {
  items: Customer[];
  page: number;
  page_size: number;
  total: number;
}

export default function ClientsPage() {
  const { salon } = useAuth();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [data, setData] = useState<CustomerList>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Customer>();

  useEffect(() => {
    const timeout = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!salon) return;
    void fetch(`${api}/api/salons/${salon.id}/customers/tags`, {
      credentials: "include",
    })
      .then((response) => (response.ok ? response.json() : []))
      .then(setTags);
  }, [salon]);

  useEffect(() => {
    if (!salon) return;
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (query) params.set("search", query);
    if (tag) params.set("tag", tag);
    if (blocked) params.set("blocked", "true");
    setLoading(true);
    setError("");
    void fetch(`${api}/api/salons/${salon.id}/customers?${params}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Impossibile caricare i clienti.");
        setData((await response.json()) as CustomerList);
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(reason instanceof Error ? reason.message : "Errore inatteso.");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [blocked, query, salon, tag]);

  async function remove() {
    if (!salon || !pendingDelete) return;
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/customers/${pendingDelete.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      setError(response.status === 409 ? "Il cliente ha appuntamenti collegati: non puo essere eliminato." : "Il cliente non e stato eliminato.");
      return;
    }
    setData((current) => current ? {
      ...current,
      items: current.items.filter((item) => item.id !== pendingDelete.id),
      total: Math.max(0, current.total - 1),
    } : current);
    setPendingDelete(undefined);
  }

  return (
    <AppPage maxWidth="max-w-7xl">
      <PageTransition>
        <PageHeader
          eyebrow="CRM"
          title="Clienti"
          subtitle={`${data?.total ?? 0} profili nel salone`}
          actions={<Link href="/clients/new" className="rounded-xl bg-[#7b3159] px-4 py-3 text-sm font-bold text-white">Nuovo cliente</Link>}
        />

        <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cerca per nome, email o telefono"
              className="rounded-xl border border-stone-200 px-4 py-3 outline-none focus:border-[#7b3159]"
            />
            <label className="flex items-center gap-2 rounded-xl bg-stone-50 px-4 py-3 text-sm font-medium">
              <input type="checkbox" checked={blocked} onChange={(event) => setBlocked(event.target.checked)} />
              Solo bloccati
            </label>
          </div>
          {tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => setTag("")} className={`rounded-full px-3 py-1.5 text-xs font-bold ${tag === "" ? "bg-stone-900 text-white" : "bg-stone-100"}`}>Tutti</button>
              {tags.map((item) => (
                <button key={item} onClick={() => setTag(item)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${tag === item ? "bg-[#7b3159] text-white" : "bg-rose-50 text-[#7b3159]"}`}>
                  {item}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          {loading ? (
            <div className="space-y-3 p-5">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-stone-100" />)}</div>
          ) : error ? (
            <p className="p-8 text-center text-sm text-red-700">{error}</p>
          ) : data?.items.length === 0 ? (
            <div className="p-12 text-center"><h2 className="font-bold">Nessun cliente trovato</h2><p className="mt-2 text-sm text-stone-500">Modifica i filtri oppure crea il primo profilo.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500"><tr><th className="p-4">Cliente</th><th>Contatti</th><th>Tag</th><th>Ultima visita</th><th>Appuntamenti</th><th>Punti</th><th>Azioni</th></tr></thead>
                <tbody>
                  {data?.items.map((customer) => (
                    <tr key={customer.id} className="border-t border-stone-100 hover:bg-stone-50">
                      <td className="p-4"><Link href={`/clients/${customer.id}`} className="font-bold text-stone-900 hover:text-[#7b3159]">{customer.full_name}</Link>{customer.blocked && <span className="ml-2"><StatusBadge status="cancelled">Bloccato</StatusBadge></span>}</td>
                      <td className="text-stone-600"><span className="block">{customer.email ?? "-"}</span><span className="text-xs">{customer.phone ?? "-"}</span></td>
                      <td><div className="flex max-w-56 flex-wrap gap-1">{customer.tags.map((item) => <span key={item} className="rounded-full bg-rose-50 px-2 py-1 text-xs text-[#7b3159]">{item}</span>)}</div></td>
                      <td>{customer.last_visit ? new Date(customer.last_visit).toLocaleDateString("it-IT") : "-"}</td>
                      <td>{customer.total_appointments}</td>
                      <td>{customer.loyalty_points}</td>
                      <td><Button onClick={() => setPendingDelete(customer)} size="sm" variant="destructive">Elimina</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </PageTransition>
      <ConfirmDialog
        confirmLabel="Elimina"
        destructive
        description="Il cliente verra rimosso se non ha appuntamenti collegati."
        onCancel={() => setPendingDelete(undefined)}
        onConfirm={() => void remove()}
        open={Boolean(pendingDelete)}
        title={`Eliminare ${pendingDelete?.full_name ?? "cliente"}?`}
      />
    </AppPage>
  );
}
