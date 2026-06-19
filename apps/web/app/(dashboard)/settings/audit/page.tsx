"use client";

import { useEffect, useMemo, useState } from "react";

import {
  AppPage,
  Drawer,
  EmptyState,
  InlineError,
  PageHeaderMetrics,
  SectionCard,
  StatusBadge,
} from "@esse-beauty/ui";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

type ActivityKind = "all" | "appointments" | "sales" | "customers" | "team" | "settings";

interface AuditItem {
  action: string;
  actorAvatarUrl?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  actorUserId?: string | null;
  createdAt?: string;
  diff?: Record<string, unknown> | null;
  entityId?: string | null;
  entityType?: string | null;
  id: string;
  payload?: { body?: Record<string, unknown> } | null;
  summary?: string;
}

interface AuditSaleItem {
  description?: string;
  discount_cents?: number;
  item_type?: string;
  quantity?: number;
  unit_price_cents?: number;
}

interface AuditPayment {
  amount_cents?: number;
  method?: string;
}

const roleLabels: Record<string, string> = {
  employee: "Collaboratore",
  manager: "Responsabile",
  owner: "Titolare",
  receptionist: "Reception",
};

const statusLabels: Record<string, string> = {
  cancelled: "Annullato",
  completed: "Completo",
  confirmed: "Confermato",
  no_show: "No-show",
  paid: "Pagato",
  pending: "In attesa",
};

const paymentLabels: Record<string, string> = {
  bank_transfer: "Bonifico",
  card: "Carta",
  cash: "Contanti",
  other: "Altro",
  voucher: "Voucher",
};

const ignoredActions = new Set([
  "delete_notifications",
  "patch_read",
  "post_read_all",
]);

