"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Breadcrumbs, Button, ConfirmDialog, EmptyState, InlineError, PageSkeleton } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Product {
  id: string;
  lowStockThreshold: number;
  name: string;
  sku?: string | null;
  stockQuantity: number;
  supplier?: string | null;
  unitPriceCents: number;
}

interface Movement {
  createdAt: string;
  delta: number;
  id: string;
  reason: string;
}

export default function InventoryProductPage() {
  const { productId } = useParams<{ productId: string }>();
  const router = useRouter();
  const { salon } = useAuth();
  const [product, setProduct] = useState<Product>();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function load() {
    if (!salon) return;
    setLoading(true);
    const [productsResponse, movementsResponse] = await Promise.all([
      fetch(`${api}/api/salons/${salon.id}/inventory`, { credentials: "include" }),
      fetch(`${api}/api/salons/${salon.id}/inventory/${productId}/movements`, { credentials: "include" }),
    ]);
    if (!productsResponse.ok) {
      setError("Impossibile caricare il prodotto.");
      setLoading(false);
      return;
    }
    const products = await productsResponse.json() as Product[];
    setProduct(products.find((item) => item.id === productId));
    setMovements(movementsResponse.ok ? await movementsResponse.json() as Movement[] : []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [salon?.id, productId]);

  async function save(data: FormData) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/inventory/${productId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        sku: data.get("sku") || null,
        low_stock_threshold: Number(data.get("threshold")),
        unit_price_cents: Math.round(Number(data.get("price")) * 100),
        supplier: data.get("supplier") || null,
      }),
    });
    if (!response.ok) {
      setError("Prodotto non salvato.");
      return;
    }
    await load();
  }

  async function archive() {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/inventory/${productId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      setError("Prodotto non archiviato.");
      return;
    }
    router.push("/inventory");
  }

  if (loading) return <PageSkeleton />;

  return (
    <main className="min-h-screen bg-stone-100 p-5 md:p-10">
      <div className="mx-auto max-w-5xl">
        <Breadcrumbs items={[{ href: "/inventory", label: "Inventario" }, { label: product?.name ?? "Prodotto" }]} />
        {error && <div className="mt-4"><InlineError>{error}</InlineError></div>}
        {!product ? (
          <EmptyState title="Prodotto non trovato" description="Potrebbe essere archiviato o non accessibile." />
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
            <form action={save} className="grid gap-4 rounded-3xl bg-white p-6 shadow-sm md:grid-cols-2">
              <div className="md:col-span-2">
                <p className="text-xs font-bold uppercase tracking-[.2em] text-rose-700">Prodotto</p>
                <h1 className="mt-2 text-3xl font-bold">{product.name}</h1>
              </div>
              <label className="text-sm font-semibold">Nome<input name="name" defaultValue={product.name} required className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label>
              <label className="text-sm font-semibold">SKU<input name="sku" defaultValue={product.sku ?? ""} className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label>
              <label className="text-sm font-semibold">Soglia minima<input name="threshold" type="number" defaultValue={product.lowStockThreshold} required className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label>
              <label className="text-sm font-semibold">Prezzo unitario informativo<input name="price" type="number" defaultValue={(product.unitPriceCents / 100).toFixed(2)} required className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label>
              <label className="text-sm font-semibold md:col-span-2">Fornitore<input name="supplier" defaultValue={product.supplier ?? ""} className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label>
              <div className="flex justify-end gap-3 md:col-span-2">
                <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>Archivia</Button>
                <Button type="submit">Salva modifiche</Button>
              </div>
            </form>
            <aside className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">Movimenti</h2>
              <p className="mt-1 text-sm text-stone-600">Scorta attuale: <strong>{product.stockQuantity}</strong></p>
              <div className="mt-4 space-y-3">
                {movements.length === 0 ? <p className="text-sm text-stone-500">Nessun movimento registrato.</p> : movements.map((movement) => (
                  <article key={movement.id} className="rounded-2xl bg-stone-50 p-3 text-sm">
                    <strong>{movement.delta > 0 ? "+" : ""}{movement.delta}</strong> · {movement.reason}
                    <p className="text-xs text-stone-500">{new Date(movement.createdAt).toLocaleString("it-IT")}</p>
                  </article>
                ))}
              </div>
            </aside>
          </div>
        )}
      </div>
      <ConfirmDialog
        confirmLabel="Archivia"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void archive()}
        open={confirmDelete}
        title="Archiviare prodotto?"
        description="Il prodotto non apparirà più nell'inventario attivo."
      />
    </main>
  );
}
