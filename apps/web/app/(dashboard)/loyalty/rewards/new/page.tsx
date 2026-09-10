"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppPage, Breadcrumbs, Button, FormField, InlineError } from "@esse-beauty/ui";

import { useAuth } from "../../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
type RewardType = "free_treatment" | "free_product" | "fixed_discount" | "percent_discount" | "credit";
interface CatalogItem { id: string; name: string; priceCents?: number; price_cents?: number; }

export default function NewRewardPage() {
  const { salon } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [type, setType] = useState<RewardType>("fixed_discount");
  const [services, setServices] = useState<CatalogItem[]>([]);
  const [products, setProducts] = useState<CatalogItem[]>([]);

  useEffect(() => {
    if (!salon) return;
    void Promise.all([
      fetch(`${api}/api/salons/${salon.id}/services?active=true`, { credentials: "include" }).then(async (response) => response.ok ? response.json() as Promise<CatalogItem[]> : []),
      fetch(`${api}/api/salons/${salon.id}/products?active=true`, { credentials: "include" }).then(async (response) => response.ok ? response.json() as Promise<CatalogItem[]> : []),
    ]).then(([loadedServices, loadedProducts]) => { setServices(loadedServices); setProducts(loadedProducts); });
  }, [salon]);

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
        type,
        ...(type === "free_treatment" && { service_id: data.get("service_id") }),
        ...(type === "free_product" && { product_id: data.get("product_id") }),
        ...((type === "fixed_discount" || type === "credit") && { discount_amount_cents: Math.round(Number(data.get("amount")) * 100) }),
        ...(type === "percent_discount" && { discount_percent: Number(data.get("percent")), max_discount_cents: data.get("max_discount") ? Math.round(Number(data.get("max_discount")) * 100) : undefined }),
        ...((type === "fixed_discount" || type === "percent_discount") && { min_spend_cents: data.get("min_spend") ? Math.round(Number(data.get("min_spend")) * 100) : undefined }),
      }),
    });
    if (!response.ok) {
      setError("Premio non creato.");
      return;
    }
    const reward = await response.json() as { id: string };
    router.push(`/loyalty/rewards/${reward.id}`);
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <form action={create} className="grid gap-4 rounded-2xl border border-[#e8dfe4] bg-white p-6 shadow-[0_10px_30px_rgb(45_29_39_/_0.055)]">
        <Breadcrumbs items={[{ href: "/loyalty", label: "Fedeltà" }, { href: "/loyalty/rewards", label: "Premi" }, { label: "Nuovo premio" }]} />
        <h1 className="text-3xl font-bold">Nuovo premio</h1>
        {error && <InlineError>{error}</InlineError>}
        <FormField label="Nome premio" required><input required name="name" className="min-h-12 w-full rounded-xl border px-3" /></FormField>
        <FormField label="Punti richiesti" required><input required name="points" type="number" min="1" className="min-h-12 w-full rounded-xl border px-3" /></FormField>
        <FormField label="Tipo di premio" required>
          <select className="min-h-12 w-full rounded-xl border px-3" onChange={(event) => setType(event.target.value as RewardType)} value={type}>
            <option value="free_treatment">Trattamento omaggio</option><option value="free_product">Prodotto omaggio</option><option value="fixed_discount">Sconto fisso</option><option value="percent_discount">Sconto percentuale</option><option value="credit">Credito</option>
          </select>
        </FormField>
        {type === "free_treatment" && <FormField label="Trattamento" required><select className="min-h-12 w-full rounded-xl border px-3" name="service_id" required defaultValue=""><option disabled value="">Seleziona un trattamento</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></FormField>}
        {type === "free_product" && <FormField label="Prodotto" required><select className="min-h-12 w-full rounded-xl border px-3" name="product_id" required defaultValue=""><option disabled value="">Seleziona un prodotto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></FormField>}
        {(type === "fixed_discount" || type === "credit") && <FormField label={type === "credit" ? "Importo credito (€)" : "Importo sconto (€)"} required><input className="min-h-12 w-full rounded-xl border px-3" min="0.01" name="amount" required step="0.01" type="number" /></FormField>}
        {type === "percent_discount" && <><FormField label="Sconto percentuale" required><input className="min-h-12 w-full rounded-xl border px-3" max="100" min="1" name="percent" required type="number" /></FormField><FormField label="Sconto massimo (€)"><input className="min-h-12 w-full rounded-xl border px-3" min="0" name="max_discount" step="0.01" type="number" /></FormField></>}
        {(type === "fixed_discount" || type === "percent_discount") && <FormField label="Spesa minima (€)"><input className="min-h-12 w-full rounded-xl border px-3" min="0" name="min_spend" step="0.01" type="number" /></FormField>}
        <FormField label="Descrizione"><textarea name="description" className="min-h-28 w-full rounded-xl border p-3" /></FormField>
        <Button type="submit">Salva</Button>
      </form>
    </AppPage>
  );
}
