"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, Phone, Save, Undo2, UserCheck, UserX, X } from "lucide-react";

import { APPOINTMENT_STATUS_PALETTE, appointmentStatusLabel, formatPrice, PERMISSION_KEYS } from "@esse-beauty/shared";
import { Button, EmptyState, InlineError, SaveToast, StatusBadge } from "@esse-beauty/ui";

import { staffRequest } from "../../../lib/staff-auth";
import { dayLabel, durationLabel, time } from "../../../lib/format";
import type { Appointment } from "../../../lib/types";
import { Surface } from "../../_components/Surface";
import { useStaffAuth } from "../../_components/StaffAuthProvider";

function wideRangeParams() {
  const from = new Date();
  from.setDate(from.getDate() - 30);
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  to.setDate(to.getDate() + 120);
  return new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
}

export default function AppointmentDetailPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const { session } = useStaffAuth();
  const router = useRouter();
  const [appointment, setAppointment] = useState<Appointment>();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const permissionSet = new Set(session?.permissions ?? []);
  const canManageAgenda = permissionSet.has(PERMISSION_KEYS.CALENDAR_MANAGE_OWN);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    void staffRequest<Appointment[]>(`/api/staff-app/appointments?${wideRangeParams()}`)
      .then((rows) => {
        const found = rows.find((item) => item.id === appointmentId);
        if (!found) {
          setNotFound(true);
          return;
        }
        setAppointment(found);
        setNotes(found.notes ?? "");
      })
      .catch(() => setError("Appuntamento non disponibile."))
      .finally(() => setLoading(false));
  }, [session, appointmentId]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [message]);

  async function setStatus(status: "confirmed" | "cancelled" | "no_show") {
    if (!appointment) return;
    try {
      await staffRequest(`/api/staff-app/appointments/${appointment.id}/status`, { body: JSON.stringify({ status }), method: "PATCH" });
      setAppointment({ ...appointment, status });
      setMessage("Appuntamento aggiornato.");
    } catch {
      setError("Non puoi aggiornare questo appuntamento.");
    }
  }

  async function saveNotes() {
    if (!appointment) return;
    try {
      const updated = await staffRequest<{ id: string; notes: string | null }>(`/api/staff-app/appointments/${appointment.id}/notes`, { body: JSON.stringify({ notes }), method: "PATCH" });
      setAppointment({ ...appointment, notes: updated.notes });
      setMessage("Note interne salvate.");
    } catch {
      setError("Le note non sono state salvate.");
    }
  }

  if (!session) return null;

  return (
    <main className="mx-auto max-w-md lg:max-w-2xl">
      <SaveToast visible={Boolean(message)}>{message}</SaveToast>
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur-xl lg:mt-8 lg:rounded-t-3xl lg:border">
        <button className="flex min-h-11 items-center gap-2 font-bold text-[#792f59]" onClick={() => router.push("/agenda")} type="button"><ChevronLeft className="size-5" /> Agenda</button>
      </header>
      <div className="space-y-4 p-4 lg:rounded-b-3xl lg:border lg:border-t-0 lg:border-stone-200 lg:p-8">
        {error && <InlineError>{error}</InlineError>}
        {loading ? (
          <div className="h-64 animate-pulse rounded-3xl bg-stone-100" />
        ) : notFound || !appointment ? (
          <Surface><EmptyState title="Appuntamento non trovato" description="Potrebbe essere stato spostato o non è più nella tua agenda." /></Surface>
        ) : (
          <>
            <Surface className="relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: session.staff.color }} />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-black uppercase tracking-[.15em] text-[#792f59]">{dayLabel(appointment.starts_at)} · {time(appointment.starts_at)}-{time(appointment.ends_at)}</p>
                    <span className="rounded-full bg-[#faf3f7] px-2.5 py-0.5 text-[10px] font-black text-[#792f59]">{durationLabel(appointment.starts_at, appointment.ends_at)}</span>
                  </div>
                  <h1 className="mt-3 text-3xl font-bold leading-tight tracking-[-.02em] text-stone-950">{appointment.service_name}</h1>
                  <p className="mt-2 text-lg font-semibold text-stone-600">{appointment.customer_name}</p>
                </div>
                <StatusBadge status={appointment.status}>{appointmentStatusLabel(appointment.status)}</StatusBadge>
              </div>
              {typeof appointment.service_price_cents === "number" && (
                <p className="mt-4 border-t border-stone-100 pt-3 text-sm font-bold text-stone-500">{formatPrice(appointment.service_price_cents, "it-IT")}</p>
              )}
            </Surface>
            <Surface>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[.15em] text-stone-400">Note cliente</p>
                {appointment.customer_phone && (
                  <a className="flex items-center gap-1.5 rounded-full bg-[#faf3f7] px-3 py-1.5 text-xs font-black text-[#792f59]" href={`tel:${appointment.customer_phone}`}>
                    <Phone className="size-3.5" />Chiama
                  </a>
                )}
              </div>
              <p className="mt-3 text-sm leading-6 text-stone-700">{appointment.customer_notes || "Nessuna nota cliente."}</p>
            </Surface>
            <Surface>
              <p className="text-xs font-black uppercase tracking-[.15em] text-stone-400">Note interne</p>
              <textarea aria-label="Note interne appuntamento" className="mt-3" disabled={!canManageAgenda} maxLength={4000} onChange={(event) => setNotes(event.target.value)} placeholder="Indicazioni operative visibili allo staff..." value={notes} />
              <Button className="mt-3 w-full" disabled={!canManageAgenda || notes === (appointment.notes ?? "")} onClick={() => void saveNotes()} size="sm" variant="outline"><Save className="size-4" />Salva note</Button>
            </Surface>
            {appointment.status === "pending" && (
              <div className="sticky bottom-4 grid grid-cols-2 gap-2 rounded-3xl border border-stone-200 bg-white p-2 shadow-[0_20px_60px_rgb(45_29_39_/_0.18)]">
                <Button disabled={!canManageAgenda} onClick={() => void setStatus("confirmed")} size="sm" variant="primary"><UserCheck className="size-4" />Conferma</Button>
                <Button disabled={!canManageAgenda} onClick={() => void setStatus("cancelled")} size="sm" variant="outline"><X className="size-4" />Annulla</Button>
              </div>
            )}
            {appointment.status === "confirmed" && (
              <div className="sticky bottom-4 rounded-3xl border border-stone-200 bg-white p-2 shadow-[0_20px_60px_rgb(45_29_39_/_0.18)]">
                <Button className="w-full" disabled={!canManageAgenda} onClick={() => void setStatus("no_show")} size="sm" variant="outline"><UserX className="size-4" />Segna no-show</Button>
              </div>
            )}
            {appointment.status === "no_show" && (
              <div className="sticky bottom-4 rounded-3xl border border-stone-200 bg-white p-2 shadow-[0_20px_60px_rgb(45_29_39_/_0.18)]">
                <Button className="w-full" disabled={!canManageAgenda} onClick={() => void setStatus("confirmed")} size="sm" variant="outline"><Undo2 className="size-4" />Annulla no-show</Button>
              </div>
            )}
            {(appointment.status === "completed" || appointment.status === "cancelled") && (
              <div className="sticky bottom-4 rounded-3xl border border-stone-200 bg-white p-3 text-center text-xs font-bold text-stone-400 shadow-[0_20px_60px_rgb(45_29_39_/_0.18)]">
                Appuntamento concluso.
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
