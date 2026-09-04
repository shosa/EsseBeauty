"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bell, BellOff, CalendarClock, ChevronDown, Lock, RefreshCw, Trash2, UserRound } from "lucide-react";
import { appointmentStatusLabel } from "@esse-beauty/shared";

import { apiBaseUrl } from "../../../lib/api";
import type { SalonClosure } from "../../../lib/salon-closures";
import { NoticeModal } from "../../_components/NoticeModal";
import { CustomerAuthOverlay } from "../_components/CustomerAuthOverlay";
import { useCustomerAuth } from "../_components/CustomerAuthProvider";
import { getExistingPushSubscription, isPushSupported, subscribeToPush, unsubscribeFromPush } from "../_components/push-notifications";
import { RescheduleWizard } from "../_components/RescheduleWizard";

interface Branding { accentColor?: string; primaryColor?: string; }
interface Profile {
  branding?: Branding | null;
  closures?: SalonClosure[];
  pwa?: { allowCancellation?: boolean; allowReschedule?: boolean; maxAdvanceDays?: number; pushPublicKey?: string | null; requireEmail?: boolean };
  salon: { name: string };
}
interface Item {
  ends_at: string;
  id: string;
  pending_reschedule_requested_starts_at?: string | null;
  service_id: string;
  service_name: string;
  staff_id: string;
  staff_name: string;
  starts_at: string;
  status: string;
}

function isPastAppointment(item: Item): boolean {
  return item.status === "completed" || item.status === "no_show" || item.status === "cancelled" || new Date(item.ends_at) <= new Date();
}

