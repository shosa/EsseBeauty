"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Mail, MessageCircle, Phone, Plus, Search, Tag, X } from "lucide-react";
import { AppPage, Button, Dialog, EmptyState, FormField, InlineError, PageHeader, PageTransition, StatusBadge, Switch } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
type CustomerStatus = "all" | "active" | "blocked";

interface Customer {
  blocked: boolean;
  email: string | null;
  first_name: string;
  full_name: string;
  has_account: boolean;
  id: string;
  last_name: string;
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

const avatarPalette = ["#b8578a", "#8f3a68", "#57534e", "#c98a3f", "#3f7d6f", "#7a4fa0"];

function avatarColor(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return avatarPalette[hash % avatarPalette.length];
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function customerName(customer: Pick<Customer, "first_name" | "last_name" | "full_name">) {
  return [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.full_name;
}

function paginationPages(current: number, total: number) {
  const candidates = [1, current - 1, current, current + 1, total];
  return [...new Set(candidates.filter((page) => page >= 1 && page <= total))].sort((a, b) => a - b);
}

export default function ClientsPage() {
  const { salon } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState<CustomerStatus>("all");
  const [page, setPage] = useState(1);
  const [tags, setTags] = useState<string[]>([]);
  const [data, setData] = useState<CustomerList>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [whatsAppConsent, setWhatsAppConsent] = useState(false);
  const [consentSource, setConsentSource] = useState("in_person");
  const [consentNote, setConsentNote] = useState("");

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setNewOpen(true);
      router.replace("/clients");
    }
  }, [router, searchParams]);

  function closeNewClient() {
    setNewOpen(false);
    setCreateError("");
    setNewTags([]);
    setNewTagInput("");
    setWhatsAppConsent(false);
    setConsentSource("in_person");
    setConsentNote("");
  }

  function addNewTag() {
    const value = newTagInput.trim();
    if (!value) return;
    setNewTags((current) => current.some((item) => item.toLocaleLowerCase("it-IT") === value.toLocaleLowerCase("it-IT")) ? current : [...current, value]);
    setNewTagInput("");
  }

