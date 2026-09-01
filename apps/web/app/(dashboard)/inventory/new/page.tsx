"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppPage, Breadcrumbs, Button, InlineError } from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
const cents = (value: FormDataEntryValue | null) => Math.round(Number(value || 0) * 100);
const basisPoints = (value: FormDataEntryValue | null) => Math.round(Number(value || 0) * 100);
const text = (value: FormDataEntryValue | null) => {
  const stringValue = String(value ?? "").trim();
  return stringValue ? stringValue : undefined;
};

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
        barcode: text(data.get("barcode")),
        brand: text(data.get("brand")),
        category: text(data.get("category")),
        cost_cents: cents(data.get("purchaseCost")),
        description: text(data.get("description")),
        internally_consumable: data.get("internallyConsumable") === "on",
        item_type: data.get("itemType"),
        manufacturer_code: text(data.get("manufacturerCode")),
        notes: text(data.get("notes")),
        reorder_quantity: Number(data.get("reorderQuantity") || 0),
        sku: text(data.get("sku")),
        stock_quantity: Number(data.get("stock")),
        low_stock_threshold: Number(data.get("threshold")),
        unit_price_cents: cents(data.get("salePrice")),
        unit: text(data.get("unit")) ?? "pz",
        vat_rate_basis_points: basisPoints(data.get("vatRate")),
        storage_location: text(data.get("storageLocation")),
        supplier: text(data.get("supplier")),
        track_stock: data.get("trackStock") === "on",
        sellable: data.get("sellable") === "on",
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
      <form action={create} className="grid gap-5 rounded-2xl border border-[#e8dfe4] bg-white p-6 shadow-[0_10px_30px_rgb(45_29_39_/_0.055)] md:grid-cols-2">
        <div className="md:col-span-2">
          <Breadcrumbs items={[{ href: "/inventory", label: "Magazzino" }, { label: "Nuovo prodotto" }]} />
          <p className="mt-6 text-xs font-bold uppercase tracking-[.2em] text-rose-700">Magazzino</p>
          <h1 className="mt-2 text-3xl font-bold">Nuovo prodotto</h1>
        </div>
        {error && <div className="md:col-span-2"><InlineError>{error}</InlineError></div>}
        <section className="grid gap-4 md:col-span-2 md:grid-cols-3">
          {[
            { name: "name", label: "Nome articolo", type: "text", required: true },
            { name: "brand", label: "Marca / linea", type: "text", required: false },
            { name: "category", label: "Categoria", type: "text", required: false },
            { name: "sku", label: "SKU interno", type: "text", required: false },
            { name: "manufacturerCode", label: "Codice produttore", type: "text", required: false },
            { name: "barcode", label: "Barcode / EAN", type: "text", required: false },
          ].map((field) => (
            <label key={field.name} className="text-sm font-semibold">
              {field.label}
              <input name={field.name} type={field.type} required={field.required} className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" />
            </label>
          ))}
        </section>
        <label className="text-sm font-semibold md:col-span-2">Descrizione<textarea name="description" rows={3} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2" /></label>
        <section className="grid gap-4 md:col-span-2 md:grid-cols-4">
          <label className="text-sm font-semibold">Tipo articolo<select name="itemType" defaultValue="resale" className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 bg-white px-3"><option value="resale">Rivendita</option><option value="consumable">Consumo interno</option><option value="equipment">Attrezzatura</option><option value="expense">Spesa</option></select></label>
          {[
            { name: "stock", label: "Scorta iniziale", type: "number", required: true, defaultValue: "0" },
            { name: "threshold", label: "Soglia minima", type: "number", required: true, defaultValue: "0" },
            { name: "reorderQuantity", label: "Riordino consigliato", type: "number", required: false, defaultValue: "0" },
            { name: "unit", label: "Unità", type: "text", required: true, defaultValue: "pz" },
            { name: "purchaseCost", label: "Costo acquisto", type: "number", required: true, defaultValue: "0" },
            { name: "salePrice", label: "Prezzo vendita", type: "number", required: true, defaultValue: "0" },
            { name: "vatRate", label: "IVA %", type: "number", required: true, defaultValue: "22" },
            { name: "storageLocation", label: "Ubicazione", type: "text", required: false },
            { name: "supplier", label: "Fornitore", type: "text", required: false },
          ].map((field) => (
          <label key={field.name} className="text-sm font-semibold">
            {field.label}
            <input name={field.name} type={field.type} step={field.type === "number" ? "0.01" : undefined} required={field.required} defaultValue={field.defaultValue} className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3" />
          </label>
        ))}
        </section>
        <section className="grid gap-3 md:col-span-2 md:grid-cols-3">
          <label className="flex min-h-12 items-center gap-2 rounded-xl border border-stone-200 px-3 text-sm font-semibold"><input name="trackStock" type="checkbox" defaultChecked />Gestisci scorta</label>
          <label className="flex min-h-12 items-center gap-2 rounded-xl border border-stone-200 px-3 text-sm font-semibold"><input name="sellable" type="checkbox" defaultChecked />Vendibile al cliente</label>
          <label className="flex min-h-12 items-center gap-2 rounded-xl border border-stone-200 px-3 text-sm font-semibold"><input name="internallyConsumable" type="checkbox" />Usabile nei trattamenti</label>
        </section>
        <label className="text-sm font-semibold md:col-span-2">Note interne<textarea name="notes" rows={3} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2" /></label>
        <div className="flex justify-end gap-3 md:col-span-2">
          <Button type="button" variant="ghost" onClick={() => router.push("/inventory")}>Annulla</Button>
          <Button type="submit">Salva</Button>
        </div>
      </form>
    </AppPage>
  );
}
