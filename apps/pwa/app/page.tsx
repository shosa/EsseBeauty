"use client";

import Link from "next/link";
import { LocateFixed, MapPin, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { apiBaseUrl } from "../lib/api";

interface SalonResult {
  address?: string | null;
  city?: string | null;
  country?: string | null;
  distanceKm?: number | null;
  logoUrl?: string | null;
  name: string;
  postalCode?: string | null;
  primaryColor?: string | null;
  province?: string | null;
  slug: string;
}

export default function CustomerEntry() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SalonResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState("");

  async function search(value = query, coordinates?: { latitude: number; longitude: number }) {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (value.trim()) params.set("q", value.trim());
    if (coordinates) {
      params.set("lat", String(coordinates.latitude));
      params.set("lng", String(coordinates.longitude));
    }
    try {
      const response = await fetch(`${apiBaseUrl()}/api/public/salons/search?${params}`);
      if (!response.ok) throw new Error();
      setItems(await response.json() as SalonResult[]);
    } catch {
      setError("Non è stato possibile cercare i saloni. Riprova tra poco.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void search(""); }, []);

  function findNearby() {
    if (!navigator.geolocation) {
      setError("La posizione non è disponibile su questo dispositivo.");
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationLoading(false);
        void search(query, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setLocationLoading(false);
        setError("Non è stato possibile usare la tua posizione.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f4d8a855,transparent_24rem),linear-gradient(180deg,#fffafd,#f3edf1)] px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <header className="text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#402334] text-2xl font-black text-white">E</span>
          <p className="mt-5 text-xs font-black uppercase tracking-[.24em] text-[#8f3a68]">EsseBeauty</p>
          <h1 className="mt-2 text-4xl font-bold text-[#2d1d27] sm:text-5xl">Trova il salone più vicino a te</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-stone-600">Cerca per nome, città, CAP o indirizzo e accedi subito ai servizi e alle prenotazioni.</p>
        </header>

        <section className="mt-8 rounded-2xl border border-white/80 bg-white/90 p-4 shadow-[0_18px_50px_rgb(45_29_39_/_0.10)]">
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void search(); }}>
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Cerca salone</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-stone-400" />
              <input className="min-h-13 w-full pl-12" onChange={(event) => setQuery(event.target.value)} placeholder="Nome, città, CAP o indirizzo" value={query} />
            </label>
            <button className="min-h-13 rounded-xl bg-[#402334] px-6 font-black text-white" type="submit">Cerca</button>
          </form>
          <button className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d7a6c1] px-4 text-sm font-black text-[#792f59]" disabled={locationLoading} onClick={findNearby} type="button">
            <LocateFixed className="size-4" />
            {locationLoading ? "Cerco la posizione..." : "Usa la mia posizione"}
          </button>
        </section>

        {error && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</p>}

        <section className="mt-7">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-[#8f3a68]">Saloni disponibili</p>
              <h2 className="mt-1 text-2xl font-bold text-[#2d1d27]">{loading ? "Ricerca in corso" : `${items.length} risultati`}</h2>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {loading && [1, 2, 3, 4].map((item) => <div className="h-36 animate-pulse rounded-2xl bg-white" key={item} />)}
            {!loading && items.map((salon) => (
              <Link className="group rounded-2xl border border-white/80 bg-white/90 p-5 shadow-[0_12px_32px_rgb(45_29_39_/_0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgb(45_29_39_/_0.12)]" href={`/${salon.slug}`} key={salon.slug}>
                <div className="flex items-start gap-4">
                  {salon.logoUrl
                    ? <img alt="" className="size-12 rounded-xl border border-stone-100 object-cover" src={salon.logoUrl} />
                    : <span className="grid size-12 shrink-0 place-items-center rounded-xl text-lg font-black text-white" style={{ background: salon.primaryColor || "#792f59" }}>{salon.name.slice(0, 1)}</span>}
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold text-stone-950">{salon.name}</h3>
                    <p className="mt-1 flex items-start gap-1.5 text-sm leading-5 text-stone-500">
                      <MapPin className="mt-0.5 size-4 shrink-0" />
                      <span>{[salon.address, [salon.postalCode, salon.city].filter(Boolean).join(" "), salon.province].filter(Boolean).join(", ") || "Indirizzo da completare"}</span>
                    </p>
                    {salon.distanceKm !== null && salon.distanceKm !== undefined && <p className="mt-2 text-xs font-black text-[#792f59]">{salon.distanceKm < 1 ? `${Math.round(salon.distanceKm * 1000)} m` : `${salon.distanceKm.toFixed(1)} km`} da te</p>}
                  </div>
                </div>
                <span className="mt-4 inline-flex text-sm font-black text-[#792f59]">Apri il salone →</span>
              </Link>
            ))}
          </div>
          {!loading && items.length === 0 && <p className="rounded-2xl border border-dashed border-[#d7a6c1] bg-white/70 p-8 text-center text-sm text-stone-600">Nessun salone trovato. Prova con una città o un CAP diverso.</p>}
        </section>
      </div>
    </main>
  );
}
