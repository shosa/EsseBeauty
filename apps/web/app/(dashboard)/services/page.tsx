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

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
const schema = z.object({ name: z.string().min(2), category: z.string().min(2), duration_minutes: z.number().min(5), price: z.number().min(0) });
type Form = z.infer<typeof schema>;
interface Service { id: string; name: string; category: string; durationMinutes: number; priceCents: number; active: boolean; }

function Row({ item, canEdit, onToggle }: { item: Service; canEdit: boolean; onToggle(): void }) {
  const sortable = useSortable({ id: item.id, disabled: !canEdit });
  return <article ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
    className="grid grid-cols-[32px_1fr_auto] items-center gap-3 border-b border-stone-100 px-4 py-4 last:border-0">
    <button className="cursor-grab text-stone-400" {...sortable.attributes} {...sortable.listeners} aria-label={`Sposta ${item.name}`}>⋮⋮</button>
    <div><h3 className="font-semibold text-stone-900">{item.name}</h3><p className="text-sm text-stone-500">{item.durationMinutes} min · {item.category}</p></div>
    <div className="flex items-center gap-3"><strong className="text-stone-800">{formatPrice(item.priceCents, "it-IT")}</strong>{canEdit && <Switch checked={item.active} onCheckedChange={onToggle} />}</div>
  </article>;
}

export default function ServicesPage() {
  const [items, setItems] = useState<Service[]>([]);
  const [open, setOpen] = useState(false);
  const { hasPermission, salon } = useAuth();
  const canEdit = hasPermission(PERMISSION_KEYS.SETTINGS_SERVICES);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });
  const load = () => salon ? fetch(`${api}/api/salons/${salon.id}/services`, { credentials: "include" }).then((r) => r.ok ? r.json() : []).then(setItems) : Promise.resolve();
  useEffect(() => { void load(); }, [salon?.id]);
  const grouped = Map.groupBy(items, (item) => item.category);
  async function drag(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const next = arrayMove(items, items.findIndex((i) => i.id === event.active.id), items.findIndex((i) => i.id === event.over!.id));
    setItems(next);
    await fetch(`${api}/api/salons/${salon?.id}/services/reorder`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ order: next.map((i, display_order) => ({ id: i.id, display_order })) }) });
  }
  const submit = handleSubmit(async (value) => {
    await fetch(`${api}/api/salons/${salon?.id}/services`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...value, price_cents: Math.round(value.price * 100) }) });
    reset(); setOpen(false); await load();
  });
  async function toggle(item: Service) {
    await fetch(`${api}/api/salons/${salon?.id}/services/${item.id}`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: !item.active }) });
    await load();
  }
  return <main className="min-h-screen bg-[#f7f5f2] p-5 md:p-10">
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 flex items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[.2em] text-rose-700">Catalogo</p><h1 className="text-3xl font-bold text-stone-950">Servizi</h1></div>
        {canEdit && <Button onClick={() => setOpen(true)}>Nuovo servizio</Button>}</header>
      <DndContext onDragEnd={drag}><SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className="space-y-6">{[...grouped].map(([category, services]) => <section key={category}><h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-stone-500">{category}</h2>
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">{services.map((item) => <Row key={item.id} item={item} canEdit={canEdit} onToggle={() => void toggle(item)} />)}</div></section>)}</div>
      </SortableContext></DndContext>
    </div>
    {open && <div className="fixed inset-0 grid place-items-center bg-black/35 p-4"><form onSubmit={submit} className="w-full max-w-lg space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
      <div className="flex justify-between"><h2 className="text-xl font-bold">Nuovo servizio</h2><button onClick={() => setOpen(false)} type="button">Chiudi</button></div>
      {(["name", "category", "duration_minutes", "price"] as const).map((field) => <label key={field} className="block text-sm font-medium capitalize">{field.replace("_", " ")}
        <input {...register(field, field === "name" || field === "category" ? {} : { valueAsNumber: true })} className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-3" type={field === "name" || field === "category" ? "text" : "number"} /></label>)}
      {Object.keys(errors).length > 0 && <p className="text-sm text-red-700">Controlla i campi inseriti.</p>}<Button type="submit" className="w-full">Salva servizio</Button>
    </form></div>}
  </main>;
}
