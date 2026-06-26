"use client";

import { useEffect, useMemo, useState } from "react";
import { Gift, Package, Plus, Scissors, ShoppingBag } from "lucide-react";
import { AppPage, Button, Dialog, EmptyState, FormField, InlineError, PageHeader, SaveToast, SectionCard, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";
import { ServiceCategoryIcon } from "../services/ServiceCategoryIcon";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";
type PaymentMethod = "cash" | "card" | "bank_transfer" | "voucher" | "other";
type CatalogType = "service" | "product" | "package";
type CartItemType = CatalogType | "custom";

interface CatalogItem { category?: string; category_icon?: string | null; category_id?: string | null; id: string; name: string; price_cents: number; stock_quantity?: number; }
interface Customer { email?: string | null; id: string; name: string; phone?: string | null; }
interface StaffItem { color: string; id: string; name: string; }
interface PosCatalog { packages?: CatalogItem[]; products: CatalogItem[]; services: CatalogItem[]; staff: StaffItem[]; }
interface CartLine { assigned_package_id?: string; customer_package_id?: string; description: string; discount_cents: number; id: string; issued_voucher_id?: string; item_type: CartItemType; package_item_id?: string; package_name?: string; package_quantity?: number; product_id?: string; quantity: number; service_id?: string; unit_price_cents: number; }
interface Payment { amount_cents: number; method: PaymentMethod; voucher_balance_cents?: number; voucher_code?: string; voucher_customer_name?: string; }
interface IssuedVoucherDraft { amount_cents: number; id: string; message?: string; recipient_customer_id: string; recipient_name: string; }
interface VoucherLookup { balance_cents: number; code: string; customer_id: string; customer_name: string; id: string; status: string; }
interface IssuedVoucherResult { balanceCents: number; code: string; customerId: string; id: string; originalAmountCents: number; }
interface CustomerPackage { expiresAt?: string | null; id: string; items: Array<{ itemType: CartItemType; name: string; packageItemId: string; productId?: string | null; remainingQuantity: number; serviceId?: string | null }>; name: string; }
interface AgendaAppointment { color?: string | null; customer_name: string; ends_at: string; id: string; service_name: string; staff_id: string; staff_name: string; starts_at: string; status: string; }
interface AppointmentCheckoutPreview {
  appointment: {
    customer_email?: string | null;
    customer_id: string;
    customer_name: string;
    customer_phone?: string | null;
    id: string;
    service_id: string;
    service_name: string;
    service_price_cents: number;
    staff_id: string;
    starts_at: string;
    status: string;
  };
  sale: unknown | null;
}
const paymentMethods: Array<{ label: string; value: PaymentMethod }> = [
  { label: "Contanti", value: "cash" },
  { label: "Carta", value: "card" },
  { label: "Voucher", value: "voucher" },
  { label: "Bonifico", value: "bank_transfer" },
  { label: "Altro", value: "other" },
];
const methodLabels: Record<PaymentMethod, string> = Object.fromEntries(paymentMethods.map((method) => [method.value, method.label])) as Record<PaymentMethod, string>;
function euro(cents: number) { return (cents / 100).toLocaleString("it-IT", { currency: "EUR", style: "currency" }); }
function cents(value: string) { const amount = Number(value.replace(",", ".")); return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0; }
function todayAgendaRange() {
  const from = new Date();
  const to = new Date();
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}
function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}
function readableTextColor(hex?: string | null) {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return "#ffffff";
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 > 150 ? "#2d1d27" : "#ffffff";
}

