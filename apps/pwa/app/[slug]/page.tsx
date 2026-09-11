"use client";

import Link from "next/link";
import { ArrowRight, Bell, BellOff, Clock, LogOut, Sparkles, Star, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Avatar, Style } from "@dicebear/core";
import miniavs from "@dicebear/styles/miniavs.json" with { type: "json" };
import { useParams } from "next/navigation";
import type { Weekday, WorkingHours } from "@esse-beauty/shared";

import { apiBaseUrl } from "../../lib/api";
import { NoticeModal } from "../_components/NoticeModal";
import { ServiceCategoryIcon } from "../_components/ServiceCategoryIcon";
import { CustomerAuthOverlay } from "./_components/CustomerAuthOverlay";
import { useCustomerAuth } from "./_components/CustomerAuthProvider";
import { InstallAppButton } from "./_components/InstallAppButton";
import { getExistingPushSubscription, isPushSupported, subscribeToPush, unsubscribeFromPush } from "./_components/push-notifications";

const avatarStyle = new Style(miniavs);

function CustomerAvatar({
  borderColor,
  name,
  seed,
}: {
  borderColor: string;
  name: string;
  seed: string;
}) {
  const src = useMemo(
    () =>
      new Avatar(avatarStyle, {
        seed,
        size: 64,
        borderRadius: 50,
      }).toDataUri(),
    [seed],
  );

  return (
    <img
      alt={`Avatar di ${name}`}
      className="size-8 shrink-0 rounded-full border-2 object-cover"
      height={32}
      src={src}
      style={{ borderColor }}
      width={32}
    />
  );
}

function customerAvatarSeed(customer: { full_name: string }): string {
  const id = (customer as { id?: unknown }).id;
  return typeof id === "string" && id ? id : customer.full_name;
}

interface Service { id: string; name: string; category: string; durationMinutes: number; priceCents: number; }
interface Category { icon: string; id: string; name: string; }
interface Branding { accentColor?: string; heroSubtitle?: string; heroTitle?: string; installPromptEnabled?: boolean; logoUrl?: string; primaryColor?: string; welcomeText?: string; }
interface Profile { branding?: Branding | null; categories: Category[]; opening_hours?: WorkingHours | null; pwa?: { pushPublicKey?: string | null } | null; salon: { name: string; timezone?: string }; services: Service[]; }

const WEEKDAY_KEYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const WEEKDAY_LABELS: Record<Weekday, string> = { fri: "Venerdì", mon: "Lunedì", sat: "Sabato", sun: "Domenica", thu: "Giovedì", tue: "Martedì", wed: "Mercoledì" };

function todayWeekdayAndMinutes(timezone: string): { minutes: number; weekday: Weekday } {
  const parts = new Intl.DateTimeFormat("en-US", { hour: "2-digit", hour12: false, minute: "2-digit", timeZone: timezone, weekday: "short" }).formatToParts(new Date());
  const short = parts.find((part) => part.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const weekday = WEEKDAY_KEYS[(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short) + 6) % 7] ?? "mon";
  return { minutes: hour * 60 + minute, weekday };
}
interface PublicReview { comment: string | null; created_at: string; customer_name: string; id: string; rating: number; reply: string | null; }
interface PublicReviews { average_rating: number | null; items: PublicReview[]; total: number; }
interface AppMessage { body: string; created_at: string; href?: string | null; id: string; read_at: string | null; title: string; }

function displayName(value: string): string {
  const first = value.trim().split(/\s+/)[0];
  return first ? `${first} cliente` : "Cliente";
}

