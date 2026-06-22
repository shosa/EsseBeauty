"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppPage, Breadcrumbs, Button, FormField, InlineError } from "@esse-beauty/ui";

import { useAuth } from "../../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function NewServicePage() {
  const { salon } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    if (!salon) return;
    void fetch(`${api}/api/salons/${salon.id}/service-categories?active=true`, { credentials: "include" })
      .then(async (response) => response.ok ? response.json() : [])
      .then((data: Array<{ id: string; name: string }>) => {
        setCategories(data);
        const requested = new URLSearchParams(window.location.search).get("category");
        setCategoryId(data.some((item) => item.id === requested) ? requested! : data[0]?.id ?? "");
      });
  }, [salon]);

  async function create(data: FormData) {
    if (!salon) return;
    const category = categories.find((item) => item.id === categoryId);
    if (!category) {
      setError("Seleziona una categoria prima di creare il servizio.");
      return;
    }
    const response = await fetch(`${api}/api/salons/${salon.id}/services`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        category: category.name,
        category_id: category.id,
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
    router.push(`/settings/services/${service.id}`);
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <form action={create} className="grid gap-4 rounded-2xl border border-[#e8dfe4] bg-white p-6 shadow-[0_10px_30px_rgb(45_29_39_/_0.055)]">
        <Breadcrumbs items={[{ href: "/settings/services", label: "Catalogo servizi" }, { label: "Nuovo servizio" }]} />
        <h1 className="text-3xl font-bold">Nuovo servizio</h1>
        {error && <InlineError>{error}</InlineError>}
        <FormField label="Nome servizio" required><input required name="name" className="min-h-12 w-full rounded-xl border px-3" /></FormField>
        <FormField label="Categoria" required>
          <select className="min-h-12 w-full" onChange={(event) => setCategoryId(event.target.value)} required value={categoryId}>
            <option disabled value="">Seleziona categoria</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </FormField>
        {categories.length === 0 && <InlineError>Prima crea almeno una categoria dal Catalogo servizi.</InlineError>}
        <FormField label="Descrizione"><textarea name="description" className="min-h-28 w-full rounded-xl border p-3" /></FormField>
        <FormField label="Durata" required description="Inserisci la durata in minuti."><input required name="duration" type="number" min="5" step="5" className="min-h-12 w-full rounded-xl border px-3" /></FormField>
        <FormField label="Prezzo informativo" required description="Solo informativo, non genera pagamenti o documenti fiscali."><input required name="price" type="number" min="0" step="0.01" className="min-h-12 w-full rounded-xl border px-3" /></FormField>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.push("/settings/services")}>Annulla</Button>
          <Button disabled={!categoryId} type="submit">Salva</Button>
        </div>
      </form>
    </AppPage>
  );
}
