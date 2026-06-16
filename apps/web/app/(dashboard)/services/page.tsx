"use client";

import { useEffect, useState } from "react";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { formatPrice, PERMISSION_KEYS } from "@esse-beauty/shared";
import { Button, Switch } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";
import { GripIcon, ServicesIcon } from "../_components/Icons";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
const schema = z.object({
  category: z.string().min(2, "Inserisci una categoria."),
  description: z.string().optional(),
  duration_minutes: z.number().min(5, "La durata minima è 5 minuti."),
  name: z.string().min(2, "Inserisci un nome."),
  price: z.number().min(0, "Il prezzo non può essere negativo."),
});
type Form = z.infer<typeof schema>;
interface Service { active: boolean; category: string; description?: string; durationMinutes: number; id: string; name: string; priceCents: number; }

function Row({ item, canEdit, onDelete, onEdit, onToggle }: { item: Service; canEdit: boolean; onDelete(): void; onEdit(): void; onToggle(): void }) {
  const sortable = useSortable({ id: item.id, disabled: !canEdit });
  return <article ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }} className={`grid gap-3 border-b border-stone-100 px-4 py-4 last:border-0 md:grid-cols-[32px_1fr_auto] md:items-center ${item.active ? "" : "opacity-55"}`}>
    <button disabled={!canEdit} className="cursor-grab rounded-lg p-1 text-stone-400 hover:bg-stone-100 disabled:cursor-default" {...sortable.attributes} {...sortable.listeners} aria-label={`Sposta ${item.name}`}><GripIcon /></button>
    <button onClick={onEdit} disabled={!canEdit} className="text-left disabled:cursor-default"><h3 className="font-semibold text-stone-900">{item.name}</h3><p className="text-sm text-stone-500">{item.durationMinutes} min · {item.category}</p>{item.description && <p className="mt-1 line-clamp-1 text-xs text-stone-400">{item.description}</p>}</button>
    <div className="flex flex-wrap items-center justify-end gap-3"><strong className="text-stone-800">{formatPrice(item.priceCents, "it-IT")}</strong><button disabled={!canEdit} onClick={onEdit} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-bold text-[#792f59] disabled:opacity-40">Modifica</button><button disabled={!canEdit} onClick={onToggle} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-bold disabled:opacity-40">{item.active ? "Disattiva" : "Riattiva"}</button><button disabled={!canEdit} onClick={onDelete} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-40">Elimina</button><Switch checked={item.active} disabled={!canEdit} onCheckedChange={onToggle} /></div>
  </article>;
}

