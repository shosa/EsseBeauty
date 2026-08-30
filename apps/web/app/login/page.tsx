"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CircleAlert, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

import { BrandLogo } from "../_components/BrandLogo";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    const response = await fetch(`${api}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: formData.get("email"), password: formData.get("password") }),
    }).catch(() => null);
    if (!response) {
      setError("Il servizio non è raggiungibile. Controlla la connessione e riprova.");
      setLoading(false);
      return;
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error === "INVALID_CREDENTIALS"
        ? "L’email o la password non sono corrette. Verifica i dati inseriti."
        : "Non è stato possibile completare l’accesso. Riprova.");
      setLoading(false);
      return;
    }
    const sessionResponse = await fetch(`${api}/api/auth/me`, { credentials: "include" }).catch(() => null);
    if (!sessionResponse?.ok) {
      setError("La sessione non è disponibile. Effettua nuovamente l’accesso.");
      setLoading(false);
      return;
    }
    const session = await sessionResponse.json() as {
      salon?: { onboarding_completed?: boolean };
      user?: { role?: string };
    };
    const destination = session.user?.role === "owner" && session.salon?.onboarding_completed === false ? "/onboarding" : "/";
    window.location.replace(destination);
  }

  return (
    <main className="min-h-screen bg-white text-stone-950 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(28rem,0.78fr)]">
      <section aria-label="EsseBeauty" className="relative hidden min-h-screen overflow-hidden bg-[#2d1d27] px-12 py-10 text-white lg:flex lg:flex-col xl:px-16 xl:py-12">
        <div aria-hidden="true" className="absolute inset-y-0 right-0 w-px bg-white/10" />
        <div aria-hidden="true" className="absolute -bottom-44 -left-36 size-[32rem] rounded-full border border-white/8" />
        <BrandLogo className="pointer-events-none absolute -bottom-20 -right-24 size-[34rem] opacity-[0.045] xl:size-[42rem]" tone="white" />
        <header className="relative flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-xl border border-white/10 bg-white/8">
            <BrandLogo className="size-9" tone="white" />
          </span>
          <div><strong className="block text-base">EsseBeauty</strong><span className="block text-xs text-white/60">Workspace gestionale</span></div>
        </header>

        <div className="relative my-auto max-w-xl py-12">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#f4d8a8]">Il tuo spazio di lavoro</p>
          <h2 className="mt-4 max-w-lg font-display text-5xl font-semibold leading-[1.08] tracking-[-.035em] text-white xl:text-6xl">Il salone, organizzato con chiarezza.</h2>
          <p className="mt-6 max-w-lg text-base leading-7 text-white/70">Agenda, clienti, cassa e attività quotidiane restano coordinate in un unico ambiente riservato al team.</p>
        </div>

        <footer className="relative flex items-center gap-3 border-t border-white/10 pt-5 text-sm text-white/65">
          <ShieldCheck aria-hidden="true" className="size-5 shrink-0 text-[#f4d8a8]" />
          <span>Accesso protetto per il personale autorizzato.</span>
        </footer>
      </section>

      <section aria-labelledby="login-title" className="flex min-h-screen items-center justify-center bg-[#fbfaf9] px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-[27rem]">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="grid size-12 place-items-center rounded-xl bg-white shadow-sm ring-1 ring-stone-950/5">
              <BrandLogo className="size-9" />
            </span>
            <div><strong className="block text-base text-[#2d1d27]">EsseBeauty</strong><span className="block text-xs text-stone-500">Workspace gestionale</span></div>
          </div>

          <header>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#792f59]">Area riservata</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-.035em] text-[#2d1d27]" id="login-title">Accedi</h1>
            <p className="mt-3 text-[15px] leading-6 text-stone-600">Usa l’account assegnato dal tuo amministratore per entrare nel workspace del salone.</p>
          </header>

          <form action={submit} aria-busy={loading} className="mt-8">
            <div>
              <label className="block text-sm font-semibold text-stone-800" htmlFor="login-email">Email</label>
              <div className="group relative mt-2">
                <Mail aria-hidden="true" className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-stone-500 transition-colors group-focus-within:text-[#792f59]" />
                <input aria-describedby={error ? "login-error" : undefined} aria-invalid={Boolean(error)} autoCapitalize="none" autoComplete="email" autoFocus className="auth-text-input min-h-12 w-full rounded-xl border-stone-300 bg-white pl-11 pr-4 text-base shadow-sm" id="login-email" inputMode="email" name="email" placeholder="nome@esempio.it" required spellCheck={false} type="email" />
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-semibold text-stone-800" htmlFor="login-password">Password</label>
                <Link className="rounded-md text-sm font-semibold text-[#792f59] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20" href="/forgot-password">Password dimenticata?</Link>
              </div>
              <div className="group relative mt-2">
                <LockKeyhole aria-hidden="true" className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-stone-500 transition-colors group-focus-within:text-[#792f59]" />
                <input aria-describedby={error ? "login-error" : undefined} aria-invalid={Boolean(error)} autoComplete="current-password" className="auth-text-input min-h-12 w-full rounded-xl border-stone-300 bg-white pl-11 pr-14 text-base shadow-sm" id="login-password" minLength={10} name="password" required type={passwordVisible ? "text" : "password"} />
                <button aria-label={passwordVisible ? "Nascondi password" : "Mostra password"} aria-pressed={passwordVisible} className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20" onClick={() => setPasswordVisible((visible) => !visible)} type="button">
                  {passwordVisible ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
                </button>
              </div>
            </div>

            {error && <div aria-live="assertive" className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" id="login-error" role="alert"><CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-red-700" /><div><strong className="block font-semibold">Accesso non riuscito</strong><span className="mt-0.5 block leading-5">{error}</span></div></div>}

            <button className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#792f59] px-5 font-semibold text-white shadow-sm transition-colors hover:bg-[#642548] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/25 disabled:bg-stone-300 disabled:text-stone-600 disabled:shadow-none" disabled={loading} type="submit">
              {loading ? <><LoaderCircle aria-hidden="true" className="size-5 animate-spin" />Accesso in corso…</> : <>Accedi<ArrowRight aria-hidden="true" className="size-4" /></>}
            </button>
          </form>

          <p className="mt-7 flex items-start gap-2 border-t border-stone-200 pt-5 text-xs leading-5 text-stone-500"><LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span>Le credenziali vengono trasmesse tramite una connessione protetta e non vengono salvate in questa schermata.</span></p>
        </div>
      </section>
    </main>
  );
}
