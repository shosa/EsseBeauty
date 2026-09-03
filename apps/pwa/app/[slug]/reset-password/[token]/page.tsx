"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { Lock } from "lucide-react";

import { customerCompletePasswordReset } from "../../../../lib/customer-auth";

const ERROR_MESSAGES: Record<string, string> = {
  PASSWORD_TOO_SHORT: "La password deve contenere almeno 8 caratteri.",
  RESET_TOKEN_INVALID_OR_EXPIRED: "Il link non è più valido. Richiedine uno nuovo dalla schermata di accesso.",
};

export default function ResetPasswordPage() {
  const { slug, token } = useParams<{ slug: string; token: string }>();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(data: FormData) {
    setSubmitting(true);
    setError("");
    const result = await customerCompletePasswordReset(slug, token, String(data.get("password") ?? ""));
    setSubmitting(false);
    if (result.ok) {
      setDone(true);
      return;
    }
    setError((result.error && ERROR_MESSAGES[result.error]) || "Si è verificato un errore. Riprova.");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f2f4] p-5">
      <section className="animate-slide-up w-full max-w-md rounded-[2.2rem] bg-white p-7 shadow-[0_24px_70px_rgb(45_29_39_/_0.16)]">
        <span className="grid size-12 place-items-center rounded-2xl bg-[#402334] text-white"><Lock className="size-5" /></span>
        <h1 className="mt-4 text-2xl font-bold text-stone-950">Scegli una nuova password</h1>
        {done ? (
          <>
            <p className="mt-3 text-sm font-semibold text-emerald-700">Password aggiornata. Ora puoi accedere con la tua nuova password.</p>
            <Link className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#402334] font-black text-white" href={`/${slug}/appointments`}>Vai al login</Link>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-stone-500">Inserisci la nuova password per il tuo account.</p>
            {error && <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
            <form action={submit} className="mt-5 space-y-3">
              <label className="block text-sm font-black text-stone-800">
                Nuova password
                <div className="relative mt-2">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                  <input className="w-full pl-9" minLength={8} name="password" required type="password" />
                </div>
              </label>
              <button className="min-h-12 w-full rounded-2xl bg-[#402334] font-black text-white disabled:opacity-50" disabled={submitting} type="submit">
                {submitting ? "Un momento..." : "Aggiorna password"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
