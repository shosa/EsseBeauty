"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
interface Campaign { id: string; name: string; channel: string; targetSegment: { type: string }; status: string; scheduledAt?: string; sentAt?: string; }

export default function MarketingPage() {
  const { salon } = useAuth();
  const [items, setItems] = useState<Campaign[]>([]);
  useEffect(() => { if (salon) void fetch(`${api}/api/salons/${salon.id}/campaigns`, { credentials: "include" }).then((response) => response.json()).then(setItems); }, [salon]);
  return <main className="min-h-screen bg-[#f6f2f4] p-5 md:p-10"><div className="mx-auto max-w-6xl"><header className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#792f59]">Comunicazioni</p><h1 className="mt-2 text-3xl font-bold">Campagne</h1></div><Link href="/marketing/new" className="rounded-xl bg-[#402334] px-5 py-3 font-bold text-white">Nuova campagna</Link></header>
    <section className="mt-7 grid gap-4">{items.map((item) => <article key={item.id} className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm md:grid-cols-[1fr_auto_auto_auto] md:items-center"><div><h2 className="font-bold">{item.name}</h2><p className="text-sm text-stone-500">Segmento: {item.targetSegment.type.replace("_", " ")}</p></div><span className="rounded-full bg-[#f3e2eb] px-3 py-1 text-xs font-bold text-[#792f59]">{item.channel}</span><span className="rounded-full bg-stone-100 px-3 py-1 text-xs">{item.status}</span><time className="text-sm text-stone-500">{item.sentAt || item.scheduledAt ? new Date(item.sentAt ?? item.scheduledAt!).toLocaleString("it-IT") : "Bozza"}</time></article>)}</section>
  </div></main>;
}
