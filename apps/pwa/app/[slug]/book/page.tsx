"use client";

import Link from "next/link";
import { Check, Shuffle, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { formatPrice, type WorkingHours } from "@esse-beauty/shared";

import { apiBaseUrl } from "../../../lib/api";
import { isDateClosed, type SalonClosure } from "../../../lib/salon-closures";
import { DateField } from "../../_components/DateField";
import { ServiceCategoryIcon } from "../../_components/ServiceCategoryIcon";
import { CompleteRegistrationCard } from "../_components/CompleteRegistrationCard";
import { useCustomerAuth } from "../_components/CustomerAuthProvider";

interface Branding {
  accentColor?: string;
  bookingSuccessText?: string;
  heroTitle?: string;
  primaryColor?: string;
}
interface Service {
  category?: string;
  categoryIcon?: string | null;
  categoryId?: string | null;
  durationMinutes: number;
  id: string;
  name: string;
  priceCents: number;
}
interface Category {
  icon: string;
  id: string;
  name: string;
}
interface Member {
  displayName: string;
  id: string;
  serviceIds?: string[];
}
interface Slot {
  available: boolean;
  starts_at: string;
}
interface Profile {
  branding?: Branding | null;
  capabilities?: { waitlist?: boolean };
  categories: Category[];
  closures?: SalonClosure[];
  opening_hours?: WorkingHours;
  pwa?: {
    allowStaffPreference?: boolean;
    bookingDefaultStatus?: "confirmed" | "pending";
    maxAdvanceDays?: number;
    requireEmail?: boolean;
    requirePhone?: boolean;
  };
  salon: { name: string };
  services: Service[];
  staff: Member[];
}
interface Booking {
  endsAt: string;
  id: string;
  salon_name: string;
  service_name: string;
  staff_name: string;
  startsAt: string;
  status?: string;
}

function ics(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(".000", "");
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || value;
}

function formatDateSummary(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "long", weekday: "long" });
}

function formatTimeSummary(value: string) {
  return new Date(value).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function isoDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA").format(value);
}

const QUICK_DAY_COUNT = 8;

