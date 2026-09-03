"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, CalendarPlus, LogOut, Sparkles, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { apiBaseUrl } from "../../lib/api";
import { ServiceCategoryIcon } from "../_components/ServiceCategoryIcon";
import { CustomerAuthOverlay } from "./_components/CustomerAuthOverlay";
import { useCustomerAuth } from "./_components/CustomerAuthProvider";
import { InstallAppButton } from "./_components/InstallAppButton";

function initials(fullNameValue: string): string {
  const parts = fullNameValue.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
interface Service { id: string; name: string; category: string; durationMinutes: number; priceCents: number; }
interface Category { icon: string; id: string; name: string; }
interface Branding { accentColor?: string; heroSubtitle?: string; heroTitle?: string; installPromptEnabled?: boolean; logoUrl?: string; primaryColor?: string; welcomeText?: string; }
interface Profile { branding?: Branding | null; categories: Category[]; salon: { name: string }; services: Service[]; }

export default function SalonLanding() {
  const { slug } = useParams<{ slug: string }>();
  const { customer, logout, status: authStatus } = useCustomerAuth();
  const [profile, setProfile] = useState<Profile>();
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable" | "missing">("loading");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [showAuthOverlay, setShowAuthOverlay] = useState(false);

  useEffect(() => {
    void fetch(`${apiBaseUrl()}/api/public/${slug}`).then(async (response) => {
      if (response.status === 503) return setStatus("unavailable");
      if (!response.ok) return setStatus("missing");
      setProfile(await response.json());
      setStatus("ready");
    });
  }, [slug]);

  const categories = useMemo(() => profile?.categories.filter((category) =>
    profile.services.some((service) => service.category === category.name),
  ) ?? [], [profile]);
  const brand = profile?.branding;
  const primary = brand?.primaryColor || "#402334";
  const accent = brand?.accentColor || "#f4d8a8";

  if (status === "loading") return <main className="grid min-h-screen place-items-center bg-[#f6f2f4] text-sm font-bold text-[#792f59]">Preparazione salone...</main>;
  if (status === "unavailable") return <main className="grid min-h-screen place-items-center bg-[#f6f2f4] p-5"><section className="max-w-md rounded-[2rem] bg-white p-8 text-center shadow-xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#792f59]">Prenotazioni online</p><h1 className="mt-3 text-3xl font-bold">Servizio momentaneamente non disponibile</h1><p className="mt-3 text-stone-600">Contatta direttamente il salone per fissare un appuntamento.</p></section></main>;
  if (status === "missing") return <main className="grid min-h-screen place-items-center bg-[#f6f2f4] p-5"><h1 className="text-2xl font-bold">Salone non trovato</h1></main>;

  return (
    <main className="min-h-screen px-4 py-6" style={{ background: `radial-gradient(circle at 10% 0%, ${accent}55, transparent 18rem), linear-gradient(180deg,#fffafd,#f6f2f4)` }}>
      <div className="animate-reveal mx-auto max-w-md">
        <div className="flex items-center justify-between rounded-2xl p-2.5 text-white shadow-[0_10px_28px_rgb(45_29_39_/_0.16)]" style={{ background: `linear-gradient(135deg, ${primary}, #792f59)` }}>
          {brand?.logoUrl ? <img alt="Logo salone" className="size-10 rounded-xl bg-white object-cover p-1" src={brand.logoUrl} /> : <span className="grid size-10 place-items-center rounded-xl bg-white/15 text-base font-black">E</span>}
          <div className="relative">
            <button
              aria-label={authStatus === "authenticated" ? "Il tuo account" : "Accedi"}
              className="flex items-center gap-2 rounded-full bg-white/15 py-1 pl-3 pr-1 text-sm font-bold transition hover:bg-white/25"
              onClick={() => (authStatus === "authenticated" ? setAccountMenuOpen((state) => !state) : setShowAuthOverlay(true))}
              type="button"
            >
              {authStatus === "authenticated" && customer ? customer.first_name : "Accedi"}
              <span className="grid size-8 place-items-center rounded-full bg-white text-xs font-black" style={{ color: primary }}>
                {authStatus === "authenticated" && customer ? initials(customer.full_name) : <UserRound className="size-4" />}
              </span>
            </button>
            {accountMenuOpen && customer && (
              <div className="animate-pop absolute right-0 top-[calc(100%+8px)] z-20 w-48 origin-top-right rounded-2xl bg-white p-3 text-left shadow-[0_18px_44px_rgb(45_29_39_/_0.25)]">
                <p className="truncate text-sm font-black text-stone-900">{customer.full_name}</p>
                <p className="truncate text-xs text-stone-500">{customer.phone}</p>
                <button
                  className="mt-3 flex w-full items-center gap-2 rounded-xl bg-stone-100 px-3 py-2 text-sm font-bold text-stone-700"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    void logout();
                  }}
                  type="button"
                >
                  <LogOut className="size-4" />Esci
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 px-0.5">
          {authStatus === "authenticated" && customer && <p className="text-base font-black" style={{ color: primary }}>Ciao, {customer.first_name}</p>}
          <h1 className={`text-[1.7rem] font-bold leading-tight text-stone-950 ${authStatus === "authenticated" && customer ? "mt-0.5" : ""}`}>{brand?.heroTitle || profile?.salon.name || "Esse Beauty"}</h1>
          <p className="mt-2 text-sm leading-6 text-stone-500">{brand?.heroSubtitle || "Il tuo spazio per prenderti cura di te, con la libertà di prenotare quando vuoi."}</p>
          <Link href={`/${slug}/book`} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl font-black text-white shadow-lg" style={{ background: primary }}><CalendarPlus className="size-5" />Prenota ora</Link>
        </div>

        {brand?.welcomeText && <p className="mt-5 rounded-3xl border border-white/80 bg-white/82 p-5 text-sm leading-6 text-stone-600 shadow-sm">{brand.welcomeText}</p>}
        <InstallAppButton accent={accent} enabled={brand?.installPromptEnabled !== false} primary={primary} />

        <section className="mt-5 grid grid-cols-2 gap-3">
          <Link className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-[0_14px_34px_rgb(45_29_39_/_0.08)] transition hover:-translate-y-0.5" href={`/${slug}/appointments`}>
            <span className="grid size-11 place-items-center rounded-2xl text-white" style={{ background: primary }}><CalendarDays className="size-5" /></span>
            <h2 className="mt-4 text-lg font-bold text-stone-950">I miei appuntamenti</h2>
            <p className="mt-1 text-sm leading-5 text-stone-500">Consulta le prenotazioni già effettuate.</p>
          </Link>
          <Link className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-[0_14px_34px_rgb(45_29_39_/_0.08)] transition hover:-translate-y-0.5" href={`/${slug}/book`}>
            <span className="grid size-11 place-items-center rounded-2xl" style={{ background: accent, color: primary }}><CalendarPlus className="size-5" /></span>
            <h2 className="mt-4 text-lg font-bold text-stone-950">Nuova prenotazione</h2>
            <p className="mt-1 text-sm leading-5 text-stone-500">Trova il trattamento e l’orario giusto.</p>
          </Link>
        </section>

        <section className="mt-7">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em]" style={{ color: primary }}><Sparkles className="size-4" />Da dove vuoi iniziare?</p>
          <h2 className="mt-2 text-2xl font-bold text-stone-950">Scegli un’esperienza</h2>
          <div className="mt-4 grid gap-3">
            {categories.map((category, index) => (
              <Link
                className="animate-reveal group flex min-h-20 items-center justify-between rounded-3xl border border-white/80 bg-white/88 px-5 shadow-[0_12px_30px_rgb(45_29_39_/_0.07)] transition hover:-translate-y-0.5"
                href={`/${slug}/book?category=${encodeURIComponent(category.name)}`}
                key={category.id}
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
              >
                <div className="flex items-center gap-4">
                  <span className="grid size-11 place-items-center rounded-2xl" style={{ background: `${primary}12`, color: primary }}>
                    <ServiceCategoryIcon className="size-5" name={category.icon} />
                  </span>
                  <strong className="text-base text-stone-950">{category.name}</strong>
                </div>
                <ArrowRight className="size-5 transition group-hover:translate-x-1" style={{ color: primary }} />
              </Link>
            ))}
          </div>
        </section>
      </div>
      {showAuthOverlay && <CustomerAuthOverlay accent={accent} onClose={() => setShowAuthOverlay(false)} primary={primary} salonName={profile?.salon.name} />}
    </main>
  );
}
