"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumbs, Button, FormField, InlineError } from "@esse-beauty/ui";

import { useAuth } from "../../../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function NewRewardPage() {
  const { salon } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");

  async function create(data: FormData) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/loyalty/rewards`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        description: data.get("description") || undefined,
        points_required: Number(data.get("points")),
      }),
    });
    if (!response.ok) {
      setError("Premio non creato.");
      return;
    }
    const reward = await response.json() as { id: string };
    router.push(`/settings/loyalty/rewards/${reward.id}`);
  }

  return (
    <main className="p-5 md:p-8">
      <form action={create} className="mx-auto grid max-w-[1000px] gap-4 rounded-3xl bg-white p-6 shadow-sm md:p-8">
        <Breadcrumbs items={[{ href: "/settings/loyalty", label: "Fedeltà" }, { label: "Nuovo premio" }]} />
        <h1 className="text-3xl font-bold">Nuovo premio</h1>
        {error && <InlineError>{error}</InlineError>}
        <FormField label="Nome premio" required><input required name="name" className="min-h-12 w-full rounded-xl border px-3" /></FormField>
        <FormField label="Punti richiesti" required><input required name="points" type="number" min="1" className="min-h-12 w-full rounded-xl border px-3" /></FormField>
        <FormField label="Descrizione"><textarea name="description" className="min-h-28 w-full rounded-xl border p-3" /></FormField>
        <Button type="submit">Salva</Button>
      </form>
    </main>
  );
}