  async function createCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!salon || creating) return;
    const formData = new FormData(event.currentTarget);
    const phone = String(formData.get("phone") ?? "").trim();
    if (whatsAppConsent && !phone) {
      setCreateError("Inserisci il numero di telefono per concedere il consenso WhatsApp.");
      return;
    }
    setCreating(true);
    setCreateError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/customers`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        first_name: formData.get("first_name"),
        last_name: formData.get("last_name"),
        email: formData.get("email") || undefined,
        phone: phone || undefined,
        notes: formData.get("notes") || undefined,
        tags: newTags,
      }),
    });
    if (!response.ok) {
      setCreateError("Impossibile creare il cliente.");
      setCreating(false);
      return;
    }
    const customer = (await response.json()) as { id: string };
    if (whatsAppConsent) {
      const consentResponse = await fetch(`${api}/api/salons/${salon.id}/customers/${customer.id}/communication-consents/whatsapp-marketing`, {
        body: JSON.stringify({ evidence_note: consentNote, source: consentSource, status: "granted" }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "PUT",
      });
      if (!consentResponse.ok) {
        setCreateError("Cliente creato, ma il consenso WhatsApp non è stato registrato. Apri la scheda per riprovare.");
        setCreating(false);
        router.push(`/clients/${customer.id}`);
        return;
      }
    }
    router.push(`/clients/${customer.id}`);
  }

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
          actions={<Button onClick={() => setNewOpen(true)} variant="primary"><Plus aria-hidden="true" className="size-4" />Nuovo cliente</Button>}
          eyebrow="Clienti"
          subtitle="Cerca, segmenta e apri rapidamente la scheda di ogni cliente del salone."
          title="Rubrica"
        />

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#e8dfe4] bg-white p-3 shadow-[0_10px_30px_rgb(45_29_39_/_0.055)]">
          <label className="relative min-w-[240px] flex-1">
            <span className="sr-only">Cerca cliente</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input className="w-full pl-10" onChange={(event) => setSearch(event.target.value)} placeholder="Nome, telefono o email…" value={search} />
          </label>
          <label className="w-[180px]">
            <span className="sr-only">Stato anagrafica</span>
            <select className="w-full" onChange={(event) => setStatus(event.target.value as CustomerStatus)} value={status}>
              <option value="all">Tutti i clienti</option>
              <option value="active">Solo attivi</option>
              <option value="blocked">Solo bloccati</option>
            </select>
          </label>
          <label className="w-[180px]">
            <span className="sr-only">Segmento</span>
            <select className="w-full" onChange={(event) => setTag(event.target.value)} value={tag}>
              <option value="">Tutti i segmenti</option>
              {tags.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <Button disabled={!filtersActive} onClick={resetFilters} variant="outline">Azzera filtri</Button>
        </div>

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
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.14em] text-stone-500">
                  <tr><th className="px-5 py-3">Cliente</th><th>Contatti</th><th>Segmenti</th><th>Ultima visita</th><th className="w-12 pr-5" /></tr>
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
                          <span className="grid size-10 shrink-0 place-items-center rounded-full text-xs font-black text-white" style={{ background: avatarColor(customer.id) }}>{initials(customerName(customer))}</span>
                          <span className="min-w-0">
                            <strong className="block truncate text-stone-950 group-hover:text-[#792f59]">{customerName(customer)}</strong>
                            <span className="mt-1 flex flex-wrap gap-1.5">
                              {customer.has_account && <StatusBadge status="active">App</StatusBadge>}
                              {customer.blocked && <StatusBadge status="cancelled">Bloccato</StatusBadge>}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="max-w-64 text-stone-600">
                        <span className={`flex items-center gap-1.5 font-semibold ${customer.phone ? "text-stone-700" : "text-stone-400"}`}><Phone aria-hidden="true" className="size-3.5 shrink-0 text-stone-400" />{customer.phone ?? "Nessun numero"}</span>
                        <span className={`mt-0.5 flex items-center gap-1.5 truncate text-xs ${customer.email ? "text-stone-500" : "text-stone-400"}`}><Mail aria-hidden="true" className="size-3.5 shrink-0 text-stone-400" /><span className="truncate">{customer.email ?? "Nessuna email"}</span></span>
                      </td>
                      <td><div className="flex max-w-56 flex-wrap gap-1">{customer.tags.slice(0, 3).map((item) => <span className="rounded-full bg-[#f8edf3] px-2 py-1 text-[11px] font-semibold text-[#792f59]" key={item}>{item}</span>)}{customer.tags.length > 3 && <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] font-bold text-stone-500">+{customer.tags.length - 3}</span>}</div></td>
                      <td><span className="font-semibold text-stone-700">{customer.last_visit ? new Date(customer.last_visit).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }) : "Mai"}</span></td>
                      <td className="pr-5 text-right"><ChevronRight aria-hidden="true" className="inline-block size-4 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-[#792f59]" /></td>
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

      <Dialog onClose={closeNewClient} open={newOpen} title="Nuovo cliente">
        <form className="grid gap-4" onSubmit={(event) => void createCustomer(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nome" required><input autoComplete="given-name" name="first_name" required className="w-full" /></FormField>
            <FormField label="Cognome" required><input autoComplete="family-name" name="last_name" required className="w-full" /></FormField>
            <FormField label="Email"><input name="email" type="email" className="w-full" /></FormField>
            <FormField label="Telefono"><input name="phone" className="w-full" /></FormField>
          </div>
          <FormField label="Segmenti" description="Digita un nome e premi Invio per crearne uno nuovo.">
            <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 focus-within:border-[#792f59]">
              {newTags.map((item) => (
                <span className="inline-flex items-center gap-1 rounded-lg bg-[#f4e4ec] px-2.5 py-1.5 text-xs font-bold text-[#682849]" key={item}>
                  <Tag aria-hidden="true" size={13} />{item}
                  <button aria-label={`Rimuovi segmento ${item}`} className="ml-1 text-[#7b3159] hover:text-red-700" onClick={() => setNewTags((current) => current.filter((tagItem) => tagItem !== item))} type="button"><X aria-hidden="true" size={13} /></button>
                </span>
              ))}
              <input
                className="min-w-40 flex-1 border-0 px-1 py-1.5 text-sm outline-none"
                onChange={(event) => setNewTagInput(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addNewTag(); } }}
                placeholder={newTags.length ? "Aggiungi un altro segmento" : "Scrivi un segmento e premi Invio"}
                value={newTagInput}
              />
            </div>
          </FormField>
          <FormField label="Note interne"><textarea name="notes" rows={3} className="w-full" /></FormField>

          <div className="overflow-hidden rounded-xl border border-emerald-100">
            <div className="flex items-center justify-between gap-4 bg-emerald-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-600 text-white"><MessageCircle aria-hidden="true" size={18} /></span>
                <div><h3 className="text-sm font-bold">Consenso marketing WhatsApp</h3><p className="text-xs text-stone-600">Richiede un numero di telefono valido.</p></div>
              </div>
              <Switch aria-label="Consenso marketing WhatsApp" checked={whatsAppConsent} onCheckedChange={setWhatsAppConsent} />
            </div>
            {whatsAppConsent && (
              <div className="grid gap-4 border-t border-emerald-100 p-4 sm:grid-cols-2">
                <FormField label="Fonte di acquisizione">
                  <select onChange={(event) => setConsentSource(event.target.value)} value={consentSource} className="w-full">
                    <option value="in_person">Acquisito in salone</option>
                    <option value="customer_request">Richiesta del cliente</option>
                    <option value="web_form">Modulo online</option>
                    <option value="import_verified">Importazione verificata</option>
                    <option value="manual_admin">Inserimento amministrativo</option>
                  </select>
                </FormField>
                <FormField label="Nota o evidenza"><textarea onChange={(event) => setConsentNote(event.target.value)} placeholder="Es. consenso espresso in reception" rows={2} value={consentNote} className="w-full" /></FormField>
              </div>
            )}
          </div>

          {createError && <InlineError>{createError}</InlineError>}

          <div className="flex justify-end gap-3 border-t border-stone-100 pt-4">
            <Button disabled={creating} onClick={closeNewClient} type="button" variant="ghost">Annulla</Button>
            <Button disabled={creating} type="submit" variant="primary">{creating ? "Creazione…" : "Crea cliente"}</Button>
          </div>
        </form>
      </Dialog>
    </AppPage>
  );
}
