"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { formatPrice } from "@esse-beauty/shared";

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

type BookingSection = "category" | "service" | "staff";

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
  const [openSection, setOpenSection] = useState<BookingSection | null>("category");
  const [openDateSection, setOpenDateSection] = useState<"date" | "time" | null>("date");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [serviceId, setServiceId] = useState(searchParams.get("serviceId") ?? "");
  const [staffId, setStaffId] = useState(searchParams.get("staffId") ?? "");
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

  const selectedService = profile?.services.find((service) => service.id === serviceId);
  const categories = useMemo(
    () => profile?.categories.filter((item) => profile.services.some((service) => service.category === item.name)) ?? [],
    [profile],
  );
  const filteredServices = useMemo(
    () => profile?.services.filter((service) => service.category === category) ?? [],
    [category, profile],
  );
  const qualifiedStaff = useMemo(
    () => profile?.staff.filter((member) => !serviceId || !member.serviceIds?.length || member.serviceIds.includes(serviceId)) ?? [],
    [profile, serviceId],
  );
  const selectedStaffName = staffId ? qualifiedStaff.find((member) => member.id === staffId)?.displayName : "Nessuna preferenza";

  useEffect(() => {
    if (staffId && !qualifiedStaff.some((member) => member.id === staffId)) setStaffId("");
  }, [qualifiedStaff, staffId]);
  const brand = profile?.branding;
  const primary = brand?.primaryColor || "#402334";
  const accent = brand?.accentColor || "#f4d8a8";

  function sectionHeader(key: BookingSection, title: string, summary: string | undefined) {
    const isOpen = openSection === key;
    return (
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpenSection(isOpen ? null : key)} type="button">
        <span>
          <span className="block text-sm font-black text-stone-800">{title}</span>
          {summary && !isOpen && <span className="mt-0.5 block text-xs font-bold" style={{ color: primary }}>{summary}</span>}
        </span>
        <ChevronDown className={`size-4 shrink-0 text-stone-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
    );
  }

  function dateSectionHeader(key: "date" | "time", title: string, summary: string | undefined) {
    const isOpen = openDateSection === key;
    return (
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpenDateSection(isOpen ? null : key)} type="button">
        <span>
          <span className="block text-sm font-black text-stone-800">{title}</span>
          {summary && !isOpen && <span className="mt-0.5 block text-xs font-bold" style={{ color: primary }}>{summary}</span>}
        </span>
        <ChevronDown className={`size-4 shrink-0 text-stone-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
    );
  }

  useEffect(() => {
    if (step !== 2 || !serviceId) return;
    let cancelled = false;
    setLoadingSlots(true);
    setError("");
    const query = new URLSearchParams({ date, serviceId });
    if (staffId) query.set("staffId", staffId);
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
  }, [date, serviceId, slug, staffId, step]);

  function pickSlot(startsAtValue: string) {
    setStartsAt(startsAtValue);
    requestAnimationFrame(() => continueRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
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
        service_id: serviceId,
        staff_id: staffId || undefined,
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
        customer: { email: data.get("email"), first_name: data.get("first_name"), full_name: fullName(data), last_name: data.get("last_name"), phone: data.get("phone") },
        requested_date: date,
        service_id: serviceId,
        staff_id: staffId || undefined,
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
      <main className="grid min-h-screen place-items-center bg-[#f6f2f4] p-5">
        <section className="max-w-md rounded-[2rem] bg-white p-8 text-center shadow-xl">
          <h1 className="text-3xl font-bold">Prenotazioni non disponibili</h1>
          <p className="mt-3 text-stone-600">Il salone ha sospeso temporaneamente le prenotazioni online.</p>
        </section>
      </main>
    );
  }

  if (booking) {
    return (
      <main className="min-h-screen px-4 py-8" style={{ background: `radial-gradient(circle at top, ${accent}55, transparent 20rem), #f6f2f4` }}>
        <section className="animate-slide-up mx-auto max-w-md rounded-[2.2rem] bg-white p-7 text-center shadow-[0_24px_70px_rgb(45_29_39_/_0.16)]">
          <span className="mx-auto grid size-16 place-items-center rounded-3xl text-2xl font-black text-white" style={{ background: primary }}>✓</span>
          <h1 className="mt-5 text-3xl font-bold">{booking.status === "confirmed" ? "Prenotazione confermata" : "Richiesta inviata"}</h1>
          <p className="mt-2 text-sm text-stone-500">
            {booking.status === "confirmed"
              ? (brand?.bookingSuccessText || "Il tuo appuntamento è confermato.")
              : "Il salone deve ancora confermare la richiesta: riceverai un avviso appena verrà accettata."}
          </p>
          <p className="mt-3 text-stone-600">{booking.service_name} con {firstName(booking.staff_name)}</p>
          <p className="mt-1 text-sm font-bold text-[#792f59]">{new Date(booking.startsAt).toLocaleString("it-IT", { dateStyle: "full", timeStyle: "short" })}</p>
          <button onClick={() => saveCalendar(booking)} className="mt-7 min-h-12 w-full rounded-2xl font-black text-white shadow-lg" style={{ background: primary }}>Aggiungi al calendario</button>
          <Link className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-stone-100 font-black text-stone-700" href={`/${slug}`}>Torna alla home</Link>
        </section>
        {bookedCustomer && showRegisterPrompt && (
          <div className="mx-auto max-w-md"><CompleteRegistrationCard prefill={bookedCustomer} primary={primary} /></div>
        )}
      </main>
    );
  }

  if (waitlistSent) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f2f4] p-5">
        <section className="animate-slide-up max-w-md rounded-[2rem] bg-white p-8 text-center shadow-xl">
          <span className="mx-auto grid size-16 place-items-center rounded-3xl text-2xl font-black text-white" style={{ background: primary }}>✓</span>
          <h1 className="mt-5 text-3xl font-bold">Richiesta in lista d’attesa</h1>
          <p className="mt-3 text-stone-600">Ti contatteremo se si libera un orario compatibile. La richiesta non garantisce né riserva un appuntamento.</p>
          <Link className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-stone-100 font-black text-stone-700" href={`/${slug}`}>Torna alla home</Link>
        </section>
      </main>
    );
  }

  if (!profile) return <main className="grid min-h-screen place-items-center bg-[#f6f2f4] text-sm font-black text-[#792f59]">Preparazione agenda...</main>;

  return (
    <main className="min-h-screen overflow-x-hidden px-4 py-6" style={{ background: `radial-gradient(circle at 10% 0%, ${accent}60, transparent 18rem), linear-gradient(180deg,#fffafd,#f6f2f4)` }}>
      <div className="mx-auto max-w-md">
        <header className="rounded-[2.2rem] p-6 text-white shadow-[0_24px_70px_rgb(45_29_39_/_0.18)]" style={{ background: `linear-gradient(135deg, ${primary}, #792f59)` }}>
          <p className="text-xs font-black uppercase tracking-[.24em]" style={{ color: accent }}>{profile.salon.name}</p>
          <h1 className="mt-3 text-4xl font-bold">Prenota</h1>
          <p className="mt-2 text-sm text-white/75">{selectedService ? selectedService.name : "Parti dalla categoria, scegli il trattamento e trova il tuo orario."}</p>
        </header>

        {error && <p className="animate-reveal mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}

        <div className="my-5 grid grid-cols-3 gap-2">
          {["Trattamento", "Orario", customerAuthStatus === "authenticated" ? "Conferma" : "Dati"].map((label, index) => (
            <span key={label} className={`rounded-2xl py-3 text-center text-xs font-black transition-colors duration-300 ${step >= index + 1 ? "text-white" : "bg-white text-stone-400"}`} style={step >= index + 1 ? { background: primary } : undefined}>
              {label}
            </span>
          ))}
        </div>

        <AnimatePresence custom={stepDirection} initial={false} mode="wait">
        {step === 1 && (
          <motion.section
            animate="center"
            className="space-y-3 rounded-[2rem] border border-white/80 bg-white/86 p-5 shadow-[0_18px_44px_rgb(45_29_39_/_0.09)]"
            custom={stepDirection}
            exit="exit"
            initial="enter"
            key="step-1"
            transition={{ duration: reduceMotion ? 0.12 : 0.26, ease: [0.22, 0.9, 0.28, 1] }}
            variants={stepVariants}
          >
            <div className="rounded-2xl border border-stone-100 bg-white/70 p-4">
              {sectionHeader("category", "Categoria", category || undefined)}
              <AnimatePresence initial={false}>
                {openSection === "category" && (
                  <motion.div
                    animate={{ height: "auto", opacity: 1 }}
                    className="overflow-hidden"
                    exit={{ height: 0, opacity: 0 }}
                    initial={{ height: 0, opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0.12 : 0.28, ease: [0.22, 0.9, 0.28, 1] }}
                  >
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {categories.map((item) => (
                        <button
                          className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-black transition ${category === item.name ? "text-white shadow-md" : "border-stone-100 bg-white text-stone-700 hover:border-[#d99aba]"}`}
                          key={item.id}
                          onClick={() => {
                            setCategory(item.name);
                            setServiceId("");
                            setStartsAt("");
                            setOpenSection("service");
                          }}
                          style={category === item.name ? { background: primary, borderColor: primary } : undefined}
                          type="button"
                        >
                          <ServiceCategoryIcon className="size-6" name={item.icon} />
                          <span>{item.name}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {category && (
              <div className="rounded-2xl border border-stone-100 bg-white/70 p-4">
                {sectionHeader("service", "Trattamento", selectedService?.name)}
                <AnimatePresence initial={false}>
                  {openSection === "service" && (
                    <motion.div
                      animate={{ height: "auto", opacity: 1 }}
                      className="overflow-hidden"
                      exit={{ height: 0, opacity: 0 }}
                      initial={{ height: 0, opacity: 0 }}
                      transition={{ duration: reduceMotion ? 0.12 : 0.28, ease: [0.22, 0.9, 0.28, 1] }}
                    >
                      <div className="mt-3 space-y-2">
                        {filteredServices.map((service) => (
                          <button
                            className={`flex min-h-16 w-full items-center justify-between rounded-2xl border p-3 text-left transition ${serviceId === service.id ? "border-[#792f59] bg-[#faf3f7] shadow-sm" : "border-stone-100 bg-white hover:border-[#d99aba]"}`}
                            key={service.id}
                            onClick={() => {
                              setServiceId(service.id);
                              if (profile.pwa?.allowStaffPreference !== false) setOpenSection("staff");
                              else setStep(2);
                            }}
                            type="button"
                          >
                            <span><b className="block">{service.name}</b><small className="text-stone-500">{service.durationMinutes} min</small></span>
                            <b style={{ color: primary }}>{formatPrice(service.priceCents, "it-IT")}</b>
                          </button>
                        ))}
                        {filteredServices.length === 0 && <p className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-600">Nessun trattamento disponibile in questa categoria.</p>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {profile.pwa?.allowStaffPreference !== false && serviceId && (
              <div className="rounded-2xl border border-stone-100 bg-white/70 p-4">
                {sectionHeader("staff", "Preferenza staff", selectedStaffName)}
                <AnimatePresence initial={false}>
                  {openSection === "staff" && (
                    <motion.div
                      animate={{ height: "auto", opacity: 1 }}
                      className="overflow-hidden"
                      exit={{ height: 0, opacity: 0 }}
                      initial={{ height: 0, opacity: 0 }}
                      transition={{ duration: reduceMotion ? 0.12 : 0.28, ease: [0.22, 0.9, 0.28, 1] }}
                    >
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button className={`min-h-11 rounded-full border px-4 text-sm font-bold ${staffId === "" ? "text-white" : "border-stone-200 bg-white text-stone-700"}`} onClick={() => { setStaffId(""); setStep(2); }} style={staffId === "" ? { background: primary, borderColor: primary } : undefined} type="button">Nessuna preferenza</button>
                        {qualifiedStaff.map((member) => (
                          <button
                            className={`min-h-11 rounded-full border px-4 text-sm font-bold ${staffId === member.id ? "text-white" : "border-stone-200 bg-white text-stone-700"}`}
                            key={member.id}
                            onClick={() => { setStaffId(member.id); setStep(2); }}
                            style={staffId === member.id ? { background: primary, borderColor: primary } : undefined}
                            type="button"
                          >
                            {firstName(member.displayName)}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <motion.button className="min-h-12 w-full rounded-2xl font-black text-white disabled:opacity-40" disabled={!serviceId} onClick={() => setStep(2)} style={{ background: primary }} whileTap={{ scale: 0.97 }}>Continua</motion.button>
          </motion.section>
        )}

        {step === 2 && (
          <motion.section
            animate="center"
            className="rounded-[2rem] border border-white/80 bg-white/86 p-5 shadow-[0_18px_44px_rgb(45_29_39_/_0.09)]"
            custom={stepDirection}
            exit="exit"
            initial="enter"
            key="step-2"
            transition={{ duration: reduceMotion ? 0.12 : 0.26, ease: [0.22, 0.9, 0.28, 1] }}
            variants={stepVariants}
          >
            <button className="mb-4 text-sm font-black text-[#792f59]" onClick={() => setStep(1)}>← Cambia servizio</button>
            <div className="space-y-3">
              <div className="rounded-2xl border border-stone-100 bg-white/70 p-4">
                {dateSectionHeader("date", "Data", formatDateSummary(date))}
                <AnimatePresence initial={false}>
                  {openDateSection === "date" && (
                    <motion.div
                      animate={{ height: "auto", opacity: 1 }}
                      className="overflow-hidden"
                      exit={{ height: 0, opacity: 0 }}
                      initial={{ height: 0, opacity: 0 }}
                      transition={{ duration: reduceMotion ? 0.12 : 0.28, ease: [0.22, 0.9, 0.28, 1] }}
                    >
                      <div className="mt-3">
                        <DateField
                          id="booking-date"
                          isDateDisabled={(day) => isDateClosed(day, profile.closures)}
                          max={new Date(Date.now() + (profile.pwa?.maxAdvanceDays ?? 90) * 86400000).toISOString().slice(0, 10)}
                          min={new Date().toISOString().slice(0, 10)}
                          onChange={(nextValue) => { setDate(nextValue); setOpenDateSection("time"); }}
                          primary={primary}
                          value={date}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="rounded-2xl border border-stone-100 bg-white/70 p-4">
                {dateSectionHeader("time", "Orario", startsAt ? formatTimeSummary(startsAt) : undefined)}
                <AnimatePresence initial={false}>
                  {openDateSection === "time" && (
                    <motion.div
                      animate={{ height: "auto", opacity: 1 }}
                      className="overflow-hidden"
                      exit={{ height: 0, opacity: 0 }}
                      initial={{ height: 0, opacity: 0 }}
                      transition={{ duration: reduceMotion ? 0.12 : 0.28, ease: [0.22, 0.9, 0.28, 1] }}
                    >
                      <div className="mt-3">
                        {loadingSlots ? (
                          <p className="rounded-2xl bg-stone-50 p-4 text-center text-sm font-bold text-stone-500">Cerco orari...</p>
                        ) : dayClosed ? (
                          <p className="animate-reveal rounded-2xl border border-stone-200 bg-stone-50 p-5 text-center text-sm font-bold text-stone-600">Il salone è chiuso in questa data. Scegli un altro giorno.</p>
                        ) : (
                          <div className="grid grid-cols-3 gap-2">
                            {slots.map((slot) => (
                              <button key={slot.starts_at} disabled={!slot.available} onClick={() => pickSlot(slot.starts_at)} className={`min-h-12 rounded-2xl border text-sm font-black ${startsAt === slot.starts_at ? "text-white" : slot.available ? "border-stone-100 bg-white text-stone-800" : "border-stone-100 bg-stone-100 text-stone-300 line-through"}`} style={startsAt === slot.starts_at ? { background: primary } : undefined}>
                                {formatTimeSummary(slot.starts_at)}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="scroll-mb-24" ref={continueRef}>
                          {!loadingSlots && !dayClosed && !slots.some((slot) => slot.available) && (
                            <div className="animate-reveal mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-5">
                              <p className="font-black text-stone-900">Questa giornata è al completo</p>
                              <p className="mt-1 text-sm text-stone-600">Puoi lasciare una richiesta e il salone ti contatterà se si libera un posto.</p>
                              {profile.capabilities?.waitlist && <button className="mt-4 min-h-12 w-full rounded-2xl font-black text-white" onClick={() => setWaitlistMode(true)} style={{ background: primary }}>Entra in lista d’attesa</button>}
                            </div>
                          )}
                          {waitlistMode ? (
                            <form action={submitWaitlist} className="animate-reveal mt-5 space-y-4 border-t border-stone-100 pt-5">
                              <fieldset>
                                <legend className="text-sm font-black text-stone-800">Quando sei disponibile?</legend>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  {([ ["any", "Qualsiasi orario"], ["morning", "Mattina"], ["afternoon", "Pomeriggio"], ["evening", "Sera"] ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setTimePreference(value)} className={`min-h-12 rounded-2xl border text-sm font-bold ${timePreference === value ? "text-white" : "border-stone-200 bg-white text-stone-700"}`} style={timePreference === value ? { background: primary, borderColor: primary } : undefined}>{label}</button>)}
                                </div>
                              </fieldset>
                              {[["first_name", "Nome", "text"], ["last_name", "Cognome", "text"], ["email", "Email", "email"], ["phone", "Telefono", "tel"]].map(([name, label, type]) => <label key={name} className="block text-sm font-black text-stone-800">{label}<input className="mt-2 w-full" name={name} type={type} required={name === "first_name" || name === "last_name" || (name === "email" && profile.pwa?.requireEmail !== false) || (name === "phone" && profile.pwa?.requirePhone === true)} /></label>)}
                              <motion.button className="min-h-12 w-full rounded-2xl font-black text-white disabled:opacity-50" disabled={submittingWaitlist} style={{ background: primary }} whileTap={{ scale: 0.97 }}>{submittingWaitlist ? "Invio richiesta..." : "Invia richiesta"}</motion.button>
                            </form>
                          ) : <motion.button className="mt-5 min-h-12 w-full rounded-2xl font-black text-white disabled:opacity-40" disabled={!startsAt} onClick={() => setStep(3)} whileTap={{ scale: 0.97 }} style={{ background: primary }}>Continua</motion.button>}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.section>
        )}

        {step === 3 && (
          <motion.div
            animate="center"
            className="space-y-4 rounded-[2rem] border border-white/80 bg-white/86 p-5 shadow-[0_18px_44px_rgb(45_29_39_/_0.09)]"
            custom={stepDirection}
            exit="exit"
            initial="enter"
            key="step-3"
            transition={{ duration: reduceMotion ? 0.12 : 0.26, ease: [0.22, 0.9, 0.28, 1] }}
            variants={stepVariants}
          >
            <button type="button" className="text-sm font-black text-[#792f59]" onClick={() => setStep(2)}>← Cambia orario</button>
            {customerAuthStatus === "authenticated" && customer ? (
              <>
                <div className="rounded-2xl bg-stone-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[.12em] text-stone-500">Prenoti come</p>
                  <p className="mt-1 text-lg font-black text-stone-900">{customer.full_name}</p>
                  <p className="text-sm text-stone-500">{customer.phone}{customer.email ? ` · ${customer.email}` : ""}</p>
                </div>
                <motion.button className="min-h-12 w-full rounded-2xl font-black text-white" onClick={() => void submitAuthenticated()} style={{ background: primary }} whileTap={{ scale: 0.97 }}>Conferma prenotazione</motion.button>
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
                <motion.button className="min-h-12 w-full rounded-2xl font-black text-white" style={{ background: primary }} whileTap={{ scale: 0.97 }}>Conferma prenotazione</motion.button>
              </form>
            )}
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </main>
  );
}