function fullName(data: FormData) {
  return [data.get("first_name"), data.get("last_name")]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function saveCalendar(item: Booking) {
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Esse Beauty//IT",
    "BEGIN:VEVENT",
    `UID:${item.id}@essebeauty`,
    `DTSTAMP:${ics(new Date().toISOString())}`,
    `DTSTART:${ics(item.startsAt)}`,
    `DTEND:${ics(item.endsAt)}`,
    `SUMMARY:${item.service_name} - ${item.salon_name}`,
    `DESCRIPTION:Con ${firstName(item.staff_name)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "appuntamento.ics";
  link.click();
  URL.revokeObjectURL(url);
}

const stepVariants = {
  center: { opacity: 1, x: 0 },
  enter: (direction: number) => ({ opacity: 0, x: direction >= 0 ? 24 : -24 }),
  exit: (direction: number) => ({ opacity: 0, x: direction >= 0 ? -24 : 24 }),
};

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const { customer, status: customerAuthStatus } = useCustomerAuth();
  const continueRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<Profile>();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [serviceIds, setServiceIds] = useState<string[]>(() => {
    const preselected = searchParams.get("serviceId");
    return preselected ? [preselected] : [];
  });
  const [staffByService, setStaffByService] = useState<Record<string, string>>(() => {
    const serviceId = searchParams.get("serviceId");
    const staffId = searchParams.get("staffId");
    return serviceId && staffId ? { [serviceId]: staffId } : {};
  });
  const [primaryStaffId, setPrimaryStaffId] = useState(searchParams.get("staffId") ?? "");
  const [date, setDate] = useState(() => searchParams.get("date") ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [dayClosed, setDayClosed] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [booking, setBooking] = useState<Booking>();
  const [bookedCustomer, setBookedCustomer] = useState<{ email?: string; first_name: string; last_name: string; phone: string }>();
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [waitlistMode, setWaitlistMode] = useState(false);
  const [waitlistSent, setWaitlistSent] = useState(false);
  const [timePreference, setTimePreference] = useState("any");
  const [submittingWaitlist, setSubmittingWaitlist] = useState(false);
  const reduceMotion = useReducedMotion();
  const prevStepRef = useRef(step);
  const [stepDirection, setStepDirection] = useState(0);

  useEffect(() => {
    setStepDirection(step > prevStepRef.current ? 1 : step < prevStepRef.current ? -1 : 0);
    prevStepRef.current = step;
  }, [step]);

  useEffect(() => {
    void fetch(`${apiBaseUrl()}/api/public/${slug}`).then(async (response) => {
      if (response.status === 503) {
        setUnavailable(true);
        return;
      }
      if (!response.ok) {
        setError("Salone non trovato.");
        return;
      }
      setProfile(await response.json());
    });
  }, [slug]);

  const selectedServices = useMemo(
    () => serviceIds.map((id) => profile?.services.find((service) => service.id === id)).filter((service): service is Service => Boolean(service)),
    [profile, serviceIds],
  );
  const categories = useMemo(
    () => profile?.categories.filter((item) => profile.services.some((service) => service.category === item.name)) ?? [],
    [profile],
  );
  const filteredServices = useMemo(
    () => profile?.services.filter((service) => service.category === category) ?? [],
    [category, profile],
  );
  const staffPreferences = serviceIds.map((serviceId) => staffByService[serviceId] ?? "");
  const primaryStaff = profile?.staff.find((member) => member.id === primaryStaffId);
  const primaryStaffChoices = profile?.staff.filter((member) => selectedServices.some((service) => !member.serviceIds?.length || member.serviceIds.includes(service.id))) ?? [];
  const incompatibleServices = primaryStaff
    ? selectedServices.filter((service) => primaryStaff.serviceIds?.length && !primaryStaff.serviceIds.includes(service.id))
    : [];
  const quickDays = useMemo(() => Array.from({ length: QUICK_DAY_COUNT }, (_, index) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + index);
    return day;
  }), []);

  useEffect(() => {
    if (!profile) return;
    setStaffByService((current) => Object.fromEntries(Object.entries(current).filter(([serviceId, staffId]) =>
      profile.staff.some((member) => member.id === staffId && (!member.serviceIds?.length || member.serviceIds.includes(serviceId))),
    )));
  }, [profile, serviceIds]);
  const brand = profile?.branding;
  const primary = brand?.primaryColor || "#15140f";
  const accent = brand?.accentColor || "#0e7c59";

  useEffect(() => {
    if (step !== 3 || !serviceIds.length) return;
    let cancelled = false;
    setLoadingSlots(true);
    setError("");
    const query = new URLSearchParams({ date, serviceIds: serviceIds.join(",") });
    if (staffPreferences.some(Boolean)) query.set("staffIds", staffPreferences.join(","));
    void fetch(`${apiBaseUrl()}/api/public/${slug}/slots?${query}`).then(async (response) => {
      if (cancelled) return;
      setLoadingSlots(false);
      if (response.status === 503) {
        setUnavailable(true);
        return;
      }
      if (!response.ok) {
        setError("Impossibile caricare gli orari disponibili.");
        return;
      }
      const result = await response.json() as { closed?: boolean; slots?: Slot[] };
      setSlots(result.slots ?? []);
      setDayClosed(Boolean(result.closed));
      setStartsAt("");
    });
    return () => {
      cancelled = true;
    };
  }, [date, serviceIds, slug, staffPreferences.join(","), step]);

  function pickSlot(startsAtValue: string) {
    setStartsAt(startsAtValue);
    requestAnimationFrame(() => continueRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
  }

  function toggleService(serviceId: string) {
    setServiceIds((current) => current.includes(serviceId)
      ? current.filter((id) => id !== serviceId)
      : [...current, serviceId]);
    setStartsAt("");
    setPrimaryStaffId("");
    setStaffByService({});
  }

  function qualifiedStaffFor(serviceId: string) {
    return profile?.staff.filter((member) => !member.serviceIds?.length || member.serviceIds.includes(serviceId)) ?? [];
  }

  function choosePrimaryStaff(staffId: string) {
    setPrimaryStaffId(staffId);
    if (!staffId) {
      setStaffByService({});
      return;
    }
    const member = profile?.staff.find((item) => item.id === staffId);
    setStaffByService(Object.fromEntries(selectedServices
      .filter((service) => !member?.serviceIds?.length || member.serviceIds.includes(service.id))
      .map((service) => [service.id, staffId])));
  }

  async function performBooking(payload: { email?: string; first_name: string; last_name: string; phone?: string }) {
    setError("");
    const response = await fetch(`${apiBaseUrl()}/api/public/${slug}/book`, {
      body: JSON.stringify({
        customer: {
          email: payload.email || undefined,
          first_name: payload.first_name,
          full_name: [payload.first_name, payload.last_name].filter(Boolean).join(" "),
          last_name: payload.last_name,
          phone: payload.phone || undefined,
        },
        service_ids: serviceIds,
        staff_ids: staffPreferences.map((staffId) => staffId || null),
        starts_at: startsAt,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (response.ok) {
      setBooking(await response.json());
      if (payload.phone) {
        setBookedCustomer({ email: payload.email || undefined, first_name: payload.first_name, last_name: payload.last_name, phone: payload.phone });
        if (customerAuthStatus !== "authenticated") setShowRegisterPrompt(true);
      }
      return;
    }
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.status === 503) setUnavailable(true);
    else if (response.status === 403 && result.error === "CUSTOMER_BLOCKED") setError("Non è possibile prenotare online con questi dati. Contatta il salone.");
    else setError("Prenotazione non riuscita. Verifica i dati e riprova.");
  }

  async function submit(data: FormData) {
    await performBooking({
      email: String(data.get("email") ?? "").trim(),
      first_name: String(data.get("first_name") ?? "").trim(),
      last_name: String(data.get("last_name") ?? "").trim(),
      phone: String(data.get("phone") ?? "").trim(),
    });
  }

  async function submitAuthenticated() {
    if (!customer) return;
    await performBooking({
      email: customer.email ?? undefined,
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone: customer.phone ?? undefined,
    });
  }

  async function submitWaitlist(data: FormData) {
    setSubmittingWaitlist(true);
    setError("");
    const response = await fetch(`${apiBaseUrl()}/api/public/${slug}/waitlist`, {
      body: JSON.stringify({
        customer: customerAuthStatus === "authenticated" && customer
          ? { email: customer.email, first_name: customer.first_name, full_name: customer.full_name, last_name: customer.last_name, phone: customer.phone }
          : { email: data.get("email"), first_name: data.get("first_name"), full_name: fullName(data), last_name: data.get("last_name"), phone: data.get("phone") },
        requested_date: date,
        service_id: serviceIds[0],
        staff_id: staffPreferences[0] || undefined,
        time_preference: timePreference,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    setSubmittingWaitlist(false);
    if (response.ok) return setWaitlistSent(true);
    const result = await response.json().catch(() => ({})) as { error?: string };
    setError(result.error === "WAITLIST_DUPLICATE" ? "Hai già una richiesta attiva per questo giorno." : "Non è stato possibile inviare la richiesta. Verifica i dati e riprova.");
  }

  if (unavailable) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#faf8f4] p-5">
        <section className="max-w-md rounded-3xl border border-stone-200 bg-white p-8 text-center">
          <h1 className="text-3xl font-bold">Prenotazioni non disponibili</h1>
          <p className="mt-3 text-stone-600">Il salone ha sospeso temporaneamente le prenotazioni online.</p>
        </section>
      </main>
    );
  }

  if (booking) {
    return (
      <main className="min-h-screen bg-[#faf8f4] px-4 py-8">
        <section className="animate-slide-up mx-auto max-w-md rounded-3xl border border-stone-200 bg-white p-7 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-3xl text-2xl font-black text-white" style={{ background: primary }}>✓</span>
          <h1 className="mt-5 text-3xl font-bold">{booking.status === "confirmed" ? "Prenotazione confermata" : "Richiesta inviata"}</h1>
          <p className="mt-2 text-sm text-stone-500">
            {booking.status === "confirmed"
              ? (brand?.bookingSuccessText || "Il tuo appuntamento è confermato.")
              : "Il salone deve ancora confermare la richiesta: riceverai un avviso appena verrà accettata."}
          </p>
          <p className="mt-3 text-stone-600">{booking.service_name} con {firstName(booking.staff_name)}</p>
          <p className="mt-1 text-sm font-bold text-stone-950">{new Date(booking.startsAt).toLocaleString("it-IT", { dateStyle: "full", timeStyle: "short" })}</p>
          <button onClick={() => saveCalendar(booking)} className="mt-7 min-h-12 w-full rounded-full font-black text-white" style={{ background: primary }}>Aggiungi al calendario</button>
          <Link className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-stone-100 font-black text-stone-700" href={`/${slug}`}>Torna alla home</Link>
        </section>
        {bookedCustomer && showRegisterPrompt && (
          <div className="mx-auto max-w-md"><CompleteRegistrationCard prefill={bookedCustomer} primary={primary} /></div>
        )}
      </main>
    );
  }

  if (waitlistSent) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#faf8f4] p-5">
        <section className="animate-slide-up max-w-md rounded-3xl border border-stone-200 bg-white p-8 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-3xl text-2xl font-black text-white" style={{ background: primary }}>✓</span>
          <h1 className="mt-5 text-3xl font-bold">Richiesta in lista d’attesa</h1>
          <p className="mt-3 text-stone-600">Ti contatteremo se si libera un orario compatibile. La richiesta non garantisce né riserva un appuntamento.</p>
          <Link className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-stone-100 font-black text-stone-700" href={`/${slug}`}>Torna alla home</Link>
        </section>
      </main>
    );
  }

  if (!profile) return <main className="grid min-h-screen place-items-center bg-[#faf8f4] text-sm font-black text-stone-500">Preparazione agenda...</main>;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#faf8f4] px-4 pb-28 pt-6 lg:px-10 lg:pb-24 lg:pt-10">
      <div className="mx-auto max-w-md lg:max-w-3xl">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-[.24em]" style={{ color: primary }}>{profile.salon.name}</p>
          <Link aria-label="Chiudi" className="grid size-10 place-items-center rounded-full border border-stone-200 bg-white text-stone-700" href={`/${slug}`}>
            <X className="size-4" />
          </Link>
        </div>

        <div className="mt-4 flex gap-1.5">
          {[1, 2, 3, 4].map((segment) => (
            <span className="h-1 flex-1 rounded-full bg-stone-200" key={segment}>
              <span className="block h-full rounded-full transition-[width] duration-300" style={{ background: primary, width: step >= segment ? "100%" : "0%" }} />
            </span>
          ))}
        </div>

        {error && <p className="animate-reveal mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}

        <AnimatePresence custom={stepDirection} initial={false} mode="wait">
        {step === 1 && (
          <motion.section
            animate="center"
            className="mt-5 space-y-5"
            custom={stepDirection}
            exit="exit"
            initial="enter"
            key="step-1"
            transition={{ duration: reduceMotion ? 0.12 : 0.26, ease: [0.22, 0.9, 0.28, 1] }}
            variants={stepVariants}
          >
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-stone-400">Passo 1 di 4</p>
              <h1 className="mt-0.5 text-2xl font-bold text-stone-950">Scegli i servizi</h1>
              <p className="mt-1 text-sm text-stone-500">Puoi selezionare più trattamenti: verranno prenotati uno dopo l’altro.</p>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((item) => (
                <button
                  className={`flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold transition ${category === item.name ? "text-white" : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"}`}
                  key={item.id}
                  onClick={() => {
                    setCategory(item.name);
                    setStartsAt("");
                  }}
                  style={category === item.name ? { background: primary, borderColor: primary } : undefined}
                  type="button"
                >
                  <ServiceCategoryIcon className="size-4" name={item.icon} />
                  {item.name}
                </button>
              ))}
            </div>

            {category && (
              <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
                {filteredServices.map((service) => {
                  const selected = serviceIds.includes(service.id);
                  return (
                    <div
                      className={`overflow-hidden rounded-2xl border transition ${selected ? "" : "border-stone-200 bg-white hover:border-stone-300"}`}
                      key={service.id}
                      style={selected ? { borderColor: primary, background: `${primary}0d` } : undefined}
                    >
                      <button className="flex min-h-16 w-full items-center justify-between gap-3 p-4 text-left" onClick={() => toggleService(service.id)} type="button">
                        <span className="flex min-w-0 items-center gap-3">
                          <span className={`grid size-6 shrink-0 place-items-center rounded-full border ${selected ? "text-white" : "border-stone-300 bg-white text-transparent"}`} style={selected ? { background: primary, borderColor: primary } : undefined}>
                            <Check className="size-3.5" strokeWidth={3} />
                          </span>
                          <b className="block text-[15.5px]">{service.name}</b>
                        </span>
                        <b className="whitespace-nowrap" style={{ color: primary }}>{formatPrice(service.priceCents, "it-IT")}</b>
                      </button>
                    </div>
                  );
                })}
                {filteredServices.length === 0 && <p className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-600">Nessun trattamento disponibile in questa categoria.</p>}
              </div>
            )}

          </motion.section>
        )}

        {step === 2 && (
          <motion.section
            animate="center"
            className="mt-5 space-y-5"
            custom={stepDirection}
            exit="exit"
            initial="enter"
            key="step-2"
            transition={{ duration: reduceMotion ? 0.12 : 0.26, ease: [0.22, 0.9, 0.28, 1] }}
            variants={stepVariants}
          >
            <button className="text-sm font-black text-stone-500" onClick={() => setStep(1)} type="button">← Cambia servizi</button>
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-stone-400">Passo 2 di 4</p>
              <h1 className="mt-0.5 text-2xl font-bold text-stone-950">Scegli lo staff</h1>
              <p className="mt-1 text-sm leading-6 text-stone-500">Puoi lasciare a noi l’assegnazione oppure indicare chi preferisci.</p>
            </div>

            {profile.pwa?.allowStaffPreference === false ? (
              <div className="flex items-center gap-3 rounded-2xl bg-stone-100 p-4 text-sm font-bold text-stone-700">
                <Shuffle className="size-5 shrink-0" />Lo staff verrà assegnato automaticamente.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                <button
                  aria-pressed={!primaryStaffId}
                  className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border px-3 text-center text-sm font-black ${!primaryStaffId ? "text-white" : "border-stone-200 bg-white text-stone-700"}`}
                  onClick={() => choosePrimaryStaff("")}
                  style={!primaryStaffId ? { background: primary, borderColor: primary } : undefined}
                  type="button"
                >
                  <Shuffle className="size-5" />Nessuna preferenza
                </button>
                {primaryStaffChoices.map((member) => (
                  <button
                    aria-pressed={primaryStaffId === member.id}
                    className={`min-h-20 rounded-2xl border px-3 text-sm font-black ${primaryStaffId === member.id ? "text-white" : "border-stone-200 bg-white text-stone-700"}`}
                    key={member.id}
                    onClick={() => choosePrimaryStaff(member.id)}
                    style={primaryStaffId === member.id ? { background: primary, borderColor: primary } : undefined}
                    type="button"
                  >
                    {firstName(member.displayName)}
                  </button>
                ))}
              </div>
            )}

            {incompatibleServices.map((service) => (
              <div className="border-t border-stone-200 pt-5" key={service.id}>
                <p className="font-black text-stone-900">Per {service.name}</p>
                <p className="mt-1 text-sm leading-6 text-stone-500">{firstName(primaryStaff?.displayName ?? "")} non esegue questo servizio. Scegli un’altra preferenza.</p>
                <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3">
                  <button
                    aria-pressed={!staffByService[service.id]}
                    className={`flex min-h-16 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-black ${!staffByService[service.id] ? "text-white" : "border-stone-200 bg-white text-stone-700"}`}
                    onClick={() => setStaffByService((current) => ({ ...current, [service.id]: "" }))}
                    style={!staffByService[service.id] ? { background: primary, borderColor: primary } : undefined}
                    type="button"
                  >
                    <Shuffle className="size-4" />Nessuna preferenza
                  </button>
                  {qualifiedStaffFor(service.id).map((member) => (
                    <button
                      aria-pressed={staffByService[service.id] === member.id}
                      className={`min-h-16 rounded-2xl border px-3 text-sm font-black ${staffByService[service.id] === member.id ? "text-white" : "border-stone-200 bg-white text-stone-700"}`}
                      key={member.id}
                      onClick={() => setStaffByService((current) => ({ ...current, [service.id]: member.id }))}
                      style={staffByService[service.id] === member.id ? { background: primary, borderColor: primary } : undefined}
                      type="button"
                    >
                      {firstName(member.displayName)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </motion.section>
        )}

        {step === 3 && (
          <motion.section
            animate="center"
            className="mt-5 space-y-4"
            custom={stepDirection}
            exit="exit"
            initial="enter"
            key="step-3"
            transition={{ duration: reduceMotion ? 0.12 : 0.26, ease: [0.22, 0.9, 0.28, 1] }}
            variants={stepVariants}
          >
            <button className="text-sm font-black text-stone-500" onClick={() => setStep(2)} type="button">← Cambia staff</button>

            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-stone-400">Passo 3 di 4</p>
              <h1 className="mt-0.5 text-2xl font-bold text-stone-950">Scegli data e ora</h1>
              <p className="mt-1 text-sm font-bold capitalize" style={{ color: primary }}>{formatDateSummary(date)}</p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl bg-stone-100 px-4 py-3">
              <p className="text-sm font-bold text-stone-700">{selectedServices.length === 1 ? selectedServices[0]?.name : `${selectedServices.length} servizi`}</p>
              <DateField
                compact
                id="booking-date"
                isDateDisabled={(day) => isDateClosed(day, profile.closures, profile.opening_hours)}
                max={new Date(Date.now() + (profile.pwa?.maxAdvanceDays ?? 90) * 86400000).toISOString().slice(0, 10)}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(nextValue) => setDate(nextValue)}
                primary={primary}
                value={date}
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {quickDays.map((day) => {
                const iso = isoDate(day);
                const closed = isDateClosed(day, profile.closures, profile.opening_hours);
                const active = date === iso;
                return (
                  <button
                    className={`flex h-[72px] w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border text-xs font-bold transition ${active ? "text-white" : closed ? "border-stone-200 bg-stone-200 text-stone-400" : "border-stone-200 bg-white text-stone-700"}`}
                    disabled={closed}
                    key={iso}
                    onClick={() => setDate(iso)}
                    style={active ? { background: primary, borderColor: primary } : undefined}
                    type="button"
                  >
                    <span className="text-[10px] font-black uppercase tracking-wide">{day.toLocaleDateString("it-IT", { weekday: "short" }).replace(".", "")}</span>
                    <span className="text-lg font-bold">{day.getDate()}</span>
                    <span className="text-[9px] font-black uppercase tracking-wide opacity-70">{day.toLocaleDateString("it-IT", { month: "short" }).replace(".", "")}</span>
                  </button>
                );
              })}
            </div>

            <div>
              {loadingSlots ? (
                <p className="rounded-2xl bg-stone-50 p-4 text-center text-sm font-bold text-stone-500">Cerco orari...</p>
              ) : dayClosed ? (
                <p className="animate-reveal rounded-2xl border border-stone-200 bg-stone-50 p-5 text-center text-sm font-bold text-stone-600">Il salone è chiuso in questa data. Scegli un altro giorno.</p>
              ) : slots.some((slot) => slot.available) ? (
                <div className="grid grid-cols-3 gap-2 lg:grid-cols-5">
                  {slots.map((slot) => (
                    <button key={slot.starts_at} disabled={!slot.available} onClick={() => pickSlot(slot.starts_at)} className={`min-h-12 rounded-2xl border text-sm font-black ${startsAt === slot.starts_at ? "text-white" : slot.available ? "border-stone-200 bg-white text-stone-800" : "border-stone-100 bg-stone-100 text-stone-300 line-through"}`} style={startsAt === slot.starts_at ? { background: primary, borderColor: primary } : undefined}>
                      {formatTimeSummary(slot.starts_at)}
                    </button>
                  ))}
                </div>
              ) : waitlistMode ? (
                  <form action={submitWaitlist} className="animate-reveal mt-6 space-y-4 border-t border-stone-100 pt-5">
                    <fieldset>
                      <legend className="text-sm font-black text-stone-800">Quando sei disponibile?</legend>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {([ ["any", "Qualsiasi orario"], ["morning", "Mattina"], ["afternoon", "Pomeriggio"], ["evening", "Sera"] ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setTimePreference(value)} className={`min-h-12 rounded-2xl border text-sm font-bold ${timePreference === value ? "text-white" : "border-stone-200 bg-white text-stone-700"}`} style={timePreference === value ? { background: primary, borderColor: primary } : undefined}>{label}</button>)}
                      </div>
                    </fieldset>
                    {[["first_name", "Nome", "text"], ["last_name", "Cognome", "text"], ["email", "Email", "email"], ["phone", "Telefono", "tel"]].map(([name, label, type]) => {
                      const accountValue = customerAuthStatus === "authenticated" && customer
                        ? name === "first_name" ? customer.first_name : name === "last_name" ? customer.last_name : name === "email" ? customer.email ?? "" : customer.phone ?? ""
                        : undefined;
                      return (
                        <label key={name} className="block text-sm font-black text-stone-800">
                          {label}
                          <input
                            aria-readonly={accountValue !== undefined}
                            className={`mt-2 w-full ${accountValue !== undefined ? "cursor-not-allowed bg-stone-100 text-stone-500" : ""}`}
                            defaultValue={accountValue}
                            name={name}
                            readOnly={accountValue !== undefined}
                            required={name === "first_name" || name === "last_name" || (name === "email" && profile.pwa?.requireEmail !== false) || (name === "phone" && profile.pwa?.requirePhone === true)}
                            type={type}
                          />
                        </label>
                      );
                    })}
                    <motion.button className="min-h-12 w-full rounded-full font-black text-white disabled:opacity-50" disabled={submittingWaitlist} style={{ background: primary }} whileTap={{ scale: 0.97 }}>{submittingWaitlist ? "Invio richiesta..." : "Invia richiesta"}</motion.button>
                  </form>
              ) : (
                <div className="animate-reveal flex min-h-[40dvh] flex-col items-center justify-center py-8 text-center">
                  <img alt="" aria-hidden="true" className="h-36 w-36 object-contain" src="/booking-oops-doodle.png" />
                  <p className="mt-2 text-3xl font-black text-stone-950">Oops!</p>
                  <p className="mt-2 text-lg font-black text-stone-900">Questa giornata è al completo</p>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-stone-600">
                    {selectedServices.length === 1
                      ? "Lascia una richiesta: il salone ti contatterà se si libera un posto."
                      : "Non c’è una sequenza disponibile per tutti i servizi. Prova un altro giorno o modifica la selezione."}
                  </p>
                  {profile.capabilities?.waitlist && selectedServices.length === 1 && (
                    <button
                      className="mt-6 min-h-12 w-full max-w-xs rounded-full px-6 font-black text-white"
                      onClick={() => setWaitlistMode(true)}
                      style={{ background: primary }}
                      type="button"
                    >
                      Iscriviti alla lista d’attesa
                    </button>
                  )}
                </div>
              )}
              <div className="scroll-mb-24" ref={continueRef}>
              </div>
            </div>
          </motion.section>
        )}

        {step === 4 && (
          <motion.div
            animate="center"
            className="mt-5 space-y-4"
            custom={stepDirection}
            exit="exit"
            initial="enter"
            key="step-4"
            transition={{ duration: reduceMotion ? 0.12 : 0.26, ease: [0.22, 0.9, 0.28, 1] }}
            variants={stepVariants}
          >
            <button type="button" className="text-sm font-black text-stone-500" onClick={() => setStep(3)}>← Cambia orario</button>
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-stone-400">Passo 4 di 4</p>
              <h1 className="mt-0.5 text-2xl font-bold text-stone-950">Conferma la prenotazione</h1>
            </div>
            {customerAuthStatus === "authenticated" && customer ? (
              <>
                <div className="rounded-2xl bg-stone-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[.12em] text-stone-500">Prenoti come</p>
                  <p className="mt-1 text-lg font-black text-stone-900">{customer.full_name}</p>
                  <p className="text-sm text-stone-500">{customer.phone}{customer.email ? ` · ${customer.email}` : ""}</p>
                </div>
                <motion.button className="min-h-12 w-full rounded-full font-black text-white" onClick={() => void submitAuthenticated()} style={{ background: primary }} whileTap={{ scale: 0.97 }}>Conferma prenotazione</motion.button>
              </>
            ) : (
              <form action={submit} className="space-y-4">
                {[
                  ["first_name", "Nome", "text"],
                  ["last_name", "Cognome", "text"],
                  ["email", "Email", "email"],
                  ["phone", "Telefono", "tel"],
                ].map(([name, label, type]) => (
                  <label key={name} className="block text-sm font-black text-stone-800">
                    {label}
                    <input name={name} type={type} required={name === "first_name" || name === "last_name" || (name === "email" && profile.pwa?.requireEmail !== false) || (name === "phone" && profile.pwa?.requirePhone === true)} className="mt-2 w-full" />
                  </label>
                ))}
                <motion.button className="min-h-12 w-full rounded-full font-black text-white" style={{ background: primary }} whileTap={{ scale: 0.97 }}>Conferma prenotazione</motion.button>
              </form>
            )}
          </motion.div>
        )}
        </AnimatePresence>
      </div>
      {(step === 1 || step === 2 || (step === 3 && !waitlistMode && (loadingSlots || dayClosed || slots.some((slot) => slot.available)))) && (
        <footer
          className="fixed inset-x-0 bottom-[76px] z-40 border-t border-stone-200/80 bg-[#faf8f4]/95 px-4 pt-3 backdrop-blur lg:bottom-0 lg:px-10"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto max-w-md lg:max-w-3xl">
            {step === 1 && selectedServices.length > 0 && (
              <div aria-label="Servizi selezionati" className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {selectedServices.map((service) => (
                  <button
                    aria-label={`Rimuovi ${service.name}`}
                    className="flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-stone-200 bg-white px-3 text-sm font-black text-stone-800"
                    key={service.id}
                    onClick={() => toggleService(service.id)}
                    type="button"
                  >
                    {service.name}
                    <X aria-hidden="true" className="size-3.5 text-stone-500" strokeWidth={2.5} />
                  </button>
                ))}
              </div>
            )}
            <motion.button
              className="min-h-12 w-full rounded-full font-black text-white shadow-sm disabled:opacity-40"
              disabled={step === 1 ? serviceIds.length === 0 : step === 3 ? !startsAt : false}
              onClick={() => setStep(step + 1)}
              style={{ background: primary }}
              type="button"
              whileTap={{ scale: 0.97 }}
            >
              Avanti
            </motion.button>
          </div>
        </footer>
      )}
    </main>
  );
}
