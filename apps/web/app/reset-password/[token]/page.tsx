"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>();
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");
    setError("");
    if (password !== confirmation) {
      setError("Le password non coincidono.");
      return;
    }
    setLoading(true);
    const response = await fetch(`${api}/api/auth/password-reset/complete`, {
      body: JSON.stringify({ new_password: password, token: params.token }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }).catch(() => null);
    setLoading(false);
    if (!response) {
      setError("Servizio non raggiungibile. Riprova tra poco.");
      return;
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      setError(body.error === "RESET_TOKEN_INVALID_OR_EXPIRED"
        ? "Questo link è scaduto o è già stato utilizzato. Richiedine uno nuovo."
        : "Non è stato possibile aggiornare la password.");
      return;
    }
    setCompleted(true);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f2f4] p-5">
      <section aria-labelledby="reset-title" className="w-full max-w-md rounded-[2rem] bg-white p-7 shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#792f59]">Sicurezza account</p>
        <h1 id="reset-title" className="mt-2 text-3xl font-bold text-[#2d1d27]">Nuova password</h1>
        <div aria-live="polite">
          {completed ? (
            <div className="mt-6 rounded-2xl bg-emerald-50 p-5 text-emerald-900">
              <p className="font-bold">Password aggiornata</p>
              <p className="mt-1 text-sm">Le sessioni precedenti sono state disconnesse.</p>
              <a href="/login" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#402334] px-5 font-bold text-white">Accedi</a>
            </div>
          ) : (
            <form action={submit} className="mt-7 space-y-4">
              <p className="text-sm leading-6 text-stone-500">Usa almeno 10 caratteri. Il link può essere utilizzato una sola volta.</p>
              <label className="block text-sm font-semibold">Nuova password
                <input name="password" type="password" autoComplete="new-password" minLength={10} required className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3 outline-none focus:border-[#792f59] focus:ring-2 focus:ring-[#792f59]/20" />
              </label>
              <label className="block text-sm font-semibold">Conferma nuova password
                <input name="confirmation" type="password" autoComplete="new-password" minLength={10} required className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3 outline-none focus:border-[#792f59] focus:ring-2 focus:ring-[#792f59]/20" />
              </label>
              {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <button disabled={loading} className="min-h-12 w-full rounded-xl bg-[#402334] font-bold text-white disabled:opacity-50">{loading ? "Aggiornamento..." : "Aggiorna password"}</button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
