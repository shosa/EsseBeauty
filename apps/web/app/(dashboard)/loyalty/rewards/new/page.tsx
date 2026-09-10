"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppPage, Breadcrumbs, Button, EmptyState, FormField, InlineError } from "@esse-beauty/ui";
import { MODULE_KEYS, useModuleEnabled } from "@esse-beauty/feature-flags";

import { useAuth } from "../../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function NewRewardPage() {
  const { salon } = useAuth();
  const router = useRouter();
  const moduleEnabled = useModuleEnabled(MODULE_KEYS.LOYALTY);
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
    router.push(`/loyalty/rewards/${reward.id}`);
  }

  if (!moduleEnabled) {
    return (
      <AppPage maxWidth="max-w-[1600px]">
        <Breadcrumbs items={[{ href: "/loyalty", label: "Fedeltà" }, { href: "/loyalty/rewards", label: "Premi" }, { label: "Nuovo premio" }]} />
        <div className="mt-5">
          <EmptyState
            action={<Link className="inline-flex min-h-10 items-center rounded-xl bg-[#6f244e] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#58203f]" href="/apps">Vai a App e moduli</Link>}
            description="Attiva il modulo Fedeltà dalla pagina App e moduli per creare nuovi premi."
            title="Modulo Fedeltà non attivo"
          />
        </div>
      </AppPage>
    );
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <form action={create} className="grid gap-4 rounded-2xl border border-[#e8dfe4] bg-white p-6 shadow-[0_10px_30px_rgb(45_29_39_/_0.055)]">
        <Breadcrumbs items={[{ href: "/loyalty", label: "Fedeltà" }, { href: "/loyalty/rewards", label: "Premi" }, { label: "Nuovo premio" }]} />
        <h1 className="text-3xl font-bold">Nuovo premio</h1>
        {error && <InlineError>{error}</InlineError>}
        <FormField label="Nome premio" required><input required name="name" className="min-h-12 w-full rounded-xl border px-3" /></FormField>
        <FormField label="Punti richiesti" required><input required name="points" type="number" min="1" className="min-h-12 w-full rounded-xl border px-3" /></FormField>
        <FormField label="Descrizione"><textarea name="description" className="min-h-28 w-full rounded-xl border p-3" /></FormField>
        <Button type="submit">Salva</Button>
      </form>
    </AppPage>
  );
}
