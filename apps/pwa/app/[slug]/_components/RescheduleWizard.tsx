"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { apiBaseUrl } from "../../../lib/api";
import { isDateClosed, type SalonClosure } from "../../../lib/salon-closures";
import { DateField } from "../../_components/DateField";

interface Slot {
  available: boolean;
  starts_at: string;
}

interface Props {
  closures?: SalonClosure[];
  maxAdvanceDays: number;
  onClose: () => void;
  onSubmit: (startsAt: string) => Promise<void>;
  primary: string;
  serviceId: string;
  serviceName: string;
  slug: string;
  specialOpenings?: string[];
  staffId: string;
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

export function RescheduleWizard({ closures, maxAdvanceDays, onClose, onSubmit, primary, serviceId, serviceName, slug, specialOpenings, staffId }: Props) {
  const reduceMotion = useReducedMotion();
  const [date, setDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [dayClosed, setDayClosed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const quickDays = useMemo(() => Array.from({ length: QUICK_DAY_COUNT }, (_, index) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + index);
    return day;
  }), []);

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
      className="fixed inset-0 z-40 grid place-items-center bg-[#15140f]/55 p-3 backdrop-blur-sm"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}
      transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: "easeOut" }}
    >
      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="relative flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white"
        exit={reduceMotion ? { opacity: 0, y: 0 } : { opacity: 0, y: 16 }}
        initial={reduceMotion ? { opacity: 0, y: 0 } : { opacity: 0, y: 16 }}
        transition={{ duration: reduceMotion ? 0.12 : 0.26, ease: [0.22, 0.9, 0.28, 1] }}
      >
        <button aria-label="Chiudi" className="absolute right-5 top-5 z-10 grid size-9 place-items-center rounded-full bg-stone-100 text-stone-500" onClick={onClose} type="button">
          <X className="size-4" />
        </button>
        <div className="overflow-y-auto p-6 pb-4">
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

          <div className="mt-5 space-y-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-stone-400">Data e ora</p>
              <div className="mt-2 flex items-center gap-2">
                <p className="flex-1 truncate rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm font-bold capitalize text-stone-800">{formatDateSummary(date)}</p>
                <DateField
                  compact
                  isDateDisabled={(day) => isDateClosed(day, closures, undefined, specialOpenings)}
                  max={new Date(Date.now() + maxAdvanceDays * 86400000).toISOString().slice(0, 10)}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(nextValue) => setDate(nextValue)}
                  primary={primary}
                  value={date}
                />
              </div>
            </div>

            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {quickDays.map((day) => {
                const iso = isoDate(day);
                const closed = isDateClosed(day, closures, undefined, specialOpenings);
                const active = date === iso;
                return (
                  <button
                    className={`flex h-[72px] w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border text-xs font-bold transition ${active ? "text-white" : closed ? "border-stone-100 bg-stone-50 text-stone-300" : "border-stone-200 bg-white text-stone-700"}`}
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
                <p className="rounded-2xl border border-stone-200 bg-stone-50 p-5 text-center text-sm font-bold text-stone-600">Il salone è chiuso in questa data. Scegli un altro giorno.</p>
              ) : slots.some((slot) => slot.available) ? (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((slot) => (
                    <button key={slot.starts_at} disabled={!slot.available} onClick={() => setStartsAt(slot.starts_at)} className={`min-h-12 rounded-2xl border text-sm font-black ${startsAt === slot.starts_at ? "text-white" : slot.available ? "border-stone-200 bg-white text-stone-800" : "border-stone-100 bg-stone-100 text-stone-300 line-through"}`} style={startsAt === slot.starts_at ? { background: primary, borderColor: primary } : undefined} type="button">
                      {formatTimeSummary(slot.starts_at)}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-stone-200 bg-stone-50 p-5 text-center text-sm font-bold text-stone-600">Nessun orario disponibile in questa data.</p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-stone-100 p-6 pt-4">
          <motion.button className="min-h-12 w-full rounded-full font-black text-white disabled:opacity-40" disabled={!startsAt || submitting} onClick={() => void confirm()} style={{ background: primary }} type="button" whileTap={{ scale: 0.97 }}>
            {submitting ? "Invio richiesta..." : "Invia richiesta di cambio orario"}
          </motion.button>
        </div>
      </motion.section>
    </motion.div>
  );
}
