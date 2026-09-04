"use client";

import { useEffect, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { apiBaseUrl } from "../../../lib/api";
import { isDateClosed, type SalonClosure } from "../../../lib/salon-closures";
import { DateField } from "../../_components/DateField";

interface Slot {
  available: boolean;
  starts_at: string;
}

interface Props {
  accent: string;
  closures?: SalonClosure[];
  maxAdvanceDays: number;
  onClose: () => void;
  onSubmit: (startsAt: string) => Promise<void>;
  primary: string;
  serviceId: string;
  serviceName: string;
  slug: string;
  staffId: string;
}

function formatDateSummary(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "long", weekday: "long" });
}

function formatTimeSummary(value: string) {
  return new Date(value).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export function RescheduleWizard({ accent, closures, maxAdvanceDays, onClose, onSubmit, primary, serviceId, serviceName, slug, staffId }: Props) {
  const reduceMotion = useReducedMotion();
  const [date, setDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [openSection, setOpenSection] = useState<"date" | "time">("date");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [dayClosed, setDayClosed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoadingSlots(true);
    setError("");
    const query = new URLSearchParams({ date, serviceId, staffId });
    void fetch(`${apiBaseUrl()}/api/public/${slug}/slots?${query}`).then(async (response) => {
      if (cancelled) return;
      setLoadingSlots(false);
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
  }, [date, serviceId, slug, staffId]);

  async function confirm() {
    if (!startsAt) return;
    setSubmitting(true);
    setError("");
    try {
      await onSubmit(startsAt);
    } catch {
      setError("Impossibile inviare la richiesta. Riprova.");
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-40 grid place-items-end bg-[#2d1d27]/55 p-3 backdrop-blur-sm sm:place-items-center"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}
      transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: "easeOut" }}
    >
      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[2.2rem] p-6 shadow-[0_-24px_70px_rgb(45_29_39_/_0.25)] sm:rounded-[2.2rem] sm:shadow-[0_24px_70px_rgb(45_29_39_/_0.25)]"
        exit={reduceMotion ? { opacity: 0, y: 0 } : { opacity: 0, y: 40 }}
        initial={reduceMotion ? { opacity: 0, y: 0 } : { opacity: 0, y: 40 }}
        style={{ background: `radial-gradient(circle at top left, ${accent}35, transparent 14rem), #fff` }}
        transition={{ duration: reduceMotion ? 0.12 : 0.26, ease: [0.22, 0.9, 0.28, 1] }}
      >
        <button aria-label="Chiudi" className="absolute right-5 top-5 grid size-9 place-items-center rounded-full bg-stone-100 text-stone-500" onClick={onClose} type="button">
          <X className="size-4" />
        </button>
        <h1 className="text-2xl font-bold text-stone-950">Riprogramma appuntamento</h1>
        <p className="mt-1 text-sm text-stone-500">{serviceName} · scegli nuova data e orario in base alla disponibilità.</p>

        <AnimatePresence>
          {error && (
            <motion.p
              animate={{ height: "auto", marginTop: 16, opacity: 1 }}
              className="overflow-hidden rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700"
              exit={{ height: 0, marginTop: 0, opacity: 0 }}
              initial={{ height: 0, marginTop: 0, opacity: 0 }}
              transition={{ duration: reduceMotion ? 0.12 : 0.2, ease: [0.22, 0.9, 0.28, 1] }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="mt-5 space-y-3">
          <div className="rounded-2xl border border-stone-100 bg-white/70 p-4">
            <button className="flex w-full items-center justify-between text-left" onClick={() => setOpenSection(openSection === "date" ? "time" : "date")} type="button">
              <span>
                <span className="block text-sm font-black text-stone-800">Data</span>
                {openSection !== "date" && <span className="mt-0.5 block text-xs font-bold" style={{ color: primary }}>{formatDateSummary(date)}</span>}
              </span>
              <ChevronDown className={`size-4 shrink-0 text-stone-400 transition-transform ${openSection === "date" ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
              {openSection === "date" && (
                <motion.div
                  animate={{ height: "auto", opacity: 1 }}
                  className="overflow-hidden"
                  exit={{ height: 0, opacity: 0 }}
                  initial={{ height: 0, opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0.12 : 0.28, ease: [0.22, 0.9, 0.28, 1] }}
                >
                  <div className="mt-3">
                    <DateField
                      isDateDisabled={(day) => isDateClosed(day, closures)}
                      max={new Date(Date.now() + maxAdvanceDays * 86400000).toISOString().slice(0, 10)}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(nextValue) => { setDate(nextValue); setOpenSection("time"); }}
                      primary={primary}
                      value={date}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="rounded-2xl border border-stone-100 bg-white/70 p-4">
            <button className="flex w-full items-center justify-between text-left" onClick={() => setOpenSection(openSection === "time" ? "date" : "time")} type="button">
              <span>
                <span className="block text-sm font-black text-stone-800">Orario</span>
                {openSection !== "time" && startsAt && <span className="mt-0.5 block text-xs font-bold" style={{ color: primary }}>{formatTimeSummary(startsAt)}</span>}
              </span>
              <ChevronDown className={`size-4 shrink-0 text-stone-400 transition-transform ${openSection === "time" ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
              {openSection === "time" && (
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
                      <p className="rounded-2xl border border-stone-200 bg-stone-50 p-5 text-center text-sm font-bold text-stone-600">Il salone è chiuso in questa data. Scegli un altro giorno.</p>
                    ) : slots.some((slot) => slot.available) ? (
                      <div className="grid grid-cols-3 gap-2">
                        {slots.map((slot) => (
                          <button key={slot.starts_at} disabled={!slot.available} onClick={() => setStartsAt(slot.starts_at)} className={`min-h-12 rounded-2xl border text-sm font-black ${startsAt === slot.starts_at ? "text-white" : slot.available ? "border-stone-100 bg-white text-stone-800" : "border-stone-100 bg-stone-100 text-stone-300 line-through"}`} style={startsAt === slot.starts_at ? { background: primary } : undefined} type="button">
                            {formatTimeSummary(slot.starts_at)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-2xl border border-stone-200 bg-stone-50 p-5 text-center text-sm font-bold text-stone-600">Nessun orario disponibile in questa data.</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <motion.button className="mt-5 min-h-12 w-full rounded-2xl font-black text-white disabled:opacity-40" disabled={!startsAt || submitting} onClick={() => void confirm()} style={{ background: primary }} type="button" whileTap={{ scale: 0.97 }}>
          {submitting ? "Invio richiesta..." : "Invia richiesta di cambio orario"}
        </motion.button>
      </motion.section>
    </motion.div>
  );
}