export default function SalesPage() {
  const { salon } = useAuth();
  const [catalog, setCatalog] = useState<PosCatalog>();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [catalogType, setCatalogType] = useState<CatalogType>("service");
  const [selectedServiceCategoryId, setSelectedServiceCategoryId] = useState("");
  const [query, setQuery] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer>();
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [voucherDialogOpen, setVoucherDialogOpen] = useState(false);
  const [voucherRecipientQuery, setVoucherRecipientQuery] = useState("");
  const [voucherRecipientResults, setVoucherRecipientResults] = useState<Customer[]>([]);
  const [voucherRecipient, setVoucherRecipient] = useState<Customer>();
  const [voucherAmount, setVoucherAmount] = useState("50.00");
  const [voucherMessage, setVoucherMessage] = useState("");
  const [issuedVouchers, setIssuedVouchers] = useState<IssuedVoucherDraft[]>([]);
  const [customerVouchers, setCustomerVouchers] = useState<VoucherLookup[]>([]);
  const [customerPackages, setCustomerPackages] = useState<CustomerPackage[]>([]);
  const [staffId, setStaffId] = useState("");
  const [discountCents, setDiscountCents] = useState(0);
  const [payments, setPayments] = useState<Payment[]>([{ amount_cents: 0, method: "cash" }]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [todayAppointments, setTodayAppointments] = useState<AgendaAppointment[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [agendaExpanded, setAgendaExpanded] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");

  async function loadCatalog() {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/pos-catalog`, { credentials: "include" });
    if (!response.ok) return setError("Catalogo cassa non disponibile.");
    setCatalog(await response.json() as PosCatalog);
  }
  async function loadTodayAppointments() {
    if (!salon) return;
    setAgendaLoading(true);
    const response = await fetch(`${api}/api/salons/${salon.id}/appointments?${new URLSearchParams(todayAgendaRange())}`, { credentials: "include" });
    if (!response.ok) {
      setTodayAppointments([]);
      setAgendaLoading(false);
      return;
    }
    const result = await response.json() as AgendaAppointment[] | { appointments?: AgendaAppointment[] };
    const appointments = Array.isArray(result) ? result : result.appointments ?? [];
    setTodayAppointments(appointments.filter((item) => !["cancelled", "completed"].includes(item.status)));
    setAgendaLoading(false);
  }
  async function loadAppointmentCheckout(appointmentId: string) {
    if (!salon) return;
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/appointments/${appointmentId}/checkout`, { credentials: "include" });
    if (!response.ok) {
      setError("Appuntamento non caricabile in cassa.");
      return;
    }
    const preview = await response.json() as AppointmentCheckoutPreview;
    const appointment = preview.appointment;
    if (appointment.status !== "confirmed") {
      setError("Puoi incassare solo appuntamenti confermati.");
      return;
    }
    setSelectedAppointmentId(appointment.id);
    setCustomerId(appointment.customer_id);
    setSelectedCustomer({
      email: appointment.customer_email,
      id: appointment.customer_id,
      name: appointment.customer_name,
      phone: appointment.customer_phone,
    });
    setStaffId(appointment.staff_id);
    setCart([{
      description: appointment.service_name,
      discount_cents: 0,
      id: appointment.service_id,
      item_type: "service",
      quantity: 1,
      service_id: appointment.service_id,
      unit_price_cents: appointment.service_price_cents,
    }]);
    setDiscountCents(0);
    setIssuedVouchers([]);
    setPayments([{ amount_cents: appointment.service_price_cents, method: "cash" }]);
    setNotes(`Da appuntamento agenda ${timeLabel(appointment.starts_at)}`);
    setAgendaExpanded(false);
    resetServiceCatalogStep();
  }
  useEffect(() => { void loadCatalog(); }, [salon?.id]);
  useEffect(() => { void loadTodayAppointments(); }, [salon?.id]);
  useEffect(() => {
    if (!salon || !customerDialogOpen) return;
    const search = customerQuery.trim();
    if (search.length < 2) {
      setCustomerResults([]);
      setCustomerLoading(false);
      return;
    }
    const timeout = window.setTimeout(() => {
      setCustomerLoading(true);
      const params = new URLSearchParams({ search });
      void fetch(`${api}/api/salons/${salon.id}/pos-customers?${params}`, { credentials: "include" })
        .then(async (response) => {
          if (!response.ok) throw new Error();
          const result = await response.json() as { items?: Customer[] };
          setCustomerResults(result.items ?? []);
        })
        .catch(() => setCustomerResults([]))
        .finally(() => setCustomerLoading(false));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [customerDialogOpen, customerQuery, salon?.id]);
  useEffect(() => {
    if (!salon || !voucherDialogOpen || voucherRecipient) return;
    const search = voucherRecipientQuery.trim();
    if (search.length < 2) return setVoucherRecipientResults([]);
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({ search });
      void fetch(`${api}/api/salons/${salon.id}/pos-customers?${params}`, { credentials: "include" })
        .then(async (response) => response.ok ? response.json() as Promise<{ items?: Customer[] }> : { items: [] })
        .then((result) => setVoucherRecipientResults(result.items ?? []));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [salon?.id, voucherDialogOpen, voucherRecipient, voucherRecipientQuery]);
  useEffect(() => {
    if (!salon || !customerId) {
      setCustomerVouchers([]);
      return;
    }
    const params = new URLSearchParams({ customer_id: customerId, status: "active" });
    void fetch(`${api}/api/salons/${salon.id}/vouchers?${params}`, { credentials: "include" })
      .then(async (response) => response.ok ? response.json() as Promise<VoucherLookup[]> : [])
      .then(setCustomerVouchers)
      .catch(() => setCustomerVouchers([]));
  }, [customerId, salon?.id]);
  useEffect(() => {
    if (!salon || !customerId) {
      setCustomerPackages([]);
      return;
    }
    void fetch(`${api}/api/salons/${salon.id}/customer-service-packages?${new URLSearchParams({ customer_id: customerId })}`, { credentials: "include" })
      .then(async (response) => response.ok ? response.json() as Promise<CustomerPackage[]> : [])
      .then((packages) => {
        setCustomerPackages(packages);
        if (packages.length) window.setTimeout(() => applyPackages(packages), 0);
      })
      .catch(() => setCustomerPackages([]));
  }, [customerId, salon?.id]);

  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + Math.max(0, (line.quantity - (line.package_quantity ?? 0)) * line.unit_price_cents - line.discount_cents), 0), [cart]);
  const total = Math.max(0, subtotal - discountCents);
  const paid = payments.reduce((sum, item) => sum + item.amount_cents, 0);
  useEffect(() => { if (payments.length === 1) setPayments((current) => [{ ...current[0]!, amount_cents: total }]); }, [total]);
  const serviceCategories = useMemo(() => {
    const categories = new Map<string, { count: number; icon?: string | null; id: string; name: string }>();
    for (const service of catalog?.services ?? []) {
      const id = service.category_id ?? service.category ?? "service";
      const current = categories.get(id);
      if (current) {
        current.count += 1;
      } else {
        categories.set(id, {
          count: 1,
          icon: service.category_icon,
          id,
          name: service.category ?? "Servizi",
        });
      }
    }
    return Array.from(categories.values()).sort((left, right) => left.name.localeCompare(right.name, "it"));
  }, [catalog?.services]);
  const visibleCatalog = (catalogType === "service" ? catalog?.services : catalogType === "product" ? catalog?.products : catalog?.packages)
    ?.filter((item) => catalogType !== "service" || item.category_id === selectedServiceCategoryId || (!item.category_id && item.category === selectedServiceCategoryId))
    .filter((item) => `${item.name} ${item.category ?? ""}`.toLowerCase().includes(query.toLowerCase())) ?? [];
  const appointmentsByStaff = useMemo(() => {
    const groups = new Map<string, { color?: string | null; items: AgendaAppointment[]; name: string; staffId: string }>();
    for (const appointment of todayAppointments) {
      const staffKey = appointment.staff_id || appointment.staff_name;
      const current = groups.get(staffKey);
      if (current) {
        current.items.push(appointment);
      } else {
        groups.set(staffKey, { color: appointment.color, items: [appointment], name: appointment.staff_name, staffId: staffKey });
      }
    }
    return Array.from(groups.values()).map((group) => ({
      ...group,
      items: group.items.sort((left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime()),
    }));
  }, [todayAppointments]);

  function selectCatalogType(type: CatalogType) {
    setCatalogType(type);
    setQuery("");
    if (type !== "service") setSelectedServiceCategoryId("");
  }

  function resetServiceCatalogStep() {
    setSelectedServiceCategoryId("");
    setQuery("");
  }

  function addItem(item: CatalogItem) {
    if (catalogType === "package") {
      if (!selectedCustomer) {
        setError("Seleziona il cliente a cui intestare il pacchetto.");
        return;
      }
      setCart((current) => [...current, {
        assigned_package_id: item.id,
        description: `Pacchetto · ${item.name}`,
        discount_cents: 0,
        id: crypto.randomUUID(),
        item_type: "custom",
        quantity: 1,
        unit_price_cents: item.price_cents,
      }]);
      return;
    }
    setCart((current) => {
      const found = current.find((line) => line.id === item.id && line.item_type === catalogType);
      const next = found ? current.map((line) => line === found ? { ...line, quantity: line.quantity + 1 } : line) : [...current, {
        description: item.name, discount_cents: 0, id: item.id, item_type: catalogType,
        product_id: catalogType === "product" ? item.id : undefined, quantity: 1,
        service_id: catalogType === "service" ? item.id : undefined, unit_price_cents: item.price_cents,
      }];
      if (catalogType === "service") resetServiceCatalogStep();
      window.setTimeout(() => applyPackages(), 0);
      return next;
    });
  }
  function updateLine(index: number, patch: Partial<CartLine>) { setCart((current) => current.map((line, i) => i === index ? { ...line, ...patch } : line)); }
  function addCustomItem() {
    setCart((current) => [...current, {
      description: "Voce libera",
      discount_cents: 0,
      id: crypto.randomUUID(),
      item_type: "custom",
      quantity: 1,
      unit_price_cents: 0,
    }]);
  }
  function applyPackages(packages = customerPackages) {
    const remaining = new Map<string, number>();
    packages.forEach((pack) => pack.items.forEach((item) => remaining.set(`${pack.id}:${item.packageItemId}`, item.remainingQuantity)));
    setCart((current) => current.map((line) => {
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
  function addVoucherToCart() {
    if (!voucherRecipient) return;
    const amountCents = cents(voucherAmount);
    if (amountCents <= 0) return;
    const id = crypto.randomUUID();
    setIssuedVouchers((current) => [...current, {
      amount_cents: amountCents,
      id,
      message: voucherMessage.trim() || undefined,
      recipient_customer_id: voucherRecipient.id,
      recipient_name: voucherRecipient.name,
    }]);
    setCart((current) => [...current, {
      description: `Buono acquisto · ${voucherRecipient.name}`,
      discount_cents: 0,
      id,
      issued_voucher_id: id,
      item_type: "custom",
      quantity: 1,
      unit_price_cents: amountCents,
    }]);
    setDiscountCents(0);
    setVoucherDialogOpen(false);
    setVoucherRecipient(undefined);
    setVoucherRecipientQuery("");
    setVoucherRecipientResults([]);
    setVoucherAmount("50.00");
    setVoucherMessage("");
  }
  function removeCartLine(index: number) {
    setCart((current) => {
      const removed = current[index];
      if (removed?.issued_voucher_id) {
        setIssuedVouchers((vouchers) => vouchers.filter((voucher) => voucher.id !== removed.issued_voucher_id));
      }
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }
  function chooseCustomer(customer: Customer) {
    setCustomerId(customer.id);
    setSelectedCustomer(customer);
    setCustomerDialogOpen(false);
    setCustomerQuery("");
    setCustomerResults([]);
  }
  function clearCustomer() {
    setCustomerId("");
    setSelectedCustomer(undefined);
    setCustomerVouchers([]);
    setCustomerPackages([]);
    setSelectedAppointmentId("");
    setCart((current) => current.filter((line) => !line.assigned_package_id));
    setPayments((current) => current.map((payment) => payment.method === "voucher"
      ? { amount_cents: payment.amount_cents, method: "cash" }
      : payment));
  }
  function resetRegister() { setCart([]); setIssuedVouchers([]); clearCustomer(); setStaffId(""); setDiscountCents(0); setPayments([{ amount_cents: 0, method: "cash" }]); setNotes(""); setSelectedAppointmentId(""); }

  function applyVoucher(voucher: VoucherLookup, paymentIndex?: number) {
    const voucherAmount = Math.min(total, voucher.balance_cents);
    const voucherPayment: Payment = {
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
    const remainder = total - voucherAmount;
    setPayments(remainder > 0 ? [voucherPayment, { amount_cents: remainder, method: "cash" }] : [voucherPayment]);
    setError("");
  }

  async function checkout() {
    if (!salon || !cart.length || paid !== total) return;
    setSaving(true); setError("");
    const checkoutUrl = selectedAppointmentId
      ? `${api}/api/salons/${salon.id}/appointments/${selectedAppointmentId}/checkout`
      : `${api}/api/salons/${salon.id}/pos-checkout`;
    const response = await fetch(checkoutUrl, {
      body: JSON.stringify({
        assigned_packages: cart.filter((line) => line.assigned_package_id).map((line) => ({ package_id: line.assigned_package_id })),
        customer_id: customerId || undefined,
        discount_cents: discountCents,
        issued_vouchers: issuedVouchers.map(({ amount_cents, message, recipient_customer_id }) => ({ amount_cents, message, recipient_customer_id })),
        items: cart,
        notes,
        payments: payments.map(({ amount_cents, method, voucher_code }) => ({ amount_cents, method, voucher_code })),
        staff_id: staffId || undefined,
      }),
      credentials: "include", headers: { "content-type": "application/json" }, method: "POST",
    });
    const body = await response.json().catch(() => ({})) as { error?: string; issued_vouchers?: IssuedVoucherResult[] };
    if (!response.ok) {
      const messages: Record<string, string> = {
        PAYMENT_TOTAL_MISMATCH: "I pagamenti non coincidono con il totale.",
        VOUCHER_CODE_REQUIRED: "Inserisci il codice del buono.",
        VOUCHER_CANNOT_BE_DISCOUNTED: "I buoni acquisto devono essere emessi al loro valore nominale. Rimuovi lo sconto sul conto.",
        VOUCHER_CUSTOMER_MISMATCH: "Il buono non appartiene al cliente selezionato.",
        VOUCHER_EXHAUSTED: "Il buono è già esaurito.",
        VOUCHER_INSUFFICIENT_BALANCE: "Il buono non ha saldo sufficiente per questo importo.",
        VOUCHER_NOT_FOUND: "Buono non trovato.",
        PACKAGE_CUSTOMER_REQUIRED: "Seleziona il cliente a cui intestare il pacchetto.",
        PACKAGE_NOT_FOUND: "Pacchetto non disponibile.",
        APPOINTMENT_NOT_CONFIRMED: "L'appuntamento deve essere confermato prima dell'incasso.",
      };
      setError(messages[body.error ?? ""] ?? "Vendita non registrata."); setSaving(false); return;
    }
    const codes = body.issued_vouchers?.map((voucher) => voucher.code.replace(/(\d{4})(?=\d)/g, "$1 ")).join(", ");
    resetRegister();
    await Promise.all([loadCatalog(), loadTodayAppointments()]);
    setMessage(codes ? `Vendita registrata. Buono emesso: ${codes}` : "Vendita registrata correttamente.");
    setSaving(false);
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <SaveToast visible={Boolean(message)}>{message}</SaveToast>
      <Dialog onClose={() => setCustomerDialogOpen(false)} open={customerDialogOpen} title="Rubrica clienti">
        <label className="block text-sm font-bold text-stone-700">Cerca cliente
          <input
            autoFocus
            className="mt-2 min-h-12 w-full rounded-xl border border-stone-200 px-4"
            onChange={(event) => setCustomerQuery(event.target.value)}
            placeholder="Nome, telefono o email"
            value={customerQuery}
          />
        </label>
        <p className="mt-2 text-xs text-stone-500">Scrivi almeno 2 caratteri. Vengono mostrati al massimo 20 risultati.</p>
        <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto">
          {customerLoading && <div className="rounded-xl bg-stone-50 p-5 text-center text-sm font-semibold text-stone-500">Ricerca in corso…</div>}
          {!customerLoading && customerQuery.trim().length >= 2 && customerResults.length === 0 && <EmptyState title="Nessun cliente trovato" description="Controlla il testo inserito oppure usa Cliente occasionale." />}
          {!customerLoading && customerResults.map((customer) => (
            <button className="flex w-full items-center gap-3 rounded-2xl border border-stone-200 p-3 text-left transition hover:border-[#c98cac] hover:bg-[#fff9fc]" key={customer.id} onClick={() => chooseCustomer(customer)} type="button">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f3e2eb] text-xs font-black text-[#792f59]">{customer.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate">{customer.name}</strong>
                <span className="mt-1 block truncate text-xs text-stone-500">{[customer.phone, customer.email].filter(Boolean).join(" · ") || "Nessun recapito"}</span>
              </span>
              <span className="text-sm font-bold text-[#792f59]">Seleziona</span>
            </button>
          ))}
        </div>
        <div className="mt-5 border-t border-stone-100 pt-4">
          <Button onClick={() => { clearCustomer(); setCustomerDialogOpen(false); }} variant="ghost">Continua come cliente occasionale</Button>
        </div>
      </Dialog>
      <Dialog onClose={() => setVoucherDialogOpen(false)} open={voucherDialogOpen} title="Emetti buono acquisto">
        <div className="grid gap-5">
          <FormField label="Valore del buono">
            <div className="relative">
              <input
                autoFocus
                className="min-h-12 w-full rounded-xl border border-stone-200 px-4 pr-12 text-lg font-black"
                min=".01"
                onChange={(event) => setVoucherAmount(event.target.value)}
                step=".01"
                type="number"
                value={voucherAmount}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-bold text-stone-400">€</span>
            </div>
          </FormField>
          <FormField label="Destinatario">
            {voucherRecipient ? (
              <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4">
                <span className="grid size-9 place-items-center rounded-full bg-white text-xs font-black text-emerald-800">
                  {voucherRecipient.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <strong className="block truncate">{voucherRecipient.name}</strong>
                  <span className="block truncate text-xs text-stone-500">{voucherRecipient.phone || voucherRecipient.email || "Cliente in rubrica"}</span>
                </div>
                <button className="text-sm font-black text-[#792f59]" onClick={() => setVoucherRecipient(undefined)} type="button">Cambia</button>
              </div>
            ) : (
              <>
                <input
                  className="min-h-12 w-full rounded-xl border border-stone-200 px-4"
                  onChange={(event) => setVoucherRecipientQuery(event.target.value)}
                  placeholder="Cerca per nome, telefono o email"
                  value={voucherRecipientQuery}
                />
                <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                  {voucherRecipientResults.map((customer) => (
                    <button
                      className="flex w-full items-center justify-between rounded-xl border border-stone-200 p-3 text-left hover:border-[#c98cac] hover:bg-[#fff9fc]"
                      key={customer.id}
                      onClick={() => { setVoucherRecipient(customer); setVoucherRecipientResults([]); }}
                      type="button"
                    >
                      <span><strong className="block">{customer.name}</strong><small className="text-stone-500">{customer.phone || customer.email || "Cliente in rubrica"}</small></span>
                      <span className="text-sm font-black text-[#792f59]">Seleziona</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </FormField>
          <FormField label="Messaggio sul regalo">
            <textarea
              className="min-h-24 w-full rounded-xl border border-stone-200 p-4"
              onChange={(event) => setVoucherMessage(event.target.value)}
              placeholder="Facoltativo"
              value={voucherMessage}
            />
          </FormField>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
            Il buono viene generato alla chiusura della vendita, è personale, non ricaricabile e utilizzabile anche in più pagamenti.
          </div>
          <Button disabled={!voucherRecipient || cents(voucherAmount) <= 0} onClick={addVoucherToCart} variant="primary">
            Aggiungi al conto
          </Button>
        </div>
      </Dialog>
      <PageHeader eyebrow="Punto vendita" title="Cassa" subtitle="Vendite da appuntamento, servizi liberi, prodotti e pagamenti in un unico flusso." status={<StatusBadge status="active">Operativa</StatusBadge>} />
      {error && <InlineError className="mb-5">{error}</InlineError>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_520px]">
        <div className="space-y-5">
        <SectionCard>
          <button
            className="flex w-full items-center justify-between gap-4 text-left"
            onClick={() => setAgendaExpanded((value) => !value)}
            type="button"
          >
            <span>
              <span className="block text-xs font-black uppercase tracking-[.16em] text-[#792f59]">Agenda di oggi</span>
              <strong className="mt-1 block text-xl">Appuntamenti da completare</strong>
              <span className="mt-1 block text-sm text-stone-500">{todayAppointments.length} appuntamenti richiamabili in cassa</span>
            </span>
            <span className="rounded-full border border-stone-200 px-3 py-1 text-sm font-black text-[#792f59]">{agendaExpanded ? "Chiudi" : "Apri"}</span>
          </button>
          {agendaExpanded && (
            <div className="mt-5">
              {agendaLoading ? (
                <div className="rounded-2xl bg-stone-50 p-5 text-sm font-bold text-stone-500">Caricamento agenda…</div>
              ) : appointmentsByStaff.length ? (
                <div className="overflow-x-auto pb-2">
                <div className="flex min-w-max gap-3">
                  {appointmentsByStaff.map((group) => (
                    <section className="min-w-[210px] max-w-[210px] rounded-xl border border-stone-200 bg-[#fbfaf8] p-2" key={group.staffId}>
                      <div className="mb-2 flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: group.color ?? "#792f59" }} />
                        <strong className="truncate text-xs">{group.name}</strong>
                        <span className="ml-auto rounded-full bg-white px-1.5 py-0.5 text-[9px] font-black text-stone-500">{group.items.length}</span>
                      </div>
                      <div className="space-y-1.5">
                        {group.items.map((appointment) => {
                          const disabled = appointment.status !== "confirmed";
                          const selected = selectedAppointmentId === appointment.id;
                          const background = appointment.color ?? "#792f59";
                          const foreground = readableTextColor(background);
                          return (
                            <button
                              className={`min-h-[74px] w-full rounded-lg border px-2.5 py-2 text-left shadow-sm transition ${selected ? "ring-2 ring-[#2d1d27]" : "hover:-translate-y-0.5 hover:shadow-md"} ${disabled ? "cursor-not-allowed opacity-55 hover:translate-y-0 hover:shadow-sm" : ""}`}
                              disabled={disabled}
                              key={appointment.id}
                              onClick={() => void loadAppointmentCheckout(appointment.id)}
                              style={{ backgroundColor: background, borderColor: background, color: foreground }}
                              title={disabled ? "Conferma l'appuntamento prima di incassare" : "Carica appuntamento in cassa"}
                              type="button"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-[11px] font-black">{timeLabel(appointment.starts_at)}</span>
                                <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[8px] font-black uppercase">{appointment.status}</span>
                              </div>
                              <strong className="mt-1.5 block truncate text-sm leading-4">{appointment.customer_name}</strong>
                              <span className="mt-0.5 block truncate text-[11px] leading-4 opacity-90">{appointment.service_name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
                </div>
              ) : (
                <EmptyState title="Nessun appuntamento da incassare" description="Gli appuntamenti di oggi non completati appariranno qui." />
              )}
            </div>
          )}
        </SectionCard>
        <SectionCard title="Catalogo" subtitle="Seleziona servizi o prodotti da aggiungere al conto.">
          <div className="mb-4 flex flex-wrap gap-2">
            <Button onClick={() => selectCatalogType("service")} variant={catalogType === "service" ? "primary" : "outline"}><Scissors className="size-4" /> Servizi</Button>
            <Button onClick={() => selectCatalogType("product")} variant={catalogType === "product" ? "primary" : "outline"}><ShoppingBag className="size-4" /> Prodotti</Button>
            <Button onClick={() => selectCatalogType("package")} variant={catalogType === "package" ? "primary" : "outline"}><Package className="size-4" /> Pacchetti</Button>
            <Button onClick={addCustomItem} variant="outline"><Plus className="size-4" /> Riga libera</Button>
            <Button onClick={() => setVoucherDialogOpen(true)} variant="outline"><Gift className="size-4" /> Buono regalo</Button>
            {(catalogType !== "service" || selectedServiceCategoryId) && <input className="min-h-11 min-w-64 flex-1 rounded-xl border border-stone-200 px-4" onChange={(event) => setQuery(event.target.value)} placeholder="Cerca nel catalogo" value={query} />}
          </div>
          {catalogType === "service" && !selectedServiceCategoryId ? (
            <div>
              <p className="mb-3 text-sm font-bold text-stone-900">Scegli una categoria</p>
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {serviceCategories.map((category) => (
                  <button
                    className="flex min-h-20 items-center gap-3 rounded-2xl border border-stone-200 bg-[#fbfaf8] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#b85888] hover:shadow-md"
                    key={category.id}
                    onClick={() => setSelectedServiceCategoryId(category.id)}
                    type="button"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f4e4ec] text-[#792f59]">
                      <ServiceCategoryIcon className="size-5" name={category.icon} />
                    </span>
                    <span>
                      <strong className="block">{category.name}</strong>
                      <small className="text-stone-500">{category.count} servizi</small>
                    </span>
                  </button>
                ))}
                {!serviceCategories.length && <EmptyState title="Nessuna categoria" description="Il catalogo non contiene servizi vendibili." />}
              </div>
            </div>
          ) : (
            <div>
              {catalogType === "service" && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#faf3f7] px-4 py-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.14em] text-[#792f59]">Categoria</p>
                    <strong>{serviceCategories.find((category) => category.id === selectedServiceCategoryId)?.name ?? "Servizi"}</strong>
                  </div>
                  <Button onClick={() => { setSelectedServiceCategoryId(""); setQuery(""); }} size="sm" variant="outline">Cambia categoria</Button>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {visibleCatalog.map((item) => <button className="rounded-2xl border border-stone-200 bg-[#fbfaf8] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#b85888] hover:shadow-md" key={item.id} onClick={() => addItem(item)} type="button">
                  <div className="flex items-start justify-between gap-3"><strong>{item.name}</strong><span className="font-black text-[#792f59]">{euro(item.price_cents)}</span></div>
                  <p className={`mt-2 text-xs ${catalogType === "product" && (item.stock_quantity ?? 0) <= 0 ? "font-bold text-amber-700" : "text-stone-500"}`}>{catalogType === "service" ? item.category || "Servizio" : catalogType === "package" ? "Assegnazione immediata al cliente" : `Disponibilità: ${item.stock_quantity ?? 0}${(item.stock_quantity ?? 0) <= 0 ? " · vendita consentita" : ""}`}</p>
                </button>)}
                {!visibleCatalog.length && <EmptyState title="Nessun elemento" description="Il catalogo non contiene risultati per questa ricerca." />}
              </div>
            </div>
          )}
        </SectionCard>
        </div>

        <aside className="self-start rounded-2xl border border-[#e8dfe4] bg-white p-5 shadow-[0_10px_30px_rgb(45_29_39_/_0.055)] xl:sticky xl:top-24">
          <div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#792f59]">Conto corrente</p><h2 className="mt-1 text-2xl font-black">Nuova vendita</h2></div><Button onClick={resetRegister} size="sm" variant="ghost">Azzera</Button></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <FormField label="Cliente">
              <div className="flex min-h-12 items-center gap-2 rounded-xl border border-stone-200 bg-white p-1.5">
                <div className="min-w-0 flex-1 px-2">
                  <strong className="block truncate text-sm">{selectedCustomer?.name ?? "Cliente occasionale"}</strong>
                  {selectedCustomer && <span className="block truncate text-[11px] text-stone-500">{selectedCustomer.phone || selectedCustomer.email || "Cliente in rubrica"}</span>}
                </div>
                {selectedCustomer && <button aria-label="Rimuovi cliente" className="rounded-lg px-2 py-2 text-xs font-bold text-stone-500 hover:bg-stone-100" onClick={clearCustomer} type="button">Rimuovi</button>}
                <button
                  aria-label="Apri rubrica clienti"
                  className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#d7a6c1] text-[#792f59] transition hover:bg-[#f8eaf1]"
                  onClick={() => setCustomerDialogOpen(true)}
                  title="Apri rubrica clienti"
                  type="button"
                >
                  <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="M5 4.5h13a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H5z" />
                    <path d="M5 7H3.5M5 12H3.5M5 17H3.5" />
                    <circle cx="12" cy="10" r="2.3" />
                    <path d="M8.5 16a3.5 3.5 0 0 1 7 0" />
                  </svg>
                </button>
              </div>
            </FormField>
            <FormField label="Operatore"><select className="w-full" onChange={(event) => setStaffId(event.target.value)} value={staffId}><option value="">Non assegnato</option>{catalog?.staff.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></FormField>
          </div>
          {selectedCustomer && customerVouchers.length > 0 && <section className="mt-4 rounded-2xl border border-teal-200 bg-teal-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-[.14em] text-teal-800">Credito disponibile</p><p className="mt-1 text-sm text-teal-950">{selectedCustomer.name} ha {customerVouchers.length === 1 ? "un buono attivo" : `${customerVouchers.length} buoni attivi`}.</p></div>
              <strong className="text-xl text-teal-950">{euro(customerVouchers.reduce((sum, voucher) => sum + voucher.balance_cents, 0))}</strong>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {customerVouchers.map((voucher) => <button className="rounded-xl border border-teal-300 bg-white px-3 py-2 text-left text-xs transition hover:bg-teal-100" key={voucher.id} onClick={() => applyVoucher(voucher)} type="button">
                <span className="block font-black text-teal-950">Usa {euro(voucher.balance_cents)}</span>
                <span className="font-mono text-[10px] text-teal-700">•••• {voucher.code.slice(-4)}</span>
              </button>)}
            </div>
          </section>}
          {selectedCustomer && customerPackages.some((pack) => pack.items.some((item) => item.remainingQuantity > 0)) && <section className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.14em] text-violet-800">Pacchetti attivi</p><p className="mt-1 text-sm text-violet-950">La cassa può coprire automaticamente servizi e prodotti ancora disponibili.</p></div><Button onClick={() => applyPackages()} size="sm" variant="outline">Applica pacchetto</Button></div>
            <div className="mt-3 flex flex-wrap gap-2">{customerPackages.map((pack) => <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-violet-900" key={pack.id}>{pack.name}</span>)}</div>
          </section>}
          <div className="mt-5 space-y-3">
            {!cart.length && <EmptyState title="Carrello vuoto" description="Aggiungi un servizio o un prodotto dal catalogo." />}
            {cart.map((line, index) => <article className="rounded-2xl border border-stone-200 bg-[#fbfaf8] p-3" key={`${line.item_type}-${line.id}`}>
              <div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1">
                {line.issued_voucher_id
                  ? <strong>{line.description}</strong>
                  : line.item_type === "custom"
                  ? <input aria-label="Descrizione riga libera" className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 font-bold" onChange={(event) => updateLine(index, { description: event.target.value })} value={line.description} />
                  : <strong>{line.description}</strong>}
                <p className="mt-1 text-xs uppercase text-stone-400">{line.issued_voucher_id ? "Buono regalo" : line.assigned_package_id ? "Pacchetto cliente" : line.item_type === "service" ? "Servizio" : line.item_type === "product" ? "Prodotto" : "Voce libera"}</p>
                {(line.package_quantity ?? 0) > 0 && <p className="mt-2 rounded-lg bg-violet-100 px-2 py-1 text-xs font-black text-violet-900">{line.package_quantity}× coperto da {line.package_name} · {euro(line.package_quantity! * line.unit_price_cents)} azzerati</p>}
              </div><button className="text-sm font-bold text-red-700" onClick={() => removeCartLine(index)}>Rimuovi</button></div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <label className="text-[10px] font-bold text-stone-500">Quantità<input className="mt-1 w-full rounded-lg border p-2 disabled:bg-stone-100" disabled={Boolean(line.issued_voucher_id || line.assigned_package_id)} min={1} onChange={(event) => updateLine(index, { quantity: Math.max(1, Number(event.target.value)) })} type="number" value={line.quantity} /></label>
                <label className="text-[10px] font-bold text-stone-500">Prezzo<input className="mt-1 w-full rounded-lg border p-2 disabled:bg-stone-100" disabled={Boolean(line.issued_voucher_id || line.assigned_package_id)} min={0} onChange={(event) => updateLine(index, { unit_price_cents: cents(event.target.value) })} step=".01" type="number" value={(line.unit_price_cents / 100).toFixed(2)} /></label>
                <label className="text-[10px] font-bold text-stone-500">Sconto<input className="mt-1 w-full rounded-lg border p-2 disabled:bg-stone-100" disabled={Boolean(line.issued_voucher_id || line.assigned_package_id)} min={0} onChange={(event) => updateLine(index, { discount_cents: cents(event.target.value) })} step=".01" type="number" value={(line.discount_cents / 100).toFixed(2)} /></label>
              </div>
            </article>)}
          </div>
          <div className="mt-5 border-y border-stone-200 py-4">
            <div className="flex justify-between text-sm"><span>Subtotale</span><b>{euro(subtotal)}</b></div>
            <label className="mt-3 flex items-center justify-between text-sm">Sconto conto<input className="w-28 rounded-xl border p-2 text-right font-bold disabled:bg-stone-100" disabled={issuedVouchers.length > 0} min={0} onChange={(event) => setDiscountCents(cents(event.target.value))} step=".01" type="number" value={(discountCents / 100).toFixed(2)} /></label>
            <div className="mt-4 flex items-end justify-between"><strong>Totale</strong><b className="text-4xl text-[#5f2447]">{euro(total)}</b></div>
          </div>
          <div className="mt-5">
            <div className="flex justify-between"><strong>Pagamenti</strong><button className="text-sm font-bold text-[#792f59]" onClick={() => setPayments((current) => [...current, { amount_cents: 0, method: "cash" }])}>Dividi</button></div>
            <div className="mt-3 space-y-3">{payments.map((payment, index) => <div className="rounded-2xl border border-stone-200 p-3" key={index}>
              <div className="grid grid-cols-[1fr_130px_auto] gap-2">
                <select
                  className="rounded-xl border px-3"
                  onChange={(event) => setPayments((current) => current.map((item, i) => i === index ? {
                    amount_cents: item.amount_cents,
                    method: event.target.value as PaymentMethod,
                  } : item))}
                  value={payment.method}
                >
                  {paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                </select>
                <input className="rounded-xl border p-2 text-right font-bold" onChange={(event) => setPayments((current) => current.map((item, i) => i === index ? { ...item, amount_cents: cents(event.target.value) } : item))} step=".01" type="number" value={(payment.amount_cents / 100).toFixed(2)} />
                {payments.length > 1 && <button aria-label="Rimuovi pagamento" className="px-2 font-black text-red-700" onClick={() => setPayments((current) => current.filter((_, i) => i !== index))}>×</button>}
              </div>
              {payment.method === "voucher" && <div className="mt-3">
                {!selectedCustomer && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">Seleziona prima il cliente intestatario.</p>}
                {selectedCustomer && customerVouchers.length === 0 && <p className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-600">Il cliente non ha buoni attivi.</p>}
                {customerVouchers.length > 0 && <div className="grid gap-2">
                  {customerVouchers.map((voucher) => <button className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-xs ${payment.voucher_code === voucher.code ? "border-teal-500 bg-teal-50" : "border-stone-200 bg-white hover:border-teal-300"}`} key={voucher.id} onClick={() => applyVoucher(voucher, index)} type="button">
                    <span><strong className="block">Buono •••• {voucher.code.slice(-4)}</strong><span className="text-stone-500">Disponibile {euro(voucher.balance_cents)}</span></span>
                    <span className="font-black text-teal-800">{payment.voucher_code === voucher.code ? "Selezionato" : "Usa"}</span>
                  </button>)}
                </div>}
              </div>}
            </div>)}</div>
            <div className={`mt-3 rounded-xl px-3 py-2 text-sm font-bold ${paid === total ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>Registrato: {euro(paid)} / {euro(total)}</div>
          </div>
          <FormField className="mt-5" label="Nota interna"><textarea className="min-h-20 w-full" onChange={(event) => setNotes(event.target.value)} value={notes} /></FormField>
          <Button
            className="mt-5 min-h-14 w-full text-base"
            disabled={saving || !cart.length || paid !== total || cart.some((line) => !line.description.trim()) || payments.some((payment) => payment.method === "voucher" && (!payment.voucher_code || payment.voucher_balance_cents === undefined || payment.amount_cents > payment.voucher_balance_cents))}
            onClick={() => void checkout()}
            variant="primary"
          >
            {saving ? "Registrazione…" : `Incassa ${euro(total)}`}
          </Button>
        </aside>
      </div>
    </AppPage>
  );
}
