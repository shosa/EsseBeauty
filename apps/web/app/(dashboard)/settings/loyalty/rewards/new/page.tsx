"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumbs, Button, InlineError } from "@esse-beauty/ui";

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
    <main className="min-h-screen bg-stone-100 p-5 md:p-10">
      <form action={create} className="mx-auto grid max-w-2xl gap-4 rounded-3xl bg-white p-6 shadow-sm md:p-8">
        <Breadcrumbs items={[{ href: "/settings/loyalty", label: "Fedeltà" }, { label: "Nuovo premio" }]} />
        <h1 className="text-3xl font-bold">Nuovo premio</h1>
        {error && <InlineError>{error}</InlineError>}
        <input required name="name" placeholder="Nome premio" className="min-h-12 rounded-xl border px-3" />
        <input required name="points" type="number" min="1" placeholder="Punti richiesti" className="min-h-12 rounded-xl border px-3" />
        <textarea name="description" placeholder="Descrizione" className="min-h-28 rounded-xl border p-3" />
        <Button type="submit">Salva</Button>
      </form>
    </main>
  );
}
