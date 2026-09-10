"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Gift } from "lucide-react";

import { AppPage, Button, EmptyState, InlineError, PageHeader, PageTransition, SectionCard } from "@esse-beauty/ui";
import { MODULE_KEYS, useModuleEnabled } from "@esse-beauty/feature-flags";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Reward { active: boolean; description: string | null; id: string; name: string; pointsRequired: number; }

export default function LoyaltyRewardsPage() {
  const { salon } = useAuth();
  const moduleEnabled = useModuleEnabled(MODULE_KEYS.LOYALTY);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRewards() {
    if (!moduleEnabled) return;
    if (!salon) return;
    setLoading(true);
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/loyalty/rewards`, { credentials: "include" });
    if (!response.ok) {
      setError("Non riesco a caricare il catalogo premi.");
      setLoading(false);
      return;
    }
    setRewards(await response.json() as Reward[]);
    setLoading(false);
  }

  useEffect(() => { void loadRewards(); }, [moduleEnabled, salon?.id]);

  async function toggleReward(reward: Reward) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/loyalty/rewards/${reward.id}`, {
      method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: !reward.active }),
    });
    if (!response.ok) return setError("Aggiornamento premio non riuscito.");
    await loadRewards();
  }

  if (!moduleEnabled) {
    return (
      <AppPage maxWidth="max-w-[1600px]">
        <PageHeader eyebrow="Fedeltà" title="Premi" subtitle="Disponibilità, costo punti e accesso rapido alla modifica." />
        <EmptyState
          action={<Link className="inline-flex min-h-10 items-center rounded-xl bg-[#6f244e] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#58203f]" href="/apps">Vai a App e moduli</Link>}
          description="Attiva il modulo Fedeltà dalla pagina App e moduli per gestire il catalogo premi."
          title="Modulo Fedeltà non attivo"
        />
      </AppPage>
    );
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageTransition>
        <PageHeader
          actions={<Link className="inline-flex min-h-10 items-center rounded-xl bg-[#6f244e] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#58203f]" href="/loyalty/rewards/new"><Gift className="mr-2 size-4" />Nuovo premio</Link>}
          eyebrow="Fedeltà"
          title="Premi"
          subtitle="Disponibilità, costo punti e accesso rapido alla modifica."
        />
        {error && <InlineError className="mb-5">{error}</InlineError>}
        {loading ? <div className="h-40 animate-pulse rounded-2xl bg-stone-100" /> : (
          <SectionCard icon={Gift} title="Catalogo premi" subtitle="Attiva, archivia o apri un premio per modificarlo.">
            <div className="space-y-2">
              {rewards.map((reward) => <div className={`grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-stone-200 p-3 ${reward.active ? "bg-white" : "bg-stone-50 opacity-65"}`} key={reward.id}><div className="min-w-0"><Link className="font-bold text-stone-950 hover:text-[#6f244e]" href={`/loyalty/rewards/${reward.id}`}>{reward.name}</Link><p className="truncate text-xs text-stone-500">{reward.description || "Nessuna descrizione"}</p></div><div className="flex items-center gap-2"><b className="whitespace-nowrap text-[#6f244e]">{reward.pointsRequired} pt</b><Button onClick={() => void toggleReward(reward)} size="sm" variant="outline">{reward.active ? "Archivia" : "Riattiva"}</Button></div></div>)}
              {rewards.length === 0 && <EmptyState title="Nessun premio" description="Crea il primo vantaggio concreto del programma." />}
            </div>
          </SectionCard>
        )}
      </PageTransition>
    </AppPage>
  );
}
