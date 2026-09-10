"use client";

import { FeedbackSystemPreview } from "../(dashboard)/notifications/_components/FeedbackSystemPreview";

export default function PublicFeedbackPreviewPage() {
  return <main className="min-h-[100dvh] bg-[#f6f2f4] px-4 py-8 text-stone-900 sm:px-6 lg:px-10">
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-6 max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[.16em] text-[#792f59]">EsseBeauty feedback system</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Avvisi, messaggi e notifiche</h1>
        <p className="mt-3 text-base leading-6 text-stone-600">Proposta interattiva per componenti riutilizzabili: avvisi persistenti, conferme nel contesto e toast temporanei con segnali audio discreti.</p>
      </header>
      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_20px_50px_rgb(64_35_52_/_0.08)] sm:p-6">
        <FeedbackSystemPreview />
      </section>
    </div>
  </main>;
}
