"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, CircleMinus, CirclePlus, Gift, Search } from "lucide-react";

import {
  AppPage,
  Button,
  ConfirmDialog,
  EmptyState,
  FormField,
  InlineError,
  PageHeader,
  SaveToast,
  SectionCard,
  StatCard,
  StatGrid,
  StatusBadge,
} from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

type EarningAction = "appointment_completed" | "service_purchased" | "product_purchased" | "euro_spent";
interface EarningRule { action: EarningAction; active: boolean; points: number; }
interface Reward { active: boolean; description: string | null; id: string; name: string; pointsRequired: number; }
interface Tier { benefits: { text?: string }; id: string; minPoints: number; name: string; }
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
  redemptions: Array<{ created_at: string; id: string; points_spent: number; reward_name: string; status: string }>;
}
interface LoyaltySummary {
  metrics: { earned_period: number; members: number; outstanding_balance: number; redeemed_period: number };
  period_days: number;
  recent_movements: Array<{ actor_name: string | null; created_at: string; customer_id: string; customer_name: string; delta: number; id: string; reason: string }>;
  recent_redemptions: Array<{ created_at: string; customer_id: string; customer_name: string; id: string; points_spent: number; reward_name: string; status: string }>;
  tier_distribution: Array<{ id: string; members: number; min_points: number; name: string }>;
}
interface LoyaltySettings { allowNegativeBalance: boolean; earningRules?: EarningRule[]; pointsExpireAfterDays: number | null; pointsPerAppointment: number; }

