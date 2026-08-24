"use client";

import { useState } from "react";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    setMessage("");
    const response = await fetch(`${api}/api/auth/password-reset/request`, {
      body: JSON.stringify({ email: formData.get("email") }),
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
      setError(body.error === "PROVIDER_NOT_CONFIGURED"
        ? "L'invio email non è ancora configurato. Contatta l'amministratore."
        : "Non è stato possibile elaborare la richiesta. Riprova.");
      return;
    }
    setMessage("Se l'indirizzo è registrato, riceverai un link valido per 30 minuti.");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f2f4] p-5">
      <section aria-labelledby="recovery-title" className="w-full max-w-md rounded-[2rem] bg-white p-7 shadow-xl">
        <a href="/login" className="text-sm font-semibold text-[#792f59]">← Torna all'accesso</a>
        <p className="mt-6 text-xs font-bold uppercase tracking-[.2em] text-[#792f59]">Recupero account</p>
        <h1 id="recovery-title" className="mt-2 text-3xl font-bold text-[#2d1d27]">Reimposta la password</h1>
        <p className="mt-2 text-sm leading-6 text-stone-500">Inserisci la tua email. Per proteggere l'account, la risposta sarà uguale anche se l'indirizzo non è registrato.</p>
        <form action={submit} className="mt-7 space-y-4">
          <label className="block text-sm font-semibold">Email
            <input name="email" type="email" autoComplete="email" required className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3 outline-none focus:border-[#792f59] focus:ring-2 focus:ring-[#792f59]/20" />
          </label>
          {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button disabled={loading} className="min-h-12 w-full rounded-xl bg-[#402334] font-bold text-white disabled:opacity-50">{loading ? "Invio in corso..." : "Invia il link"}</button>
        </form>
      </section>
    </main>
  );
}
