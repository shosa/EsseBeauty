"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { AppPage, Button, ConfirmDialog, EmptyState, InlineError, PageHeader, PageTransition, StatusBadge, TableSkeleton } from "@esse-beauty/ui";
import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
const preferenceLabels: Record<string, string> = { any: "Qualsiasi orario", morning: "Mattina", afternoon: "Pomeriggio", evening: "Sera" };
const statusLabels: Record<string, string> = { waiting: "In attesa", notified: "Notificati", booked: "Prenotati", expired: "Scaduti" };

interface Entry { created_at: string; customer_email?: string; customer_id: string; customer_name: string; customer_phone?: string; id: string; requested_date: string; service_id: string; service_name: string; staff_id?: string; staff_name?: string; status: string; time_preference: string }

function appointmentHref(item: Entry) {
  const date = item.requested_date.slice(0, 10);
  const hour = item.time_preference === "afternoon" ? "14:00" : item.time_preference === "evening" ? "18:00" : "09:00";
  const query = new URLSearchParams({ customerId: item.customer_id, serviceId: item.service_id, startsAt: `${date}T${hour}:00`, waitlistId: item.id });
  if (item.staff_id) query.set("staffId", item.staff_id);
  return `/calendar/appointments/new?${query}`;
}

function chipClass(active: boolean) {
  return `min-h-10 shrink-0 rounded-full border px-4 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#792f59] ${active ? "border-[#792f59] bg-[#792f59] text-white" : "border-stone-200 bg-white text-stone-600 hover:border-[#c78baa]"}`;
}