const defaultRules: EarningRule[] = [
  { action: "appointment_completed", active: true, points: 10 },
  { action: "service_purchased", active: false, points: 5 },
  { action: "product_purchased", active: false, points: 1 },
  { action: "euro_spent", active: false, points: 1 },
];
const ruleMeta: Record<EarningAction, { label: string; unit: string }> = {
  appointment_completed: { label: "Appuntamento completato", unit: "per appuntamento" },
  service_purchased: { label: "Servizio acquistato", unit: "per servizio" },
  product_purchased: { label: "Prodotto acquistato", unit: "per prodotto" },
  euro_spent: { label: "Euro speso", unit: "per euro intero" },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function errorMessage(code?: string) {
  if (code === "INSUFFICIENT_POINTS") return "Il saldo disponibile non è sufficiente per questa operazione.";
  if (code === "REWARD_NOT_AVAILABLE") return "Il premio non è più disponibile.";
  if (code === "INVALID_ADJUSTMENT") return "Inserisci punti validi e un motivo obbligatorio.";
  return "Operazione non riuscita. Riprova.";
}

export default function LoyaltySettingsPage() {
  const { salon } = useAuth();
  const [summary, setSummary] = useState<LoyaltySummary>();
  const [settings, setSettings] = useState<LoyaltySettings>();
  const [rules, setRules] = useState(defaultRules);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
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

  async function loadAll() {
    if (!salon) return;
    setLoading(true);
    setError("");
    const urls = ["summary", "settings", "rewards", "tiers", "customers"].map((path) => `${api}/api/salons/${salon.id}/loyalty/${path}`);
    const responses = await Promise.all(urls.map((url) => fetch(url, { credentials: "include" })));
    if (responses.some((response) => !response.ok)) {
      setError("Non riesco a caricare il programma fedeltà.");
      setLoading(false);
      return;
    }
    const [summaryData, settingsData, rewardsData, tiersData, customersData] = await Promise.all(responses.map((response) => response.json()));
    setSummary(summaryData as LoyaltySummary);
    setSettings(settingsData as LoyaltySettings);
    setRewards(rewardsData as Reward[]);
    setTiers(tiersData as Tier[]);
    setCustomers(customersData as CustomerSummary[]);
    setRules(defaultRules.map((fallback) => (settingsData as LoyaltySettings).earningRules?.find((rule) => rule.action === fallback.action) ?? fallback));
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

  useEffect(() => { void loadAll(); }, [salon?.id]);
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  async function saveRules() {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/loyalty/settings`, {
      method: "PATCH", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        allow_negative_balance: settings?.allowNegativeBalance ?? false,
        earning_rules: rules,
        points_expire_after_days: settings?.pointsExpireAfterDays ?? null,
        points_per_appointment: rules.find((rule) => rule.action === "appointment_completed")?.points ?? 0,
      }),
    });
    if (!response.ok) return setError("Salvataggio delle regole non riuscito.");
    setMessage("Regole di accumulo aggiornate.");
    await loadAll();
  }

  async function saveTiers() {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/loyalty/tiers`, {
      method: "PUT", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tiers: tiers.map((tier) => ({ benefits: tier.benefits.text ?? "", min_points: tier.minPoints, name: tier.name })) }),
    });
    if (!response.ok) return setError("Controlla nomi e soglie: ogni livello deve avere una soglia diversa.");
    setMessage("Livelli fedeltà salvati.");
    await loadAll();
  }

  async function toggleReward(reward: Reward) {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/loyalty/rewards/${reward.id}`, {
      method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: !reward.active }),
    });
    if (!response.ok) return setError("Aggiornamento premio non riuscito.");
    await loadAll();
  }

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
    await Promise.all([loadAll(), loadCustomer(selectedCustomerId)]);
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
    await Promise.all([loadAll(), loadCustomer(selectedCustomerId)]);
  }

  const metrics = summary?.metrics ?? { earned_period: 0, members: 0, outstanding_balance: 0, redeemed_period: 0 };

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <SaveToast visible={Boolean(message)}>{message}</SaveToast>
      <PageHeader
        actions={<Link className="inline-flex min-h-10 items-center rounded-xl bg-[#6f244e] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#58203f]" href="/loyalty/rewards/new"><Gift className="mr-2 size-4" />Nuovo premio</Link>}
        eyebrow="Fedeltà"
        title="Programma fedeltà"
        subtitle="Saldo reale, premi riscattabili, clienti e regole: tutto in un’unica vista operativa."
        status={<StatusBadge status={rewards.some((reward) => reward.active) ? "active" : "draft"}>{rewards.filter((reward) => reward.active).length} premi attivi</StatusBadge>}
      />

      {error && <div className="mb-4"><InlineError>{error}<button className="ml-3 underline" onClick={() => setError("")} type="button">Chiudi</button></InlineError></div>}
      {loading ? <div className="h-40 animate-pulse rounded-2xl bg-stone-100" /> : <>
        <StatGrid>
          <StatCard detail="clienti con saldo attivo" label="Membri" value={metrics.members} />
          <StatCard detail="punti disponibili oggi" label="Saldo in circolo" value={metrics.outstanding_balance} />
          <StatCard detail={`ultimi ${summary?.period_days ?? 30} giorni`} label="Punti guadagnati" value={`+${metrics.earned_period}`} />
          <StatCard detail={`ultimi ${summary?.period_days ?? 30} giorni`} label="Punti riscattati" value={`-${metrics.redeemed_period}`} />
        </StatGrid>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,.75fr)]">
          <SectionCard title="Clienti e saldo" subtitle="Cerca un cliente, controlla la progressione e opera sul saldo.">
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
                  {customer.available_rewards.filter((reward) => reward.active).map((reward) => <button className="flex items-center justify-between rounded-xl border border-stone-200 p-3 text-left hover:border-[#c887aa] disabled:cursor-not-allowed disabled:opacity-45" disabled={!reward.available} key={reward.id} onClick={() => prepareRedemption(reward)} type="button"><span><b className="block text-sm">{reward.name}</b><span className="text-xs text-stone-500">{reward.available ? "Disponibile ora" : `Mancano ${reward.pointsRequired - customer.balance} punti`}</span></span><span className="font-black text-[#6f244e]">{reward.pointsRequired} pt</span></button>)}
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

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <SectionCard title="Livelli e progressione" subtitle="Soglie ordinate e beneficio visibile allo staff e al cliente.">
            <div className="space-y-2">
              {[...tiers].sort((left, right) => left.minPoints - right.minPoints).map((tier, index) => (
                <div className="grid gap-2 rounded-xl border border-stone-200 bg-white p-3 md:grid-cols-[1fr_120px_1.4fr_auto]" key={tier.id}>
                  <input aria-label={`Nome livello ${index + 1}`} onChange={(event) => setTiers((current) => current.map((item) => item.id === tier.id ? { ...item, name: event.target.value } : item))} value={tier.name} />
                  <input aria-label={`Soglia livello ${index + 1}`} min={0} onChange={(event) => setTiers((current) => current.map((item) => item.id === tier.id ? { ...item, minPoints: Math.max(0, Number(event.target.value)) } : item))} type="number" value={tier.minPoints} />
                  <input aria-label={`Benefici livello ${index + 1}`} onChange={(event) => setTiers((current) => current.map((item) => item.id === tier.id ? { ...item, benefits: { text: event.target.value } } : item))} placeholder="Benefit del livello" value={tier.benefits.text ?? ""} />
                  <button aria-label={`Rimuovi ${tier.name}`} className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => setTiers((current) => current.filter((item) => item.id !== tier.id))} type="button"><CircleMinus className="size-5" /></button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-2">
              <Button onClick={() => setTiers((current) => [...current, { benefits: { text: "" }, id: crypto.randomUUID(), minPoints: current.length ? Math.max(...current.map((tier) => tier.minPoints)) + 100 : 0, name: `Livello ${current.length + 1}` }])} size="sm" variant="outline"><CirclePlus className="mr-2 size-4" />Aggiungi livello</Button>
              <Button onClick={() => void saveTiers()} size="sm">Salva livelli</Button>
            </div>
            {summary?.tier_distribution.length ? <div className="mt-5 border-t border-stone-200 pt-4"><p className="mb-3 text-xs font-black uppercase tracking-wider text-stone-500">Distribuzione membri</p><div className="grid gap-2 sm:grid-cols-2">{summary.tier_distribution.map((tier) => <div className="flex justify-between rounded-lg bg-stone-50 px-3 py-2 text-sm" key={tier.id}><span>{tier.name} · da {tier.min_points} pt</span><b>{tier.members}</b></div>)}</div></div> : null}
          </SectionCard>

          <SectionCard title="Catalogo premi" subtitle="Disponibilità, costo punti e accesso rapido alla modifica.">
            <div className="space-y-2">
              {rewards.map((reward) => <div className={`grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-stone-200 p-3 ${reward.active ? "bg-white" : "bg-stone-50 opacity-65"}`} key={reward.id}><div className="min-w-0"><Link className="font-bold text-stone-950 hover:text-[#6f244e]" href={`/loyalty/rewards/${reward.id}`}>{reward.name}</Link><p className="truncate text-xs text-stone-500">{reward.description || "Nessuna descrizione"}</p></div><div className="flex items-center gap-2"><b className="whitespace-nowrap text-[#6f244e]">{reward.pointsRequired} pt</b><Button onClick={() => void toggleReward(reward)} size="sm" variant="outline">{reward.active ? "Archivia" : "Riattiva"}</Button></div></div>)}
               {rewards.length === 0 && <EmptyState title="Nessun premio" description="Crea il primo vantaggio concreto del programma." />}
            </div>
          </SectionCard>
        </div>

         <SectionCard className="mt-6" title="Regole di accumulo" subtitle="Punti assegnati automaticamente da appuntamenti e vendite reali.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {rules.map((rule) => <article className={`rounded-xl border p-4 ${rule.active ? "border-emerald-200 bg-emerald-50/60" : "border-stone-200 bg-stone-50"}`} key={rule.action}><div className="flex items-start justify-between gap-2"><div><h3 className="text-sm font-black">{ruleMeta[rule.action].label}</h3><p className="text-xs text-stone-500">{ruleMeta[rule.action].unit}</p></div><button aria-label={`${rule.active ? "Disattiva" : "Attiva"} ${ruleMeta[rule.action].label}`} className={`relative h-6 w-10 rounded-full ${rule.active ? "bg-emerald-600" : "bg-stone-300"}`} onClick={() => setRules((current) => current.map((item) => item.action === rule.action ? { ...item, active: !item.active } : item))} type="button"><span className={`absolute top-1 size-4 rounded-full bg-white transition ${rule.active ? "left-5" : "left-1"}`} /></button></div><input className="mt-3 w-full" disabled={!rule.active} min={0} onChange={(event) => setRules((current) => current.map((item) => item.action === rule.action ? { ...item, points: Math.max(0, Number(event.target.value)) } : item))} type="number" value={rule.points} /></article>)}
           </div>
           <div className="mt-4 grid gap-3 border-t border-stone-200 pt-4 md:grid-cols-2">
             <FormField label="Scadenza punti"><div className="flex items-center gap-2"><input className="w-32" min={1} onChange={(event) => setSettings((current) => current ? { ...current, pointsExpireAfterDays: event.target.value ? Number(event.target.value) : null } : current)} placeholder="Mai" type="number" value={settings?.pointsExpireAfterDays ?? ""} /><span className="text-sm text-stone-500">giorni; vuoto = nessuna scadenza</span></div></FormField>
             <label className="flex min-h-11 items-center gap-3 rounded-xl border border-stone-200 px-3 text-sm"><input checked={settings?.allowNegativeBalance ?? false} onChange={(event) => setSettings((current) => current ? { ...current, allowNegativeBalance: event.target.checked } : current)} type="checkbox" /><span><b className="block">Correzioni sotto zero</b><span className="text-xs text-stone-500">Consenti solo se la tua procedura lo richiede.</span></span></label>
           </div>
           <div className="mt-4 flex justify-end"><Button onClick={() => void saveRules()}>Salva regole</Button></div>
        </SectionCard>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <SectionCard title="Movimenti recenti" subtitle="Ledger immutabile: accrediti, riscatti e correzioni manuali.">
            <div className="divide-y divide-stone-100">{summary?.recent_movements.map((movement) => <button className="grid w-full grid-cols-[1fr_auto] gap-3 py-3 text-left" key={movement.id} onClick={() => void loadCustomer(movement.customer_id)} type="button"><span><b className="block text-sm">{movement.customer_name}</b><span className="text-xs text-stone-500">{movement.reason} · {formatDate(movement.created_at)}{movement.actor_name ? ` · ${movement.actor_name}` : ""}</span></span><b className={movement.delta >= 0 ? "text-emerald-700" : "text-red-700"}>{movement.delta > 0 ? "+" : ""}{movement.delta} pt</b></button>)}{!summary?.recent_movements.length && <p className="py-8 text-center text-sm text-stone-500">Nessun movimento registrato.</p>}</div>
          </SectionCard>
          <SectionCard title="Riscatti recenti" subtitle="Premi consegnati e punti scalati nello stesso momento.">
            <div className="divide-y divide-stone-100">{summary?.recent_redemptions.map((redemption) => <button className="grid w-full grid-cols-[1fr_auto] gap-3 py-3 text-left" key={redemption.id} onClick={() => void loadCustomer(redemption.customer_id)} type="button"><span><b className="block text-sm">{redemption.reward_name}</b><span className="text-xs text-stone-500">{redemption.customer_name} · {formatDate(redemption.created_at)}</span></span><span className="text-right"><b className="block text-red-700">-{redemption.points_spent} pt</b><span className="text-[11px] font-bold uppercase text-emerald-700">Riscattato</span></span></button>)}{!summary?.recent_redemptions.length && <p className="py-8 text-center text-sm text-stone-500">Nessun riscatto registrato.</p>}</div>
          </SectionCard>
        </div>
      </>}

      <ConfirmDialog
        confirmLabel="Conferma riscatto"
        description={redeemReward && customer ? `Scala ${redeemReward.pointsRequired} punti dal saldo di ${customer.name}. Il nuovo saldo sarà ${customer.balance - redeemReward.pointsRequired} punti.` : ""}
        onCancel={() => setRedeemReward(undefined)}
        onConfirm={() => void confirmRedemption()}
        open={Boolean(redeemReward)}
        title={`Riscattare ${redeemReward?.name ?? "premio"}?`}
      />
    </AppPage>
  );
}
