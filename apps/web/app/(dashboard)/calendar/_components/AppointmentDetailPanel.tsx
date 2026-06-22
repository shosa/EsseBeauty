"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  InlineError,
  PageSkeleton,
  StatusBadge,
} from "@esse-beauty/ui";
import { APPOINTMENT_STATUS_PALETTE, appointmentStatusLabel, type AppointmentStatus } from "@esse-beauty/shared";

import { useAuth } from "../../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

type ItemType = "service" | "product" | "custom";
type PaymentMethod = "cash" | "card" | "bank_transfer" | "voucher" | "other";

const statusActions: AppointmentStatus[] = ["pending", "confirmed", "completed", "no_show", "cancelled"];

function statusActionPalette(status: AppointmentStatus, active = false) {
  const strong: Record<AppointmentStatus, { background: string; border: string; text: string }> = {
    cancelled: { background: "#dc2626", border: "#991b1b", text: "#ffffff" },
    completed: { background: "#16a34a", border: "#166534", text: "#ffffff" },
    confirmed: { background: "#0284c7", border: "#075985", text: "#ffffff" },
    no_show: { background: "#ea580c", border: "#9a3412", text: "#ffffff" },
    pending: { background: "#f59e0b", border: "#b45309", text: "#451a03" },
  };
  if (active) return strong[status];
  if (status === "confirmed") return { background: "#e0f2fe", border: "#7dd3fc", text: "#075985" };
  if (status === "completed") return { background: "#dcfce7", border: "#86efac", text: "#166534" };
  return APPOINTMENT_STATUS_PALETTE[status as Exclude<AppointmentStatus, "confirmed">];
}

function StatusActionIcon({ status }: { status: AppointmentStatus }) {
  if (status === "pending") return <svg aria-hidden="true" fill="none" height="24" viewBox="0 0 24 24" width="24"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" /><path d="M12 7v5l3 2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>;
  if (status === "confirmed") return <svg aria-hidden="true" fill="none" height="24" viewBox="0 0 24 24" width="24"><path d="m6 12 4 4 8-9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" /></svg>;
  if (status === "completed") return <svg aria-hidden="true" fill="none" height="24" viewBox="0 0 24 24" width="24"><path d="m3.5 12 3.5 3.5 6.5-7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /><path d="m10.5 15.5 2 2 8-9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>;
  if (status === "no_show") return <svg aria-hidden="true" fill="none" height="24" viewBox="0 0 24 24" width="24"><path d="M3 3l18 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /><path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c5.5 0 9 6 9 6a17 17 0 0 1-2.4 3.2M14.1 14.3A3 3 0 0 1 9.7 9.9M6.4 7.3C4.2 9 3 12 3 12s3.5 6 9 6a9.8 9.8 0 0 0 3-.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
  return <svg aria-hidden="true" fill="none" height="24" viewBox="0 0 24 24" width="24"><path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" /></svg>;
}

interface Appointment {
  customer_email?: string | null;
  customer_id: string;
  customer_name: string;
  customer_phone?: string | null;
  ends_at: string;
  id: string;
  notes?: string | null;
  service_id: string;
  service_name: string;
  service_price_cents: number;
  staff_id: string;
  staff_name: string;
  starts_at: string;
  status: string;
}

interface CatalogItem {
  category?: string;
  id: string;
  name: string;
  price_cents: number;
  stock_quantity?: number;
}

interface CheckoutLine {
  customer_package_id?: string;
  description: string;
  discount_cents: number;
  item_type: ItemType;
  package_item_id?: string;
  package_name?: string;
  package_quantity?: number;
  product_id?: string;
  quantity: number;
  service_id?: string;
  staff_id?: string;
  unit_price_cents: number;
}

interface PaymentDraft {
  amount_cents: number;
  method: PaymentMethod;
  voucher_balance_cents?: number;
  voucher_code?: string;
  voucher_customer_name?: string;
}

interface VoucherLookup {
  balance_cents: number;
  code: string;
  customer_id: string;
  customer_name: string;
  id: string;
}
interface CustomerPackage { id: string; items: Array<{ itemType: ItemType; packageItemId: string; productId?: string | null; remainingQuantity: number; serviceId?: string | null }>; name: string; }

interface CheckoutResponse {
  appointment: Appointment;
  catalog: { products: CatalogItem[]; services: CatalogItem[] };
  sale: null | {
    discountCents: number;
    id: string;
    items: Array<{
      description: string;
      discountCents: number;
      itemType: ItemType;
      productId?: string | null;
      quantity: number;
      serviceId?: string | null;
      staffId?: string | null;
      unitPriceCents: number;
    }>;
    notes?: string | null;
    payments: Array<{ amountCents: number; method: PaymentMethod }>;
    status: string;
    totalCents: number;
  };
}

