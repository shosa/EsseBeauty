"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppPage, Breadcrumbs, Button, FormField, InlineError } from "@esse-beauty/ui";

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
    <AppPage maxWidth="max-w-[1600px]">
      <form action={invite} className="grid gap-4 rounded-2xl border border-[#e8dfe4] bg-white p-6 shadow-[0_10px_30px_rgb(45_29_39_/_0.055)]">
        <Breadcrumbs items={[{ href: "/settings/users", label: "Utenti" }, { label: "Invita" }]} />
        <h1 className="text-3xl font-bold">Invita utente</h1>
        {error && <InlineError>{error}</InlineError>}
        {temporaryPassword && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Password temporanea: <code className="font-bold">{temporaryPassword}</code></div>}
        <FormField label="Nome completo" required><input required name="full_name" className="min-h-12 w-full rounded-xl border px-3" /></FormField>
        <FormField label="Email" required><input required type="email" name="email" className="min-h-12 w-full rounded-xl border px-3" /></FormField>
        <FormField label="Ruolo" required><select name="role" defaultValue="employee" className="min-h-12 w-full rounded-xl border bg-white px-3">
          <option value="manager">Manager</option>
          <option value="receptionist">Receptionist</option>
          <option value="employee">Dipendente</option>
        </select></FormField>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.push("/settings/users")}>Torna</Button>
          <Button type="submit">Crea utente</Button>
        </div>
      </form>
    </AppPage>
  );
}