export default function SalonLanding() {
  const { slug } = useParams<{ slug: string }>();
  const { customer, logout, status: authStatus } = useCustomerAuth();
  const [profile, setProfile] = useState<Profile>();
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable" | "missing">("loading");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [showAuthOverlay, setShowAuthOverlay] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "reviews">("overview");
  const [reviews, setReviews] = useState<PublicReviews>();
  const [reviewsStatus, setReviewsStatus] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [messages, setMessages] = useState<AppMessage[]>([]);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [messagesStatus, setMessagesStatus] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushPromptDismissed, setPushPromptDismissed] = useState(true);
  const [toast, setToast] = useState("");
  const [guestAvatarSeed] = useState(() => `guest-${crypto.randomUUID()}`);

  useEffect(() => {
    void fetch(`${apiBaseUrl()}/api/public/${slug}`).then(async (response) => {
      if (response.status === 503) return setStatus("unavailable");
      if (!response.ok) return setStatus("missing");
      setProfile(await response.json());
      setStatus("ready");
    });
  }, [slug]);

  useEffect(() => {
    if (reviewsStatus !== "idle") return;
    setReviewsStatus("loading");
    void fetch(`${apiBaseUrl()}/api/public/${slug}/reviews`)
      .then(async (response) => {
        if (!response.ok) throw new Error("REVIEWS_UNAVAILABLE");
        setReviews(await response.json());
        setReviewsStatus("ready");
      })
      .catch(() => setReviewsStatus("failed"));
  }, [reviewsStatus, slug]);

  useEffect(() => {
    if (authStatus !== "authenticated" || messagesStatus !== "idle") return;
    setMessagesStatus("loading");
    void fetch(`${apiBaseUrl()}/api/public/${slug}/messages`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("MESSAGES_UNAVAILABLE");
        setMessages(await response.json() as AppMessage[]);
        setMessagesStatus("ready");
      })
      .catch(() => setMessagesStatus("failed"));
  }, [authStatus, messagesStatus, slug]);

  useEffect(() => {
    const supported = isPushSupported();
    setPushSupported(supported);
    setPushPromptDismissed(window.localStorage.getItem(`esse-push-prompt-dismissed:${slug}`) === "1");
    if (authStatus !== "authenticated" || !supported) return;
    void getExistingPushSubscription().then((subscription) => setPushSubscribed(Boolean(subscription)));
  }, [authStatus, slug]);

  function dismissPushPrompt() {
    setPushPromptDismissed(true);
    window.localStorage.setItem(`esse-push-prompt-dismissed:${slug}`, "1");
  }

  async function togglePush() {
    const pushPublicKey = profile?.pwa?.pushPublicKey;
    if (!pushPublicKey || pushBusy) return;
    setPushBusy(true);
    try {
      if (pushSubscribed) {
        await unsubscribeFromPush(apiBaseUrl(), slug);
        setPushSubscribed(false);
        setToast("Notifiche push disattivate.");
      } else {
        const subscription = await subscribeToPush(apiBaseUrl(), slug, pushPublicKey);
        setPushSubscribed(Boolean(subscription));
        setToast(subscription ? "Notifiche push attivate." : "Attiva le notifiche dalle impostazioni del browser per riceverle.");
        if (subscription) dismissPushPrompt();
      }
    } catch (error) {
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      setToast(`Impossibile aggiornare le notifiche push. (${detail})`);
    } finally {
      setPushBusy(false);
    }
  }

  const categories = useMemo(() => profile?.categories.filter((category) =>
    profile.services.some((service) => service.category === category.name),
  ) ?? [], [profile]);
  const openingHours = profile?.opening_hours;
  const isOpenNow = useMemo(() => {
    if (!openingHours) return null;
    const { minutes, weekday } = todayWeekdayAndMinutes(profile?.salon.timezone || "Europe/Rome");
    return (openingHours[weekday] ?? []).some((range) => {
      const [fromHour = 0, fromMinute = 0] = range.from.split(":").map(Number);
      const [toHour = 0, toMinute = 0] = range.to.split(":").map(Number);
      return minutes >= fromHour * 60 + fromMinute && minutes < toHour * 60 + toMinute;
    });
  }, [openingHours, profile?.salon.timezone]);
  const todayKey = openingHours ? todayWeekdayAndMinutes(profile?.salon.timezone || "Europe/Rome").weekday : undefined;
  const brand = profile?.branding;

  function hoursStatusBadge() {
    if (isOpenNow === null) return null;
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold" style={{ color: isOpenNow ? "#0e7c59" : "#a6a399" }}>
        <span className="size-1.5 rounded-full" style={{ background: isOpenNow ? "#0e7c59" : "#a6a399" }} />
        {isOpenNow ? "Aperto ora" : "Chiuso ora"}
      </span>
    );
  }

  function hoursList() {
    return (
      <div className="space-y-1.5">
        {WEEKDAY_KEYS.map((key) => {
          const ranges = openingHours?.[key] ?? [];
          return (
            <div className={`flex items-center justify-between gap-3 text-sm ${key === todayKey ? "font-black text-stone-950" : "text-stone-600"}`} key={key}>
              <span className="shrink-0 whitespace-nowrap">{WEEKDAY_LABELS[key]}</span>
              <span className={`shrink-0 whitespace-nowrap ${ranges.length ? "" : "text-stone-400"}`}>{ranges.length ? ranges.map((range) => `${range.from}–${range.to}`).join(", ") : "Chiuso"}</span>
            </div>
          );
        })}
      </div>
    );
  }
  const primary = brand?.primaryColor || "#15140f";
  const accent = brand?.accentColor || "#0e7c59";
  const unreadMessages = messages.filter((message) => !message.read_at).length;

  if (status === "loading") return <main className="grid min-h-screen place-items-center bg-[#faf8f4] text-sm font-bold text-stone-500">Preparazione salone...</main>;
  if (status === "unavailable") return <main className="grid min-h-screen place-items-center bg-[#faf8f4] p-5"><section className="max-w-md rounded-3xl border border-stone-200 bg-white p-8 text-center"><p className="text-xs font-bold uppercase tracking-[.2em] text-stone-400">Prenotazioni online</p><h1 className="mt-3 text-3xl font-bold">Servizio momentaneamente non disponibile</h1><p className="mt-3 text-stone-600">Contatta direttamente il salone per fissare un appuntamento.</p></section></main>;
  if (status === "missing") return <main className="grid min-h-screen place-items-center bg-[#faf8f4] p-5"><h1 className="text-2xl font-bold">Salone non trovato</h1></main>;

  return (
    <main className="min-h-screen bg-[#faf8f4] px-4 py-6 lg:px-10 lg:py-10">
      <div className="animate-reveal mx-auto max-w-md lg:max-w-6xl">
        <div className="flex items-center justify-end gap-2">
          {authStatus === "authenticated" && (
            <button
              aria-label="Apri notifiche"
              aria-pressed={messagesOpen}
              className="relative grid size-11 place-items-center rounded-full border border-stone-200 bg-white text-stone-700 transition hover:border-stone-300"
              onClick={() => setMessagesOpen((state) => !state)}
              type="button"
            >
              <Bell className="size-[18px]" />
              {unreadMessages > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-stone-950 px-1 text-[10px] font-black text-white">{Math.min(unreadMessages, 9)}</span>}
            </button>
          )}
          <div className="relative">
            <button
              aria-label={authStatus === "authenticated" ? "Il tuo account" : "Accedi"}
              className="flex items-center gap-2 rounded-full border border-stone-200 bg-white py-1 pl-3 pr-1 text-sm font-bold text-stone-800 transition hover:border-stone-300"
              onClick={() => (authStatus === "authenticated" ? setAccountMenuOpen((state) => !state) : setShowAuthOverlay(true))}
              type="button"
            >
              {authStatus === "authenticated" && customer ? customer.first_name : "Accedi"}
              {authStatus === "authenticated" && customer ? (
                <CustomerAvatar
                  borderColor={primary}
                  name={customer.full_name}
                  seed={customerAvatarSeed(customer)}
                />
              ) : (
                <CustomerAvatar
                  borderColor={primary}
                  name="Ospite"
                  seed={guestAvatarSeed}
                />
              )}
            </button>
            {accountMenuOpen && customer && (
              <div className="animate-pop absolute right-0 top-[calc(100%+8px)] z-20 w-60 origin-top-right rounded-2xl border border-stone-200 bg-white p-3 text-left shadow-[0_12px_32px_rgb(21_20_15_/_0.12)]">
                <p className="truncate text-sm font-black text-stone-900">{customer.full_name}</p>
                <p className="truncate text-xs text-stone-500">{customer.phone}</p>
                {pushSupported && profile?.pwa?.pushPublicKey && (
                  <button
                    className="mt-3 flex w-full items-center gap-2 rounded-xl bg-stone-100 px-3 py-2 text-left text-sm font-bold text-stone-700 disabled:opacity-60"
                    disabled={pushBusy}
                    onClick={() => void togglePush()}
                    type="button"
                  >
                    {pushSubscribed ? <Bell className="size-4 shrink-0" /> : <BellOff className="size-4 shrink-0" />}
                    <span className="min-w-0 flex-1 truncate">{pushSubscribed ? "Notifiche push attive" : "Attiva notifiche push"}</span>
                  </button>
                )}
                <button
                  className="mt-2 flex w-full items-center gap-2 rounded-xl bg-stone-100 px-3 py-2 text-sm font-bold text-stone-700"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    void logout();
                  }}
                  type="button"
                >
                  <LogOut className="size-4" />Esci
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="lg:mt-6 lg:grid lg:grid-cols-[360px_1fr] lg:items-start lg:gap-10">
        <div className="lg:col-start-1">
        <div className="mt-5 flex items-center justify-between gap-3.5">
          <div className="flex min-w-0 items-center gap-3.5">
            {brand?.logoUrl
              ? <img alt="Logo salone" className="size-12 shrink-0 rounded-2xl border border-stone-200 object-cover" src={brand.logoUrl} />
              : <span className="grid size-12 shrink-0 place-items-center rounded-2xl" style={{ background: primary }}><img alt="EsseBeauty" className="h-9 w-auto brightness-0 invert" src="/esse-logo.svg" /></span>}
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-stone-950">{profile?.salon.name}</p>
              {Boolean(reviews?.average_rating) && (
                <p className="mt-0.5 flex items-center gap-1 text-sm">
                  <Star className="size-[13px] fill-current" style={{ color: "#b8862e" }} />
                  <span className="font-black text-stone-950">{reviews!.average_rating!.toLocaleString("it-IT")}</span>
                  <span className="text-stone-400">({reviews!.total})</span>
                </p>
              )}
            </div>
          </div>
          {openingHours && (
            <div className="relative shrink-0 lg:hidden">
              <button aria-expanded={hoursOpen} aria-label="Orari di apertura" className="grid size-10 place-items-center rounded-full border border-stone-200 bg-white text-stone-700" onClick={() => setHoursOpen((state) => !state)} type="button">
                <Clock className="size-[18px]" />
              </button>
              {hoursOpen && (
                <div className="animate-pop absolute right-0 top-[calc(100%+8px)] z-20 w-[19rem] max-w-[calc(100vw-2.5rem)] origin-top-right rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-[0_12px_32px_rgb(21_20_15_/_0.12)]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-[.14em] text-stone-400">Orari</p>
                    {hoursStatusBadge()}
                  </div>
                  {hoursList()}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 px-0.5">
          {authStatus === "authenticated" && customer && <p className="text-base font-black" style={{ color: primary }}>Ciao, {customer.first_name}</p>}
          <h1 className={`text-[1.7rem] font-bold leading-tight text-stone-950 ${authStatus === "authenticated" && customer ? "mt-0.5" : ""}`}>{brand?.heroTitle || "Prenota il tuo prossimo trattamento"}</h1>
          <p className="mt-2 text-sm leading-6 text-stone-500">{brand?.heroSubtitle || "Il tuo spazio per prenderti cura di te, con la libertà di prenotare quando vuoi."}</p>
        </div>

        {openingHours && (
          <div className="mt-5 hidden rounded-3xl border border-stone-200 bg-white p-5 lg:block">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.14em] text-stone-400"><Clock className="size-4" />Orari</p>
              {hoursStatusBadge()}
            </div>
            <div className="mt-3">{hoursList()}</div>
          </div>
        )}

        {brand?.welcomeText && <p className="mt-5 rounded-3xl border border-stone-200 bg-white p-5 text-sm leading-6 text-stone-600">{brand.welcomeText}</p>}
        <InstallAppButton enabled={brand?.installPromptEnabled !== false} primary={primary} />

        {authStatus === "authenticated" && pushSupported && profile?.pwa?.pushPublicKey && !pushSubscribed && !pushPromptDismissed && (
          <div className="animate-reveal mt-5 flex items-start gap-3 rounded-3xl border border-stone-200 bg-white p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: primary }}><Bell className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-stone-950">Attiva le notifiche push</p>
              <p className="mt-0.5 text-xs leading-5 text-stone-500">Sii avvisato subito su conferme, spostamenti e cambi di operatore.</p>
              <div className="mt-3 flex gap-2">
                <button className="min-h-9 rounded-full px-4 text-xs font-black text-white disabled:opacity-60" disabled={pushBusy} onClick={() => void togglePush()} style={{ background: primary }} type="button">{pushBusy ? "Un momento..." : "Attiva"}</button>
                <button className="min-h-9 rounded-full px-4 text-xs font-black text-stone-500" onClick={dismissPushPrompt} type="button">Non ora</button>
              </div>
            </div>
          </div>
        )}
        </div>

        <div className="lg:col-start-2">
        <nav className="mt-6 grid grid-cols-2 rounded-full border border-stone-200 bg-white p-1 text-sm font-black lg:max-w-xs">
          {[
            ["overview", "Overview"],
            ["reviews", "Recensioni"],
          ].map(([value, label]) => (
            <button aria-pressed={activeTab === value} className={`min-h-11 rounded-full transition ${activeTab === value ? "text-white" : "text-stone-500"}`} key={value} onClick={() => setActiveTab(value as "overview" | "reviews")} style={activeTab === value ? { background: primary } : undefined} type="button">{label}</button>
          ))}
        </nav>

        {activeTab === "overview" && <>
          <section className="mt-5 grid grid-cols-2 gap-3">
            <Link className="group flex min-h-[92px] flex-col items-start justify-between rounded-3xl p-4 text-white transition hover:-translate-y-0.5" href={`/${slug}/book`} style={{ background: primary }}>
              <span className="whitespace-nowrap text-[15px] font-bold leading-tight">Prenota ora</span>
              <ArrowRight className="size-5 transition group-hover:translate-x-1" />
            </Link>
            <Link className="group flex min-h-[92px] flex-col items-start justify-between rounded-3xl border border-stone-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-stone-300" href={`/${slug}/appointments`}>
              <span className="text-[15px] font-bold leading-tight text-stone-950">I tuoi appuntamenti</span>
              <ArrowRight className="size-5 transition group-hover:translate-x-1" style={{ color: primary }} />
            </Link>
          </section>

          <section className="mt-7">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em]" style={{ color: primary }}><Sparkles className="size-4" />Da dove vuoi iniziare?</p>
            <h2 className="mt-2 text-2xl font-bold text-stone-950">Scegli un trattamento</h2>
            <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible">
              {categories.map((category) => (
                <Link
                  className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm font-bold text-stone-800 transition hover:border-stone-300"
                  href={`/${slug}/book?category=${encodeURIComponent(category.name)}`}
                  key={category.id}
                >
                  <span style={{ color: primary }}><ServiceCategoryIcon className="size-4" name={category.icon} /></span>
                  {category.name}
                </Link>
              ))}
            </div>
          </section>
        </>}

        {activeTab === "reviews" && <section className="mt-6">
          <div className="rounded-3xl border border-stone-200 bg-white p-5">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em]" style={{ color: primary }}><Star className="size-4 fill-current" />Recensioni clienti</p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <h2 className="min-w-0 text-2xl font-bold text-stone-950">Cosa dicono del salone</h2>
              {reviews?.average_rating && <span className="shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-black text-white" style={{ background: primary }}>{reviews.average_rating.toLocaleString("it-IT")} ★</span>}
            </div>
          </div>
          {reviewsStatus === "loading" && <p className="mt-4 rounded-3xl border border-stone-200 bg-white p-5 text-sm font-bold text-stone-500">Caricamento recensioni...</p>}
          {reviewsStatus === "failed" && <p className="mt-4 rounded-3xl bg-rose-50 p-5 text-sm font-bold text-rose-700">Recensioni non disponibili.</p>}
          {reviewsStatus === "ready" && reviews?.items.length === 0 && <p className="mt-4 rounded-3xl border border-stone-200 bg-white p-5 text-sm leading-6 text-stone-500">Le recensioni pubbliche compariranno qui appena il salone le renderà visibili.</p>}
          {reviewsStatus === "ready" && Boolean(reviews?.items.length) && <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {reviews?.items.map((item) => (
              <article className="rounded-3xl border border-stone-200 bg-white p-5" key={item.id}>
                <div className="flex items-start justify-between gap-4">
                  <div><h3 className="font-black text-stone-950">{displayName(item.customer_name)}</h3><p className="mt-1 text-xs font-semibold text-stone-400">{new Date(item.created_at).toLocaleDateString("it-IT", { dateStyle: "medium" })}</p></div>
                  <span className="whitespace-nowrap text-sm font-black" style={{ color: primary }}>{"★".repeat(item.rating)}<span className="text-stone-200">{"★".repeat(5 - item.rating)}</span></span>
                </div>
                {item.comment && <p className="mt-4 text-sm leading-6 text-stone-600">{item.comment}</p>}
                {item.reply && <p className="mt-4 rounded-2xl p-4 text-sm leading-6" style={{ background: `${primary}10`, color: primary }}><strong>Risposta del salone</strong><br />{item.reply}</p>}
              </article>
            ))}
          </div>}
        </section>}
        </div>
        </div>
      </div>
      <AnimatePresence>
        {showAuthOverlay && <CustomerAuthOverlay accent={accent} onClose={() => setShowAuthOverlay(false)} primary={primary} salonName={profile?.salon.name} />}
      </AnimatePresence>
      <AnimatePresence>
        {messagesOpen && (
          <motion.section
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-40 flex flex-col bg-[#faf8f4]"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-4">
              <h2 className="text-lg font-bold text-stone-950">Notifiche</h2>
              <button aria-label="Chiudi notifiche" className="grid size-10 place-items-center rounded-full border border-stone-200 bg-white text-stone-700" onClick={() => setMessagesOpen(false)} type="button">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {messagesStatus === "loading" && <p className="text-sm font-semibold text-stone-500">Caricamento...</p>}
              {messagesStatus === "failed" && <p className="text-sm font-semibold text-rose-700">Notifiche non disponibili.</p>}
              {messagesStatus === "ready" && messages.length === 0 && <p className="text-sm font-semibold text-stone-500">Nessuna notifica ricevuta.</p>}
              {messagesStatus === "ready" && messages.length > 0 && (
                <div className="space-y-2">
                  {messages.map((message) => (
                    <Link className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-white p-3 transition hover:border-stone-300" href={`/${slug}/messages/${message.id}`} key={message.id} onClick={() => setMessagesOpen(false)}>
                      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full text-white" style={{ background: message.read_at ? "#a8a29e" : primary }}><Bell className="size-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black text-stone-950">{message.title}</span>
                        <span className="mt-0.5 line-clamp-2 text-xs leading-5 text-stone-500">{message.body}</span>
                        <span className="mt-1 block text-[11px] font-bold text-stone-400">{new Date(message.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <NoticeModal message={toast} onClose={() => setToast("")} primary={primary} />}
      </AnimatePresence>
    </main>
  );
}
