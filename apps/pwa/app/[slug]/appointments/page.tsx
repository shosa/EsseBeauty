"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarClock, ChevronDown, Lock, RefreshCw, Trash2, UserRound } from "lucide-react";
import { appointmentStatusLabel } from "@esse-beauty/shared";

import { apiBaseUrl } from "../../../lib/api";
import type { SalonClosure } from "../../../lib/salon-closures";
import { NoticeModal } from "../../_components/NoticeModal";
import { CustomerAuthOverlay } from "../_components/CustomerAuthOverlay";
import { useCustomerAuth } from "../_components/CustomerAuthProvider";
import { RescheduleWizard } from "../_components/RescheduleWizard";

interface Branding { accentColor?: string; primaryColor?: string; }
interface Profile {
  branding?: Branding | null;
  closures?: SalonClosure[];
  pwa?: { allowCancellation?: boolean; allowReschedule?: boolean; cancellationPolicyHours?: number; maxAdvanceDays?: number; requireEmail?: boolean };
  salon: { name: string };
  special_openings?: string[];
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
  const primary = profile?.branding?.primaryColor || "#15140f";
  const accent = profile?.branding?.accentColor || "#0e7c59";

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

  const upcomingItems = useMemo(
    () => items.filter((item) => !isPastAppointment(item)),
    [items],
  );
  const pastItems = useMemo(
    () => items.filter(isPastAppointment).sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()),
    [items],
  );
  const visibleItems = tab === "upcoming" ? upcomingItems : pastItems;

  function cancellationFailureMessage(code: string | undefined) {
    switch (code) {
      case "CANCELLATION_DISABLED": return "Il salone ha disattivato la cancellazione online: contattalo direttamente per annullare.";
      case "CANCELLATION_WINDOW_CLOSED": return `Non è più possibile annullare online: mancano meno di ${profile?.pwa?.cancellationPolicyHours ?? 24} ore all'appuntamento. Contatta il salone.`;
      case "APPOINTMENT_NOT_FOUND": return "Appuntamento non trovato: potrebbe essere già stato annullato.";
      case "CUSTOMER_IDENTIFICATION_REQUIRED": return "Non è stato possibile verificarti: esci e accedi di nuovo, poi riprova.";
      default: return "Impossibile annullare l'appuntamento. Riprova più tardi o contatta il salone.";
    }
  }

  async function cancel(appointmentId: string) {
    if (!window.confirm("Vuoi annullare questo appuntamento?")) return;
    const response = await fetch(`${apiBaseUrl()}/api/public/${slug}/appointments/${appointmentId}/cancel`, {
      credentials: "include",
      method: "POST",
    });
    if (response.ok) {
      setToast("Appuntamento annullato.");
      await search();
      return;
    }
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setToast(cancellationFailureMessage(payload.error));
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
    <main className="min-h-screen bg-[#faf8f4] px-4 py-8 lg:px-10 lg:py-10">
      <section className="mx-auto max-w-md lg:max-w-4xl">
        <header>
          <p className="text-xs font-black uppercase tracking-[.24em]" style={{ color: primary }}>{profile?.salon.name ?? "Area cliente"}</p>
          <h1 className="mt-2 text-[1.7rem] font-bold text-stone-950">I tuoi appuntamenti</h1>
          <p className="mt-2 text-sm text-stone-500">Consulta le prossime prenotazioni del tuo account.</p>
        </header>
        {authStatus === "authenticated" && (
          <div className="mt-5 flex gap-2 lg:max-w-xs" role="tablist">
            <button aria-selected={tab === "upcoming"} className={`min-h-11 flex-1 rounded-full border px-4 text-sm font-bold ${tab === "upcoming" ? "text-white" : "border-stone-200 bg-white text-stone-700"}`} onClick={() => setTab("upcoming")} role="tab" style={tab === "upcoming" ? { background: primary, borderColor: primary } : undefined} type="button">Prossimi ({upcomingItems.length})</button>
            <button aria-selected={tab === "past"} className={`min-h-11 flex-1 rounded-full border px-4 text-sm font-bold ${tab === "past" ? "text-white" : "border-stone-200 bg-white text-stone-700"}`} onClick={() => setTab("past")} role="tab" style={tab === "past" ? { background: primary, borderColor: primary } : undefined} type="button">Passati ({pastItems.length})</button>
          </div>
        )}
        {authStatus === "authenticated" && (
          <div className="mt-3 space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
            {visibleItems.map((item, index) => {
              const isOpen = openItemId === item.id;
              const isPast = isPastAppointment(item);
              const isPending = item.status === "pending";
              const isCancelled = item.status === "cancelled";
              const startDate = new Date(item.starts_at);
              return (
                <article className="animate-reveal overflow-hidden rounded-3xl border border-stone-200 bg-white" key={item.id} style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}>
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
                              {profile?.pwa?.allowReschedule !== false && <button className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-3 text-xs font-black text-stone-700 transition-colors hover:bg-stone-50" onClick={() => setRescheduleTarget(item)} type="button"><RefreshCw className="size-4" />Riprogramma</button>}
                              {profile?.pwa?.allowCancellation !== false && <button className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 text-xs font-black text-red-700 transition-colors hover:bg-red-100" onClick={() => void cancel(item.id)} type="button"><Trash2 className="size-4" />Annulla</button>}
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
              <p className="animate-reveal rounded-3xl border border-stone-200 bg-white p-5 text-sm font-semibold text-stone-600">
                {tab === "upcoming" ? "Nessun appuntamento futuro trovato per il tuo account." : "Nessun appuntamento passato trovato per il tuo account."}
              </p>
            )}
          </div>
        )}
        {authStatus === "anonymous" && (
          <div className="animate-reveal mt-5 rounded-3xl border border-stone-200 bg-white p-6 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl text-white" style={{ background: primary }}><Lock className="size-5" /></span>
            <h2 className="mt-4 text-lg font-black text-stone-950">Accedi per vedere i tuoi appuntamenti</h2>
            <p className="mt-1 text-sm leading-5 text-stone-500">Accedi con il tuo numero di telefono, oppure registrati se non hai ancora un account.</p>
            <button className="mt-5 min-h-12 w-full rounded-full font-black text-white" onClick={() => setShowAuthOverlay(true)} style={{ background: primary }} type="button">Accedi o registrati</button>
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
            closures={profile?.closures}
            maxAdvanceDays={profile?.pwa?.maxAdvanceDays ?? 90}
            onClose={() => setRescheduleTarget(undefined)}
            onSubmit={(startsAt) => submitReschedule(rescheduleTarget.id, startsAt)}
            primary={primary}
            serviceId={rescheduleTarget.service_id}
            serviceName={rescheduleTarget.service_name}
            slug={slug}
            specialOpenings={profile?.special_openings}
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
