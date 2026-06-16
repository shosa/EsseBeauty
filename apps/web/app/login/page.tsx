"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function LoginPage() {
  const router = useRouter();
  const [bootstrap, setBootstrap] = useState<boolean>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch(`${api}/api/auth/bootstrap/status`)
      .then((response) => response.json())
      .then((data) => setBootstrap(data.required))
      .catch(() => setError("API non raggiungibile."));
  }, []);

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    const endpoint = bootstrap ? "bootstrap" : "login";
    const payload = bootstrap
      ? {
          salon_name: formData.get("salon_name"),
          full_name: formData.get("full_name"),
          email: formData.get("email"),
          password: formData.get("password"),
        }
      : {
          email: formData.get("email"),
          password: formData.get("password"),
        };
    const response = await fetch(`${api}/api/auth/${endpoint}`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
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
          : body.error === "PASSWORD_TOO_SHORT"
            ? "La password deve contenere almeno 10 caratteri."
            : "Operazione non riuscita.",
      );
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return <main className="grid min-h-screen place-items-center bg-[#f6f2f4] p-5"><section className="w-full max-w-md rounded-[2rem] bg-white p-7 shadow-xl"><div className="grid size-12 place-items-center rounded-2xl bg-[#402334] text-xl font-black text-white">E</div><p className="mt-6 text-xs font-bold uppercase tracking-[.2em] text-[#792f59]">{bootstrap ? "Primo avvio" : "Area riservata"}</p><h1 className="mt-2 text-3xl font-bold text-[#2d1d27]">{bootstrap ? "Crea il tuo salone" : "Bentornato"}</h1><p className="mt-2 text-sm leading-6 text-stone-500">{bootstrap ? "Configura l'account owner locale. Nessun servizio esterno richiesto." : "Accedi con le credenziali salvate nel tuo server."}</p>
    {bootstrap === undefined ? <div className="mt-7 h-64 animate-pulse rounded-2xl bg-stone-100" /> : <form action={submit} className="mt-7 space-y-4">{bootstrap && <><label className="block text-sm font-semibold">Nome salone<input name="salon_name" required className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label><label className="block text-sm font-semibold">Nome e cognome<input name="full_name" required className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label></>}<label className="block text-sm font-semibold">Email<input name="email" type="email" required className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label><label className="block text-sm font-semibold">Password<input name="password" type="password" minLength={10} required className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label>{error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={loading} className="min-h-12 w-full rounded-xl bg-[#402334] font-bold text-white disabled:opacity-50">{loading ? "Attendi…" : bootstrap ? "Crea salone" : "Accedi"}</button></form>}
  </section></main>;
}