export default function ServicesPage() {
  const [items, setItems] = useState<Service[]>([]);
  const [editing, setEditing] = useState<Service | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { hasPermission, salon } = useAuth();
  const canEdit = hasPermission(PERMISSION_KEYS.SETTINGS_SERVICES);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  async function load() {
    if (!salon) return;
    setLoading(true);
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/services`, { credentials: "include" });
    if (!response.ok) {
      setItems([]);
      setError(response.status === 403 ? "Non hai il permesso di gestire i servizi." : "Impossibile caricare i servizi.");
      setLoading(false);
      return;
    }
    const data: unknown = await response.json();
    setItems(Array.isArray(data) ? data as Service[] : []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [salon?.id]);
  const grouped = Map.groupBy(items, (item) => item.category);

  function openCreate() {
    setEditing(null);
    reset({ category: "", description: "", duration_minutes: 30, name: "", price: 0 });
    setOpen(true);
  }

  function openEdit(item: Service) {
    setEditing(item);
    reset({ category: item.category, description: item.description ?? "", duration_minutes: item.durationMinutes, name: item.name, price: item.priceCents / 100 });
    setOpen(true);
  }

  async function drag(event: DragEndEvent) {
    if (!canEdit || !event.over || event.active.id === event.over.id || !salon) return;
    const next = arrayMove(items, items.findIndex((item) => item.id === event.active.id), items.findIndex((item) => item.id === event.over!.id));
    setItems(next);
    const response = await fetch(`${api}/api/salons/${salon.id}/services/reorder`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ order: next.map((item, display_order) => ({ id: item.id, display_order })) }) });
    if (!response.ok) {
      setError("Il nuovo ordinamento non è stato salvato.");
      await load();
    }
  }

  const submit = handleSubmit(async (value) => {
    if (!salon) return;
    setSaving(true);
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/services${editing ? `/${editing.id}` : ""}`, {
      method: editing ? "PATCH" : "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: value.name, category: value.category, description: value.description || undefined, duration_minutes: value.duration_minutes, price_cents: Math.round(value.price * 100) }),
    });
    setSaving(false);
    if (!response.ok) {
      setError("Il servizio non è stato salvato. Controlla i dati e riprova.");
      return;
    }
    setOpen(false);
    await load();
  });

  async function toggle(item: Service) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/services/${item.id}`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: !item.active }) });
    if (!response.ok) setError("Lo stato del servizio non è stato aggiornato.");
    await load();
  }

  async function remove(item: Service) {
    if (!salon || !window.confirm(`Eliminare il servizio "${item.name}"?`)) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/services/${item.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) setError("Il servizio non e stato eliminato.");
    await load();
  }

  return <main className="min-h-screen bg-[#f7f5f2] p-5 md:p-10"><div className="mx-auto max-w-5xl">
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[.2em] text-rose-700">Catalogo</p><h1 className="text-3xl font-bold text-stone-950">Servizi</h1><p className="mt-2 text-sm text-stone-500">Definisci durata, prezzo e disponibilità dei trattamenti.</p></div><Button disabled={!canEdit} onClick={openCreate} className="min-h-11 rounded-xl disabled:cursor-not-allowed disabled:opacity-45">Nuovo servizio</Button></header>
    {!canEdit && <p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Il tuo account può consultare il catalogo, ma non modificarlo.</p>}
    {error && <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {loading ? <div className="space-y-3">{[1,2,3].map((item) => <div key={item} className="h-20 animate-pulse rounded-2xl bg-white" />)}</div> : items.length === 0 ? <section className="grid min-h-80 place-items-center rounded-[2rem] border border-dashed border-stone-300 bg-white p-8 text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-rose-50 text-[#792f59]"><ServicesIcon /></span><h2 className="mt-5 text-xl font-bold">Nessun servizio configurato</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">Crea il primo trattamento. Servirà per calendario, prenotazioni online e report.</p><Button disabled={!canEdit} onClick={openCreate} className="mt-5 min-h-11 rounded-xl disabled:opacity-45">Crea il primo servizio</Button></div></section> :
      <DndContext onDragEnd={drag}><SortableContext items={items} strategy={verticalListSortingStrategy}><div className="space-y-6">{[...grouped].map(([category, services]) => <section key={category}><h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-stone-500">{category}</h2><div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">{services.map((item) => <Row key={item.id} item={item} canEdit={canEdit} onDelete={() => void remove(item)} onEdit={() => openEdit(item)} onToggle={() => void toggle(item)} />)}</div></section>)}</div></SortableContext></DndContext>}
  </div>
  {open && <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4"><form onSubmit={submit} className="w-full max-w-lg space-y-4 rounded-3xl bg-white p-6 shadow-2xl"><div className="flex justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-[#792f59]">{editing ? "Modifica" : "Nuovo"}</p><h2 className="text-xl font-bold">{editing ? editing.name : "Nuovo servizio"}</h2></div><button onClick={() => setOpen(false)} type="button">Chiudi</button></div>
    <label className="block text-sm font-medium">Nome<input {...register("name")} className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-3" /></label>
    <label className="block text-sm font-medium">Categoria<input {...register("category")} className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-3" /></label>
    <label className="block text-sm font-medium">Descrizione<textarea {...register("description")} rows={3} className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-3" /></label>
    <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-medium">Durata (minuti)<input {...register("duration_minutes", { valueAsNumber: true })} type="number" step="5" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-3" /></label><label className="block text-sm font-medium">Prezzo (€)<input {...register("price", { valueAsNumber: true })} type="number" step="0.01" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-3" /></label></div>
    {Object.values(errors)[0]?.message && <p className="text-sm text-red-700">{Object.values(errors)[0]?.message}</p>}<Button disabled={saving} type="submit" className="min-h-11 w-full rounded-xl">{saving ? "Salvataggio..." : "Salva servizio"}</Button>
  </form></div>}
  </main>;
}
