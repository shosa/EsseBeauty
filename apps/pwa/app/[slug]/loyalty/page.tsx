"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { Lock } from "lucide-react";

import { apiBaseUrl } from "../../../lib/api";
import { CustomerAuthOverlay } from "../_components/CustomerAuthOverlay";
import { useCustomerAuth } from "../_components/CustomerAuthProvider";

interface Branding { accentColor?: string; primaryColor?: string; }
interface Profile { branding?: Branding | null; pwa?: { requireEmail?: boolean }; salon: { name: string }; }
interface Loyalty {
  balance: number;
  current_tier: { minPoints: number; name: string } | null;
  customer: { name: string };
  history: Array<{ createdAt: string; delta: number; id: string; reason: string }>;
  next_tier: { minPoints: number; name: string; pointsRemaining: number } | null;
  rewards: Array<{ available: boolean; description?: string; id: string; name: string; pointsRequired: number }>;
}

export default function LoyaltyPage() {
  const { slug } = useParams<{ slug: string }>();
  const { status: authStatus } = useCustomerAuth();
  const [data, setData] = useState<Loyalty>();
  const [missing, setMissing] = useState(false);
  const [profile, setProfile] = useState<Profile>();
  const [showAuthOverlay, setShowAuthOverlay] = useState(true);
  const primary = profile?.branding?.primaryColor || "#402334";
  const accent = profile?.branding?.accentColor || "#f4d8a8";

  useEffect(() => {
    void fetch(`${apiBaseUrl()}/api/public/${slug}`).then(async (response) => {
      if (response.ok) setProfile(await response.json());
    });
  }, [slug]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    void fetch(`${apiBaseUrl()}/api/public/${slug}/loyalty`, { credentials: "include" }).then(async (response) => {
      setMissing(!response.ok);
      setData(response.ok ? await response.json() : undefined);
    });
  }, [authStatus, slug]);

  return (
    <main className="min-h-screen px-4 py-8" style={{ background: `radial-gradient(circle at top left, ${accent}55, transparent 18rem), linear-gradient(180deg,#fffafd,#f6f2f4)` }}>
      <section className="mx-auto max-w-lg">
        <header className="rounded-[2.2rem] p-6 text-white shadow-[0_24px_70px_rgb(45_29_39_/_0.16)]" style={{ background: `linear-gradient(135deg, ${primary}, #792f59)` }}>
          <p className="text-xs font-black uppercase tracking-[.24em]" style={{ color: accent }}>{profile?.salon.name ?? "Programma fedeltà"}</p>
          <h1 className="mt-3 text-4xl font-bold">I tuoi punti</h1>
          <p className="mt-2 text-sm text-white/75">Consulta saldo, premi e movimenti del tuo account.</p>
        </header>
        {missing && <p className="animate-reveal mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">Nessun profilo fedeltà trovato per il tuo account.</p>}
        {data && (
          <div className="animate-reveal mt-6 space-y-5">
            <article className="rounded-[2rem] p-7 text-white shadow-[0_24px_70px_rgb(45_29_39_/_0.16)]" style={{ background: `linear-gradient(135deg, ${primary}, #792f59)` }}>
              <p className="text-sm" style={{ color: accent }}>{data.customer.name}</p>
              <strong className="mt-2 block text-6xl tracking-[-.06em]">{data.balance}</strong>
              <span className="text-sm text-white/70">punti disponibili</span>
              <div className="mt-5 border-t border-white/15 pt-4">
                <div className="flex items-center justify-between gap-4 text-sm"><b>{data.current_tier?.name ?? "Livello base"}</b>{data.next_tier && <span className="text-white/70">{data.next_tier.pointsRemaining} pt a {data.next_tier.name}</span>}</div>
                {data.next_tier && <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ background: accent, width: `${Math.min(100, data.balance / data.next_tier.minPoints * 100)}%` }} /></div>}
              </div>
            </article>
            <section className="rounded-[2rem] border border-white/80 bg-white/86 p-6 shadow-sm">
              <h2 className="text-xl font-black">Premi disponibili</h2>
              <div className="mt-4 space-y-3">
                {data.rewards.map((reward, index) => (
                  <article className={`animate-reveal flex justify-between gap-4 rounded-2xl border border-stone-100 bg-white p-4 ${reward.available ? "" : "opacity-55"}`} key={reward.id} style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}>
                    <div><b>{reward.name}</b><p className="text-sm text-stone-500">{reward.description}</p><span className="mt-2 inline-block text-xs font-bold" style={{ color: reward.available ? "#047857" : "#78716c" }}>{reward.available ? "Disponibile in salone" : `Mancano ${reward.pointsRequired - data.balance} punti`}</span></div>
                    <strong className="whitespace-nowrap" style={{ color: primary }}>{reward.pointsRequired} pt</strong>
                  </article>
                ))}
                {data.rewards.length === 0 && <p className="text-sm text-stone-500">Nessun premio attivo al momento.</p>}
              </div>
            </section>
            <section className="rounded-[2rem] border border-white/80 bg-white/86 p-6 shadow-sm">
              <h2 className="text-xl font-black">Movimenti</h2>
              <div className="mt-4 border-l-2 border-[#e8bfd4] pl-5">
                {data.history.map((item) => (
                  <article key={item.id} className="relative border-b border-stone-100 py-4 last:border-0">
                    <span className="absolute -left-[27px] top-6 size-3 rounded-full ring-4 ring-[#faf3f7]" style={{ background: primary }} />
                    <div className="flex justify-between gap-4">
                      <div><b>{item.reason.replaceAll("_", " ")}</b><p className="text-xs text-stone-400">{new Date(item.createdAt).toLocaleDateString("it-IT")}</p></div>
                      <strong className={item.delta >= 0 ? "text-emerald-700" : "text-red-700"}>{item.delta > 0 ? "+" : ""}{item.delta}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
        {authStatus === "anonymous" && (
          <div className="animate-reveal mt-6 rounded-[1.7rem] border border-white/80 bg-white/86 p-6 text-center shadow-sm">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl text-white" style={{ background: primary }}><Lock className="size-5" /></span>
            <h2 className="mt-4 text-lg font-black text-stone-950">Accedi per vedere i tuoi punti fedeltà</h2>
            <p className="mt-1 text-sm leading-5 text-stone-500">Accedi con il tuo numero di telefono, oppure registrati se non hai ancora un account.</p>
            <button className="mt-5 min-h-12 w-full rounded-2xl font-black text-white" onClick={() => setShowAuthOverlay(true)} style={{ background: primary }} type="button">Accedi o registrati</button>
          </div>
        )}
      </section>
      <AnimatePresence>
        {authStatus === "anonymous" && showAuthOverlay && (
          <CustomerAuthOverlay accent={accent} onClose={() => setShowAuthOverlay(false)} primary={primary} requireEmail={profile?.pwa?.requireEmail !== false} salonName={profile?.salon.name} subtitle="Accedi per consultare i tuoi punti fedeltà, oppure registrati se non hai ancora un account." />
        )}
      </AnimatePresence>
    </main>
  );
}
