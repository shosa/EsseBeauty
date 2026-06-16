"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppPage, Button, EmptyState, PageHeader, SectionCard, StatCard, StatGrid, StatusBadge } from "@esse-beauty/ui";

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

  const lowStockCount = useMemo(
    () => items.filter((item) => item.stockQuantity <= item.lowStockThreshold).length,
    [items],
  );
  const stockValue = useMemo(
    () => items.reduce((sum, item) => sum + item.stockQuantity * item.unitPriceCents, 0),
    [items],
  );

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
    <AppPage>
      <PageHeader
        actions={<Link className="inline-flex min-h-11 items-center rounded-xl border border-[#402334] bg-[linear-gradient(135deg,#402334_0%,#792f59_58%,#b85888_100%)] px-4 py-2.5 font-semibold text-white shadow-[0_16px_36px_rgb(121_47_89_/_0.28)] transition hover:-translate-y-0.5" href="/inventory/new">Aggiungi prodotto</Link>}
        eyebrow="Magazzino"
        title="Inventario prodotti"
        subtitle="Tieni sotto controllo scorte, soglie e movimenti senza aprire viste tecniche."
        status={<StatusBadge status={lowStockCount > 0 ? "waiting" : "active"}>{lowStockCount > 0 ? `${lowStockCount} sotto soglia` : "Scorte ok"}</StatusBadge>}
      />

      <StatGrid className="mb-6 md:grid-cols-3">
        <StatCard label="Prodotti" value={items.length} detail="Nel magazzino" />
        <StatCard label="Scorte basse" value={lowStockCount} detail="Da reintegrare" />
        <StatCard label="Valore scorte" value={(stockValue / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" })} detail="Stimato dai prezzi" />
      </StatGrid>

      <SectionCard
        actions={
          <label className="inline-flex items-center gap-2 rounded-full border border-[#ead1df] bg-[#fffafd] px-4 py-2 text-sm font-bold text-[#792f59]">
            <input checked={lowOnly} onChange={(event) => setLowOnly(event.target.checked)} type="checkbox" />
            Solo scorte basse
          </label>
        }
        title="Prodotti"
        subtitle="Apri una scheda prodotto o registra un movimento rapido di magazzino."
      >
        {items.length === 0 ? (
          <EmptyState
            action={<Link className="inline-flex min-h-11 items-center rounded-xl border border-[#402334] bg-[linear-gradient(135deg,#402334_0%,#792f59_58%,#b85888_100%)] px-4 py-2.5 font-semibold text-white shadow-[0_16px_36px_rgb(121_47_89_/_0.28)] transition hover:-translate-y-0.5" href="/inventory/new">Aggiungi prodotto</Link>}
            description={lowOnly ? "Nessun prodotto sotto soglia." : "Aggiungi il primo prodotto per iniziare a monitorare le scorte."}
            title={lowOnly ? "Scorte sotto controllo" : "Nessun prodotto"}
          />
        ) : (
          <div className="overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/90 shadow-[0_18px_48px_rgb(45_29_39_/_0.08)] ring-1 ring-stone-950/5">
            <div className="grid min-w-[760px] grid-cols-[1.4fr_.8fr_.7fr_.7fr_1fr_auto] bg-[#faf3f7] px-4 py-3 text-xs font-black uppercase tracking-[.08em] text-[#792f59]">
              <span>Prodotto</span>
              <span>SKU</span>
              <span>Scorta</span>
              <span>Soglia</span>
              <span>Fornitore</span>
              <span />
            </div>
            <div className="overflow-x-auto">
              {items.map((item) => {
                const low = item.stockQuantity <= item.lowStockThreshold;
                return (
                  <div className="grid min-w-[760px] grid-cols-[1.4fr_.8fr_.7fr_.7fr_1fr_auto] items-center border-t border-stone-100 px-4 py-4 text-sm" key={item.id}>
                    <Link className="font-bold text-stone-950 hover:text-[#792f59]" href={`/inventory/${item.id}`}>{item.name}</Link>
                    <span className="text-stone-500">{item.sku ?? "-"}</span>
                    <span className={`font-black ${low ? "text-red-700" : "text-stone-950"}`}>{item.stockQuantity}</span>
                    <span className="text-stone-500">{item.lowStockThreshold}</span>
                    <span className="text-stone-500">{item.supplier ?? "-"}</span>
                    <Button onClick={() => setMovement(item)} size="sm" variant="tableAction">Movimento</Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SectionCard>

      {movement && <StockMovementModal name={movement.name} onClose={() => setMovement(undefined)} onConfirm={addMovement} />}
    </AppPage>
  );
}
