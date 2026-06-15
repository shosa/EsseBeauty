"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatPrice } from "@esse-beauty/shared";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
interface Service { id: string; name: string; category: string; durationMinutes: number; priceCents: number; }
interface Profile { salon: { name: string }; services: Service[]; }

export default function SalonLanding() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<Profile>();
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable" | "missing">("loading");
  useEffect(() => {
    void fetch(`${api}/api/public/${slug}`).then(async (response) => {
      if (response.status === 503) {
        setStatus("unavailable");
        return;
      }
      if (!response.ok) {
        setStatus("missing");
        return;
      }
      setProfile(await response.json());
      setStatus("ready");
    });
  }, [slug]);
  if (status === "loading") return <main className="grid min-h-screen place-items-center bg-[#f8f2ef]">Caricamento…</main>;
  if (status === "unavailable") return <main className="grid min-h-screen place-items-center bg-[#f8f2ef] p-5"><section className="max-w-md rounded-[2rem] bg-white p-8 text-center shadow-xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-rose-700">Prenotazioni online</p><h1 className="mt-3 text-3xl font-bold">Servizio momentaneamente non disponibile</h1><p className="mt-3 text-stone-600">Contatta direttamente il salone per fissare un appuntamento.</p></section></main>;
  if (status === "missing") return <main className="grid min-h-screen place-items-center bg-[#f8f2ef] p-5"><h1 className="text-2xl font-bold">Salone non trovato</h1></main>;
  const groups = profile ? Map.groupBy(profile.services, (service) => service.category) : new Map<string, Service[]>();
  return <main className="min-h-screen bg-[#f8f2ef] px-4 py-8"><div className="mx-auto max-w-md">
    <header className="rounded-[2rem] bg-stone-950 px-6 py-10 text-white"><p className="text-xs font-bold uppercase tracking-[.25em] text-rose-300">Benvenuta</p><h1 className="mt-3 text-4xl font-bold">{profile?.salon.name ?? "Esse Beauty"}</h1><p className="mt-3 text-stone-300">Scegli il trattamento e trova il momento giusto per te.</p>
      <Link href={`/${slug}/book`} className="mt-7 inline-grid min-h-12 w-full place-items-center rounded-xl bg-white font-bold text-stone-950">Prenota ora</Link></header>
    <section className="mt-7 space-y-6">{[...groups].map(([category, services]) => <div key={category}><h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-stone-500">{category}</h2>
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">{services.map((service) => <article key={service.id} className="flex items-center justify-between border-b border-stone-100 p-4 last:border-0"><div><h3 className="font-bold">{service.name}</h3><p className="text-sm text-stone-500">{service.durationMinutes} minuti</p></div><strong>{formatPrice(service.priceCents, "it-IT")}</strong></article>)}</div></div>)}</section>
  </div></main>;
}
