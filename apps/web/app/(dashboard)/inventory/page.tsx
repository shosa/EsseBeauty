"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../lib/auth-context";
import { StockMovementModal } from "./_components/StockMovementModal";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
interface Product { id: string; name: string; sku?: string; stockQuantity: number; lowStockThreshold: number; supplier?: string; unitPriceCents: number; }

export default function InventoryPage() {
  const { salon } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [lowOnly, setLowOnly] = useState(false);
  const [movement, setMovement] = useState<Product>();
  const [open, setOpen] = useState(false);
  const load = () => salon ? fetch(`${api}/api/salons/${salon.id}/inventory${lowOnly ? "?low_stock=true" : ""}`, { credentials: "include" }).then((response) => response.json()).then(setItems) : Promise.resolve();
  useEffect(() => { void load(); }, [salon, lowOnly]);
  async function create(data: FormData) { await fetch(`${api}/api/salons/${salon?.id}/inventory`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: data.get("name"), sku: data.get("sku") || undefined, stock_quantity: Number(data.get("stock")), low_stock_threshold: Number(data.get("threshold")), unit_price_cents: Math.round(Number(data.get("price")) * 100), supplier: data.get("supplier") || undefined, active: true }) }); setOpen(false); await load(); }
  async function addMovement(delta: number, reason: string) { await fetch(`${api}/api/salons/${salon?.id}/inventory/${movement?.id}/movements`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ delta, reason }) }); setMovement(undefined); await load(); }

  return <main className="min-h-screen bg-[#f6f2f4] p-5 md:p-10"><div className="mx-auto max-w-6xl"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#792f59]">Magazzino</p><h1 className="mt-2 text-3xl font-bold">Inventario prodotti</h1></div><button onClick={() => setOpen(true)} className="rounded-xl bg-[#402334] px-5 py-3 font-bold text-white">Aggiungi prodotto</button></header>
    <label className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm"><input type="checkbox" checked={lowOnly} onChange={(event) => setLowOnly(event.target.checked)} className="accent-[#792f59]" />Mostra solo scorte basse</label>
    <div className="mt-4 overflow-x-auto rounded-[2rem] bg-white shadow-sm"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-stone-50"><tr>{["Prodotto","SKU","Scorta","Soglia","Fornitore",""].map((label) => <th key={label} className="p-4">{label}</th>)}</tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t border-stone-100"><td className="p-4 font-bold">{item.name}</td><td>{item.sku ?? "—"}</td><td className={item.stockQuantity <= item.lowStockThreshold ? "font-bold text-red-700" : "font-bold"}>{item.stockQuantity}</td><td>{item.lowStockThreshold}</td><td>{item.supplier ?? "—"}</td><td><button onClick={() => setMovement(item)} className="font-semibold text-[#792f59]">Movimento</button></td></tr>)}</tbody></table></div>
  </div>{open && <div className="fixed inset-0 grid place-items-center bg-black/35 p-4"><form action={create} className="grid w-full max-w-xl gap-4 rounded-[2rem] bg-white p-6 md:grid-cols-2"><h2 className="text-xl font-bold md:col-span-2">Nuovo prodotto</h2>{[{ name: "name", label: "Nome", type: "text", required: true },{ name: "sku", label: "SKU", type: "text", required: false },{ name: "stock", label: "Scorta iniziale", type: "number", required: true },{ name: "threshold", label: "Soglia minima", type: "number", required: true },{ name: "price", label: "Prezzo unitario", type: "number", required: true },{ name: "supplier", label: "Fornitore", type: "text", required: false }].map((field) => <label key={field.name} className="text-sm font-semibold">{field.label}<input name={field.name} type={field.type} required={field.required} className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label>)}<div className="flex justify-end gap-3 md:col-span-2"><button type="button" onClick={() => setOpen(false)}>Annulla</button><button className="rounded-xl bg-[#402334] px-5 py-3 font-bold text-white">Salva</button></div></form></div>}{movement && <StockMovementModal name={movement.name} onClose={() => setMovement(undefined)} onConfirm={addMovement} />}</main>;
}
