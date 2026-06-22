"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppPage, Button, EmptyState, InlineError, PageHeader, PageTransition, SectionCard, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
type CustomerStatus = "all" | "active" | "blocked";

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

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function paginationPages(current: number, total: number) {
  const candidates = [1, current - 1, current, current + 1, total];
  return [...new Set(candidates.filter((page) => page >= 1 && page <= total))].sort((a, b) => a - b);
}

export default function ClientsPage() {
  const { salon } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState<CustomerStatus>("all");
  const [page, setPage] = useState(1);
  const [tags, setTags] = useState<string[]>([]);
  const [data, setData] = useState<CustomerList>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [query, status, tag]);

  useEffect(() => {
    if (!salon) return;
    void fetch(`${api}/api/salons/${salon.id}/customers/tags`, { credentials: "include" })
      .then((response) => response.ok ? response.json() : [])
      .then(setTags);
  }, [salon?.id]);

  useEffect(() => {
    if (!salon) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    if (query) params.set("search", query);
    if (tag) params.set("tag", tag);
    if (status !== "all") params.set("blocked", String(status === "blocked"));
    setLoading(true);
    setError("");
    void fetch(`${api}/api/salons/${salon.id}/customers?${params}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Impossibile caricare la rubrica clienti.");
        setData(await response.json() as CustomerList);
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(reason instanceof Error ? reason.message : "Errore inatteso.");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [page, query, salon?.id, status, tag]);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.page_size ?? 20)));
  const pages = useMemo(() => paginationPages(page, totalPages), [page, totalPages]);
  const from = data?.total ? (page - 1) * data.page_size + 1 : 0;
  const to = Math.min(page * (data?.page_size ?? 20), data?.total ?? 0);
  const filtersActive = Boolean(query || tag || status !== "all");

  function resetFilters() {
    setSearch("");
    setQuery("");
    setTag("");
    setStatus("all");
    setPage(1);
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageTransition>
        <PageHeader
          actions={<Link className="inline-flex min-h-11 items-center rounded-xl bg-[#7b3159] px-4 py-3 text-sm font-bold text-white shadow-sm" href="/clients/new">Nuovo cliente</Link>}
          eyebrow="CRM"
          subtitle="Ricerca, segmenta e consulta rapidamente l’intera anagrafica del salone."
          title="Clienti"
        />

        <SectionCard
          actions={<span className="text-sm font-bold text-stone-500">{data?.total ?? 0} risultati</span>}
          subtitle="Cerca per nome, telefono o email e restringi la rubrica con stato e tag."
          title="Rubrica clienti"
        >
          <div className="grid gap-3 xl:grid-cols-[minmax(320px,1fr)_220px_220px_auto]">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-stone-600">Cerca cliente</span>
              <div className="relative">
                <svg aria-hidden="true" className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-stone-400" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
                <input className="w-full" onChange={(event) => setSearch(event.target.value)} placeholder="Nome, telefono o email" style={{ paddingLeft: "2.75rem" }} value={search} />
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-stone-600">Stato anagrafica</span>
              <select className="w-full" onChange={(event) => setStatus(event.target.value as CustomerStatus)} value={status}>
                <option value="all">Tutti i clienti</option>
                <option value="active">Solo attivi</option>
                <option value="blocked">Solo bloccati</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-stone-600">Segmento</span>
              <select className="w-full" onChange={(event) => setTag(event.target.value)} value={tag}>
                <option value="">Tutti i tag</option>
                {tags.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <div className="flex items-end">
              <Button className="w-full" disabled={!filtersActive} onClick={resetFilters} variant="outline">Azzera filtri</Button>
            </div>
          </div>
        </SectionCard>

        {error && <InlineError className="mt-5">{error}</InlineError>}

        <section className="mt-5 overflow-hidden rounded-2xl border border-[#e8dfe4] bg-white shadow-[0_10px_30px_rgb(45_29_39_/_0.055)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
            <div>
              <h2 className="font-bold text-stone-950">Anagrafica</h2>
              <p className="mt-1 text-xs text-stone-500">{from}–{to} di {data?.total ?? 0} clienti</p>
            </div>
            <p className="text-xs font-semibold text-stone-400">Pagina {page} di {totalPages}</p>
          </div>

          {loading ? (
            <div className="space-y-3 p-5">{Array.from({ length: 8 }, (_, index) => <div className="h-16 animate-pulse rounded-xl bg-stone-100" key={index} />)}</div>
          ) : data?.items.length === 0 ? (
            <div className="p-6"><EmptyState action={filtersActive ? <Button onClick={resetFilters} variant="outline">Rimuovi filtri</Button> : undefined} description="Modifica la ricerca oppure crea una nuova anagrafica." title="Nessun cliente trovato" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.14em] text-stone-500">
                  <tr><th className="px-5 py-3">Cliente</th><th>Contatti</th><th>Segmenti</th><th>Ultima visita</th><th className="text-center">Appuntamenti</th><th className="pr-5 text-center">Punti</th></tr>
                </thead>
                <tbody>
                  {data?.items.map((customer) => (
                    <tr
                      className="group cursor-pointer border-t border-stone-100 transition hover:bg-[#fffafd] focus-visible:bg-[#fffafd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#b85888]"
                      key={customer.id}
                      onClick={() => router.push(`/clients/${customer.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(`/clients/${customer.id}`);
                        }
                      }}
                      tabIndex={0}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f3e2eb] text-xs font-black text-[#792f59]">{initials(customer.full_name)}</span>
                          <span className="min-w-0"><strong className="block truncate text-stone-950 group-hover:text-[#792f59]">{customer.full_name}</strong>{customer.blocked && <span className="mt-1 inline-block"><StatusBadge status="cancelled">Bloccato</StatusBadge></span>}</span>
                        </div>
                      </td>
                      <td className="max-w-64 text-stone-600"><span className="block truncate">{customer.email ?? "Nessuna email"}</span><span className="mt-0.5 block text-xs text-stone-400">{customer.phone ?? "Nessun telefono"}</span></td>
                      <td><div className="flex max-w-56 flex-wrap gap-1">{customer.tags.slice(0, 3).map((item) => <span className="rounded-full bg-[#f8edf3] px-2 py-1 text-[11px] font-semibold text-[#792f59]" key={item}>{item}</span>)}{customer.tags.length > 3 && <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] font-bold text-stone-500">+{customer.tags.length - 3}</span>}</div></td>
                      <td><span className="font-semibold text-stone-700">{customer.last_visit ? new Date(customer.last_visit).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }) : "Mai"}</span></td>
                      <td className="text-center"><span className="inline-flex min-w-10 justify-center rounded-lg bg-blue-50 px-2 py-1 font-black text-blue-800">{customer.total_appointments}</span></td>
                      <td className="pr-5 text-center"><span className="inline-flex min-w-12 justify-center rounded-lg bg-amber-50 px-2 py-1 font-black text-amber-800">{customer.loyalty_points}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && (data?.total ?? 0) > 0 && (
            <nav aria-label="Paginazione clienti" className="flex flex-wrap items-center justify-between gap-4 border-t border-stone-100 bg-[#fcfafb] px-5 py-4">
              <p className="text-xs font-semibold text-stone-500">Visualizzati {from}–{to} di {data?.total ?? 0}</p>
              <div className="flex items-center gap-1">
                <Button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} size="sm" variant="outline">Precedente</Button>
                {pages.map((item, index) => {
                  const previous = pages[index - 1];
                  return <span className="contents" key={item}>{previous && item - previous > 1 && <span className="px-1 text-stone-400">…</span>}<button aria-current={item === page ? "page" : undefined} className={`grid size-9 place-items-center rounded-lg text-sm font-black ${item === page ? "bg-[#792f59] text-white" : "text-stone-600 hover:bg-[#f3e2eb]"}`} onClick={() => setPage(item)} type="button">{item}</button></span>;
                })}
                <Button disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} size="sm" variant="outline">Successiva</Button>
              </div>
            </nav>
          )}
        </section>
      </PageTransition>
    </AppPage>
  );
}
