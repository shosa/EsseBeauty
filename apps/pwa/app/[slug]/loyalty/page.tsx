"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Loyalty {
  customer: { name: string };
  balance: number;
  history: Array<{ id: string; delta: number; reason: string; createdAt: string }>;
  rewards: Array<{ id: string; name: string; pointsRequired: number; description?: string }>;
}

export default function LoyaltyPage() {
  const { slug } = useParams<{ slug: string }>();
  const [email, setEmail] = useState("");
  const [data, setData] = useState<Loyalty>();
  const [missing, setMissing] = useState(false);

  async function search() {
    const response = await fetch(`${api}/api/public/${slug}/loyalty?email=${encodeURIComponent(email)}`);
    setMissing(!response.ok);
    setData(response.ok ? await response.json() : undefined);
  }

  return <main className="min-h-screen bg-[#f5f0f3] px-4 py-8"><section className="mx-auto max-w-lg">
    <p className="text-xs font-bold uppercase tracking-[.2em] text-[#792f59]">Programma fedeltà</p><h1 className="mt-2 text-4xl font-bold text-[#2d1d27]">I tuoi punti</h1>
    <div className="mt-6 flex gap-2 rounded-2xl bg-white p-3 shadow-sm"><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="La tua email" className="min-h-12 min-w-0 flex-1 rounded-xl border border-stone-200 px-3" /><button onClick={() => void search()} className="rounded-xl bg-[#402334] px-5 font-bold text-white">Mostra</button></div>
    {missing && <p className="mt-4 rounded-xl bg-white p-4 text-sm text-red-700">Nessun profilo fedeltà trovato per questa email.</p>}
    {data && <div className="mt-6 space-y-5"><article className="rounded-[2rem] bg-[#402334] p-7 text-white shadow-xl"><p className="text-sm text-[#e8b9d3]">{data.customer.name}</p><strong className="mt-2 block text-6xl">{data.balance}</strong><span className="text-sm text-stone-300">punti disponibili</span></article>
      <section className="rounded-[2rem] bg-white p-6"><h2 className="text-xl font-bold">Premi disponibili</h2><div className="mt-4 space-y-3">{data.rewards.map((reward) => <article key={reward.id} className="flex justify-between gap-4 rounded-xl border border-stone-100 p-4"><div><b>{reward.name}</b><p className="text-sm text-stone-500">{reward.description}</p></div><strong className="text-[#792f59]">{reward.pointsRequired} pt</strong></article>)}</div></section>
      <section className="rounded-[2rem] bg-white p-6"><h2 className="text-xl font-bold">Movimenti</h2><div className="mt-4 border-l-2 border-[#d9a5c2] pl-5">{data.history.map((item) => <article key={item.id} className="relative border-b border-stone-100 py-4 last:border-0"><span className="absolute -left-[27px] top-6 size-3 rounded-full bg-[#792f59]" /><div className="flex justify-between"><div><b>{item.reason.replaceAll("_", " ")}</b><p className="text-xs text-stone-400">{new Date(item.createdAt).toLocaleDateString("it-IT")}</p></div><strong className={item.delta >= 0 ? "text-emerald-700" : "text-red-700"}>{item.delta > 0 ? "+" : ""}{item.delta}</strong></div></article>)}</div></section>
    </div>}
  </section></main>;
}
