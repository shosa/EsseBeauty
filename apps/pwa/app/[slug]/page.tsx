"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { formatPrice } from "@esse-beauty/shared";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
interface Service { id: string; name: string; category: string; durationMinutes: number; priceCents: number; }
interface Branding { accentColor?: string; heroSubtitle?: string; heroTitle?: string; logoUrl?: string; primaryColor?: string; welcomeText?: string; }
interface Profile { branding?: Branding | null; salon: { name: string }; services: Service[]; }

export default function SalonLanding() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<Profile>();
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable" | "missing">("loading");

  useEffect(() => {
    void fetch(`${api}/api/public/${slug}`).then(async (response) => {
      if (response.status === 503) return setStatus("unavailable");
      if (!response.ok) return setStatus("missing");
      setProfile(await response.json());
      setStatus("ready");
    });
  }, [slug]);

  const groups = useMemo(() => profile ? Map.groupBy(profile.services, (service) => service.category) : new Map<string, Service[]>(), [profile]);
  const brand = profile?.branding;
  const primary = brand?.primaryColor || "#402334";
  const accent = brand?.accentColor || "#f4d8a8";

  if (status === "loading") return <main className="grid min-h-screen place-items-center bg-[#f6f2f4] text-sm font-bold text-[#792f59]">Preparazione salone...</main>;
  if (status === "unavailable") return <main className="grid min-h-screen place-items-center bg-[#f6f2f4] p-5"><section className="max-w-md rounded-[2rem] bg-white p-8 text-center shadow-xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#792f59]">Prenotazioni online</p><h1 className="mt-3 text-3xl font-bold">Servizio momentaneamente non disponibile</h1><p className="mt-3 text-stone-600">Contatta direttamente il salone per fissare un appuntamento.</p></section></main>;
  if (status === "missing") return <main className="grid min-h-screen place-items-center bg-[#f6f2f4] p-5"><h1 className="text-2xl font-bold">Salone non trovato</h1></main>;

  return (
    <main className="min-h-screen px-4 py-6" style={{ background: `radial-gradient(circle at 10% 0%, ${accent}55, transparent 18rem), linear-gradient(180deg,#fffafd,#f6f2f4)` }}>
      <div className="mx-auto max-w-md">
        <header className="relative overflow-hidden rounded-[2.2rem] p-7 text-white shadow-[0_24px_70px_rgb(45_29_39_/_0.2)]" style={{ background: `linear-gradient(135deg, ${primary}, #792f59)` }}>
          <div className="absolute -right-16 -top-16 size-48 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            {brand?.logoUrl ? <img alt="Logo salone" className="mb-5 size-16 rounded-2xl bg-white object-cover p-2" src={brand.logoUrl} /> : <span className="mb-5 grid size-16 place-items-center rounded-2xl bg-white/15 text-2xl font-black">E</span>}
            <p className="text-xs font-black uppercase tracking-[.24em]" style={{ color: accent }}>Benvenuta</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-.03em]">{brand?.heroTitle || profile?.salon.name || "Esse Beauty"}</h1>
            <p className="mt-3 text-sm leading-6 text-white/78">{brand?.heroSubtitle || "Scegli il trattamento e trova il momento giusto per te."}</p>
            <Link href={`/${slug}/book`} className="mt-7 inline-grid min-h-12 w-full place-items-center rounded-2xl bg-white font-black text-[#402334] shadow-lg">Prenota ora</Link>
          </div>
        </header>

        {brand?.welcomeText && <p className="mt-5 rounded-3xl border border-white/80 bg-white/82 p-5 text-sm leading-6 text-stone-600 shadow-sm">{brand.welcomeText}</p>}

        <section className="mt-7 space-y-6">
          {[...groups].map(([category, services]) => (
            <div key={category}>
              <h2 className="mb-2 text-xs font-black uppercase tracking-[.18em] text-[#792f59]">{category}</h2>
              <div className="overflow-hidden rounded-3xl border border-white/80 bg-white/88 shadow-[0_14px_34px_rgb(45_29_39_/_0.08)]">
                {services.map((service) => (
                  <article className="flex items-center justify-between border-b border-stone-100 p-4 last:border-0" key={service.id}>
                    <div><h3 className="font-bold text-stone-950">{service.name}</h3><p className="text-sm text-stone-500">{service.durationMinutes} minuti</p></div>
                    <strong className="text-[#792f59]">{formatPrice(service.priceCents, "it-IT")}</strong>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
