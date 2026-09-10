"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";

import {
  AppPage,
  Button,
  ConfirmDialog,
  EmptyState,
  FormField,
  InlineError,
  PageHeader,
  PageTransition,
  SaveToast,
  SectionCard,
  StatusBadge,
} from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

type RewardType = "free_treatment" | "free_product" | "fixed_discount" | "percent_discount" | "credit";
interface Reward { active: boolean; description: string | null; id: string; name: string; pointsRequired: number; type: RewardType; }
interface Tier { id: string; minPoints: number; name: string; }
interface CustomerSummary {
  balance: number;
  current_tier: Tier | null;
  customer_id: string;
  email: string | null;
  name: string;
  next_tier: (Tier & { pointsRemaining: number }) | null;
  phone: string | null;
}
interface CustomerDetail extends CustomerSummary {
  available_rewards: Array<Reward & { available: boolean }>;
  history: Array<{ createdAt: string; delta: number; id: string; reason: string }>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function errorMessage(code?: string) {
  if (code === "INSUFFICIENT_POINTS") return "Il saldo disponibile non è sufficiente per questa operazione.";
  if (code === "REWARD_NOT_AVAILABLE") return "Il premio non è più disponibile.";
  if (code === "REWARD_REQUIRES_CHECKOUT") return "Questo premio si applica direttamente in cassa.";
  if (code === "INVALID_ADJUSTMENT") return "Inserisci punti validi e un motivo obbligatorio.";
  return "Operazione non riuscita. Riprova.";
}

export default function LoyaltyCustomersPage() {
  const { salon } = useAuth();
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [customer, setCustomer] = useState<CustomerDetail>();
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [adjustment, setAdjustment] = useState({ delta: "", reason: "" });
  const [redeemReward, setRedeemReward] = useState<Reward>();
  const [redemptionKey, setRedemptionKey] = useState("");

  const visibleCustomers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("it-IT");
    if (!query) return customers;
    return customers.filter((item) => `${item.name} ${item.email ?? ""} ${item.phone ?? ""}`.toLocaleLowerCase("it-IT").includes(query));
  }, [customers, search]);

  async function loadCustomers() {
    if (!salon) return;
    setLoading(true);
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/loyalty/customers`, { credentials: "include" });
    if (!response.ok) {
      setError("Non riesco a caricare i clienti del programma fedeltà.");
      setLoading(false);
      return;
    }
    setCustomers(await response.json() as CustomerSummary[]);
    setLoading(false);
  }

  async function loadCustomer(customerId: string) {
    if (!salon || !customerId) return;
    setSelectedCustomerId(customerId);
    const response = await fetch(`${api}/api/salons/${salon.id}/loyalty/customers/${customerId}`, { credentials: "include" });
    if (!response.ok) {
      setError("Impossibile caricare il dettaglio cliente.");
      return;
    }
    setCustomer(await response.json() as CustomerDetail);
  }

  useEffect(() => { void loadCustomers(); }, [salon?.id]);
  useEffect(() => {
    const customerId = searchParams.get("customerId");
    if (customerId) void loadCustomer(customerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salon?.id, searchParams]);
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  async function adjustBalance() {
    if (!salon || !selectedCustomerId) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/loyalty/customers/${selectedCustomerId}/adjust`, {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ delta: Number(adjustment.delta), reason: adjustment.reason }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      return setError(errorMessage(body.error));
    }
    setAdjustment({ delta: "", reason: "" });
    setMessage("Saldo corretto e movimento registrato.");
    await Promise.all([loadCustomers(), loadCustomer(selectedCustomerId)]);
  }

  function prepareRedemption(reward: Reward) {
    setRedemptionKey(crypto.randomUUID());
    setRedeemReward(reward);
  }

  async function confirmRedemption() {
    if (!salon || !selectedCustomerId || !redeemReward) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/loyalty/customers/${selectedCustomerId}/redemptions`, {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ idempotency_key: redemptionKey, reward_id: redeemReward.id }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      return setError(errorMessage(body.error));
    }
    setRedeemReward(undefined);
    setMessage(`Premio “${redeemReward.name}” riscattato.`);
    await Promise.all([loadCustomers(), loadCustomer(selectedCustomerId)]);
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageTransition>
        <SaveToast visible={Boolean(message)}>{message}</SaveToast>
        <PageHeader eyebrow="Fedeltà" title="Clienti" subtitle="Cerca un cliente, controlla la progressione e opera sul saldo." />
        {error && <div className="mb-4"><InlineError>{error}<button className="ml-3 underline" onClick={() => setError("")} type="button">Chiudi</button></InlineError></div>}
        {loading ? <div className="h-40 animate-pulse rounded-2xl bg-stone-100" /> : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,.75fr)]">
            <SectionCard icon={Search} title="Clienti e saldo" subtitle="Cerca per nome, email o telefono.">
              <label className="relative block">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                <input aria-label="Cerca cliente" className="min-h-11 w-full rounded-xl border border-stone-200 bg-white pl-10 pr-3" onChange={(event) => setSearch(event.target.value)} placeholder="Cerca cliente per nome, email o telefono" value={search} />
              </label>
              <div className="mt-3 max-h-[420px] overflow-auto rounded-xl border border-stone-200">
                {visibleCustomers.map((item) => (
                  <button className={`grid w-full grid-cols-[1fr_auto] items-center gap-3 border-b border-stone-100 px-4 py-3 text-left last:border-0 hover:bg-[#fff8fc] ${selectedCustomerId === item.customer_id ? "bg-[#fff2f8]" : "bg-white"}`} key={item.customer_id} onClick={() => void loadCustomer(item.customer_id)} type="button">
                    <span className="min-w-0"><strong className="block truncate text-sm text-stone-950">{item.name}</strong><span className="block truncate text-xs text-stone-500">{item.current_tier?.name ?? "Nessun livello"} · {item.email ?? item.phone ?? "Nessun contatto"}</span></span>
                    <span className="flex items-center gap-2"><b className="text-[#6f244e]">{item.balance} pt</b><ChevronRight className="size-4 text-stone-400" /></span>
                  </button>
                ))}
                {visibleCustomers.length === 0 && <p className="p-6 text-center text-sm text-stone-500">Nessun cliente trovato.</p>}
              </div>
            </SectionCard>

            <SectionCard title={customer ? customer.name : "Operazioni cliente"} subtitle={customer ? `${customer.balance} punti disponibili` : "Seleziona un cliente dall’elenco."}>
              {!customer ? <EmptyState title="Seleziona un cliente" description="Qui potrai riscattare premi, correggere il saldo e leggere lo storico." /> : <div className="space-y-5">
                <div className="rounded-xl bg-[linear-gradient(135deg,#402334,#792f59)] p-5 text-white">
                  <div className="flex items-center justify-between gap-4"><span className="text-sm text-white/70">Saldo attuale</span><StatusBadge status="active">{customer.current_tier?.name ?? "Base"}</StatusBadge></div>
                  <strong className="mt-2 block text-4xl tracking-tight">{customer.balance} pt</strong>
                  {customer.next_tier && <div className="mt-4"><div className="mb-1 flex justify-between text-xs text-white/70"><span>Prossimo: {customer.next_tier.name}</span><span>{customer.next_tier.pointsRemaining} pt mancanti</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-[#f0c98a]" style={{ width: `${Math.min(100, customer.balance / customer.next_tier.minPoints * 100)}%` }} /></div></div>}
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-black text-stone-900">Riscatta premio</h3>
                  <div className="grid gap-2">
                    {customer.available_rewards.filter((reward) => reward.active).map((reward) => <div className="flex items-center justify-between rounded-xl border border-stone-200 p-3" key={reward.id}><span><b className="block text-sm">{reward.name}</b><span className="text-xs text-stone-500">{reward.type === "credit" ? (reward.available ? "Disponibile ora" : `Mancano ${reward.pointsRequired - customer.balance} punti`) : "Si applica in cassa"}</span></span><span className="flex items-center gap-2"><span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] font-bold text-stone-600">{{ free_treatment: "Trattamento", free_product: "Prodotto", fixed_discount: "Sconto fisso", percent_discount: "Sconto %", credit: "Credito" }[reward.type]}</span><b className="font-black text-[#6f244e]">{reward.pointsRequired} pt</b>{reward.type === "credit" && <Button disabled={!reward.available} onClick={() => prepareRedemption(reward)} size="sm" variant="outline">Riscatta</Button>}</span></div>)}
                    {customer.available_rewards.length === 0 && <p className="text-sm text-stone-500">Nessun premio attivo.</p>}
                  </div>
                </div>

                <div className="border-t border-stone-200 pt-4">
                  <h3 className="text-sm font-black text-stone-900">Correggi saldo</h3>
                  <p className="mt-1 text-xs text-stone-500">Usa valori positivi o negativi. Ogni correzione rimane nel registro.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[120px_1fr]">
                    <FormField label="Punti"><input aria-label="Punti correzione" className="w-full" onChange={(event) => setAdjustment((current) => ({ ...current, delta: event.target.value }))} placeholder="es. -20" type="number" value={adjustment.delta} /></FormField>
                    <FormField label="Motivo obbligatorio"><input aria-label="Motivo obbligatorio" className="w-full" onChange={(event) => setAdjustment((current) => ({ ...current, reason: event.target.value }))} placeholder="Correzione conteggio, omaggio…" value={adjustment.reason} /></FormField>
                  </div>
                  <Button className="mt-3 w-full" disabled={!adjustment.delta || adjustment.reason.trim().length < 3} onClick={() => void adjustBalance()} variant="outline">Registra correzione</Button>
                </div>
                <div className="border-t border-stone-200 pt-4">
                  <h3 className="text-sm font-black text-stone-900">Ultimi movimenti cliente</h3>
                  <div className="mt-2 divide-y divide-stone-100">{customer.history.slice(0, 5).map((movement) => <div className="flex justify-between gap-3 py-2 text-xs" key={movement.id}><span><b className="block text-stone-800">{movement.reason}</b><span className="text-stone-400">{formatDate(movement.createdAt)}</span></span><b className={movement.delta >= 0 ? "text-emerald-700" : "text-red-700"}>{movement.delta > 0 ? "+" : ""}{movement.delta} pt</b></div>)}{customer.history.length === 0 && <p className="py-3 text-xs text-stone-500">Nessun movimento.</p>}</div>
                </div>
              </div>}
            </SectionCard>
          </div>
        )}

        <ConfirmDialog
          confirmLabel="Conferma riscatto"
          description={redeemReward && customer ? `Scala ${redeemReward.pointsRequired} punti dal saldo di ${customer.name}. Il nuovo saldo sarà ${customer.balance - redeemReward.pointsRequired} punti.` : ""}
          onCancel={() => setRedeemReward(undefined)}
          onConfirm={() => void confirmRedemption()}
          open={Boolean(redeemReward)}
          title={`Riscattare ${redeemReward?.name ?? "premio"}?`}
        />
      </PageTransition>
    </AppPage>
  );
}
