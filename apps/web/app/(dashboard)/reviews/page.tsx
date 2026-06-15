"use client";

import { useEffect, useMemo, useState } from "react";
import { PERMISSION_KEYS } from "@esse-beauty/shared";
import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
interface Review { id: string; rating: number; comment?: string; reply?: string; published: boolean; created_at: string; customer_name: string; }

export default function ReviewsPage() {
  const { hasPermission, salon } = useAuth();
  const [items, setItems] = useState<Review[]>([]);
  const [selected, setSelected] = useState<Review>();
  const [reply, setReply] = useState("");
  const load = () => salon ? fetch(`${api}/api/salons/${salon.id}/reviews`, { credentials: "include" }).then((response) => response.json()).then(setItems) : Promise.resolve();
  useEffect(() => { void load(); }, [salon]);
  const average = useMemo(() => items.length ? items.reduce((sum, item) => sum + item.rating, 0) / items.length : 0, [items]);
  async function saveReply() { await fetch(`${api}/api/salons/${salon?.id}/reviews/${selected?.id}/reply`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ reply }) }); setSelected(undefined); await load(); }
  async function setPublished(item: Review, published: boolean) {
    await fetch(`${api}/api/salons/${salon?.id}/reviews/${item.id}/publish`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ published }) });
    await load();
  }

  return <main className="min-h-screen bg-[#f6f2f4] p-5 md:p-10"><div className="mx-auto max-w-6xl"><header><p className="text-xs font-bold uppercase tracking-[.2em] text-[#792f59]">Voce dei clienti</p><h1 className="mt-2 text-3xl font-bold">Recensioni</h1></header>
    <section className="mt-7 grid gap-4 md:grid-cols-[1.1fr_2fr]"><article className="rounded-[2rem] bg-[#402334] p-7 text-white"><strong className="text-6xl">{average.toFixed(1)}</strong><p className="mt-2 text-[#e8b9d3]">media su {items.length} recensioni</p></article><article className="grid grid-cols-5 gap-2 rounded-[2rem] bg-white p-6">{[5,4,3,2,1].map((star) => <div key={star} className="text-center"><b>{star}★</b><div className="mt-2 h-24 rounded-full bg-stone-100 p-1"><div className="mt-auto rounded-full bg-[#a33d72]" style={{ height: `${items.length ? items.filter((item) => item.rating === star).length / items.length * 100 : 0}%` }} /></div></div>)}</article></section>
    <section className="mt-6 space-y-3">{items.length === 0 && <div className="rounded-[2rem] border border-dashed border-stone-300 bg-white p-10 text-center"><h2 className="text-xl font-bold">Nessuna recensione</h2><p className="mt-2 text-sm text-stone-500">Le recensioni compariranno dopo gli appuntamenti completati.</p></div>}{items.map((item) => <article key={item.id} className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-[#a33d72]">{"★".repeat(item.rating)}<span className="text-stone-200">{"★".repeat(5-item.rating)}</span></p><h2 className="mt-1 font-bold">{item.customer_name}</h2></div><span className={`h-fit rounded-full px-3 py-1 text-xs ${item.published ? "bg-emerald-50 text-emerald-700" : "bg-stone-100"}`}>{item.published ? "Pubblicata" : "Privata"}</span></div><p className="mt-3 text-stone-600">{item.comment || "Nessun commento."}</p>{item.reply && <p className="mt-3 border-l-2 border-[#d9a5c2] pl-3 text-sm"><b>Risposta:</b> {item.reply}</p>}<div className="mt-4 flex flex-wrap gap-4"><button onClick={() => { setSelected(item); setReply(item.reply ?? ""); }} className="font-semibold text-[#792f59]">Rispondi</button>{hasPermission(PERMISSION_KEYS.SETTINGS_SALON) && <button onClick={() => void setPublished(item, !item.published)} className="font-semibold text-stone-600">{item.published ? "Rendi privata" : "Pubblica"}</button>}</div></article>)}</section>
  </div>{selected && <div className="fixed inset-0 grid place-items-center bg-black/35 p-4"><section className="w-full max-w-lg rounded-[2rem] bg-white p-6"><h2 className="text-xl font-bold">Rispondi a {selected.customer_name}</h2><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={5} className="mt-4 w-full rounded-xl border p-3" /><div className="mt-4 flex justify-end gap-2"><button onClick={() => setSelected(undefined)}>Annulla</button><button onClick={() => void saveReply()} className="rounded-xl bg-[#402334] px-5 py-3 font-bold text-white">Salva risposta</button></div></section></div>}</main>;
}
