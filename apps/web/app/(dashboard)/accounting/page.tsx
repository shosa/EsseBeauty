"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppPage, Button, Drawer, EmptyState, InlineError, PageHeader, SectionCard, StatCard, StatGrid, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
type Preset = "today" | "week" | "month" | "last";
type PaymentMethod = "cash" | "card" | "bank_transfer" | "voucher" | "other";
type CartItemType = "service" | "product" | "package" | "custom";

interface SaleRow { appointment_id?: string | null; closed_at: string; customer_name?: string | null; discount_cents: number; id: string; staff_name?: string | null; total_cents: number; }
interface SaleDetail {
  appointment_id?: string | null;
  cashier_name?: string | null;
  closed_at: string;
  customer_email?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  discount_cents: number;
  id: string;
  items: Array<{ description: string; discount_cents: number; id: string; item_type: CartItemType; quantity: number; total_cents: number; unit_price_cents: number }>;
  notes?: string | null;
  payments: Array<{ amount_cents: number; id: string; method: PaymentMethod; paid_at: string; reference?: string | null }>;
  staff_name?: string | null;
  subtotal_cents: number;
  total_cents: number;
}
interface SalesResponse {
  payments: Array<{ amount_cents: number; method: string }>;
  rows: SaleRow[];
  summary: { average_cents: number; count: number; discount_cents: number; total_cents: number; };
}

const methodLabels: Record<PaymentMethod, string> = {
  bank_transfer: "Bonifico",
  card: "Carta",
  cash: "Contanti",
  other: "Altro",
  voucher: "Voucher",
};
const presetLabels: Array<[Preset, string]> = [["today", "Oggi"], ["week", "Settimana"], ["month", "Mese"], ["last", "Mese scorso"]];

