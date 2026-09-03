"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Lock } from "lucide-react";

import { customerRegister, type CustomerProfile } from "../../../lib/customer-auth";
import { useCustomerAuth } from "./CustomerAuthProvider";

const ERROR_MESSAGES: Record<string, string> = {
  PASSWORD_TOO_SHORT: "La password deve contenere almeno 8 caratteri.",
  PHONE_ALREADY_REGISTERED: "Questo numero è già registrato: usa la pagina Appuntamenti per accedere.",
};

interface Prefill {
  email?: string;
  first_name: string;
  last_name: string;
  phone: string;
}

export function CompleteRegistrationCard({ prefill, primary }: { prefill: Prefill; primary: string }) {
  const { slug } = useParams<{ slug: string }>();
  const { setCustomer } = useCustomerAuth();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(data: FormData) {
    setSubmitting(true);
    setError("");
    const result = await customerRegister(slug, { ...prefill, password: String(data.get("password") ?? "") });
    setSubmitting(false);
    if (result.customer) {
      setCustomer(result.customer as CustomerProfile);
      setDone(true);
      return;
    }
    setError(ERROR_MESSAGES[result.error ?? ""] ?? "Si è verificato un errore. Riprova.");
  }

  if (done) {
    return (
      <section className="animate-slide-up mt-4 flex items-center gap-3 rounded-[2rem] border border-emerald-100 bg-emerald-50 p-5 text-emerald-800">
        <CheckCircle2 className="size-6 shrink-0" />
        <p className="text-sm font-bold">Account creato! Ora puoi accedere in un tap ai tuoi appuntamenti e alla fedeltà.</p>
      </section>
    );
  }

  return (
    <section className="animate-slide-up mt-4 rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-[0_18px_44px_rgb(45_29_39_/_0.09)]">
      <h2 className="text-lg font-black text-stone-950">Crea il tuo account, manca solo la password</h2>
      <p className="mt-1 text-sm text-stone-500">Abbiamo già {prefill.first_name} {prefill.last_name} · {prefill.phone}. Scegli una password per ritrovare appuntamenti e punti fedeltà ogni volta.</p>
      {error && <p className="animate-reveal mt-3 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      <form action={submit} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input aria-label="Password" className="w-full pl-9" minLength={8} name="password" placeholder="Crea una password" required type="password" />
        </label>
        <button className="min-h-12 shrink-0 rounded-2xl px-6 font-black text-white disabled:opacity-50" disabled={submitting} style={{ background: primary }} type="submit">
          {submitting ? "Un momento..." : "Crea account"}
        </button>
      </form>
    </section>
  );
}
