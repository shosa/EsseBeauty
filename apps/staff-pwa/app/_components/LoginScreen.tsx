"use client";

import { type FormEvent, useState } from "react";

import { Button, FormField, InlineError } from "@esse-beauty/ui";

import { useStaffAuth } from "./StaffAuthProvider";

export function LoginScreen() {
  const { login } = useStaffAuth();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const ok = await login(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
    setSubmitting(false);
    if (!ok) setError("Credenziali non valide o profilo staff non collegato.");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#faf8f4] p-5">
      <section className="w-full max-w-sm rounded-3xl border border-stone-200 bg-white p-7">
        <span className="grid size-12 place-items-center rounded-2xl bg-stone-950"><img alt="EsseBeauty" className="h-6 w-auto brightness-0 invert" src="/esse-logo.svg" /></span>
        <p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-[#792f59]">EsseBeauty Staff</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight text-stone-950">Il tuo lavoro,<br />senza rumore.</h1>
        <p className="mt-3 text-sm leading-6 text-stone-500">Agenda, clienti e richieste in un’app pensata per la giornata in salone.</p>
        {error && <InlineError className="mt-5">{error}</InlineError>}
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <FormField label="Email" required><input autoComplete="email" name="email" required type="email" /></FormField>
          <FormField label="Password" required><input autoComplete="current-password" name="password" required type="password" /></FormField>
          <Button className="mt-2 w-full" disabled={submitting} type="submit" variant="primary">{submitting ? "Accesso…" : "Accedi"}</Button>
        </form>
      </section>
    </main>
  );
}
