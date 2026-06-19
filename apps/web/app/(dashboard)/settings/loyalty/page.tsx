"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppPage, Button, ConfirmDialog, EmptyState, FormField, PageHeader, SaveToast, SectionCard, StatusBadge } from "@esse-beauty/ui";

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

  const activeRewards = useMemo(() => rewards.filter((reward) => reward.active).length, [rewards]);
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
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [message]);

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
    <AppPage maxWidth="max-w-[1500px]">
      <SaveToast variant={message.includes("non riuscito") ? "error" : "success"} visible={Boolean(message)}>{message}</SaveToast>
      <PageHeader
        actions={<Link className="inline-flex min-h-11 items-center rounded-xl border border-[#402334] bg-[linear-gradient(135deg,#402334_0%,#792f59_58%,#b85888_100%)] px-4 py-2.5 font-semibold text-white shadow-[0_16px_36px_rgb(121_47_89_/_0.28)] transition hover:-translate-y-0.5" href="/settings/loyalty/rewards/new">Nuovo premio</Link>}
        eyebrow="Modulo"
        title="Programma fedelta"
        subtitle="Configura punti e premi riscattabili per trasformare le visite ricorrenti in valore."
        status={<StatusBadge status={activeRewards > 0 ? "active" : "draft"}>{activeRewards} premi attivi</StatusBadge>}
      />

      <SectionCard title="Accumulo punti" subtitle="Decidi quanti punti assegna ogni appuntamento completato.">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <FormField label="Punti per appuntamento completato">
            <input min={0} onChange={(event) => setPoints(Number(event.target.value))} type="number" value={points} />
          </FormField>
          <Button onClick={() => void savePoints()} variant="primary">Salva punti</Button>
        </div>
      </SectionCard>

      <SectionCard className="mt-6" title="Premi" subtitle="Mantieni pochi premi chiari, facili da spiegare in salone.">
        {rewards.length === 0 ? (
          <EmptyState
            action={<Link className="inline-flex min-h-11 items-center rounded-xl border border-[#402334] bg-[linear-gradient(135deg,#402334_0%,#792f59_58%,#b85888_100%)] px-4 py-2.5 font-semibold text-white shadow-[0_16px_36px_rgb(121_47_89_/_0.28)] transition hover:-translate-y-0.5" href="/settings/loyalty/rewards/new">Crea premio</Link>}
            description="Aggiungi il primo premio riscattabile dai clienti abituali."
            title="Nessun premio configurato"
          />
        ) : (
          <div className="grid gap-3">
            {rewards.map((reward) => (
              <article className={`grid gap-4 rounded-2xl border border-white/80 bg-white/82 p-5 shadow-[0_12px_30px_rgb(45_29_39_/_0.06)] ring-1 ring-stone-950/5 transition hover:-translate-y-0.5 hover:border-[#d7a6c1] md:grid-cols-[1fr_auto] md:items-center ${reward.active ? "" : "opacity-60"}`} key={reward.id}>
                <div>
                  <Link className="text-lg font-bold text-stone-950 hover:text-[#792f59]" href={`/settings/loyalty/rewards/${reward.id}`}>{reward.name}</Link>
                  <p className="mt-1 text-sm leading-6 text-stone-500">{reward.description ?? "Nessuna descrizione"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-[#ead1df] bg-[#fffafd] px-3 py-1 text-sm font-black text-[#792f59]">{reward.pointsRequired} pt</span>
                  <StatusBadge status={reward.active ? "active" : "inactive"}>{reward.active ? "Attivo" : "Sospeso"}</StatusBadge>
                  <Button onClick={() => void toggleReward(reward)} size="sm" variant="outline">{reward.active ? "Disattiva" : "Attiva"}</Button>
                  <Button onClick={() => setConfirmDelete(reward)} size="sm" variant="destructive">Elimina</Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <ConfirmDialog
        confirmLabel="Elimina"
        destructive
        description="Il premio verra rimosso dal programma fedelta."
        onCancel={() => setConfirmDelete(undefined)}
        onConfirm={() => void removeReward()}
        open={Boolean(confirmDelete)}
        title={`Eliminare ${confirmDelete?.name ?? "premio"}?`}
      />
    </AppPage>
  );
}
