"use client";

import { useEffect, useState } from "react";
import { CircleMinus, CirclePlus, TrendingUp } from "lucide-react";

import { AppPage, Button, InlineError, PageHeader, PageTransition, SaveToast, SectionCard } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Tier { benefits: { text?: string }; id: string; minPoints: number; name: string; }
interface TierDistribution { id: string; members: number; min_points: number; name: string; }

export default function LoyaltyTiersPage() {
  const { salon } = useAuth();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [distribution, setDistribution] = useState<TierDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadAll() {
    if (!salon) return;
    setLoading(true);
    setError("");
    const [tiersResponse, summaryResponse] = await Promise.all([
      fetch(`${api}/api/salons/${salon.id}/loyalty/tiers`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/loyalty/summary`, { credentials: "include" }),
    ]);
    if (!tiersResponse.ok || !summaryResponse.ok) {
      setError("Non riesco a caricare i livelli fedeltà.");
      setLoading(false);
      return;
    }
    setTiers(await tiersResponse.json() as Tier[]);
    const summary = await summaryResponse.json() as { tier_distribution: TierDistribution[] };
    setDistribution(summary.tier_distribution);
    setLoading(false);
  }

  useEffect(() => { void loadAll(); }, [salon?.id]);
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  async function saveTiers() {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/loyalty/tiers`, {
      method: "PUT", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tiers: tiers.map((tier) => ({ benefits: tier.benefits.text ?? "", min_points: tier.minPoints, name: tier.name })) }),
    });
    if (!response.ok) return setError("Controlla nomi e soglie: ogni livello deve avere una soglia diversa.");
    setError("");
    setMessage("Livelli fedeltà salvati.");
    await loadAll();
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageTransition>
        <SaveToast visible={Boolean(message)}>{message}</SaveToast>
        <PageHeader eyebrow="Fedeltà" title="Livelli" subtitle="Soglie ordinate e beneficio visibile allo staff e al cliente." />
        {error && <InlineError className="mb-5">{error}</InlineError>}
        {loading ? <div className="h-40 animate-pulse rounded-2xl bg-stone-100" /> : (
          <SectionCard icon={TrendingUp} title="Livelli e progressione" subtitle="Soglie ordinate e beneficio visibile allo staff e al cliente.">
            <div className="space-y-2">
              {[...tiers].sort((left, right) => left.minPoints - right.minPoints).map((tier, index) => (
                <div className="grid gap-2 rounded-xl border border-stone-200 bg-white p-3 md:grid-cols-[1fr_120px_1.4fr_auto]" key={tier.id}>
                  <input aria-label={`Nome livello ${index + 1}`} onChange={(event) => setTiers((current) => current.map((item) => item.id === tier.id ? { ...item, name: event.target.value } : item))} value={tier.name} />
                  <input aria-label={`Soglia livello ${index + 1}`} min={0} onChange={(event) => setTiers((current) => current.map((item) => item.id === tier.id ? { ...item, minPoints: Math.max(0, Number(event.target.value)) } : item))} type="number" value={tier.minPoints} />
                  <input aria-label={`Benefici livello ${index + 1}`} onChange={(event) => setTiers((current) => current.map((item) => item.id === tier.id ? { ...item, benefits: { text: event.target.value } } : item))} placeholder="Benefit del livello" value={tier.benefits.text ?? ""} />
                  <button aria-label={`Rimuovi ${tier.name}`} className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => setTiers((current) => current.filter((item) => item.id !== tier.id))} type="button"><CircleMinus className="size-5" /></button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-2">
              <Button onClick={() => setTiers((current) => [...current, { benefits: { text: "" }, id: crypto.randomUUID(), minPoints: current.length ? Math.max(...current.map((tier) => tier.minPoints)) + 100 : 0, name: `Livello ${current.length + 1}` }])} size="sm" variant="outline"><CirclePlus className="mr-2 size-4" />Aggiungi livello</Button>
              <Button onClick={() => void saveTiers()} size="sm">Salva livelli</Button>
            </div>
            {distribution.length > 0 && <div className="mt-5 border-t border-stone-200 pt-4"><p className="mb-3 text-xs font-black uppercase tracking-wider text-stone-500">Distribuzione membri</p><div className="grid gap-2 sm:grid-cols-2">{distribution.map((tier) => <div className="flex justify-between rounded-lg bg-stone-50 px-3 py-2 text-sm" key={tier.id}><span>{tier.name} · da {tier.min_points} pt</span><b>{tier.members}</b></div>)}</div></div>}
          </SectionCard>
        )}
      </PageTransition>
    </AppPage>
  );
}
