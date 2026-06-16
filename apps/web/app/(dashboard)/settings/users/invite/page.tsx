"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumbs, Button, InlineError } from "@esse-beauty/ui";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function InviteUserPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");

  async function invite(formData: FormData) {
    setError("");
    setTemporaryPassword("");
    const response = await fetch(`${apiBaseUrl}/api/auth/invite`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        full_name: formData.get("full_name"),
        role: formData.get("role"),
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError("Utente non creato. Verifica email e permessi.");
      return;
    }
    setTemporaryPassword(result.temporary_password ?? "");
  }

  return (
    <main className="min-h-screen bg-stone-100 p-5 md:p-10">
      <form action={invite} className="mx-auto grid max-w-2xl gap-4 rounded-3xl bg-white p-6 shadow-sm md:p-8">
        <Breadcrumbs items={[{ href: "/settings/users", label: "Utenti" }, { label: "Invita" }]} />
        <h1 className="text-3xl font-bold">Invita utente</h1>
        {error && <InlineError>{error}</InlineError>}
        {temporaryPassword && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Password temporanea: <code className="font-bold">{temporaryPassword}</code></div>}
        <input required name="full_name" placeholder="Nome completo" className="min-h-12 rounded-xl border px-3" />
        <input required type="email" name="email" placeholder="Email" className="min-h-12 rounded-xl border px-3" />
        <select name="role" defaultValue="employee" className="min-h-12 rounded-xl border bg-white px-3">
          <option value="manager">Manager</option>
          <option value="receptionist">Receptionist</option>
          <option value="employee">Dipendente</option>
        </select>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.push("/settings/users")}>Torna</Button>
          <Button type="submit">Crea utente</Button>
        </div>
      </form>
    </main>
  );
}
