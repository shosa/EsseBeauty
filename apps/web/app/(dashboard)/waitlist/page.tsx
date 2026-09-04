"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppPage, Button, ConfirmDialog, PageHeader, PageTransition, SectionCard, StatusBadge } from "@esse-beauty/ui";
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

export default function WaitlistPage() {
  const { salon } = useAuth();
  const [items, setItems] = useState<Entry[]>([]);
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);

  const load = useCallback(async () => {
    if (!salon) return;
    setLoading(true); setMessage("");
    const query = new URLSearchParams();
    if (status) query.set("status", status);
    if (date) query.set("date", date);
    try {
      const response = await fetch(`${api}/api/salons/${salon.id}/waitlist?${query}`, { credentials: "include" });
      if (!response.ok) throw new Error();
      const data: Entry[] = await response.json();
      setItems(data);
      setSelected((current) => current.filter((id) => data.some((item) => item.id === id)));
    } catch { setMessage("Impossibile caricare la lista d’attesa. Riprova."); }
    finally { setLoading(false); }
  }, [date, salon, status]);
  useEffect(() => { void load(); }, [load]);

  async function remove() {
    const id = deleteId;
    if (!id) return;
    setPending(id); setMessage("");
    const response = await fetch(`${api}/api/salons/${salon?.id}/waitlist/${id}`, { method: "DELETE", credentials: "include" });
    setPending("");
    if (!response.ok) return setMessage("Eliminazione non riuscita. Riprova.");
    setDeleteId("");
    setMessage("Richiesta eliminata."); await load();
  }

  function toggleSelect(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]);
  }
  function toggleSelectAll() {
    setSelected((current) => items.every((item) => current.includes(item.id)) ? [] : items.map((item) => item.id));
  }
  async function removeSelected() {
    if (selected.length === 0) return;
    setBulkPending(true); setMessage("");
    const responses = await Promise.all(selected.map((id) => fetch(`${api}/api/salons/${salon?.id}/waitlist/${id}`, { method: "DELETE", credentials: "include" })));
    const failed = responses.filter((response) => !response.ok).length;
    setBulkPending(false);
    setBulkDeleteOpen(false);
    setSelected([]);
    setMessage(failed > 0 ? `${failed} richieste non eliminate. Riprova.` : "Richieste eliminate.");
    await load();
  }
  const counts = useMemo(() => Object.fromEntries(Object.keys(statusLabels).map((key) => [key, items.filter((item) => item.status === key).length])), [items]);
  const allSelected = items.length > 0 && items.every((item) => selected.includes(item.id));

  const actions = (item: Entry) => <div className="flex flex-wrap gap-2">{item.status !== "booked" && <Link className="inline-flex min-h-11 items-center rounded-xl bg-[#792f59] px-4 text-sm font-bold text-white" href={appointmentHref(item)}>Crea appuntamento</Link>}<Button disabled={pending === item.id} onClick={() => setDeleteId(item.id)} size="sm" variant="destructive">Elimina</Button></div>;

  return <AppPage maxWidth="max-w-[1600px]"><PageTransition>
    <PageHeader eyebrow="Disponibilità" title="Lista d’attesa" subtitle="Trasforma gli slot liberati in nuovi appuntamenti." />
    <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">{Object.entries(statusLabels).map(([key, label]) => <button key={key} className="min-h-20 rounded-2xl border border-stone-200 bg-white p-4 text-left" onClick={() => setStatus(status === key ? "" : key)}><span className="block text-2xl font-black">{counts[key] ?? 0}</span><span className="text-sm text-stone-600">{label}</span></button>)}</div>
    <SectionCard>
      <div className="mb-5 flex flex-wrap gap-3"><label className="text-sm font-bold">Stato<select className="ml-2 min-h-11" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tutti</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="text-sm font-bold">Data<input className="ml-2 min-h-11" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>{(status || date) && <Button onClick={() => { setStatus(""); setDate(""); }} size="sm" variant="tableAction">Azzera filtri</Button>}</div>
      {selected.length > 0 && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ead1df] bg-[#fffafd] px-4 py-2.5 text-sm"><span><strong>{selected.length}</strong> richieste selezionate</span><Button disabled={bulkPending} onClick={() => setBulkDeleteOpen(true)} size="sm" variant="destructive">Elimina selezionate</Button></div>}
      {message && <p className="mb-4 rounded-xl bg-stone-100 p-3 text-sm font-semibold" role="status">{message}</p>}
      {loading ? <p className="py-10 text-center text-stone-500">Caricamento richieste...</p> : items.length === 0 ? <p className="py-10 text-center text-stone-500">{status || date ? "Nessuna richiesta corrisponde ai filtri." : "Nessun cliente è attualmente in lista d’attesa."}</p> : <>
        <div className="space-y-3 md:hidden">{items.map((item) => <article className="rounded-2xl border border-stone-200 p-4" key={item.id}><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><input aria-label={`Seleziona ${item.customer_name}`} checked={selected.includes(item.id)} className="mt-1 accent-[#792f59]" onChange={() => toggleSelect(item.id)} type="checkbox" /><div><h2 className="font-black">{item.customer_name}</h2><p className="text-sm text-stone-600">{item.service_name}</p></div></div><StatusBadge status={item.status} /></div><p className="mt-3 text-sm"><b>{new Date(item.requested_date).toLocaleDateString("it-IT")}</b> · {preferenceLabels[item.time_preference]} · {item.staff_name ?? "Qualsiasi collaboratore"}</p><p className="my-3 text-sm">{item.customer_phone && <a className="mr-3 underline" href={`tel:${item.customer_phone}`}>{item.customer_phone}</a>}{item.customer_email && <a className="underline" href={`mailto:${item.customer_email}`}>{item.customer_email}</a>}</p>{actions(item)}</article>)}</div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-stone-950 text-white"><tr><th className="w-10 p-4"><input aria-label="Seleziona tutti" checked={allSelected} className="accent-[#792f59]" onChange={toggleSelectAll} type="checkbox" /></th>{["Cliente", "Servizio", "Giorno e fascia", "Staff", "Stato", "Azioni"].map((label) => <th className="p-4" key={label}>{label}</th>)}</tr></thead><tbody>{items.map((item) => <tr className="border-b border-stone-100" key={item.id}><td className="p-4"><input aria-label={`Seleziona ${item.customer_name}`} checked={selected.includes(item.id)} className="accent-[#792f59]" onChange={() => toggleSelect(item.id)} type="checkbox" /></td><td className="p-4"><b className="block">{item.customer_name}</b>{item.customer_phone && <a className="block underline" href={`tel:${item.customer_phone}`}>{item.customer_phone}</a>}{item.customer_email && <a className="block underline" href={`mailto:${item.customer_email}`}>{item.customer_email}</a>}</td><td>{item.service_name}</td><td>{new Date(item.requested_date).toLocaleDateString("it-IT")}<small className="block text-stone-500">{preferenceLabels[item.time_preference]}</small></td><td>{item.staff_name ?? "Qualsiasi"}</td><td><StatusBadge status={item.status} /></td><td>{actions(item)}</td></tr>)}</tbody></table></div>
      </>}
    </SectionCard>
    <ConfirmDialog open={Boolean(deleteId)} destructive title="Eliminare la richiesta?" description="La richiesta verrà rimossa definitivamente dalla lista d’attesa." confirmLabel="Elimina" onCancel={() => setDeleteId("")} onConfirm={() => void remove()} />
    <ConfirmDialog open={bulkDeleteOpen} destructive title="Eliminare le richieste selezionate?" description={`${selected.length} richieste verranno rimosse definitivamente dalla lista d’attesa.`} confirmLabel="Elimina" onCancel={() => setBulkDeleteOpen(false)} onConfirm={() => void removeSelected()} />
  </PageTransition></AppPage>;
}
