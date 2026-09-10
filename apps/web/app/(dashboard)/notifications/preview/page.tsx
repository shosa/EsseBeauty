"use client";

import Link from "next/link";

import { AppPage, PageHeader, PageTransition, SectionCard } from "@esse-beauty/ui";

import { FeedbackSystemPreview } from "../_components/FeedbackSystemPreview";

export default function NotificationSystemPreviewPage() {
  return <AppPage maxWidth="max-w-[1400px]"><PageTransition>
    <PageHeader
      actions={<Link className="inline-flex min-h-11 items-center rounded-xl border border-stone-200 bg-white px-4 text-sm font-bold text-stone-700 transition hover:border-[#b87898] hover:text-[#792f59]" href="/notifications">Torna alle notifiche</Link>}
      eyebrow="Sistema di feedback"
      subtitle="Una proposta concreta per unificare avvisi persistenti, conferme contestuali e notifiche temporanee con segnali sonori discreti."
      title="Avvisi, messaggi e notifiche"
    />
    <SectionCard className="mb-5" subtitle="Ogni componente ha un compito: l’avviso resta finché serve, il messaggio conferma un’azione nel suo contesto, il toast comunica un evento transitorio." title="Tre componenti, un solo linguaggio">
      <FeedbackSystemPreview />
    </SectionCard>
  </PageTransition></AppPage>;
}
