"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button, ConfirmDialog, PageTransition } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Reward {
  active: boolean;
  description: string | null;
  id: string;
  name: string;
  pointsRequired: number;
}

export default function LoyaltySettingsPage() {
  const { salon } = useAuth();
  const [points, setPoints] = useState(10);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Reward>();

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
    if (rewardsResponse.ok) setRewards(await rewardsResponse.json() as Reward[]);
  }

  useEffect(() => { void load(); }, [salon]);

  async function savePoints() {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/loyalty/settings`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ points_per_appointment: points }),
    });
    setMessage(response.ok ? "Impostazioni salvate." : "Salvataggio non riuscito.");
  }

  async function toggleReward(reward: Reward) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/loyalty/rewards/${reward.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !reward.active }),
    });
    if (response.ok) await load();
  }

  async function removeReward() {
    if (!salon || !confirmDelete) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/loyalty/rewards/${confirmDelete.id}`, { method: "DELETE", credentials: "include" });
    if (response.ok) await load();
    setConfirmDelete(undefined);
  }

  return (
    <main className="min-h-screen bg-[#f6f2f4] p-5 md:p-10">
      <PageTransition className="mx-auto max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#792f59]">Modulo</p>
        <h1 className="mt-2 text-4xl font-black">Programma fedeltà</h1>
        <section className="mt-7 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-950/5">
          <h2 className="font-bold">Accumulo punti</h2>
          <label className="mt-4 block text-sm font-semibold">Punti per appuntamento completato<input type="number" min={0} value={points} onChange={(event) => setPoints(Number(event.target.value))} className="mt-2 block w-full rounded-xl border p-3" /></label>
          <Button className="mt-4" onClick={() => void savePoints()}>Salva</Button>
          {message && <p className="mt-3 text-sm">{message}</p>}
        </section>
        <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-950/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">Premi</h2>
            <Link href="/settings/loyalty/rewards/new" className="rounded-xl bg-stone-950 px-4 py-3 text-sm font-bold text-white">Nuovo premio</Link>
          </div>
          <div className="mt-5 space-y-3">
            {rewards.length === 0 && <p className="rounded-xl bg-stone-50 p-5 text-center text-sm text-stone-500">Nessun premio configurato.</p>}
            {rewards.map((reward) => (
              <article key={reward.id} className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 transition hover:-translate-y-0.5 ${reward.active ? "" : "opacity-55"}`}>
                <div>
                  <Link href={`/settings/loyalty/rewards/${reward.id}`} className="font-bold hover:text-[#792f59]">{reward.name}</Link>
                  <p className="text-sm text-stone-500">{reward.description ?? "Nessuna descrizione"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <strong>{reward.pointsRequired} pt</strong>
                  <Button onClick={() => void toggleReward(reward)} variant="outline">{reward.active ? "Disattiva" : "Attiva"}</Button>
                  <Button onClick={() => setConfirmDelete(reward)} variant="destructive">Elimina</Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </PageTransition>
      <ConfirmDialog
        confirmLabel="Elimina"
        destructive
        description="Il premio verrà rimosso dal programma fedeltà."
        onCancel={() => setConfirmDelete(undefined)}
        onConfirm={() => void removeReward()}
        open={Boolean(confirmDelete)}
        title={`Eliminare ${confirmDelete?.name ?? "premio"}?`}
      />
    </main>
  );
}
