"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
interface Item { id: string; starts_at: string; service_name: string; staff_name: string; status: string; }

export default function AppointmentsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [email, setEmail] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  async function search() {
    const response = await fetch(`${api}/api/public/${slug}/appointments?email=${encodeURIComponent(email)}`);
    setItems(response.ok ? await response.json() : []);
  }
  return <main className="min-h-screen bg-[#f8f2ef] px-4 py-8"><section className="mx-auto max-w-md">
    <p className="text-xs font-bold uppercase tracking-[.2em] text-rose-700">Area cliente</p><h1 className="mt-2 text-3xl font-bold">I miei appuntamenti</h1>
    <div className="mt-6 flex gap-2 rounded-2xl bg-white p-3 shadow-sm"><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="La tua email" className="min-h-12 min-w-0 flex-1 rounded-xl border border-stone-300 px-3" /><button onClick={() => void search()} className="rounded-xl bg-stone-950 px-4 font-semibold text-white">Cerca</button></div>
    <div className="mt-5 space-y-3">{items.map((item) => <article key={item.id} className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-rose-700">{new Date(item.starts_at).toLocaleString("it-IT", { dateStyle: "full", timeStyle: "short" })}</p><h2 className="mt-1 text-lg font-bold">{item.service_name}</h2><p className="text-sm text-stone-500">con {item.staff_name} · {item.status}</p></article>)}</div>
  </section></main>;
}

