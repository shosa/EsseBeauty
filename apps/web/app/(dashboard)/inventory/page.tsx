"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "../../../lib/auth-context";
import { StockMovementModal } from "./_components/StockMovementModal";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Product {
  id: string;
  lowStockThreshold: number;
  name: string;
  sku?: string;
  stockQuantity: number;
  supplier?: string;
  unitPriceCents: number;
}

export default function InventoryPage() {
  const { salon } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [lowOnly, setLowOnly] = useState(false);
  const [movement, setMovement] = useState<Product>();

  const load = () =>
    salon
      ? fetch(`${api}/api/salons/${salon.id}/inventory${lowOnly ? "?low_stock=true" : ""}`, {
          credentials: "include",
        })
          .then((response) => response.json())
          .then(setItems)
      : Promise.resolve();

  useEffect(() => { void load(); }, [salon, lowOnly]);

  async function addMovement(delta: number, reason: string) {
    await fetch(`${api}/api/salons/${salon?.id}/inventory/${movement?.id}/movements`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ delta, reason }),
    });
    setMovement(undefined);
    await load();
  }

  return (
    <main className="min-h-screen bg-stone-100 p-5 md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-rose-700">Magazzino</p>
            <h1 className="mt-2 text-3xl font-bold">Inventario prodotti</h1>
          </div>
          <Link href="/inventory/new" className="rounded-xl bg-stone-900 px-5 py-3 font-bold text-white">Aggiungi prodotto</Link>
        </header>
        <label className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm">
          <input type="checkbox" checked={lowOnly} onChange={(event) => setLowOnly(event.target.checked)} className="accent-rose-700" />
          Mostra solo scorte basse
        </label>
        <div className="mt-4 overflow-x-auto rounded-3xl bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-stone-50">
              <tr>{["Prodotto", "SKU", "Scorta", "Soglia", "Fornitore", ""].map((label) => <th key={label} className="p-4">{label}</th>)}</tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-stone-100">
                  <td className="p-4 font-bold"><Link href={`/inventory/${item.id}`}>{item.name}</Link></td>
                  <td>{item.sku ?? "—"}</td>
                  <td className={item.stockQuantity <= item.lowStockThreshold ? "font-bold text-red-700" : "font-bold"}>{item.stockQuantity}</td>
                  <td>{item.lowStockThreshold}</td>
                  <td>{item.supplier ?? "—"}</td>
                  <td><button onClick={() => setMovement(item)} className="font-semibold text-rose-700">Movimento</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {movement && <StockMovementModal name={movement.name} onClose={() => setMovement(undefined)} onConfirm={addMovement} />}
    </main>
  );
}
