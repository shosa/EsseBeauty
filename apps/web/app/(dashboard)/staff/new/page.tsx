"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumbs, Button, FormField, InlineError } from "@esse-beauty/ui";
import type { WorkingHours } from "@esse-beauty/shared";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
const emptyHours: WorkingHours = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };

export default function NewStaffPage() {
  const { salon } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");

  async function create(data: FormData) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/staff`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        display_name: data.get("display_name"),
        bio: data.get("bio") || undefined,
        working_hours: emptyHours,
        color: "#be6b7b",
      }),
    });
    if (!response.ok) {
      setError("Collaboratore non creato.");
      return;
    }
    const member = await response.json() as { id: string };
    router.push(`/staff/${member.id}`);
  }

  return (
    <main className="min-h-screen bg-stone-100 p-5 md:p-10">
      <form action={create} className="mx-auto grid max-w-3xl gap-4 rounded-3xl bg-white p-6 shadow-sm md:p-8">
        <Breadcrumbs items={[{ href: "/staff", label: "Staff" }, { label: "Nuovo collaboratore" }]} />
        <h1 className="text-3xl font-bold">Nuovo collaboratore</h1>
        {error && <InlineError>{error}</InlineError>}
        <FormField label="Nome visibile" required><input required name="display_name" className="min-h-12 w-full rounded-xl border px-3" /></FormField>
        <FormField label="Bio o note interne"><textarea name="bio" className="min-h-28 w-full rounded-xl border p-3" /></FormField>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.push("/staff")}>Annulla</Button>
          <Button type="submit">Crea</Button>
        </div>
      </form>
    </main>
  );
}
