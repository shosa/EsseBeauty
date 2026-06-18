"use client";

import { useState } from "react";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    const response = await fetch(`${api}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    }).catch(() => null);
    if (!response) {
      setError("API non raggiungibile o richiesta bloccata dal browser.");
      setLoading(false);
      return;
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(
        body.error === "INVALID_CREDENTIALS"
          ? "Email o password non corretti."
          : "Operazione non riuscita.",
      );
      setLoading(false);
      return;
    }
    const sessionResponse = await fetch(`${api}/api/auth/me`, {
      credentials: "include",
    }).catch(() => null);
    if (!sessionResponse?.ok) {
      setError("Sessione non disponibile. Riprova.");
      setLoading(false);
      return;
    }
    const session = await sessionResponse.json() as {
      salon?: { onboarding_completed?: boolean };
      user?: { role?: string };
    };
    const destination =
      session.user?.role === "owner" &&
        session.salon?.onboarding_completed === false
        ? "/onboarding"
        : "/";
    window.location.replace(destination);
  }

  return <main className="grid min-h-screen place-items-center bg-[#f6f2f4] p-5"><section className="w-full max-w-md rounded-[2rem] bg-white p-7 shadow-xl"><div className="grid size-12 place-items-center rounded-2xl bg-[#402334] text-xl font-black text-white">E</div><p className="mt-6 text-xs font-bold uppercase tracking-[.2em] text-[#792f59]">Area riservata</p><h1 className="mt-2 text-3xl font-bold text-[#2d1d27]">Bentornato</h1><p className="mt-2 text-sm leading-6 text-stone-500">Accedi con le credenziali fornite dall&apos;amministratore EsseBeauty.</p>
    <form action={submit} className="mt-7 space-y-4"><label className="block text-sm font-semibold">Email<input name="email" type="email" required className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label><label className="block text-sm font-semibold">Password<input name="password" type="password" minLength={10} required className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label>{error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={loading} className="min-h-12 w-full rounded-xl bg-[#402334] font-bold text-white disabled:opacity-50">{loading ? "Attendi..." : "Accedi"}</button></form>
  </section></main>;
}
