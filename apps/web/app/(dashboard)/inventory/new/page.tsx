"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppPage, Breadcrumbs, Button, InlineError } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function NewInventoryProductPage() {
  const { salon } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");

  async function create(data: FormData) {
    if (!salon) return;
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/inventory`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        sku: data.get("sku") || undefined,
        stock_quantity: Number(data.get("stock")),
        low_stock_threshold: Number(data.get("threshold")),
        unit_price_cents: Math.round(Number(data.get("price")) * 100),
        supplier: data.get("supplier") || undefined,
        active: true,
      }),
    });
    if (!response.ok) {
      setError("Prodotto non creato.");
      return;
    }
    const product = await response.json() as { id: string };
    router.push(`/inventory/${product.id}`);
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <form action={create} className="grid gap-4 rounded-2xl border border-[#e8dfe4] bg-white p-6 shadow-[0_10px_30px_rgb(45_29_39_/_0.055)] md:grid-cols-2">
        <div className="md:col-span-2">
          <Breadcrumbs items={[{ href: "/inventory", label: "Inventario" }, { label: "Nuovo prodotto" }]} />
          <p className="mt-6 text-xs font-bold uppercase tracking-[.2em] text-rose-700">Magazzino</p>
          <h1 className="mt-2 text-3xl font-bold">Nuovo prodotto</h1>
        </div>
        {error && <div className="md:col-span-2"><InlineError>{error}</InlineError></div>}
        {[
          { name: "name", label: "Nome", type: "text", required: true },
          { name: "sku", label: "SKU", type: "text", required: false },
          { name: "stock", label: "Scorta iniziale", type: "number", required: true },
          { name: "threshold", label: "Soglia minima", type: "number", required: true },
          { name: "price", label: "Prezzo unitario informativo", type: "number", required: true },
          { name: "supplier", label: "Fornitore", type: "text", required: false },
        ].map((field) => (
          <label key={field.name} className="text-sm font-semibold">
            {field.label}
            <input name={field.name} type={field.type} required={field.required} className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" />
          </label>
        ))}
        <div className="flex justify-end gap-3 md:col-span-2">
          <Button type="button" variant="ghost" onClick={() => router.push("/inventory")}>Annulla</Button>
          <Button type="submit">Salva</Button>
        </div>
      </form>
    </AppPage>
  );
}