const paymentMethods: Array<{ label: string; value: PaymentMethod }> = [
  { label: "Contanti", value: "cash" },
  { label: "Carta", value: "card" },
  { label: "Voucher", value: "voucher" },
  { label: "Bonifico", value: "bank_transfer" },
  { label: "Altro", value: "other" },
];
const paymentLabels: Record<PaymentMethod, string> = Object.fromEntries(paymentMethods.map((method) => [method.value, method.label])) as Record<PaymentMethod, string>;

function euro(cents: number) {
  return (cents / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" });
}

function inputCents(value: string) {
  const amount = Number(value.replace(",", "."));
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("it-IT", { day: "2-digit", month: "long", weekday: "long", year: "numeric" });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function minutesBetween(from: string, to: string) {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
}

function initials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function dateInputValue(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function timeInputValue(value: string) {
  return new Date(value).toLocaleTimeString("it-IT", { hour: "2-digit", hour12: false, minute: "2-digit" });
}

export default function AppointmentDetailPanel({
  appointmentId,
  onChanged,
  onClose,
}: {
  appointmentId: string;
  onChanged?(): void;
  onClose(): void;
}) {
  const { salon } = useAuth();
  const [data, setData] = useState<CheckoutResponse>();
  const [lines, setLines] = useState<CheckoutLine[]>([]);
  const [payments, setPayments] = useState<PaymentDraft[]>([{ amount_cents: 0, method: "cash" }]);
  const [customerVouchers, setCustomerVouchers] = useState<VoucherLookup[]>([]);
  const [customerPackages, setCustomerPackages] = useState<CustomerPackage[]>([]);
  const [discountCents, setDiscountCents] = useState(0);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [appointmentDuration, setAppointmentDuration] = useState("60");
  const [appointmentNotes, setAppointmentNotes] = useState("");
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function load() {
    if (!salon) return;
    setLoading(true);
    const response = await fetch(`${api}/api/salons/${salon.id}/appointments/${appointmentId}/checkout`, { credentials: "include" });
    if (!response.ok) {
      setError(response.status === 404 ? "" : "Impossibile caricare l'appuntamento.");
      setData(undefined);
      setLoading(false);
      return;
    }
    const next = await response.json() as CheckoutResponse;
    setData(next);
    const voucherResponse = await fetch(`${api}/api/salons/${salon.id}/vouchers?${new URLSearchParams({ customer_id: next.appointment.customer_id, status: "active" })}`, { credentials: "include" });
    setCustomerVouchers(voucherResponse.ok ? await voucherResponse.json() as VoucherLookup[] : []);
    const packageResponse = await fetch(`${api}/api/salons/${salon.id}/customer-service-packages?${new URLSearchParams({ customer_id: next.appointment.customer_id })}`, { credentials: "include" });
    const packages = packageResponse.ok ? await packageResponse.json() as CustomerPackage[] : [];
    setCustomerPackages(packages);
    setAppointmentDate(dateInputValue(next.appointment.starts_at));
    setAppointmentTime(timeInputValue(next.appointment.starts_at));
    setAppointmentDuration(String(minutesBetween(next.appointment.starts_at, next.appointment.ends_at)));
    setAppointmentNotes(next.appointment.notes ?? "");
    if (next.sale) {
      setLines(next.sale.items.map((item) => ({
        description: item.description,
        discount_cents: item.discountCents,
        item_type: item.itemType,
        product_id: item.productId ?? undefined,
        quantity: item.quantity,
        service_id: item.serviceId ?? undefined,
        staff_id: item.staffId ?? undefined,
        unit_price_cents: item.unitPriceCents,
      })));
      setPayments(next.sale.payments.map((item) => ({ amount_cents: item.amountCents, method: item.method })));
      setDiscountCents(next.sale.discountCents);
      setNotes(next.sale.notes ?? "");
    } else {
      setLines([{
        description: next.appointment.service_name,
        discount_cents: 0,
        item_type: "service",
        quantity: 1,
        service_id: next.appointment.service_id,
        staff_id: next.appointment.staff_id,
        unit_price_cents: next.appointment.service_price_cents,
      }]);
      setDiscountCents(0);
      setNotes("");
    }
    if (packages.length) window.setTimeout(() => applyPackages(packages), 0);
    setError("");
    setLoading(false);
  }

  useEffect(() => { void load(); }, [salon?.id, appointmentId]);

  const subtotalCents = useMemo(() => lines.reduce((total, line) => {
    const gross = (line.quantity - (line.package_quantity ?? 0)) * line.unit_price_cents;
    return total + Math.max(0, gross - line.discount_cents);
  }, 0), [lines]);
  const totalCents = Math.max(0, subtotalCents - discountCents);
  const paidCents = payments.reduce((total, payment) => total + payment.amount_cents, 0);
  const isClosed = data?.sale?.status === "paid";
  const checkoutEnabled = !isClosed && data?.appointment.status === "confirmed";
  const editedEndTime = useMemo(() => {
    const duration = Number(appointmentDuration);
    if (!appointmentDate || !appointmentTime || !Number.isFinite(duration) || duration < 1) return "";
    const end = new Date(`${appointmentDate}T${appointmentTime}`);
    end.setMinutes(end.getMinutes() + duration);
    return end.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  }, [appointmentDate, appointmentDuration, appointmentTime]);

  useEffect(() => {
    if (checkoutEnabled && payments.length === 1) {
      setPayments((current) => [{ ...current[0]!, amount_cents: totalCents }]);
    }
  }, [totalCents, checkoutEnabled]);

  function updateLine(index: number, patch: Partial<CheckoutLine>) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  }

  function addCatalogItem(item: CatalogItem, itemType: ItemType) {
    setLines((current) => [...current, {
      description: item.name,
      discount_cents: 0,
      item_type: itemType,
      product_id: itemType === "product" ? item.id : undefined,
      quantity: 1,
      service_id: itemType === "service" ? item.id : undefined,
      staff_id: data?.appointment.staff_id,
      unit_price_cents: item.price_cents,
    }]);
  }

  async function updateStatus(status: AppointmentStatus) {
    if (!salon) return;
    setStatusUpdating(true);
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/appointments/${appointmentId}`, {
      body: JSON.stringify({ status }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      setError(body.error === "APPOINTMENT_STATUS_LOCKED_BY_SALE"
        ? "Lo stato non può più essere modificato perché la vendita è stata registrata."
        : "Stato non aggiornato.");
      setStatusUpdating(false);
      return;
    }
    await load();
    onChanged?.();
    setStatusUpdating(false);
  }

  async function saveAppointment() {
    if (!salon || !data || !appointmentDate || !appointmentTime) return;
    const durationMinutes = Number(appointmentDuration);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 720) {
      setError("Inserisci una durata valida, da 5 a 720 minuti.");
      return;
    }
    setSavingAppointment(true);
    setError("");
    const startsAt = new Date(`${appointmentDate}T${appointmentTime}`);
    const response = await fetch(`${api}/api/salons/${salon.id}/appointments/${appointmentId}`, {
      body: JSON.stringify({
        duration_minutes: durationMinutes,
        notes: appointmentNotes,
        starts_at: startsAt.toISOString(),
      }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setError(body.error === "APPOINTMENT_CONFLICT"
        ? "Il nuovo orario o la nuova durata si sovrappongono a un altro appuntamento o a un blocco dello staff."
        : body.error === "INVALID_DURATION"
          ? "La durata deve essere compresa tra 5 e 720 minuti."
          : "Appuntamento non aggiornato.");
      setSavingAppointment(false);
      return;
    }
    await load();
    onChanged?.();
    setEditingAppointment(false);
    setSavingAppointment(false);
  }

  async function completeCheckout() {
    if (!salon || !checkoutEnabled) return;
    if (paidCents !== totalCents) {
      setError(`I pagamenti devono coprire esattamente ${euro(totalCents)}.`);
      return;
    }
    setSaving(true);
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/appointments/${appointmentId}/checkout`, {
      body: JSON.stringify({
        discount_cents: discountCents,
        items: lines,
        notes,
        payments: payments.map(({ amount_cents, method, voucher_code }) => ({ amount_cents, method, voucher_code })),
      }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      const messages: Record<string, string> = {
        APPOINTMENT_NOT_CONFIRMED: "La cassa è disponibile solo per un appuntamento confermato.",
        PAYMENT_TOTAL_MISMATCH: "Il totale dei pagamenti non coincide con il conto.",
        SALE_ALREADY_CLOSED: "Questo conto è già stato chiuso.",
        VOUCHER_CODE_REQUIRED: "Inserisci il codice del buono.",
        VOUCHER_CUSTOMER_MISMATCH: "Il buono non appartiene a questo cliente.",
        VOUCHER_EXHAUSTED: "Il buono è già esaurito.",
        VOUCHER_INSUFFICIENT_BALANCE: "Il buono non ha saldo sufficiente per questo importo.",
        VOUCHER_NOT_FOUND: "Buono non trovato.",
      };
      setError(messages[body.error ?? ""] ?? "Checkout non completato. Controlla i dati.");
      setSaving(false);
      return;
    }
    await load();
    onChanged?.();
    setSaving(false);
  }

  function applyPackages(packages = customerPackages) {
    const remaining = new Map<string, number>();
    packages.forEach((pack) => pack.items.forEach((item) => remaining.set(`${pack.id}:${item.packageItemId}`, item.remainingQuantity)));
    setLines((current) => current.map((line) => {
      if (line.item_type !== "service" && line.item_type !== "product") return line;
      const match = packages.flatMap((pack) => pack.items.map((item) => ({ ...item, customerPackageId: pack.id, packageName: pack.name }))).find((item) =>
        item.remainingQuantity > 0 &&
        item.itemType === line.item_type &&
        (line.item_type === "service" ? item.serviceId === line.service_id : item.productId === line.product_id)
      );
      if (!match) return { ...line, customer_package_id: undefined, package_item_id: undefined, package_name: undefined, package_quantity: undefined };
      const key = `${match.customerPackageId}:${match.packageItemId}`;
      const available = remaining.get(key) ?? 0;
      const covered = Math.min(line.quantity, available);
      remaining.set(key, available - covered);
      return { ...line, customer_package_id: match.customerPackageId, package_item_id: match.packageItemId, package_name: match.packageName, package_quantity: covered };
    }));
  }

  function applyVoucher(voucher: VoucherLookup, paymentIndex?: number) {
    const voucherAmount = Math.min(totalCents, voucher.balance_cents);
    const voucherPayment: PaymentDraft = {
      amount_cents: voucherAmount,
      method: "voucher",
      voucher_balance_cents: voucher.balance_cents,
      voucher_code: voucher.code,
      voucher_customer_name: voucher.customer_name,
    };
    if (paymentIndex !== undefined) {
      setPayments((current) => current.map((payment, index) => index === paymentIndex ? voucherPayment : payment));
      return;
    }
    const remainder = totalCents - voucherAmount;
    setPayments(remainder > 0 ? [voucherPayment, { amount_cents: remainder, method: "cash" }] : [voucherPayment]);
    setError("");
  }

  async function remove() {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/appointments/${appointmentId}`, {
      credentials: "include",
      method: "DELETE",
    });
    if (!response.ok) {
      setError("Appuntamento non eliminato.");
      setConfirmDelete(false);
      return;
    }
    onChanged?.();
    onClose();
  }

  if (loading) return <div className="p-8"><PageSkeleton /></div>;
  const appointment = data?.appointment;

  return (
    <div className="min-h-full bg-[#f7f6f3]">
      <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white/96 px-5 py-3 shadow-sm backdrop-blur lg:px-8">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#792f59]">Agenda · Scheda appuntamento</p>
          <p className="mt-1 text-sm font-bold text-stone-700">{appointment?.customer_name ?? "Appuntamento"}</p>
        </div>
        {appointment && (
          <div className="ml-auto flex items-center gap-2">
          <div aria-label="Cambia stato appuntamento" className="flex flex-wrap items-center justify-end gap-1.5">
            {statusActions.map((status) => {
              const active = appointment.status === status;
              const palette = statusActionPalette(status, active);
              return (
                <button
                  aria-label={appointmentStatusLabel(status)}
                  aria-pressed={active}
                  className={`relative inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-black transition ${active ? "z-10 scale-105 border-[3px] px-4 shadow-[0_10px_24px_rgb(0_0_0_/_0.24)] ring-4 ring-current/15 disabled:opacity-100" : "opacity-70 hover:-translate-y-0.5 hover:opacity-100 disabled:opacity-35"} disabled:cursor-not-allowed`}
                  disabled={isClosed || statusUpdating || active}
                  key={status}
                  onClick={() => void updateStatus(status)}
                   style={{
                     background: palette?.background,
                     borderColor: palette?.border,
                     color: palette?.text,
                   }}
                  title={isClosed ? "Stato bloccato: vendita registrata" : appointmentStatusLabel(status)}
                  type="button"
                >
                  <span className="grid size-5 place-items-center [&_svg]:size-5"><StatusActionIcon status={status} /></span>
                  <span>{appointmentStatusLabel(status)}</span>
                  {active && <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-[11px] left-1/2 size-5 -translate-x-1/2 rotate-45 border-b-[3px] border-r-[3px] shadow-[4px_4px_7px_rgb(0_0_0_/_0.12)]"
                    style={{ background: palette?.background, borderColor: palette?.border }}
                  />}
                </button>
              );
            })}
          </div>
          <span className="mx-1 h-8 w-px bg-stone-200" />
          <button aria-label="Chiudi scheda appuntamento" className="grid size-11 shrink-0 place-items-center rounded-full border border-stone-300 bg-white text-stone-600 shadow-sm transition hover:scale-105 hover:bg-stone-950 hover:text-white" onClick={onClose} title="Chiudi" type="button"><svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" width="22"><path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" /></svg></button>
          </div>
        )}
      </div>
      {error && <div className="px-5 pt-4 lg:px-8"><InlineError>{error}</InlineError></div>}
      {!appointment ? (
        <EmptyState title="Appuntamento non trovato" description="Potrebbe essere stato eliminato o non essere accessibile." />
      ) : (
        <div className="overflow-hidden border-y border-stone-200 bg-[#f7f6f3] shadow-[0_30px_90px_rgb(38_25_32_/_0.12)]">
          <header
            className="grid gap-5 border-t-[7px] bg-[#201820] px-6 py-6 text-white transition-colors lg:grid-cols-[1fr_auto] lg:px-8"
            style={{ borderTopColor: statusActionPalette(appointment.status as AppointmentStatus, true).background }}
          >
            <div className="flex min-w-0 items-center gap-4">
              <Link
                aria-label={`Apri anagrafica di ${appointment.customer_name}`}
                className="grid size-16 shrink-0 place-items-center rounded-full border border-white/20 bg-white/12 text-xl font-black text-white shadow-lg transition hover:scale-105 hover:bg-white/20"
                href={`/clients/${appointment.customer_id}`}
              >
                {initials(appointment.customer_name)}
              </Link>
              <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-[.2em] text-[#e9a9c9]">Scheda appuntamento</span>
                <StatusBadge status={appointment.status} />
                {isClosed && <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-black text-emerald-200">Conto chiuso</span>}
              </div>
              <Link className="inline-block truncate text-3xl font-black tracking-tight hover:text-[#f2b8d5] hover:underline sm:text-4xl" href={`/clients/${appointment.customer_id}`}>{appointment.customer_name}</Link>
              <p className="mt-2 text-sm font-semibold text-stone-300">{formatDate(appointment.starts_at)} · {formatTime(appointment.starts_at)}–{formatTime(appointment.ends_at)} · {appointment.staff_name}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!isClosed && <Button onClick={() => setEditingAppointment((value) => !value)} variant="secondary">{editingAppointment ? "Chiudi modifica" : "Modifica appuntamento"}</Button>}
            </div>
          </header>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_430px]">
            <main className="space-y-5 p-5 lg:p-7">
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Servizio", appointment.service_name],
                  ["Durata", `${minutesBetween(appointment.starts_at, appointment.ends_at)} min`],
                  ["Collaboratore", appointment.staff_name],
                  ["Stato", appointmentStatusLabel(appointment.status)],
                ].map(([label, value]) => (
                  <div className="rounded-xl border border-stone-200 bg-white p-4" key={label}>
                    <p className="text-[11px] font-black uppercase tracking-[.16em] text-stone-400">{label}</p>
                    <p className="mt-2 font-black text-stone-950">{value}</p>
                  </div>
                ))}
              </section>

              {editingAppointment && !isClosed && (
                <section className="rounded-xl border border-[#d9a7c2] bg-[#fff9fc] p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[.18em] text-[#792f59]">Modifica appuntamento</p>
                      <h2 className="mt-1 text-2xl font-black text-stone-950">Data, orario, durata e note</h2>
                      <p className="mt-1 text-sm text-stone-500">La durata vale solo per questo appuntamento e non modifica il servizio a catalogo.</p>
                    </div>
                    <span className="rounded-full bg-[#f3e2eb] px-3 py-1 text-xs font-black text-[#792f59]">{appointment.staff_name}</span>
                  </div>
                  <div className="mt-5 grid gap-4 md:grid-cols-[180px_150px_150px_1fr]">
                    <label className="text-xs font-bold text-stone-600">Data
                      <input className="mt-2 min-h-12 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold" onChange={(event) => setAppointmentDate(event.target.value)} type="date" value={appointmentDate} />
                    </label>
                    <label className="text-xs font-bold text-stone-600">Ora di inizio
                      <input className="mt-2 min-h-12 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold" onChange={(event) => setAppointmentTime(event.target.value)} step={300} type="time" value={appointmentTime} />
                    </label>
                    <label className="text-xs font-bold text-stone-600">Durata (minuti)
                      <input className="mt-2 min-h-12 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold" max={720} min={5} onChange={(event) => setAppointmentDuration(event.target.value)} step={5} type="number" value={appointmentDuration} />
                      {editedEndTime && <span className="mt-1.5 block text-[11px] font-semibold text-stone-500">Termina alle {editedEndTime}</span>}
                    </label>
                    <label className="text-xs font-bold text-stone-600">Note appuntamento
                      <input className="mt-2 min-h-12 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold" onChange={(event) => setAppointmentNotes(event.target.value)} value={appointmentNotes} />
                    </label>
                  </div>
                  <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <Button onClick={() => {
                      setAppointmentDate(dateInputValue(appointment.starts_at));
                      setAppointmentTime(timeInputValue(appointment.starts_at));
                      setAppointmentDuration(String(minutesBetween(appointment.starts_at, appointment.ends_at)));
                      setAppointmentNotes(appointment.notes ?? "");
                      setEditingAppointment(false);
                    }} variant="outline">Annulla modifiche</Button>
                    <Button disabled={savingAppointment} onClick={() => void saveAppointment()} variant="primary">{savingAppointment ? "Salvataggio…" : "Salva appuntamento"}</Button>
                  </div>
                </section>
              )}

              <section className="rounded-xl border border-stone-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Link className="grid size-12 shrink-0 place-items-center rounded-full bg-[#f3e2eb] font-black text-[#792f59]" href={`/clients/${data.appointment.customer_id}`}>{initials(appointment.customer_name)}</Link>
                    <div>
                    <p className="text-xs font-black uppercase tracking-[.18em] text-[#792f59]">Cliente</p>
                    <Link className="mt-1 block text-xl font-black text-stone-950 hover:text-[#792f59] hover:underline" href={`/clients/${data.appointment.customer_id}`}>{appointment.customer_name}</Link>
                    </div>
                  </div>
                  <Link href={`/clients/${data.appointment.customer_id}`} className="text-sm font-black text-[#792f59] hover:underline">Apri anagrafica</Link>
                </div>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div><span className="block font-bold text-stone-400">Telefono</span><span className="mt-1 block font-semibold">{appointment.customer_phone || "—"}</span></div>
                  <div><span className="block font-bold text-stone-400">Email</span><span className="mt-1 block break-all font-semibold">{appointment.customer_email || "—"}</span></div>
                  <div><span className="block font-bold text-stone-400">Note appuntamento</span><span className="mt-1 block font-semibold">{appointment.notes || "Nessuna nota"}</span></div>
                </div>
              </section>

              <section className="rounded-xl border border-stone-200 bg-white p-5">
                <div className="mb-5 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.18em] text-[#792f59]">Prestazioni e prodotti</p>
                    <h2 className="mt-1 text-2xl font-black text-stone-950">Composizione del conto</h2>
                  </div>
                  <div className="flex gap-2">{checkoutEnabled && customerPackages.some((pack) => pack.items.some((item) => item.remainingQuantity > 0)) && <Button onClick={() => applyPackages()} size="sm" variant="outline">Applica pacchetto</Button>}{checkoutEnabled && <Button onClick={() => setLines((current) => [...current, { description: "", discount_cents: 0, item_type: "custom", quantity: 1, unit_price_cents: 0 }])} size="sm" variant="outline">Riga libera</Button>}</div>
                </div>

                <div className="space-y-3">
                  {lines.map((line, index) => (
                    <div className="rounded-xl border border-stone-200 bg-[#fbfaf8] p-4" key={`${line.item_type}-${index}`}>
                      <div className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_90px_125px_125px_auto]"><label className="text-xs font-bold text-stone-500">Descrizione
                        <input className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold disabled:bg-stone-100" disabled={!checkoutEnabled} onChange={(event) => updateLine(index, { description: event.target.value })} value={line.description} />
                      </label>
                      <label className="text-xs font-bold text-stone-500">Quantità
                        <input className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold disabled:bg-stone-100" disabled={!checkoutEnabled} min={1} onChange={(event) => updateLine(index, { quantity: Math.max(1, Number(event.target.value)) })} type="number" value={line.quantity} />
                      </label>
                      <label className="text-xs font-bold text-stone-500">Prezzo
                        <input className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold disabled:bg-stone-100" disabled={!checkoutEnabled} min={0} onChange={(event) => updateLine(index, { unit_price_cents: inputCents(event.target.value) })} step=".01" type="number" value={(line.unit_price_cents / 100).toFixed(2)} />
                      </label>
                      <label className="text-xs font-bold text-stone-500">Sconto
                        <input className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold disabled:bg-stone-100" disabled={!checkoutEnabled} min={0} onChange={(event) => updateLine(index, { discount_cents: inputCents(event.target.value) })} step=".01" type="number" value={(line.discount_cents / 100).toFixed(2)} />
                      </label>
                      <div className="flex items-end">
                        {checkoutEnabled && <button className="min-h-11 px-2 text-sm font-black text-red-700" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} type="button">Rimuovi</button>}
                      </div></div>
                      {(line.package_quantity ?? 0) > 0 && <p className="mt-3 rounded-xl bg-violet-100 px-3 py-2 text-xs font-black text-violet-900">{line.package_quantity}× coperto da {line.package_name} · importo azzerato</p>}
                    </div>
                  ))}
                </div>

                {checkoutEnabled && (
                  <div className="mt-5 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-xl bg-[#f7eef3] p-4">
                      <label className="text-xs font-black uppercase tracking-[.14em] text-[#792f59]">Aggiungi servizio</label>
                      <select className="mt-2 min-h-11 w-full rounded-xl border border-[#e4c4d5] bg-white px-3 text-sm font-semibold" defaultValue="" onChange={(event) => {
                        const item = data.catalog.services.find((entry) => entry.id === event.target.value);
                        if (item) addCatalogItem(item, "service");
                        event.target.value = "";
                      }}>
                        <option value="">Seleziona dal listino</option>
                        {data.catalog.services.map((item) => <option key={item.id} value={item.id}>{item.name} · {euro(item.price_cents)}</option>)}
                      </select>
                    </div>
                    <div className="rounded-xl bg-[#eef7f5] p-4">
                      <label className="text-xs font-black uppercase tracking-[.14em] text-teal-800">Aggiungi prodotto</label>
                      <select className="mt-2 min-h-11 w-full rounded-xl border border-teal-200 bg-white px-3 text-sm font-semibold" defaultValue="" onChange={(event) => {
                        const item = data.catalog.products.find((entry) => entry.id === event.target.value);
                        if (item) addCatalogItem(item, "product");
                        event.target.value = "";
                      }}>
                        <option value="">Seleziona dal magazzino</option>
                        {data.catalog.products.map((item) => <option key={item.id} value={item.id}>{item.name} · {euro(item.price_cents)} · disp. {item.stock_quantity}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </section>
            </main>

            <aside className="border-t border-stone-200 bg-white p-5 lg:border-l lg:border-t-0 lg:p-7">
              <div className="sticky top-6">
                <p className="text-xs font-black uppercase tracking-[.18em] text-[#792f59]">Checkout</p>
                <h2 className="mt-1 text-3xl font-black text-stone-950">{isClosed ? "Riepilogo vendita" : "Chiudi il conto"}</h2>

                <div className="mt-6 space-y-3 border-y border-stone-200 py-5 text-sm">
                  <div className="flex justify-between"><span className="font-semibold text-stone-500">Subtotale</span><b>{euro(subtotalCents)}</b></div>
                  <label className="flex items-center justify-between gap-3 font-semibold text-stone-500">Sconto sul conto
                    <input className="w-28 rounded-xl border border-stone-200 px-3 py-2 text-right font-black text-stone-950 disabled:bg-stone-100" disabled={!checkoutEnabled} min={0} onChange={(event) => setDiscountCents(inputCents(event.target.value))} step=".01" type="number" value={(discountCents / 100).toFixed(2)} />
                  </label>
                  <div className="flex items-end justify-between pt-2"><span className="font-black text-stone-950">Totale</span><strong className="text-4xl font-black tracking-tight text-[#5f2447]">{euro(totalCents)}</strong></div>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-stone-950">Pagamenti</h3>
                    {checkoutEnabled && <button className="text-sm font-black text-[#792f59]" onClick={() => setPayments((current) => [...current, { amount_cents: 0, method: "cash" }])} type="button">Dividi pagamento</button>}
                  </div>
                  {checkoutEnabled && customerVouchers.length > 0 && <section className="mt-3 rounded-xl border border-teal-200 bg-teal-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-teal-800">Buoni disponibili</p><p className="mt-1 text-xs text-teal-950">Credito associato a {data.appointment.customer_name}</p></div>
                      <strong className="text-teal-950">{euro(customerVouchers.reduce((sum, voucher) => sum + voucher.balance_cents, 0))}</strong>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {customerVouchers.map((voucher) => <button className="rounded-xl border border-teal-300 bg-white px-3 py-2 text-left text-xs hover:bg-teal-100" key={voucher.id ?? voucher.code} onClick={() => applyVoucher(voucher)} type="button">
                        <strong className="block">Usa {euro(voucher.balance_cents)}</strong>
                        <span className="font-mono text-[10px] text-teal-700">•••• {voucher.code.slice(-4)}</span>
                      </button>)}
                    </div>
                  </section>}
                  <div className="mt-3 space-y-3">
                    {payments.map((payment, index) => (
                      <div className="rounded-xl border border-stone-200 p-3" key={index}>
                        <div className="grid grid-cols-[1fr_130px_auto] gap-2">
                          <select
                            className="min-h-11 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold disabled:bg-stone-100"
                            disabled={!checkoutEnabled}
                            onChange={(event) => setPayments((current) => current.map((entry, entryIndex) => entryIndex === index ? {
                              amount_cents: entry.amount_cents,
                              method: event.target.value as PaymentMethod,
                            } : entry))}
                            value={payment.method}
                          >
                            {paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                          </select>
                          <input className="min-h-11 rounded-xl border border-stone-200 px-3 text-right text-sm font-black disabled:bg-stone-100" disabled={!checkoutEnabled} min={0} onChange={(event) => setPayments((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, amount_cents: inputCents(event.target.value) } : entry))} step=".01" type="number" value={(payment.amount_cents / 100).toFixed(2)} />
                          {checkoutEnabled && payments.length > 1 && <button className="px-1 font-black text-red-700" onClick={() => setPayments((current) => current.filter((_, entryIndex) => entryIndex !== index))} type="button">×</button>}
                        </div>
                        {payment.method === "voucher" && <div className="mt-3">
                          {customerVouchers.length === 0 && <p className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-600">Il cliente non ha buoni attivi.</p>}
                          {customerVouchers.length > 0 && <div className="grid gap-2">
                            {customerVouchers.map((voucher) => <button className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-xs ${payment.voucher_code === voucher.code ? "border-teal-500 bg-teal-50" : "border-stone-200 bg-white hover:border-teal-300"}`} key={voucher.code} onClick={() => applyVoucher(voucher, index)} type="button">
                              <span><strong className="block">Buono •••• {voucher.code.slice(-4)}</strong><span className="text-stone-500">Disponibile {euro(voucher.balance_cents)}</span></span>
                              <span className="font-black text-teal-800">{payment.voucher_code === voucher.code ? "Selezionato" : "Usa"}</span>
                            </button>)}
                          </div>}
                        </div>}
                      </div>
                    ))}
                  </div>
                  <div className={`mt-3 flex justify-between rounded-xl px-3 py-2 text-sm font-bold ${paidCents === totalCents ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
                    <span>Registrato</span><span>{euro(paidCents)} / {euro(totalCents)}</span>
                  </div>
                </div>

                <label className="mt-5 block text-sm font-bold text-stone-600">Nota interna sul movimento
                  <textarea className="mt-2 min-h-24 w-full resize-none rounded-xl border border-stone-200 bg-white p-3 text-sm font-medium disabled:bg-stone-100" disabled={!checkoutEnabled} onChange={(event) => setNotes(event.target.value)} value={notes} />
                </label>

                {isClosed ? (
                  <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
                    Vendita registrata nella contabilità gestionale. Nessun documento fiscale viene emesso.
                  </div>
                ) : !checkoutEnabled ? (
                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                    La cassa è disabilitata. Imposta l’appuntamento come Confermato per registrare la vendita.
                  </div>
                ) : (
                  <Button className="mt-5 min-h-14 w-full text-base" disabled={saving || lines.length === 0 || paidCents !== totalCents || payments.some((payment) => payment.method === "voucher" && (!payment.voucher_code || payment.voucher_balance_cents === undefined || payment.amount_cents > payment.voucher_balance_cents))} onClick={() => void completeCheckout()} variant="primary">
                    {saving ? "Registrazione…" : `Incassa ${euro(totalCents)}`}
                  </Button>
                )}
                {checkoutEnabled && <p className="mt-3 text-center text-xs font-semibold leading-5 text-stone-400">La chiusura registra la vendita, scala gli eventuali prodotti e completa l’appuntamento.</p>}
                <button className="mt-6 w-full text-sm font-bold text-red-700" onClick={() => setConfirmDelete(true)} type="button">Elimina appuntamento</button>
              </div>
            </aside>
          </div>
        </div>
      )}
      <ConfirmDialog
        confirmLabel="Elimina"
        destructive
        description="L'appuntamento verrà rimosso dal calendario. Questa operazione non può essere annullata."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
        open={confirmDelete}
        title="Eliminare appuntamento?"
      />
    </div>
  );
}
