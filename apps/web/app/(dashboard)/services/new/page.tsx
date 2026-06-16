"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumbs, Button, InlineError } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function NewServicePage() {
  const { salon } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");

  async function create(data: FormData) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/services`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        category: data.get("category"),
        description: data.get("description") || undefined,
        duration_minutes: Number(data.get("duration")),
        price_cents: Math.round(Number(data.get("price")) * 100),
      }),
    });
    if (!response.ok) {
      setError("Servizio non creato.");
      return;
    }
    const service = await response.json() as { id: string };
    router.push(`/services/${service.id}`);
  }

  return (
    <main className="min-h-screen bg-stone-100 p-5 md:p-10">
      <form action={create} className="mx-auto grid max-w-3xl gap-4 rounded-3xl bg-white p-6 shadow-sm md:p-8">
        <Breadcrumbs items={[{ href: "/services", label: "Servizi" }, { label: "Nuovo servizio" }]} />
        <h1 className="text-3xl font-bold">Nuovo servizio</h1>
        {error && <InlineError>{error}</InlineError>}
        <input required name="name" placeholder="Nome" className="min-h-12 rounded-xl border px-3" />
        <input required name="category" placeholder="Categoria" className="min-h-12 rounded-xl border px-3" />
        <textarea name="description" placeholder="Descrizione" className="min-h-28 rounded-xl border p-3" />
        <input required name="duration" type="number" min="5" step="5" placeholder="Durata minuti" className="min-h-12 rounded-xl border px-3" />
        <input required name="price" type="number" min="0" step="0.01" placeholder="Prezzo informativo" className="min-h-12 rounded-xl border px-3" />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.push("/services")}>Annulla</Button>
          <Button type="submit">Salva</Button>
        </div>
      </form>
    </main>
  );
}
