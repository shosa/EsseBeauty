"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppPage, EmptyState, InlineError, PageHeader, PageTransition, SectionCard, StatCard, StatGrid } from "@esse-beauty/ui";
import { MODULE_KEYS, useModuleEnabled } from "@esse-beauty/feature-flags";
import { Receipt, Award } from "lucide-react";

import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface LoyaltySummary {
  metrics: { earned_period: number; members: number; outstanding_balance: number; redeemed_period: number };
  period_days: number;
  recent_movements: Array<{ actor_name: string | null; created_at: string; customer_id: string; customer_name: string; delta: number; id: string; reason: string }>;
  recent_redemptions: Array<{ created_at: string; customer_id: string; customer_name: string; id: string; points_spent: number; reward_name: string; status: string }>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export default function LoyaltyDashboardPage() {
  const { salon } = useAuth();
  const moduleEnabled = useModuleEnabled(MODULE_KEYS.LOYALTY);
  const [summary, setSummary] = useState<LoyaltySummary>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!moduleEnabled) return;
    if (!salon) return;
    setLoading(true);
    setError("");
    void fetch(`${api}/api/salons/${salon.id}/loyalty/summary`, { credentials: "include" })
      .then((response) => {
        if (!response.ok) throw new Error("LOAD_FAILED");
        return response.json();
      })
      .then((data) => setSummary(data as LoyaltySummary))
      .catch(() => setError("Non riesco a caricare il programma fedeltà."))
      .finally(() => setLoading(false));
  }, [moduleEnabled, salon?.id]);

  const metrics = summary?.metrics ?? { earned_period: 0, members: 0, outstanding_balance: 0, redeemed_period: 0 };

  if (!moduleEnabled) {
    return (
      <AppPage maxWidth="max-w-[1600px]">
        <PageHeader eyebrow="Fedeltà" title="Panoramica" subtitle="Andamento del programma fedeltà: saldo in circolo, punti guadagnati e riscattati." />
        <EmptyState
          action={<Link className="inline-flex min-h-10 items-center rounded-xl bg-[#6f244e] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#58203f]" href="/apps">Vai a App e moduli</Link>}
          description="Attiva il modulo Fedeltà dalla pagina App e moduli per gestire punti, premi e livelli dei tuoi clienti."
          title="Modulo Fedeltà non attivo"
        />
      </AppPage>
    );
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageTransition>
        <PageHeader
          eyebrow="Fedeltà"
          title="Panoramica"
          subtitle="Andamento del programma fedeltà: saldo in circolo, punti guadagnati e riscattati."
        />

        {error && <InlineError className="mb-5">{error}</InlineError>}
        {loading ? <div className="h-40 animate-pulse rounded-2xl bg-stone-100" /> : <>
          <StatGrid>
            <StatCard detail="clienti con saldo attivo" label="Membri" value={metrics.members} />
            <StatCard detail="punti disponibili oggi" label="Saldo in circolo" value={metrics.outstanding_balance} />
            <StatCard detail={`ultimi ${summary?.period_days ?? 30} giorni`} label="Punti guadagnati" value={`+${metrics.earned_period}`} />
            <StatCard detail={`ultimi ${summary?.period_days ?? 30} giorni`} label="Punti riscattati" value={`-${metrics.redeemed_period}`} />
          </StatGrid>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <SectionCard icon={Receipt} title="Movimenti recenti" subtitle="Ledger immutabile: accrediti, riscatti e correzioni manuali.">
              <div className="divide-y divide-stone-100">
                {summary?.recent_movements.map((movement) => (
                  <Link className="grid grid-cols-[1fr_auto] gap-3 py-3 text-left hover:bg-[#fff8fc]" href={`/loyalty/customers?customerId=${movement.customer_id}`} key={movement.id}>
                    <span><b className="block text-sm">{movement.customer_name}</b><span className="text-xs text-stone-500">{movement.reason} · {formatDate(movement.created_at)}{movement.actor_name ? ` · ${movement.actor_name}` : ""}</span></span>
                    <b className={movement.delta >= 0 ? "text-emerald-700" : "text-red-700"}>{movement.delta > 0 ? "+" : ""}{movement.delta} pt</b>
                  </Link>
                ))}
                {!summary?.recent_movements.length && <p className="py-8 text-center text-sm text-stone-500">Nessun movimento registrato.</p>}
              </div>
            </SectionCard>
            <SectionCard icon={Award} title="Riscatti recenti" subtitle="Premi consegnati e punti scalati nello stesso momento.">
              <div className="divide-y divide-stone-100">
                {summary?.recent_redemptions.map((redemption) => (
                  <Link className="grid grid-cols-[1fr_auto] gap-3 py-3 text-left hover:bg-[#fff8fc]" href={`/loyalty/customers?customerId=${redemption.customer_id}`} key={redemption.id}>
                    <span><b className="block text-sm">{redemption.reward_name}</b><span className="text-xs text-stone-500">{redemption.customer_name} · {formatDate(redemption.created_at)}</span></span>
                    <span className="text-right"><b className="block text-red-700">-{redemption.points_spent} pt</b><span className="text-[11px] font-bold uppercase text-emerald-700">Riscattato</span></span>
                  </Link>
                ))}
                {!summary?.recent_redemptions.length && <p className="py-8 text-center text-sm text-stone-500">Nessun riscatto registrato.</p>}
              </div>
            </SectionCard>
          </div>

          {metrics.members === 0 && <div className="mt-6"><EmptyState title="Nessun movimento ancora" description="I punti inizieranno ad accumularsi dopo il primo appuntamento completato o la prima vendita." /></div>}
        </>}
      </PageTransition>
    </AppPage>
  );
}
