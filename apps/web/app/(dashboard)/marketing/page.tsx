"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppPage, EmptyState, PageHeaderMetrics, SectionCard, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Campaign {
  channel: string;
  id: string;
  name: string;
  scheduledAt?: string;
  sentAt?: string;
  status: string;
  targetSegment: { type: string };
}

export default function MarketingPage() {
  const { salon } = useAuth();
  const [items, setItems] = useState<Campaign[]>([]);

  useEffect(() => {
    if (!salon) return;
    void fetch(`${api}/api/salons/${salon.id}/campaigns`, {
      credentials: "include",
    })
      .then((response) => response.json())
      .then(setItems);
  }, [salon]);

  const scheduled = useMemo(() => items.filter((item) => item.status === "scheduled").length, [items]);
  const sent = useMemo(() => items.filter((item) => item.status === "sent").length, [items]);
  const drafts = useMemo(() => items.filter((item) => item.status === "draft").length, [items]);

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageHeaderMetrics
        actions={<Link className="inline-flex min-h-11 items-center rounded-xl border border-[#402334] bg-[linear-gradient(135deg,#402334_0%,#792f59_58%,#b85888_100%)] px-4 py-2.5 font-semibold text-white shadow-[0_16px_36px_rgb(121_47_89_/_0.28)] transition hover:-translate-y-0.5" href="/marketing/new">Nuova campagna</Link>}
        eyebrow="Marketing"
        metrics={[
          { detail: "Invii pianificati", label: "In programma", value: scheduled },
          { detail: "Comunicazioni concluse", label: "Inviate", value: sent },
          { detail: "Da completare", label: "Bozze", value: drafts },
        ]}
        title="Campagne"
        subtitle="Prepara comunicazioni mirate per clienti, liste e promozioni senza perdere il controllo dello stato."
        status={<StatusBadge status={items.length > 0 ? "active" : "draft"}>{items.length} campagne</StatusBadge>}
      />

      <SectionCard title="Archivio campagne" subtitle="Ogni card mostra canale, pubblico e prossima data utile.">
        {items.length === 0 ? (
          <EmptyState
            action={<Link className="inline-flex min-h-11 items-center rounded-xl border border-[#402334] bg-[linear-gradient(135deg,#402334_0%,#792f59_58%,#b85888_100%)] px-4 py-2.5 font-semibold text-white shadow-[0_16px_36px_rgb(121_47_89_/_0.28)] transition hover:-translate-y-0.5" href="/marketing/new">Crea campagna</Link>}
            description="Le campagne create compariranno qui con stato, canale e pubblico."
            title="Nessuna campagna"
          />
        ) : (
          <div className="grid gap-3">
            {items.map((item) => (
              <Link
                className="group grid gap-4 rounded-2xl border border-white/80 bg-white/82 p-5 shadow-[0_12px_30px_rgb(45_29_39_/_0.06)] ring-1 ring-stone-950/5 transition hover:-translate-y-0.5 hover:border-[#d7a6c1] hover:shadow-[0_18px_42px_rgb(45_29_39_/_0.1)] md:grid-cols-[1fr_auto_auto_auto] md:items-center"
                href={`/marketing/${item.id}`}
                key={item.id}
              >
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-stone-950 group-hover:text-[#792f59]">{item.name}</h2>
                  <p className="mt-1 text-sm text-stone-500">Pubblico: {item.targetSegment.type.replace("_", " ")}</p>
                </div>
                <span className="w-fit rounded-full border border-[#ead1df] bg-[#fffafd] px-3 py-1 text-xs font-black uppercase tracking-[.08em] text-[#792f59]">{item.channel}</span>
                <StatusBadge status={item.status} />
                <time className="text-sm font-semibold text-stone-500">
                  {item.sentAt || item.scheduledAt ? new Date(item.sentAt ?? item.scheduledAt!).toLocaleString("it-IT") : "Bozza"}
                </time>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </AppPage>
  );
}