function initials(name?: string | null) {
  return (name || "Sistema").split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function euro(cents: number) {
  return (cents / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" });
}

function operation(action: string) {
  if (action.startsWith("post_")) return "created";
  if (action.startsWith("delete_")) return "deleted";
  if (action.startsWith("patch_") || action.startsWith("put_")) return "updated";
  return "updated";
}

function activityKind(item: AuditItem): Exclude<ActivityKind, "all"> {
  const value = `${item.action} ${item.entityType ?? ""}`;
  if (/checkout|sales|sale|payments/.test(value)) return "sales";
  if (/appointment/.test(value)) return "appointments";
  if (/customer|consent|loyalty|package/.test(value)) return "customers";
  if (/staff|availability|closure|access|user/.test(value)) return "team";
  return "settings";
}

function activityTitle(item: AuditItem) {
  const value = `${item.action} ${item.entityType ?? ""}`;
  const verb = operation(item.action);
  const labels = {
    created: { appointment: "Appuntamento inserito", customer: "Cliente inserito", sale: "Vendita registrata", staff: "Collaboratore inserito" },
    deleted: { appointment: "Appuntamento eliminato", customer: "Cliente eliminato", sale: "Vendita annullata", staff: "Collaboratore eliminato" },
    updated: { appointment: "Appuntamento modificato", customer: "Cliente modificato", sale: "Vendita modificata", staff: "Collaboratore modificato" },
  } as const;
  if (/checkout|sales|sale/.test(value)) return labels[verb].sale;
  if (/appointment/.test(value)) return labels[verb].appointment;
  if (/customer/.test(value)) return labels[verb].customer;
  if (/availability/.test(value)) return verb === "deleted" ? "Permesso eliminato" : verb === "created" ? "Permesso inserito" : "Permesso modificato";
  if (/closure/.test(value)) return verb === "deleted" ? "Chiusura eliminata" : verb === "created" ? "Chiusura inserita" : "Chiusura modificata";
  if (/staff|access/.test(value)) return /access/.test(value) ? "Accesso collaboratore modificato" : labels[verb].staff;
  if (/service/.test(value)) return verb === "created" ? "Servizio inserito" : verb === "deleted" ? "Servizio eliminato" : "Servizio modificato";
  if (/product|inventory/.test(value)) return verb === "created" ? "Prodotto inserito" : verb === "deleted" ? "Prodotto eliminato" : "Prodotto o scorta modificati";
  if (/settings|working_hours/.test(value)) return "Impostazioni del salone modificate";
  return verb === "created" ? "Elemento inserito" : verb === "deleted" ? "Elemento eliminato" : "Informazioni modificate";
}

function activityDetails(item: AuditItem) {
  const body = item.payload?.body;
  if (!body) return [];
  const details: string[] = [];
  if (typeof body.status === "string") details.push(`Stato: ${statusLabels[body.status] ?? body.status}`);
  if (typeof body.notes === "string" && body.notes.trim()) details.push(`Nota: ${body.notes.trim()}`);
  if (typeof body.reason === "string" && body.reason.trim()) details.push(`Motivo: ${body.reason.trim()}`);
  if (typeof body.total_cents === "number") details.push(`Totale: ${(body.total_cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}`);
  if (Array.isArray(body.items)) details.push(`${body.items.length} ${body.items.length === 1 ? "voce" : "voci"} nel conto`);
  return details.slice(0, 2);
}

function kindStyle(kind: Exclude<ActivityKind, "all">) {
  return {
    appointments: "bg-blue-50 text-blue-700",
    customers: "bg-violet-50 text-violet-700",
    sales: "bg-emerald-50 text-emerald-700",
    settings: "bg-stone-100 text-stone-600",
    team: "bg-amber-50 text-amber-700",
  }[kind];
}

function ActivityIcon({ kind }: { kind: Exclude<ActivityKind, "all"> }) {
  const paths = {
    appointments: <><rect height="14" rx="2" width="16" x="4" y="5" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    customers: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    sales: <><path d="M4 7h16v12H4zM8 7V5h8v2M8 13h8" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    team: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20a6 6 0 0 1 12 0M14 15a5 5 0 0 1 7 4.5" /></>,
  };
  return <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${kindStyle(kind)}`}><svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">{paths[kind]}</svg></span>;
}

export default function AuditSettingsPage() {
  const { salon } = useAuth();
  const [items, setItems] = useState<AuditItem[]>([]);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<ActivityKind>("all");
  const [query, setQuery] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<AuditItem>();

  useEffect(() => {
    if (!salon?.id) return;
    void fetch(`${api}/api/salons/${salon.id}/audit-log`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Registro attività non disponibile.");
        setItems(await response.json());
        setError("");
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Registro attività non disponibile."));
  }, [salon?.id]);

  const operationalItems = useMemo(() => items.filter((item) => !ignoredActions.has(item.action)), [items]);
  const visibleItems = useMemo(() => operationalItems.filter((item) => {
    if (kind !== "all" && activityKind(item) !== kind) return false;
    const haystack = `${activityTitle(item)} ${item.actorName ?? ""} ${activityDetails(item).join(" ")}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  }), [kind, operationalItems, query]);
  const todayCount = operationalItems.filter((item) => item.createdAt && new Date(item.createdAt).toDateString() === new Date().toDateString()).length;
  const saleCount = operationalItems.filter((item) => activityKind(item) === "sales").length;
  const appointmentCount = operationalItems.filter((item) => activityKind(item) === "appointments").length;
  const selectedBody = selectedActivity?.payload?.body;
  const selectedItems = Array.isArray(selectedBody?.items) ? selectedBody.items as AuditSaleItem[] : [];
  const selectedPayments = Array.isArray(selectedBody?.payments) ? selectedBody.payments as AuditPayment[] : [];
  const selectedSubtotal = selectedItems.reduce((total, item) => total + Math.max(0,
    (Number(item.quantity) || 1) * (Number(item.unit_price_cents) || 0) - (Number(item.discount_cents) || 0),
  ), 0);
  const selectedDiscount = Number(selectedBody?.discount_cents) || 0;

  return (
    <AppPage maxWidth="max-w-[1500px]">
      <Drawer onClose={() => setSelectedActivity(undefined)} open={Boolean(selectedActivity)} title="Dettaglio attività">
        {selectedActivity && <div className="space-y-5">
          <section className={`rounded-2xl p-5 ${kindStyle(activityKind(selectedActivity))}`}>
            <p className="text-xs font-black uppercase tracking-[.16em]">Attività registrata</p>
            <h2 className="mt-2 text-2xl font-black">{activityTitle(selectedActivity)}</h2>
            <p className="mt-2 text-sm font-semibold">
              {selectedActivity.createdAt ? new Date(selectedActivity.createdAt).toLocaleString("it-IT") : "Data non disponibile"}
            </p>
          </section>

          <section className="flex items-center gap-3 rounded-2xl border border-stone-200 p-4">
            <span className="grid size-11 place-items-center rounded-full bg-[#f4e4ec] text-xs font-black text-[#792f59]">{initials(selectedActivity.actorName)}</span>
            <div><strong>{selectedActivity.actorName || "Sistema"}</strong><p className="mt-1 text-sm text-stone-500">{selectedActivity.actorRole ? roleLabels[selectedActivity.actorRole] ?? selectedActivity.actorRole : "Operazione automatica"}</p></div>
          </section>

          {selectedItems.length > 0 && <section>
            <h3 className="font-black">Cosa è stato venduto</h3>
            <div className="mt-3 space-y-2">
              {selectedItems.map((item, index) => {
                const quantity = Number(item.quantity) || 1;
                const price = Number(item.unit_price_cents) || 0;
                const discount = Number(item.discount_cents) || 0;
                return <article className="rounded-2xl border border-stone-200 p-4" key={`${item.description}-${index}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div><strong>{item.description || "Voce del conto"}</strong><p className="mt-1 text-xs uppercase text-stone-400">{item.item_type === "product" ? "Prodotto" : item.item_type === "custom" ? "Voce libera" : "Servizio"}</p></div>
                    <strong>{euro(Math.max(0, quantity * price - discount))}</strong>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-500"><span>Quantità: {quantity}</span><span>Prezzo: {euro(price)}</span>{discount > 0 && <span>Sconto: {euro(discount)}</span>}</div>
                </article>;
              })}
            </div>
            <div className="mt-3 rounded-2xl bg-stone-50 p-4">
              <div className="flex justify-between text-sm"><span>Subtotale</span><strong>{euro(selectedSubtotal)}</strong></div>
              {selectedDiscount > 0 && <div className="mt-2 flex justify-between text-sm text-stone-500"><span>Sconto conto</span><strong>- {euro(selectedDiscount)}</strong></div>}
              <div className="mt-3 flex justify-between border-t border-stone-200 pt-3 text-lg"><strong>Totale</strong><strong className="text-[#792f59]">{euro(Math.max(0, selectedSubtotal - selectedDiscount))}</strong></div>
            </div>
          </section>}

          {selectedPayments.length > 0 && <section>
            <h3 className="font-black">Pagamenti</h3>
            <div className="mt-3 space-y-2">{selectedPayments.map((payment, index) => <div className="flex justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" key={index}><strong>{paymentLabels[payment.method ?? ""] ?? "Pagamento"}</strong><strong>{euro(Number(payment.amount_cents) || 0)}</strong></div>)}</div>
          </section>}

          {selectedItems.length === 0 && <section className="rounded-2xl border border-stone-200 p-4">
            <h3 className="font-black">Dettagli operazione</h3>
            <div className="mt-3 space-y-2 text-sm">
              {typeof selectedBody?.status === "string" && <p><span className="text-stone-500">Stato:</span> <strong>{statusLabels[selectedBody.status] ?? selectedBody.status}</strong></p>}
              {typeof selectedBody?.reason === "string" && <p><span className="text-stone-500">Motivo:</span> <strong>{selectedBody.reason}</strong></p>}
              {typeof selectedBody?.notes === "string" && selectedBody.notes.trim() && <p><span className="text-stone-500">Note:</span> <strong>{selectedBody.notes}</strong></p>}
              {typeof selectedBody?.starts_at === "string" && <p><span className="text-stone-500">Data e ora:</span> <strong>{new Date(selectedBody.starts_at).toLocaleString("it-IT")}</strong></p>}
              {typeof selectedBody?.duration_minutes === "number" && <p><span className="text-stone-500">Durata:</span> <strong>{selectedBody.duration_minutes} minuti</strong></p>}
              {typeof selectedBody?.delta === "number" && <p><span className="text-stone-500">Variazione scorta:</span> <strong>{selectedBody.delta > 0 ? "+" : ""}{selectedBody.delta}</strong></p>}
              {!activityDetails(selectedActivity).length && <p className="text-stone-500">L’operazione è stata registrata correttamente. Non sono presenti ulteriori dettagli compilati.</p>}
            </div>
          </section>}
        </div>}
      </Drawer>
      <PageHeaderMetrics
        eyebrow="Attività del salone"
        metrics={[
          { detail: "Operazioni", label: "Attività oggi", value: todayCount },
          { detail: "Gestiti", label: "Appuntamenti", value: appointmentCount },
          { detail: "Registrate", label: "Vendite", value: saleCount },
        ]}
        status={<StatusBadge status="active">{todayCount} oggi</StatusBadge>}
        subtitle="Una cronologia chiara di ciò che viene inserito, modificato, eliminato e venduto dal team."
        title="Registro attività"
      />
      {error && <InlineError className="mb-5">{error}</InlineError>}
      <SectionCard title="Cosa è successo" subtitle="Le attività più recenti del salone, ordinate per data e ora.">
        <div className="mb-5 flex flex-wrap gap-2 border-b border-stone-100 pb-5">
          {([
            ["all", "Tutto"],
            ["appointments", "Appuntamenti"],
            ["sales", "Vendite"],
            ["customers", "Clienti"],
            ["team", "Team"],
            ["settings", "Impostazioni"],
          ] as Array<[ActivityKind, string]>).map(([value, label]) => (
            <button className={`min-h-10 rounded-xl border px-4 text-sm font-bold transition ${kind === value ? "border-[#792f59] bg-[#792f59] text-white" : "border-stone-200 bg-white text-stone-600 hover:border-[#c98cac]"}`} key={value} onClick={() => setKind(value)}>{label}</button>
          ))}
          <input aria-label="Cerca nel registro" className="min-h-10 min-w-64 flex-1 rounded-xl border border-stone-200 px-4 text-sm" onChange={(event) => setQuery(event.target.value)} placeholder="Cerca per persona o attività" value={query} />
        </div>
        {visibleItems.length === 0 ? <EmptyState title="Nessuna attività" description="Non ci sono attività corrispondenti ai filtri selezionati." /> : (
          <div className="divide-y divide-stone-100">
            {visibleItems.map((item) => {
              const itemKind = activityKind(item);
              const details = activityDetails(item);
              return (
                <button className="grid w-full gap-4 py-5 text-left transition hover:bg-[#fffafd] sm:grid-cols-[40px_minmax(0,1fr)_auto]" key={item.id} onClick={() => setSelectedActivity(item)} type="button">
                  <ActivityIcon kind={itemKind} />
                  <div className="min-w-0">
                    <h3 className="font-bold text-stone-950">{activityTitle(item)}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-stone-600">
                      <span className="grid size-7 place-items-center rounded-full bg-[#f4e4ec] text-[10px] font-black text-[#792f59]">{initials(item.actorName)}</span>
                      <strong className="text-stone-800">{item.actorName || "Sistema"}</strong>
                      {item.actorRole && <span>· {roleLabels[item.actorRole] ?? item.actorRole}</span>}
                    </div>
                    {details.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{details.map((detail) => <span className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600" key={detail}>{detail}</span>)}</div>}
                  </div>
                  <span className="flex items-center gap-3 sm:flex-col sm:items-end">
                    <time className="text-xs font-bold text-stone-400 sm:text-right" dateTime={item.createdAt}>
                      {item.createdAt ? new Date(item.createdAt).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Ora non disponibile"}
                    </time>
                    <span className="text-xs font-bold text-[#792f59]">Vedi dettagli →</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </SectionCard>
    </AppPage>
  );
}
