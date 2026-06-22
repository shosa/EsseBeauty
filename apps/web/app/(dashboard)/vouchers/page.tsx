"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppPage, Button, Drawer, EmptyState, InlineError, PageHeader, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Voucher {
  balance_cents: number;
  code: string;
  created_at: string;
  customer_id: string;
  customer_name: string;
  id: string;
  message?: string | null;
  original_amount_cents: number;
  status: "active" | "exhausted";
}

interface VoucherDetail extends Voucher {
  movements: Array<{
    balance_after_cents: number;
    cashier_name?: string | null;
    created_at: string;
    delta_cents: number;
    id: string;
    reason: string;
    sale_id?: string | null;
  }>;
}

function euro(cents: number) {
  return (cents / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" });
}

function code(value: string) {
  return value.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export default function VouchersPage() {
  const { salon } = useAuth();
  const [items, setItems] = useState<Voucher[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "exhausted">("all");
  const [selected, setSelected] = useState<VoucherDetail>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!salon) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set("search", query.trim());
    if (status !== "all") params.set("status", status);
    const response = await fetch(`${api}/api/salons/${salon.id}/vouchers?${params}`, { credentials: "include" });
    if (!response.ok) {
      setError("Archivio buoni non disponibile.");
      setItems([]);
    } else {
      setItems(await response.json() as Voucher[]);
      setError("");
    }
    setLoading(false);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timeout);
  }, [salon?.id, query, status]);

  async function openVoucher(voucherId: string) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/vouchers/${voucherId}`, { credentials: "include" });
    if (!response.ok) return setError("Dettaglio buono non disponibile.");
    setSelected(await response.json() as VoucherDetail);
  }

  const active = items.filter((item) => item.status === "active");
  const activeBalance = useMemo(() => active.reduce((total, item) => total + item.balance_cents, 0), [active]);

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <Drawer onClose={() => setSelected(undefined)} open={Boolean(selected)} title="Dettaglio buono">
        {selected && <div className="space-y-5">
          <section className={`rounded-2xl border p-5 ${selected.status === "active" ? "border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50" : "border-stone-200 bg-stone-100 text-stone-500"}`}>
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[10px] font-black uppercase tracking-[.2em]">Buono acquisto</p><strong className="mt-2 block font-mono text-xl tracking-[.14em]">{code(selected.code)}</strong></div>
              <StatusBadge status={selected.status === "active" ? "active" : "inactive"}>{selected.status === "active" ? "Attivo" : "Esaurito"}</StatusBadge>
            </div>
            <p className="mt-7 text-xs">Saldo disponibile</p>
            <strong className="block text-4xl">{euro(selected.balance_cents)}</strong>
            <div className="mt-5 flex justify-between border-t border-current/10 pt-4 text-sm"><span>Valore iniziale</span><strong>{euro(selected.original_amount_cents)}</strong></div>
          </section>
          <section className="rounded-2xl border border-stone-200 p-4">
            <p className="text-xs font-black uppercase tracking-[.15em] text-stone-400">Intestatario</p>
            <Link className="mt-2 block text-lg font-black text-[#792f59]" href={`/clients/${selected.customer_id}`}>{selected.customer_name}</Link>
            {selected.message && <p className="mt-3 rounded-xl bg-stone-50 p-3 text-sm italic">“{selected.message}”</p>}
          </section>
          <section>
            <h3 className="font-black">Movimenti</h3>
            <div className="mt-3 space-y-2">
              {selected.movements.map((movement) => <article className="rounded-2xl border border-stone-200 p-4" key={movement.id}>
                <div className="flex justify-between gap-3"><div><strong>{movement.reason}</strong><p className="mt-1 text-xs text-stone-500">{new Date(movement.created_at).toLocaleString("it-IT")} · {movement.cashier_name || "Sistema"}</p></div><strong className={movement.delta_cents < 0 ? "text-red-700" : "text-emerald-700"}>{movement.delta_cents > 0 ? "+" : ""}{euro(movement.delta_cents)}</strong></div>
                <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3 text-xs"><span>Saldo successivo</span><strong>{euro(movement.balance_after_cents)}</strong></div>
                {movement.sale_id && <Link className="mt-3 inline-block text-xs font-black text-[#792f59]" href="/sales">Apri registro vendite</Link>}
              </article>)}
            </div>
          </section>
        </div>}
      </Drawer>

      <PageHeader
        eyebrow="Credito clienti"
        title="Buoni acquisto"
        subtitle="Controlla i buoni emessi, il credito residuo e tutti gli utilizzi registrati in cassa."
        status={<div className="flex gap-8"><div><span className="block text-[10px] font-black uppercase tracking-[.15em] text-stone-400">Attivi</span><strong className="text-2xl">{active.length}</strong></div><div><span className="block text-[10px] font-black uppercase tracking-[.15em] text-stone-400">Credito residuo</span><strong className="text-2xl">{euro(activeBalance)}</strong></div></div>}
      />

      {error && <InlineError className="mb-5">{error}</InlineError>}
      <section className="rounded-2xl border border-[#e8dfe4] bg-white p-5 shadow-[0_10px_30px_rgb(45_29_39_/_0.055)]">
        <div className="flex flex-wrap gap-3">
          <input className="min-h-11 min-w-64 flex-1 rounded-xl border border-stone-200 px-4" onChange={(event) => setQuery(event.target.value)} placeholder="Cerca per cliente o codice" value={query} />
          {([["all", "Tutti"], ["active", "Attivi"], ["exhausted", "Esauriti"]] as const).map(([value, label]) => <Button key={value} onClick={() => setStatus(value)} size="sm" variant={status === value ? "primary" : "outline"}>{label}</Button>)}
          <Link className="inline-flex min-h-11 items-center rounded-xl bg-[#402334] px-4 text-sm font-black text-white" href="/sales">Emetti dalla cassa</Link>
        </div>

        {loading ? <div className="mt-5 h-60 animate-pulse rounded-2xl bg-stone-100" /> : items.length === 0 ? <div className="mt-5"><EmptyState title="Nessun buono trovato" description="I buoni emessi dalla cassa compariranno in questo archivio." /></div> : (
          <div className="mt-5 overflow-hidden rounded-2xl border border-stone-200">
            {items.map((voucher) => <button className="grid w-full grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_140px_140px_110px] items-center gap-4 border-b border-stone-100 px-5 py-4 text-left transition last:border-0 hover:bg-[#fff9fc]" key={voucher.id} onClick={() => void openVoucher(voucher.id)} type="button">
              <div><span className="block text-[10px] font-black uppercase tracking-[.14em] text-stone-400">Codice</span><strong className="mt-1 block font-mono tracking-[.1em]">{code(voucher.code)}</strong></div>
              <div><span className="block text-[10px] font-black uppercase tracking-[.14em] text-stone-400">Cliente</span><strong className="mt-1 block truncate">{voucher.customer_name}</strong></div>
              <div><span className="block text-[10px] font-black uppercase tracking-[.14em] text-stone-400">Valore</span><strong className="mt-1 block">{euro(voucher.original_amount_cents)}</strong></div>
              <div><span className="block text-[10px] font-black uppercase tracking-[.14em] text-stone-400">Residuo</span><strong className="mt-1 block text-[#792f59]">{euro(voucher.balance_cents)}</strong></div>
              <StatusBadge status={voucher.status === "active" ? "active" : "inactive"}>{voucher.status === "active" ? "Attivo" : "Esaurito"}</StatusBadge>
            </button>)}
          </div>
        )}
      </section>
    </AppPage>
  );
}
