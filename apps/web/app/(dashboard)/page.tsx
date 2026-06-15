"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
interface Summary { leaders: Array<{ customer_id: string; name: string; total_points: number }>; points_issued_this_month: number; }

export default function DashboardPage() {
  const { salon } = useAuth();
  const [summary, setSummary] = useState<Summary>();
  useEffect(() => { if (salon) void fetch(`${api}/api/salons/${salon.id}/loyalty/summary`, { credentials: "include" }).then((response) => response.ok ? response.json() : undefined).then(setSummary); }, [salon]);
  return <main className="min-h-screen bg-[#f6f2f4] p-5 md:p-10"><div className="mx-auto max-w-6xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#792f59]">Panoramica</p><h1 className="mt-2 text-4xl font-bold">Oggi da {salon?.name ?? "Esse Beauty"}</h1>
    {summary && <section className="mt-8 grid gap-5 md:grid-cols-[1fr_2fr]"><article className="rounded-[2rem] bg-[#402334] p-7 text-white"><p className="text-sm text-[#e8b9d3]">Punti emessi questo mese</p><strong className="mt-3 block text-6xl">{summary.points_issued_this_month}</strong></article><article className="rounded-[2rem] bg-white p-6"><h2 className="text-xl font-bold">Clienti più fedeli</h2><div className="mt-4 space-y-3">{summary.leaders.map((item, index) => <div key={item.customer_id} className="flex items-center gap-4 border-b border-stone-100 pb-3 last:border-0"><span className="grid size-8 place-items-center rounded-full bg-[#f3e2eb] text-sm font-bold text-[#792f59]">{index+1}</span><b className="flex-1">{item.name}</b><strong>{item.total_points} pt</strong></div>)}</div></article></section>}
  </div></main>;
}