export default function AppointmentsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { status: authStatus } = useCustomerAuth();
  const reduceMotion = useReducedMotion();
  const [items, setItems] = useState<Item[]>([]);
  const [tab, setTab] = useState<"past" | "upcoming">("upcoming");
  const [profile, setProfile] = useState<Profile>();
  const [openItemId, setOpenItemId] = useState<string>();
  const [rescheduleTarget, setRescheduleTarget] = useState<Item>();
  const [loadedItems, setLoadedItems] = useState(false);
  const [toast, setToast] = useState("");
  const [showAuthOverlay, setShowAuthOverlay] = useState(true);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const primary = profile?.branding?.primaryColor || "#402334";
  const accent = profile?.branding?.accentColor || "#f4d8a8";
  const pushPublicKey = profile?.pwa?.pushPublicKey;

  useEffect(() => {
    void fetch(`${apiBaseUrl()}/api/public/${slug}`).then(async (response) => {
      if (response.ok) setProfile(await response.json());
    });
  }, [slug]);

  async function search() {
    const response = await fetch(`${apiBaseUrl()}/api/public/${slug}/appointments`, { credentials: "include" });
    setItems(response.ok ? await response.json() : []);
    setLoadedItems(true);
  }

  useEffect(() => {
    if (authStatus === "authenticated") void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, slug]);

  useEffect(() => {
    const supported = isPushSupported();
    setPushSupported(supported);
    if (authStatus !== "authenticated" || !supported) return;
    void getExistingPushSubscription().then((subscription) => setPushSubscribed(Boolean(subscription)));
  }, [authStatus]);

  async function togglePush() {
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
      }
    } catch (error) {
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      setToast(`Impossibile aggiornare le notifiche push. (${detail})`);
    } finally {
      setPushBusy(false);
    }
  }

  const upcomingItems = useMemo(
    () => items.filter((item) => !isPastAppointment(item)),
    [items],
  );
  const pastItems = useMemo(
    () => items.filter(isPastAppointment).sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()),
    [items],
  );
  const visibleItems = tab === "upcoming" ? upcomingItems : pastItems;

  async function cancel(appointmentId: string) {
    if (!window.confirm("Vuoi annullare questo appuntamento?")) return;
    const response = await fetch(`${apiBaseUrl()}/api/public/${slug}/appointments/${appointmentId}/cancel`, {
      credentials: "include",
      method: "POST",
    });
    setToast(response.ok ? "Appuntamento annullato." : "Impossibile annullare l'appuntamento.");
    if (response.ok) await search();
  }

  async function submitReschedule(appointmentId: string, requestedStartsAt: string) {
    const response = await fetch(`${apiBaseUrl()}/api/public/${slug}/appointments/${appointmentId}/reschedule-requests`, {
      body: JSON.stringify({ requested_starts_at: requestedStartsAt }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (!response.ok) throw new Error("RESCHEDULE_FAILED");
    const result = await response.json() as { applied?: boolean };
    setToast(result.applied
      ? "Nuovo orario confermato. Il tuo appuntamento è stato aggiornato."
      : "Richiesta di cambio orario inviata: il salone deve ancora confermarla.");
    setRescheduleTarget(undefined);
    await search();
  }

  return (
    <main className="min-h-screen px-4 py-8" style={{ background: `radial-gradient(circle at top left, ${accent}55, transparent 18rem), linear-gradient(180deg,#fffafd,#f6f2f4)` }}>
      <section className="mx-auto max-w-md">
        <header className="rounded-[2.2rem] p-6 text-white shadow-[0_24px_70px_rgb(45_29_39_/_0.16)]" style={{ background: `linear-gradient(135deg, ${primary}, #792f59)` }}>
          <p className="text-xs font-black uppercase tracking-[.24em]" style={{ color: accent }}>{profile?.salon.name ?? "Area cliente"}</p>
          <h1 className="mt-3 text-4xl font-bold">I miei appuntamenti</h1>
          <p className="mt-2 text-sm text-white/75">Consulta le prossime prenotazioni del tuo account.</p>
        </header>
        {authStatus === "authenticated" && pushSupported && pushPublicKey && (
          <button
            className="animate-reveal mt-5 flex w-full items-center gap-3 rounded-2xl border border-white/80 bg-white/86 p-4 text-left shadow-sm disabled:opacity-60"
            disabled={pushBusy}
            onClick={() => void togglePush()}
            type="button"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: primary }}>
              {pushSubscribed ? <Bell className="size-5" /> : <BellOff className="size-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black text-stone-950">{pushSubscribed ? "Notifiche push attive" : "Attiva le notifiche push"}</span>
              <span className="mt-0.5 block text-xs text-stone-500">{pushSubscribed ? "Ricevi un avviso quando il salone conferma o modifica un appuntamento." : "Sii avvisato subito su conferme, spostamenti e cambi di operatore."}</span>
            </span>
          </button>
        )}
        {authStatus === "authenticated" && (
          <div className="mt-5 flex gap-2" role="tablist">
            <button aria-selected={tab === "upcoming"} className={`min-h-11 flex-1 rounded-full border px-4 text-sm font-bold ${tab === "upcoming" ? "text-white" : "border-stone-200 bg-white text-stone-700"}`} onClick={() => setTab("upcoming")} role="tab" style={tab === "upcoming" ? { background: primary, borderColor: primary } : undefined} type="button">Prossimi ({upcomingItems.length})</button>
            <button aria-selected={tab === "past"} className={`min-h-11 flex-1 rounded-full border px-4 text-sm font-bold ${tab === "past" ? "text-white" : "border-stone-200 bg-white text-stone-700"}`} onClick={() => setTab("past")} role="tab" style={tab === "past" ? { background: primary, borderColor: primary } : undefined} type="button">Passati ({pastItems.length})</button>
          </div>
        )}
        {authStatus === "authenticated" && (
          <div className="mt-3 space-y-3">
            {visibleItems.map((item, index) => {
              const isOpen = openItemId === item.id;
              const isPast = isPastAppointment(item);
              const isPending = item.status === "pending";
              const isCancelled = item.status === "cancelled";
              const startDate = new Date(item.starts_at);
              return (
                <article className="animate-reveal overflow-hidden rounded-[1.7rem] border border-white/80 bg-white/86 shadow-sm" key={item.id} style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}>
                  <button className="flex w-full items-center justify-between gap-3 p-5 text-left" onClick={() => setOpenItemId(isOpen ? undefined : item.id)} type="button">
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-black" style={{ color: primary }}><CalendarClock className="size-4 shrink-0" />{startDate.toLocaleString("it-IT", { dateStyle: "full", timeStyle: "short" })}</span>
                      <span className="mt-1 block truncate text-sm font-bold text-stone-600">{item.service_name}</span>
                      {isPending && <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-800">Da confermare</span>}
                      {isCancelled && <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-black text-red-700">Annullato</span>}
                      {item.pending_reschedule_requested_starts_at && <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-800">In attesa di conferma nuovo orario</span>}
                    </span>
                    <ChevronDown className={`size-4 shrink-0 text-stone-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        animate={{ height: "auto", opacity: 1 }}
                        className="overflow-hidden"
                        exit={{ height: 0, opacity: 0 }}
                        initial={{ height: 0, opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0.12 : 0.28, ease: [0.22, 0.9, 0.28, 1] }}
                      >
                        <div className="border-t border-stone-100 px-5 pb-5 pt-4">
                          <h2 className="text-xl font-black text-stone-950">{item.service_name}</h2>
                          <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-500"><UserRound className="size-4" />con {item.staff_name} · {appointmentStatusLabel(item.status)}</p>
                          {isPending && (
                            <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">Il salone deve ancora confermare questo appuntamento. Finché è in attesa non puoi modificarlo: riceverai un avviso appena verrà confermato.</p>
                          )}
                          {item.pending_reschedule_requested_starts_at && (
                            <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">Hai richiesto di spostare l’appuntamento a {new Date(item.pending_reschedule_requested_starts_at).toLocaleString("it-IT", { dateStyle: "full", timeStyle: "short" })}. Il salone deve ancora confermarlo.</p>
                          )}
                          {!isPast && !isPending && (profile?.pwa?.allowReschedule !== false || profile?.pwa?.allowCancellation !== false) && (
                            <div className="mt-4 grid grid-cols-2 gap-2">
                              {profile?.pwa?.allowReschedule !== false && <button className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-stone-50 px-3 text-xs font-black text-stone-700 transition-colors hover:bg-stone-100" onClick={() => setRescheduleTarget(item)} type="button"><RefreshCw className="size-4" />Riprogramma</button>}
                              {profile?.pwa?.allowCancellation !== false && <button className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-red-50 px-3 text-xs font-black text-red-700 transition-colors hover:bg-red-100" onClick={() => void cancel(item.id)} type="button"><Trash2 className="size-4" />Annulla</button>}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </article>
              );
            })}
            {loadedItems && visibleItems.length === 0 && (
              <p className="animate-reveal rounded-[1.7rem] bg-white/86 p-5 text-sm font-semibold text-stone-600 shadow-sm">
                {tab === "upcoming" ? "Nessun appuntamento futuro trovato per il tuo account." : "Nessun appuntamento passato trovato per il tuo account."}
              </p>
            )}
          </div>
        )}
        {authStatus === "anonymous" && (
          <div className="animate-reveal mt-5 rounded-[1.7rem] border border-white/80 bg-white/86 p-6 text-center shadow-sm">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl text-white" style={{ background: primary }}><Lock className="size-5" /></span>
            <h2 className="mt-4 text-lg font-black text-stone-950">Accedi per vedere i tuoi appuntamenti</h2>
            <p className="mt-1 text-sm leading-5 text-stone-500">Accedi con il tuo numero di telefono, oppure registrati se non hai ancora un account.</p>
            <button className="mt-5 min-h-12 w-full rounded-2xl font-black text-white" onClick={() => setShowAuthOverlay(true)} style={{ background: primary }} type="button">Accedi o registrati</button>
          </div>
        )}
      </section>
      <AnimatePresence>
        {authStatus === "anonymous" && showAuthOverlay && (
          <CustomerAuthOverlay accent={accent} onClose={() => setShowAuthOverlay(false)} primary={primary} requireEmail={profile?.pwa?.requireEmail !== false} salonName={profile?.salon.name} subtitle="Accedi per consultare i tuoi appuntamenti, oppure registrati se non hai ancora un account." />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {rescheduleTarget && (
          <RescheduleWizard
            accent={accent}
            closures={profile?.closures}
            maxAdvanceDays={profile?.pwa?.maxAdvanceDays ?? 90}
            onClose={() => setRescheduleTarget(undefined)}
            onSubmit={(startsAt) => submitReschedule(rescheduleTarget.id, startsAt)}
            primary={primary}
            serviceId={rescheduleTarget.service_id}
            serviceName={rescheduleTarget.service_name}
            slug={slug}
            staffId={rescheduleTarget.staff_id}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <NoticeModal message={toast} onClose={() => setToast("")} primary={primary} />}
      </AnimatePresence>
    </main>
  );
}
