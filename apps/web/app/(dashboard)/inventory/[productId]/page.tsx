"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppPage, Breadcrumbs, Button, ConfirmDialog, EmptyState, InlineError, PageSkeleton } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
const cents = (value: FormDataEntryValue | null) => Math.round(Number(value || 0) * 100);
const basisPoints = (value: FormDataEntryValue | null) => Math.round(Number(value || 0) * 100);
const textOrNull = (value: FormDataEntryValue | null) => {
  const stringValue = String(value ?? "").trim();
  return stringValue ? stringValue : null;
};

interface Product {
  barcode?: string | null;
  brand?: string | null;
  category?: string | null;
  costCents?: number | null;
  description?: string | null;
  id: string;
  internallyConsumable?: boolean;
  itemType?: string;
  lowStockThreshold: number;
  manufacturerCode?: string | null;
  name: string;
  notes?: string | null;
  reorderQuantity?: number;
  sku?: string | null;
  sellable?: boolean;
  stockQuantity: number;
  storageLocation?: string | null;
  supplier?: string | null;
  trackStock?: boolean;
  unit?: string;
  unitPriceCents: number;
  vatRateBasisPoints?: number;
}

interface Movement {
  appointment_id?: string | null;
  created_at: string;
  customer_name?: string | null;
  delta: number;
  id: string;
  reason: string;
  sale_id?: string | null;
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
        barcode: textOrNull(data.get("barcode")),
        brand: textOrNull(data.get("brand")),
        category: textOrNull(data.get("category")),
        cost_cents: cents(data.get("purchaseCost")),
        description: textOrNull(data.get("description")),
        internally_consumable: data.get("internallyConsumable") === "on",
        item_type: data.get("itemType"),
        manufacturer_code: textOrNull(data.get("manufacturerCode")),
        notes: textOrNull(data.get("notes")),
        reorder_quantity: Number(data.get("reorderQuantity") || 0),
        sku: data.get("sku") || null,
        stock_quantity: Number(data.get("stock")),
        low_stock_threshold: Number(data.get("threshold")),
        unit_price_cents: cents(data.get("salePrice")),
        unit: textOrNull(data.get("unit")) ?? "pz",
        vat_rate_basis_points: basisPoints(data.get("vatRate")),
        storage_location: textOrNull(data.get("storageLocation")),
        supplier: data.get("supplier") || null,
        track_stock: data.get("trackStock") === "on",
        sellable: data.get("sellable") === "on",
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
    <AppPage maxWidth="max-w-[1600px]">
      <div className="mx-auto max-w-5xl">
        <Breadcrumbs items={[{ href: "/inventory", label: "Magazzino" }, { label: product?.name ?? "Prodotto" }]} />
        {error && <div className="mt-4"><InlineError>{error}</InlineError></div>}
        {!product ? (
          <EmptyState title="Prodotto non trovato" description="Potrebbe essere archiviato o non accessibile." />
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
            <form action={save} className="grid gap-5 rounded-2xl border border-[#e8dfe4] bg-white p-6 shadow-[0_10px_30px_rgb(45_29_39_/_0.055)] md:grid-cols-2">
              <div className="md:col-span-2">
                <p className="text-xs font-bold uppercase tracking-[.2em] text-rose-700">Prodotto</p>
                <h1 className="mt-2 text-3xl font-bold">{product.name}</h1>
              </div>
              <section className="grid gap-4 md:col-span-2 md:grid-cols-3">
                <label className="text-sm font-semibold">Nome articolo<input name="name" defaultValue={product.name} required className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label>
                <label className="text-sm font-semibold">Marca / linea<input name="brand" defaultValue={product.brand ?? ""} className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label>
                <label className="text-sm font-semibold">Categoria<input name="category" defaultValue={product.category ?? ""} className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label>
                <label className="text-sm font-semibold">SKU interno<input name="sku" defaultValue={product.sku ?? ""} className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label>
                <label className="text-sm font-semibold">Codice produttore<input name="manufacturerCode" defaultValue={product.manufacturerCode ?? ""} className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label>
                <label className="text-sm font-semibold">Barcode / EAN<input name="barcode" defaultValue={product.barcode ?? ""} className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label>
              </section>
              <label className="text-sm font-semibold md:col-span-2">Descrizione<textarea name="description" rows={3} defaultValue={product.description ?? ""} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2" /></label>
              <section className="grid gap-4 md:col-span-2 md:grid-cols-4">
                <label className="text-sm font-semibold">Tipo articolo<select name="itemType" defaultValue={product.itemType ?? "resale"} className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 bg-white px-3"><option value="resale">Rivendita</option><option value="consumable">Consumo interno</option><option value="equipment">Attrezzatura</option><option value="expense">Spesa</option></select></label>
                <label className="text-sm font-semibold">Scorta<input name="stock" type="number" defaultValue={product.stockQuantity} required className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label>
                <label className="text-sm font-semibold">Soglia minima<input name="threshold" type="number" defaultValue={product.lowStockThreshold} required className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label>
                <label className="text-sm font-semibold">Riordino consigliato<input name="reorderQuantity" type="number" defaultValue={product.reorderQuantity ?? 0} className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label>
                <label className="text-sm font-semibold">Unità<input name="unit" defaultValue={product.unit ?? "pz"} required className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label>
                <label className="text-sm font-semibold">Costo acquisto<input name="purchaseCost" type="number" step="0.01" defaultValue={((product.costCents ?? 0) / 100).toFixed(2)} required className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label>
                <label className="text-sm font-semibold">Prezzo vendita<input name="salePrice" type="number" step="0.01" defaultValue={(product.unitPriceCents / 100).toFixed(2)} required className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label>
                <label className="text-sm font-semibold">IVA %<input name="vatRate" type="number" step="0.01" defaultValue={((product.vatRateBasisPoints ?? 2200) / 100).toFixed(2)} required className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label>
                <label className="text-sm font-semibold">Ubicazione<input name="storageLocation" defaultValue={product.storageLocation ?? ""} className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label>
                <label className="text-sm font-semibold md:col-span-3">Fornitore<input name="supplier" defaultValue={product.supplier ?? ""} className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" /></label>
              </section>
              <section className="grid gap-3 md:col-span-2 md:grid-cols-3">
                <label className="flex min-h-12 items-center gap-2 rounded-xl border border-stone-200 px-3 text-sm font-semibold"><input name="trackStock" type="checkbox" defaultChecked={product.trackStock ?? true} />Gestisci scorta</label>
                <label className="flex min-h-12 items-center gap-2 rounded-xl border border-stone-200 px-3 text-sm font-semibold"><input name="sellable" type="checkbox" defaultChecked={product.sellable ?? true} />Vendibile al cliente</label>
                <label className="flex min-h-12 items-center gap-2 rounded-xl border border-stone-200 px-3 text-sm font-semibold"><input name="internallyConsumable" type="checkbox" defaultChecked={product.internallyConsumable ?? false} />Usabile nei trattamenti</label>
              </section>
              <label className="text-sm font-semibold md:col-span-2">Note interne<textarea name="notes" rows={3} defaultValue={product.notes ?? ""} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2" /></label>
              <div className="flex justify-end gap-3 md:col-span-2">
                <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>Archivia</Button>
                <Button type="submit">Salva modifiche</Button>
              </div>
            </form>
            <aside className="rounded-2xl border border-[#e8dfe4] bg-white p-6 shadow-[0_10px_30px_rgb(45_29_39_/_0.055)]">
              <h2 className="text-xl font-bold">Movimenti</h2>
              <p className="mt-1 text-sm text-stone-600">Scorta attuale: <strong>{product.stockQuantity}</strong></p>
              <div className="mt-4 space-y-3">
                {movements.length === 0 ? <p className="text-sm text-stone-500">Nessun movimento registrato.</p> : movements.map((movement) => (
                  <article key={movement.id} className="rounded-2xl border border-stone-100 bg-stone-50 p-4 text-sm">
                    <div className="flex items-start gap-3">
                      <span className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-black ${movement.delta < 0 ? "bg-[#f3e2eb] text-[#792f59]" : "bg-emerald-100 text-emerald-800"}`}>
                        {movement.delta > 0 ? "+" : ""}{movement.delta}
                      </span>
                      <div className="min-w-0 flex-1">
                        <strong className="block text-stone-950">
                          {movement.sale_id ? `Vendita a ${movement.customer_name || "cliente"}` : movement.reason}
                        </strong>
                        <p className="mt-1 text-xs text-stone-500">{new Date(movement.created_at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}</p>
                        {movement.appointment_id && (
                          <Link className="mt-3 inline-flex min-h-9 items-center rounded-xl border border-[#d9a7c2] bg-white px-3 text-xs font-black text-[#792f59] transition hover:border-[#792f59] hover:bg-[#fff8fc]" href={`/calendar/appointments/${movement.appointment_id}`}>
                            Apri vendita
                          </Link>
                        )}
                      </div>
                    </div>
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
    </AppPage>
  );
}
