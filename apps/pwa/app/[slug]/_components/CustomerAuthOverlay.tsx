"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Lock, Mail, Phone, X } from "lucide-react";

import { customerLogin, customerRegister, customerRequestPasswordReset, type CustomerProfile } from "../../../lib/customer-auth";
import { useCustomerAuth } from "./CustomerAuthProvider";

const ERROR_MESSAGES: Record<string, string> = {
  CUSTOMER_BLOCKED: "Non è possibile accedere con questi dati. Contatta il salone.",
  CUSTOMER_NAME_PARTS_REQUIRED: "Inserisci nome e cognome.",
  EMAIL_REQUIRED: "Inserisci l'email associata al tuo account.",
  INVALID_CREDENTIALS: "Telefono o password errati.",
  PASSWORD_TOO_SHORT: "La password deve contenere almeno 8 caratteri.",
  PHONE_ALREADY_REGISTERED: "Questo numero è già registrato. Accedi invece.",
  PHONE_INVALID: "Numero di telefono non valido.",
  PROVIDER_NOT_CONFIGURED: "Il recupero password non è al momento disponibile. Contatta il salone.",
};

function errorMessage(code?: string): string {
  return (code && ERROR_MESSAGES[code]) || "Si è verificato un errore. Riprova.";
}

interface Props {
  accent: string;
  onClose?: () => void;
  primary: string;
  requireEmail?: boolean;
  salonName?: string;
  subtitle?: string;
}

export function CustomerAuthOverlay({ accent, onClose, primary, requireEmail = true, salonName, subtitle }: Props) {
  const { slug } = useParams<{ slug: string }>();
  const { setCustomer } = useCustomerAuth();
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function submit(data: FormData) {
    setSubmitting(true);
    setError("");
    if (mode === "reset") {
      const result = await customerRequestPasswordReset(slug, String(data.get("email") ?? "").trim());
      setSubmitting(false);
      if (result.ok) {
        setResetSent(true);
        return;
      }
      setError(errorMessage(result.error));
      return;
    }
    const phone = String(data.get("phone") ?? "");
    const password = String(data.get("password") ?? "");
    const result = mode === "login"
      ? await customerLogin(slug, { password, phone })
      : await customerRegister(slug, {
        email: String(data.get("email") ?? "").trim() || undefined,
        first_name: String(data.get("first_name") ?? "").trim(),
        last_name: String(data.get("last_name") ?? "").trim(),
        password,
        phone,
      });
    setSubmitting(false);
    if (result.customer) {
      setCustomer(result.customer as CustomerProfile);
      onClose?.();
      return;
    }
    if (mode === "login" && result.error === "PHONE_ALREADY_REGISTERED") setMode("register");
    setError(errorMessage(result.error));
  }

  function switchMode(nextMode: "login" | "register" | "reset") {
    setMode(nextMode);
    setError("");
    setResetSent(false);
  }

  return (
    <div className="animate-fade-in fixed inset-0 z-40 grid place-items-end bg-[#2d1d27]/55 p-3 backdrop-blur-sm sm:place-items-center">
      <section className="animate-slide-up relative w-full max-w-md rounded-t-[2.2rem] p-6 shadow-[0_-24px_70px_rgb(45_29_39_/_0.25)] sm:rounded-[2.2rem] sm:shadow-[0_24px_70px_rgb(45_29_39_/_0.25)]" style={{ background: `radial-gradient(circle at top left, ${accent}35, transparent 14rem), #fff` }}>
        {onClose && (
          <button aria-label="Chiudi" className="absolute right-5 top-5 grid size-9 place-items-center rounded-full bg-stone-100 text-stone-500" onClick={onClose} type="button">
            <X className="size-4" />
          </button>
        )}
        <span className="grid size-12 place-items-center rounded-2xl text-white" style={{ background: primary }}><Lock className="size-5" /></span>
        <h1 className="mt-4 text-2xl font-bold text-stone-950">{mode === "login" ? "Accedi" : mode === "register" ? "Crea il tuo account" : "Recupera la password"}</h1>
        <p className="mt-1 text-sm text-stone-500">
          {mode === "reset"
            ? "Inserisci l'email del tuo account: se corrisponde, ti invieremo un link per scegliere una nuova password."
            : subtitle ?? (mode === "login"
              ? `Accedi con il tuo numero di telefono per continuare${salonName ? ` su ${salonName}` : ""}.`
              : "Registrati con il tuo numero di telefono: se hai già prenotato, troveremo subito i tuoi dati.")}
        </p>

        {error && <p className="animate-reveal mt-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

        {mode === "reset" && resetSent ? (
          <p className="animate-reveal mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Se l&apos;indirizzo è registrato, riceverai a breve un&apos;email con il link per reimpostare la password.</p>
        ) : (
          <form action={submit} className="animate-reveal mt-5 space-y-3" key={mode}>
            {mode === "register" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-black text-stone-800">Nome<input className="mt-2 w-full" name="first_name" required type="text" /></label>
                <label className="block text-sm font-black text-stone-800">Cognome<input className="mt-2 w-full" name="last_name" required type="text" /></label>
              </div>
            )}
            {mode === "reset" ? (
              <label className="block text-sm font-black text-stone-800">
                Email
                <div className="relative mt-2">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                  <input className="w-full pl-9" name="email" required type="email" />
                </div>
              </label>
            ) : (
              <>
                <label className="block text-sm font-black text-stone-800">
                  Telefono
                  <div className="relative mt-2">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                    <input className="w-full pl-9" inputMode="tel" name="phone" required type="tel" />
                  </div>
                </label>
                {mode === "register" && (
                  <label className="block text-sm font-black text-stone-800">Email{requireEmail ? "" : " (opzionale)"}<input className="mt-2 w-full" name="email" required={requireEmail} type="email" /></label>
                )}
                <label className="block text-sm font-black text-stone-800">
                  Password
                  <div className="relative mt-2">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                    <input className="w-full pl-9" minLength={mode === "register" ? 8 : undefined} name="password" required type="password" />
                  </div>
                </label>
              </>
            )}
            <button className="mt-2 min-h-12 w-full rounded-2xl font-black text-white disabled:opacity-50" disabled={submitting} style={{ background: primary }} type="submit">
              {submitting ? "Un momento..." : mode === "login" ? "Accedi" : mode === "register" ? "Registrati" : "Invia link di recupero"}
            </button>
          </form>
        )}

        {mode === "login" && <button className="mt-3 w-full text-center text-xs font-bold text-stone-500" onClick={() => switchMode("reset")} type="button">Password dimenticata?</button>}

        <button className="mt-3 w-full text-center text-sm font-bold" onClick={() => switchMode(mode === "register" ? "login" : mode === "reset" ? "login" : "register")} style={{ color: primary }} type="button">
          {mode === "login" ? "Non hai un account? Registrati" : mode === "register" ? "Hai già un account? Accedi" : "← Torna al login"}
        </button>
      </section>
    </div>
  );
}
