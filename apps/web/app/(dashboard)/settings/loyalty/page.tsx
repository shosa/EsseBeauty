"use client";

import { useEffect, useState } from "react";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
interface Reward { active: boolean; description: string | null; id: string; name: string; pointsRequired: number; }

export default function LoyaltySettingsPage() {
  const { salon } = useAuth();
  const [points, setPoints] = useState(10);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [message, setMessage] = useState("");
  async function load() {
    if (!salon) return;
    const [settingsResponse, rewardsResponse] = await Promise.all([
      fetch(`${api}/api/salons/${salon.id}/loyalty/settings`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/loyalty/rewards`, { credentials: "include" }),
    ]);
    if (settingsResponse.ok) {
      const settings = (await settingsResponse.json()) as { pointsPerAppointment: number };
      setPoints(settings.pointsPerAppointment);
    }
    if (rewardsResponse.ok) setRewards(await rewardsResponse.json());
  }
  useEffect(() => { void load(); }, [salon]);
  async function savePoints() {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/loyalty/settings`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ points_per_appointment: points }) });
    setMessage(response.ok ? "Impostazioni salvate." : "Salvataggio non riuscito.");
  }
  async function addReward(formData: FormData) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/loyalty/rewards`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: formData.get("name"), description: formData.get("description") || undefined, points_required: Number(formData.get("points")) }) });
    if (response.ok) await load();
  }
  return <main className="min-h-screen bg-[#f6f2f4] p-5 md:p-10"><div className="mx-auto max-w-4xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#792f59]">Modulo</p><h1 className="mt-2 text-3xl font-bold">Programma fedeltà</h1>
    <section className="mt-7 rounded-2xl bg-white p-6 shadow-sm"><h2 className="font-bold">Accumulo punti</h2><label className="mt-4 block text-sm font-semibold">Punti per appuntamento completato<input type="number" min={0} value={points} onChange={(event) => setPoints(Number(event.target.value))} className="mt-2 block w-full rounded-xl border p-3" /></label><button onClick={() => void savePoints()} className="mt-4 rounded-xl bg-[#792f59] px-4 py-3 font-bold text-white">Salva</button>{message && <p className="mt-3 text-sm">{message}</p>}</section>
    <section className="mt-5 rounded-2xl bg-white p-6 shadow-sm"><h2 className="font-bold">Premi</h2><form action={addReward} className="mt-4 grid gap-3 md:grid-cols-[1fr_120px_1fr_auto]"><input required name="name" placeholder="Nome premio" className="rounded-xl border p-3" /><input required type="number" min={1} name="points" placeholder="Punti" className="rounded-xl border p-3" /><input name="description" placeholder="Descrizione" className="rounded-xl border p-3" /><button className="rounded-xl bg-stone-900 px-4 py-3 font-bold text-white">Aggiungi</button></form><div className="mt-5 space-y-3">{rewards.map((reward) => <article key={reward.id} className="flex items-center justify-between rounded-xl border p-4"><div><h3 className="font-bold">{reward.name}</h3><p className="text-sm text-stone-500">{reward.description ?? "Nessuna descrizione"}</p></div><strong>{reward.pointsRequired} pt</strong></article>)}</div></section>
  </div></main>;
}