function euro(cents: number) {
  return (cents / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" });
}

function rangeFor(preset: Preset) {
  const now = new Date(); const from = new Date(now); const to = new Date(now);
  if (preset === "today") from.setHours(0, 0, 0, 0);
  if (preset === "week") { from.setDate(now.getDate() - ((now.getDay() + 6) % 7)); from.setHours(0, 0, 0, 0); }
  if (preset === "month") { from.setDate(1); from.setHours(0, 0, 0, 0); }
  if (preset === "last") { from.setMonth(now.getMonth() - 1, 1); from.setHours(0, 0, 0, 0); to.setDate(0); to.setHours(23, 59, 59, 999); }
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function AccountingPage() {
  const { salon } = useAuth();
  const [preset, setPreset] = useState<Preset>("today");
  const [data, setData] = useState<SalesResponse>();
  const [error, setError] = useState("");
  const [selectedSale, setSelectedSale] = useState<SaleDetail>();
  const [saleLoading, setSaleLoading] = useState(false);

  async function loadSales() {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/sales?${new URLSearchParams(rangeFor(preset))}`, { credentials: "include" });
    if (!response.ok) return setError(response.status === 403 ? "Non hai accesso alla contabilita gestionale." : "Movimenti non disponibili.");
    setData(await response.json() as SalesResponse);
  }

  async function openSale(saleId: string) {
    if (!salon) return;
    setSaleLoading(true);
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/sales/${saleId}`, { credentials: "include" });
    if (!response.ok) {
      setError("Dettaglio vendita non disponibile.");
      setSaleLoading(false);
      return;
    }
    setSelectedSale(await response.json() as SaleDetail);
    setSaleLoading(false);
  }

  useEffect(() => { void loadSales(); }, [preset, salon?.id]);

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageHeader eyebrow="Amministrazione" title="Contabilita" subtitle="Chiusure contabili, registro vendite, pagamenti e statistiche navigabili per periodo." status={<StatusBadge status="active">Gestionale</StatusBadge>} />
      {error && <InlineError className="mb-5">{error}</InlineError>}
      {saleLoading && <div className="mb-5 rounded-xl bg-stone-100 px-4 py-3 text-sm font-bold text-stone-600">Caricamento dettaglio vendita...</div>}

      <SectionCard className="mb-5" title="Chiusure contabili" subtitle="Naviga il periodo e controlla incassi, sconti, metodi di pagamento e movimenti.">
        <div className="flex flex-wrap gap-2">
          {presetLabels.map(([value, label]) => <Button key={value} onClick={() => setPreset(value)} size="sm" variant={preset === value ? "primary" : "outline"}>{label}</Button>)}
        </div>
      </SectionCard>

      <StatGrid className="mb-5 md:grid-cols-4">
        <StatCard label="Incassato" value={euro(data?.summary.total_cents ?? 0)} />
        <StatCard label="Vendite" value={data?.summary.count ?? 0} />
        <StatCard label="Scontrino medio" value={euro(data?.summary.average_cents ?? 0)} />
        <StatCard label="Sconti" value={euro(data?.summary.discount_cents ?? 0)} />
      </StatGrid>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <SectionCard title="Registro vendite" subtitle="Vendite da appuntamento e vendite libere effettuate dalla cassa.">
          {!data?.rows.length ? <EmptyState title="Nessun movimento" description="Le vendite concluse appariranno qui." /> : <div className="overflow-x-auto rounded-2xl border"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#f7eef3]"><tr><th className="p-4">Data</th><th>Cliente</th><th>Operatore</th><th>Sconto</th><th className="text-right">Totale</th><th /></tr></thead><tbody>{data.rows.map((row) => <tr className="cursor-pointer border-t transition hover:bg-[#fff8fb]" key={row.id} onClick={() => void openSale(row.id)}><td className="p-4">{new Date(row.closed_at).toLocaleString("it-IT")}</td><td className="font-bold">{row.customer_name || "Cliente occasionale"}</td><td>{row.staff_name || "—"}</td><td>{euro(row.discount_cents)}</td><td className="text-right text-base font-black">{euro(row.total_cents)}</td><td className="p-4 text-right"><span className="font-bold text-[#792f59]">Vedi dettaglio →</span></td></tr>)}</tbody></table></div>}
        </SectionCard>

        <SectionCard title="Metodi di pagamento">
          {data?.payments.length ? <div className="space-y-4">{data.payments.map((item) => <div className="flex items-center justify-between rounded-xl bg-stone-50 p-4" key={item.method}><b>{methodLabels[item.method as PaymentMethod] ?? item.method}</b><strong>{euro(item.amount_cents)}</strong></div>)}</div> : <EmptyState title="Nessun incasso" description="Non ci sono pagamenti nel periodo." />}
        </SectionCard>
      </div>

      <Drawer onClose={() => setSelectedSale(undefined)} open={Boolean(selectedSale)} title="Dettaglio vendita">
        {selectedSale && <div className="space-y-5">
          <section className="rounded-2xl bg-[#402334] p-5 text-white">
            <p className="text-xs font-black uppercase tracking-[.16em] text-[#e8bfd4]">Incasso registrato</p>
            <strong className="mt-2 block text-4xl">{euro(selectedSale.total_cents)}</strong>
            <p className="mt-2 text-sm text-stone-300">{new Date(selectedSale.closed_at).toLocaleString("it-IT")}</p>
          </section>
          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-stone-200 p-3"><span className="text-[10px] font-black uppercase text-stone-400">Cliente</span><strong className="mt-1 block">{selectedSale.customer_name || "Cliente occasionale"}</strong></div>
            <div className="rounded-xl border border-stone-200 p-3"><span className="text-[10px] font-black uppercase text-stone-400">Operatore</span><strong className="mt-1 block">{selectedSale.staff_name || "Non assegnato"}</strong></div>
            <div className="rounded-xl border border-stone-200 p-3"><span className="text-[10px] font-black uppercase text-stone-400">Registrata da</span><strong className="mt-1 block">{selectedSale.cashier_name || "Sistema"}</strong></div>
            <div className="rounded-xl border border-stone-200 p-3"><span className="text-[10px] font-black uppercase text-stone-400">Origine</span><strong className="mt-1 block">{selectedSale.appointment_id ? "Appuntamento" : "Vendita libera"}</strong></div>
          </section>
          <section>
            <h3 className="font-black">Cosa e stato venduto</h3>
            <div className="mt-3 space-y-2">
              {selectedSale.items.map((item) => <article className="rounded-2xl border border-stone-200 p-4" key={item.id}>
                <div className="flex items-start justify-between gap-3"><div><strong>{item.description}</strong><p className="mt-1 text-xs uppercase text-stone-400">{item.item_type === "service" ? "Servizio" : item.item_type === "product" ? "Prodotto" : "Voce libera"}</p></div><strong>{euro(item.total_cents)}</strong></div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-500"><span>Quantita: {item.quantity}</span><span>Prezzo: {euro(item.unit_price_cents)}</span>{item.discount_cents > 0 && <span>Sconto: {euro(item.discount_cents)}</span>}</div>
              </article>)}
            </div>
          </section>
          <section className="rounded-2xl border border-stone-200 p-4">
            <div className="flex justify-between text-sm"><span>Subtotale</span><strong>{euro(selectedSale.subtotal_cents)}</strong></div>
            {selectedSale.discount_cents > 0 && <div className="mt-2 flex justify-between text-sm text-stone-500"><span>Sconto conto</span><strong>- {euro(selectedSale.discount_cents)}</strong></div>}
            <div className="mt-4 flex justify-between border-t border-stone-200 pt-4 text-lg"><strong>Totale</strong><strong className="text-[#792f59]">{euro(selectedSale.total_cents)}</strong></div>
          </section>
          <section>
            <h3 className="font-black">Pagamenti</h3>
            <div className="mt-3 space-y-2">{selectedSale.payments.map((payment) => <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900" key={payment.id}>
              <div><strong>{methodLabels[payment.method] ?? payment.method}</strong>{payment.method === "voucher" && payment.reference && <span className="mt-1 block font-mono text-[11px] tracking-[.1em]">{payment.reference.replace(/(\d{4})(?=\d)/g, "$1 ")}</span>}</div>
              <strong>{euro(payment.amount_cents)}</strong>
            </div>)}</div>
          </section>
          {selectedSale.notes && <section className="rounded-2xl bg-amber-50 p-4"><p className="text-xs font-black uppercase text-amber-800">Nota interna</p><p className="mt-2 text-sm text-amber-950">{selectedSale.notes}</p></section>}
          <div className="flex flex-wrap gap-2">
            {selectedSale.customer_id && <Link className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-bold text-[#792f59]" href={`/clients/${selectedSale.customer_id}`}>Apri cliente</Link>}
            {selectedSale.appointment_id && <Link className="rounded-xl bg-[#402334] px-4 py-3 text-sm font-bold text-white" href={`/calendar?appointment=${selectedSale.appointment_id}`}>Apri appuntamento</Link>}
          </div>
        </div>}
      </Drawer>
    </AppPage>
  );
}
