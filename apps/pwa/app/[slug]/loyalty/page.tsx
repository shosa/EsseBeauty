"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Branding { accentColor?: string; primaryColor?: string; }
interface Profile { branding?: Branding | null; salon: { name: string }; }
interface Loyalty {
  balance: number;
  customer: { name: string };
  history: Array<{ createdAt: string; delta: number; id: string; reason: string }>;
  rewards: Array<{ description?: string; id: string; name: string; pointsRequired: number }>;
}

export default function LoyaltyPage() {
  const { slug } = useParams<{ slug: string }>();
  const [email, setEmail] = useState("");
  const [data, setData] = useState<Loyalty>();
  const [missing, setMissing] = useState(false);
  const [profile, setProfile] = useState<Profile>();
  const primary = profile?.branding?.primaryColor || "#402334";
  const accent = profile?.branding?.accentColor || "#f4d8a8";

  useEffect(() => {
    void fetch(`${api}/api/public/${slug}`).then(async (response) => {
      if (response.ok) setProfile(await response.json());
    });
  }, [slug]);

  async function search() {
    const response = await fetch(`${api}/api/public/${slug}/loyalty?email=${encodeURIComponent(email)}`);
    setMissing(!response.ok);
    setData(response.ok ? await response.json() : undefined);
  }

  return (
    <main className="min-h-screen px-4 py-8" style={{ background: `radial-gradient(circle at top left, ${accent}55, transparent 18rem), linear-gradient(180deg,#fffafd,#f6f2f4)` }}>
      <section className="mx-auto max-w-lg">
        <header className="rounded-[2.2rem] p-6 text-white shadow-[0_24px_70px_rgb(45_29_39_/_0.16)]" style={{ background: `linear-gradient(135deg, ${primary}, #792f59)` }}>
          <p className="text-xs font-black uppercase tracking-[.24em]" style={{ color: accent }}>{profile?.salon.name ?? "Programma fedeltà"}</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-.03em]">I tuoi punti</h1>
          <p className="mt-2 text-sm text-white/75">Consulta saldo, premi e movimenti collegati alla tua email.</p>
        </header>
        <div className="mt-6 rounded-[2rem] border border-white/80 bg-white/86 p-3 shadow-[0_18px_44px_rgb(45_29_39_/_0.09)]">
          <div className="flex gap-2">
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="La tua email" className="min-w-0 flex-1" />
            <button disabled={!email.trim()} onClick={() => void search()} className="rounded-2xl px-5 font-black text-white disabled:opacity-40" style={{ background: primary }}>Mostra</button>
          </div>
        </div>
        {missing && <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">Nessun profilo fedeltà trovato per questa email.</p>}
        {data && (
          <div className="mt-6 space-y-5">
            <article className="rounded-[2rem] p-7 text-white shadow-[0_24px_70px_rgb(45_29_39_/_0.16)]" style={{ background: `linear-gradient(135deg, ${primary}, #792f59)` }}>
              <p className="text-sm" style={{ color: accent }}>{data.customer.name}</p>
              <strong className="mt-2 block text-6xl tracking-[-.06em]">{data.balance}</strong>
              <span className="text-sm text-white/70">punti disponibili</span>
            </article>
            <section className="rounded-[2rem] border border-white/80 bg-white/86 p-6 shadow-sm">
              <h2 className="text-xl font-black">Premi disponibili</h2>
              <div className="mt-4 space-y-3">
                {data.rewards.map((reward) => (
                  <article key={reward.id} className="flex justify-between gap-4 rounded-2xl border border-stone-100 bg-white p-4">
                    <div><b>{reward.name}</b><p className="text-sm text-stone-500">{reward.description}</p></div>
                    <strong style={{ color: primary }}>{reward.pointsRequired} pt</strong>
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
      </section>
    </main>
  );
}
