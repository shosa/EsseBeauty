"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function NewCampaignPage() {
  const { salon } = useAuth();
  const router = useRouter();
  const [channel, setChannel] = useState<"email"|"sms">("email");
  const [segment, setSegment] = useState("all");
  const [content, setContent] = useState("");
  async function create(data: FormData) {
    const config = segment === "inactive" ? { type: segment, days_since_last_visit: Number(data.get("days")) } : segment === "tag" ? { type: segment, tag: data.get("tag") } : segment === "high_loyalty" ? { type: segment, min_points: Number(data.get("points")) } : { type: "all" };
    const response = await fetch(`${api}/api/salons/${salon?.id}/campaigns`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: data.get("name"), channel, target_segment: config, content, scheduled_at: data.get("scheduled") || undefined }) });
    if (response.ok) {
      const campaign = await response.json();
      await fetch(`${api}/api/salons/${salon?.id}/campaigns/${campaign.id}/send`, { method: "POST", credentials: "include" });
      router.push("/marketing");
    }
  }
  return <main className="min-h-screen bg-[#f6f2f4] p-5 md:p-10"><form action={create} className="mx-auto max-w-3xl rounded-[2rem] bg-white p-6 shadow-sm md:p-8"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#792f59]">Nuova campagna</p><h1 className="mt-2 text-3xl font-bold">Prepara il messaggio</h1><label className="mt-7 block font-semibold">Nome<input name="name" required className="mt-2 min-h-12 w-full rounded-xl border px-3" /></label>
    <div className="mt-5 grid grid-cols-2 gap-3">{(["email","sms"] as const).map((value) => <button key={value} type="button" onClick={() => setChannel(value)} className={`rounded-xl border p-4 font-bold ${channel === value ? "border-[#792f59] bg-[#f8edf3]" : ""}`}>{value.toUpperCase()}</button>)}</div>
    <label className="mt-5 block font-semibold">Segmento<select value={segment} onChange={(event) => setSegment(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border bg-white px-3"><option value="all">Tutti</option><option value="inactive">Clienti inattivi</option><option value="tag">Tag cliente</option><option value="high_loyalty">Punti fedeltà alti</option></select></label>
    {segment === "inactive" && <input name="days" type="number" min="1" placeholder="Giorni dall'ultima visita" className="mt-3 min-h-12 w-full rounded-xl border px-3" />}{segment === "tag" && <input name="tag" placeholder="Tag" className="mt-3 min-h-12 w-full rounded-xl border px-3" />}{segment === "high_loyalty" && <input name="points" type="number" min="0" placeholder="Punti minimi" className="mt-3 min-h-12 w-full rounded-xl border px-3" />}
    <label className="mt-5 block font-semibold">Contenuto<textarea value={content} onChange={(event) => setContent(event.target.value.slice(0, channel === "sms" ? 160 : undefined))} rows={7} className="mt-2 w-full rounded-xl border p-3" /></label>{channel === "sms" && <p className="text-right text-xs text-stone-500">{content.length}/160</p>}
    <label className="mt-5 block font-semibold">Programma invio (facoltativo)<input name="scheduled" type="datetime-local" className="mt-2 min-h-12 w-full rounded-xl border px-3" /></label><button className="mt-7 min-h-12 w-full rounded-xl bg-[#402334] font-bold text-white">Salva campagna</button></form></main>;
}