export default function WaitlistPage() {
  const { salon } = useAuth();
  const [items, setItems] = useState<Entry[]>([]);
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);

  const load = useCallback(async () => {
    if (!salon) return;
    setLoading(true); setError(""); setMessage("");
    const query = new URLSearchParams();
    if (date) query.set("date", date);
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/waitlist?${query}`, { credentials: "include" });
      if (!response.ok) throw new Error();
      const data: Entry[] = await response.json();
      setItems(data);
      setSelected((current) => current.filter((id) => data.some((item) => item.id === id)));
    } catch { setError("Impossibile caricare la lista d’attesa. Riprova."); }
    finally { setLoading(false); }
  }, [date, salon]);
  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => Object.fromEntries(Object.keys(statusLabels).map((key) => [key, items.filter((item) => item.status === key).length])), [items]);
  const visible = useMemo(() => status ? items.filter((item) => item.status === status) : items, [items, status]);
  const filtersActive = Boolean(status || date);

  function resetFilters() { setStatus(""); setDate(""); }

  async function remove() {
    const id = deleteId;
    if (!id) return;
    setPending(id); setMessage(""); setError("");
    const response = await fetch(`${api}/api/salons/${salon?.id}/waitlist/${id}`, { method: "DELETE", credentials: "include" });
    setPending("");
    if (!response.ok) return setError("Eliminazione non riuscita. Riprova.");
    setDeleteId("");
    setMessage("Richiesta eliminata."); await load();
  }

  function toggleSelect(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]);
  }
  function toggleSelectAll() {
    setSelected((current) => visible.every((item) => current.includes(item.id)) ? [] : visible.map((item) => item.id));
  }
  async function removeSelected() {
    if (selected.length === 0) return;
    setBulkPending(true); setMessage(""); setError("");
    const responses = await Promise.all(selected.map((id) => fetch(`${api}/api/salons/${salon?.id}/waitlist/${id}`, { method: "DELETE", credentials: "include" })));
    const failed = responses.filter((response) => !response.ok).length;
    setBulkPending(false);
    setBulkDeleteOpen(false);
    setSelected([]);
    if (failed > 0) setError(`${failed} richieste non eliminate. Riprova.`);
    else setMessage("Richieste eliminate.");
    await load();
  }
  const allSelected = visible.length > 0 && visible.every((item) => selected.includes(item.id));

  const actions = (item: Entry) => (
    <div className="flex flex-wrap gap-2">
      {item.status !== "booked" && (
        <Link className="inline-flex min-h-11 items-center rounded-xl border border-[#792f59] bg-[#792f59] px-4 text-sm font-bold text-white transition-colors hover:border-[#66264b] hover:bg-[#66264b] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20" href={appointmentHref(item)}>Crea appuntamento</Link>
      )}
      <Button disabled={pending === item.id} onClick={() => setDeleteId(item.id)} size="sm" variant="destructive">Elimina</Button>
    </div>
  );

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageTransition>
        <PageHeader eyebrow="Disponibilità" title="Lista d’attesa" subtitle="Trasforma gli slot liberati in nuovi appuntamenti." />

        <div className="esse-panel flex flex-wrap items-center gap-3 rounded-2xl border border-[#e8dfe4] bg-white p-3 shadow-[0_10px_30px_rgb(45_29_39_/_0.055)]">
          <div aria-label="Filtra per stato" className="flex flex-1 flex-wrap gap-2" role="group">
            <button aria-pressed={status === ""} className={chipClass(status === "")} onClick={() => setStatus("")} type="button">
              Tutte <span className={status === "" ? "text-white/70" : "text-stone-400"}>{items.length}</span>
            </button>
            {Object.entries(statusLabels).map(([key, label]) => (
              <button aria-pressed={status === key} className={chipClass(status === key)} key={key} onClick={() => setStatus(status === key ? "" : key)} type="button">
                {label} <span className={status === key ? "text-white/70" : "text-stone-400"}>{counts[key] ?? 0}</span>
              </button>
            ))}
          </div>
          <label className="w-[170px]">
            <span className="sr-only">Data richiesta</span>
            <input className="w-full" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
          </label>
          <Button disabled={!filtersActive} onClick={resetFilters} variant="outline">Azzera filtri</Button>
        </div>

        {selected.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ead1df] bg-[#fffafd] px-4 py-2.5 text-sm">
            <span><strong>{selected.length}</strong> richieste selezionate</span>
            <Button disabled={bulkPending} onClick={() => setBulkDeleteOpen(true)} size="sm" variant="destructive">Elimina selezionate</Button>
          </div>
        )}
        {error && <InlineError className="mt-5">{error}</InlineError>}
        {message && <p className="mt-5 rounded-xl bg-stone-100 p-3 text-sm font-semibold" role="status">{message}</p>}

        <section className="esse-panel mt-5 overflow-hidden rounded-2xl border border-[#e8dfe4] bg-white shadow-[0_10px_30px_rgb(45_29_39_/_0.055)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
            <div>
              <h2 className="font-bold text-stone-950">Richieste</h2>
              <p className="mt-1 text-xs text-stone-500">{visible.length} {visible.length === 1 ? "richiesta" : "richieste"}</p>
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={6} />
          ) : visible.length === 0 ? (
            <div className="p-6">
              <EmptyState
                action={filtersActive ? <Button onClick={resetFilters} variant="outline">Rimuovi filtri</Button> : undefined}
                description={filtersActive ? "Prova a cambiare filtro o data." : "I clienti che si iscrivono alla lista d’attesa compariranno qui."}
                title={filtersActive ? "Nessuna richiesta corrisponde ai filtri" : "Nessun cliente è in lista d’attesa"}
              />
            </div>
          ) : (
            <>
              <div className="space-y-3 p-4 md:hidden">
                {visible.map((item) => (
                  <article className="esse-panel rounded-2xl border border-stone-200 bg-white p-4" key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <input aria-label={`Seleziona ${item.customer_name}`} checked={selected.includes(item.id)} className="mt-1 accent-[#792f59]" onChange={() => toggleSelect(item.id)} type="checkbox" />
                        <div>
                          <h3 className="font-black text-stone-950">{item.customer_name}</h3>
                          <p className="text-sm text-stone-600">{item.service_name}</p>
                        </div>
                      </div>
                      <StatusBadge status={item.status}>{statusLabels[item.status] ?? item.status}</StatusBadge>
                    </div>
                    <p className="mt-3 text-sm text-stone-700"><b className="text-stone-950">{new Date(item.requested_date).toLocaleDateString("it-IT")}</b> · {preferenceLabels[item.time_preference]} · {item.staff_name ?? "Qualsiasi collaboratore"}</p>
                    <p className="my-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {item.customer_phone && <a className="flex items-center gap-1.5 text-stone-600 underline decoration-stone-300 underline-offset-2" href={`tel:${item.customer_phone}`}><Phone aria-hidden="true" className="size-3.5 text-stone-400" />{item.customer_phone}</a>}
                      {item.customer_email && <a className="flex items-center gap-1.5 text-stone-600 underline decoration-stone-300 underline-offset-2" href={`mailto:${item.customer_email}`}><Mail aria-hidden="true" className="size-3.5 text-stone-400" />{item.customer_email}</a>}
                    </p>
                    {actions(item)}
                  </article>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-[#faf7f9] text-[10px] font-black uppercase tracking-[.14em] text-stone-500">
                    <tr>
                      <th className="w-10 px-5 py-3"><input aria-label="Seleziona tutti" checked={allSelected} className="accent-[#792f59]" onChange={toggleSelectAll} type="checkbox" /></th>
                      {["Cliente", "Servizio", "Giorno e fascia", "Staff", "Stato", "Azioni"].map((label) => <th className="px-4 py-3" key={label}>{label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((item) => (
                      <tr className="border-t border-stone-100 transition hover:bg-[#fffafd]" key={item.id}>
                        <td className="px-5 py-3.5"><input aria-label={`Seleziona ${item.customer_name}`} checked={selected.includes(item.id)} className="accent-[#792f59]" onChange={() => toggleSelect(item.id)} type="checkbox" /></td>
                        <td className="px-4 py-3.5">
                          <b className="block text-stone-950">{item.customer_name}</b>
                          {item.customer_phone && <a className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-500 underline decoration-stone-300 underline-offset-2" href={`tel:${item.customer_phone}`}><Phone aria-hidden="true" className="size-3 shrink-0 text-stone-400" />{item.customer_phone}</a>}
                          {item.customer_email && <a className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-stone-500 underline decoration-stone-300 underline-offset-2" href={`mailto:${item.customer_email}`}><Mail aria-hidden="true" className="size-3 shrink-0 text-stone-400" /><span className="truncate">{item.customer_email}</span></a>}
                        </td>
                        <td className="px-4 py-3.5 text-stone-700">{item.service_name}</td>
                        <td className="px-4 py-3.5 font-semibold text-stone-700">
                          {new Date(item.requested_date).toLocaleDateString("it-IT")}
                          <small className="block font-normal text-stone-500">{preferenceLabels[item.time_preference]}</small>
                        </td>
                        <td className="px-4 py-3.5 text-stone-700">{item.staff_name ?? "Qualsiasi"}</td>
                        <td className="px-4 py-3.5"><StatusBadge status={item.status}>{statusLabels[item.status] ?? item.status}</StatusBadge></td>
                        <td className="px-4 py-3.5">{actions(item)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </PageTransition>

      <ConfirmDialog confirmLabel="Elimina" description="La richiesta verrà rimossa definitivamente dalla lista d’attesa." destructive onCancel={() => setDeleteId("")} onConfirm={() => void remove()} open={Boolean(deleteId)} title="Eliminare la richiesta?" />
      <ConfirmDialog confirmLabel="Elimina" description={`${selected.length} richieste verranno rimosse definitivamente dalla lista d’attesa.`} destructive onCancel={() => setBulkDeleteOpen(false)} onConfirm={() => void removeSelected()} open={bulkDeleteOpen} title="Eliminare le richieste selezionate?" />
    </AppPage>
  );
}
