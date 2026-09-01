"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, CheckCheck, ChevronDown, Clock3, EyeOff, Mail, Pencil, Phone, ShoppingBag, Trash2, UserRound, X } from "lucide-react";
import {
  Button,
  ConfirmDialog,
  DateTimeField,
  Dialog,
  EmptyState,
  InlineError,
  PageSkeleton,
  StatusBadge,
} from "@esse-beauty/ui";
import { APPOINTMENT_STATUS_PALETTE, appointmentStatusLabel, nextAppointmentStatuses, type AppointmentStatus } from "@esse-beauty/shared";
import { MODULE_KEYS, useModuleEnabled } from "@esse-beauty/feature-flags";

import { useAuth } from "../../../../lib/auth-context";
import { ConsentRecordsPanel } from "../../settings/documents/_components/ConsentRecordsPanel";
import { DocumentsModuleGate } from "../../settings/documents/_components/DocumentsModuleGate";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

const statusActions: AppointmentStatus[] = ["pending", "confirmed", "no_show", "cancelled"];

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
  if (status === "pending") return <Clock3 aria-hidden="true" size={24} />;
  if (status === "confirmed") return <Check aria-hidden="true" size={24} />;
  if (status === "completed") return <CheckCheck aria-hidden="true" size={24} />;
  if (status === "no_show") return <EyeOff aria-hidden="true" size={24} />;
  return <X aria-hidden="true" size={24} />;
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
  status: AppointmentStatus;
}

interface AppointmentOverlap {
  customer_name: string;
  ends_at: string;
  id: string;
  service_name: string;
  starts_at: string;
}

interface StaffOption {
  id: string;
  name: string;
}

interface CheckoutResponse {
  appointment: Appointment;
  sale: null | { status: string };
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
  const documentsEnabled = useModuleEnabled(MODULE_KEYS.DOCUMENTS);
  const [data, setData] = useState<CheckoutResponse>();
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [staffUpdating, setStaffUpdating] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingAppointment, setEditingAppointment] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [appointmentDuration, setAppointmentDuration] = useState("60");
  const [appointmentNotes, setAppointmentNotes] = useState("");
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [overlaps, setOverlaps] = useState<AppointmentOverlap[]>([]);
  const [pendingUpdate, setPendingUpdate] = useState<Record<string, unknown>>();

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

    const staffResponse = await fetch(
      `${api}/api/salons/${salon.id}/operations/staff?serviceId=${next.appointment.service_id}&strictAssignments=true`,
      { credentials: "include" },
    );
    const staffRows = staffResponse.ok
      ? await staffResponse.json() as Array<{ display_name: string; id: string }>
      : [];
    setStaffOptions(staffRows.map((item) => ({ id: item.id, name: item.display_name })));

    setAppointmentDate(dateInputValue(next.appointment.starts_at));
    setAppointmentTime(timeInputValue(next.appointment.starts_at));
    setAppointmentDuration(String(minutesBetween(next.appointment.starts_at, next.appointment.ends_at)));
    setAppointmentNotes(next.appointment.notes ?? "");
    setError("");
    setLoading(false);
  }

  useEffect(() => { void load(); }, [salon?.id, appointmentId]);

  const isClosed = data?.sale?.status === "paid";
  const checkoutEnabled = !isClosed && data?.appointment.status === "confirmed";
  const editedEndTime = useMemo(() => {
    const duration = Number(appointmentDuration);
    if (!appointmentDate || !appointmentTime || !Number.isFinite(duration) || duration < 1) return "";
    const end = new Date(`${appointmentDate}T${appointmentTime}`);
    end.setMinutes(end.getMinutes() + duration);
    return end.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  }, [appointmentDate, appointmentDuration, appointmentTime]);

  async function updateAppointment(body: Record<string, unknown>, options: { onDone?(): void } = {}) {
    if (!salon) return;
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/appointments/${appointmentId}`, {
      body: JSON.stringify(body),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    const responseBody = await response.json().catch(() => ({})) as { conflicts?: AppointmentOverlap[]; error?: string };
    if (!response.ok) {
      if (responseBody.error === "APPOINTMENT_OVERLAP_CONFIRMATION_REQUIRED") {
        setOverlaps(responseBody.conflicts ?? []);
        setPendingUpdate(body);
        return false;
      }
      const messages: Record<string, string> = {
        APPOINTMENT_CONFLICT: "Il nuovo orario coincide con un blocco o supera il limite di affiancamento configurato.",
        INVALID_DURATION: "La durata deve essere compresa tra 5 e 720 minuti.",
        PERMISSION_DENIED: "Non hai i permessi per assegnare questo collaboratore.",
        STAFF_NOT_QUALIFIED: "Il collaboratore selezionato non è abilitato per questo servizio.",
      };
      setError(messages[responseBody.error ?? ""] ?? "Appuntamento non aggiornato.");
      return false;
    }
    await load();
    setOverlaps([]);
    setPendingUpdate(undefined);
    onChanged?.();
    options.onDone?.();
    return true;
  }

  async function changeStaff(nextStaffId: string) {
    if (!data || nextStaffId === data.appointment.staff_id) return;

    setStaffUpdating(true);
    await updateAppointment({ staff_id: nextStaffId });
    setStaffUpdating(false);
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
    if (!data || !appointmentDate || !appointmentTime) return;
    const durationMinutes = Number(appointmentDuration);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 720) {
      setError("Inserisci una durata valida, da 5 a 720 minuti.");
      return;
    }
    setSavingAppointment(true);
    const startsAt = new Date(`${appointmentDate}T${appointmentTime}`);
    await updateAppointment({
      duration_minutes: durationMinutes,
      notes: appointmentNotes,
      starts_at: startsAt.toISOString(),
    }, { onDone: () => setEditingAppointment(false) });
    setSavingAppointment(false);
  }

  async function confirmPendingUpdate() {
    if (!pendingUpdate) return;

    setSavingAppointment(true);
    setStaffUpdating(true);
    await updateAppointment(
      { ...pendingUpdate, confirm_overlap: true },
      { onDone: () => setEditingAppointment(false) },
    );
    setSavingAppointment(false);
    setStaffUpdating(false);
  }

  const closeAppointmentEditor = useCallback(() => {
    const current = data?.appointment;
    if (current) {
      setAppointmentDate(dateInputValue(current.starts_at));
      setAppointmentTime(timeInputValue(current.starts_at));
      setAppointmentDuration(String(minutesBetween(current.starts_at, current.ends_at)));
      setAppointmentNotes(current.notes ?? "");
    }
    setEditingAppointment(false);
  }, [data?.appointment]);

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
    setConfirmDelete(false);
    onChanged?.();
    onClose();
  }

  if (loading) return <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white"><div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-5 py-4"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#792f59]">Gestione appuntamento</p><p className="mt-1 text-sm font-bold text-stone-600">Caricamento dettagli…</p></div><button aria-label="Chiudi gestione appuntamento" className="grid size-11 place-items-center rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100" data-appointment-close onClick={onClose} type="button"><X aria-hidden="true" className="size-5" /></button></div><div className="min-h-0 flex-1 overflow-hidden p-6"><PageSkeleton /></div></div>;
  const appointment = data?.appointment;

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#f6f4f2]">
      <Dialog
        footer={
          <>
            <Button onClick={() => setOverlaps([])} variant="outline">Modifica orario</Button>
            <Button disabled={savingAppointment} onClick={() => void confirmPendingUpdate()} variant="primary">
              {savingAppointment ? "Salvataggio..." : "Conferma affiancamento"}
            </Button>
          </>
        }
        onClose={() => setOverlaps([])}
        open={overlaps.length > 0}
        title="Appuntamenti sovrapposti"
      >
        <p className="text-sm leading-6 text-stone-600">
          Confermando, gli appuntamenti verranno mostrati affiancati in agenda.
        </p>
        <div className="mt-5 rounded-xl border border-[#ead1df] bg-[#fffafd] p-4">
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#8f3a68]">Anteprima agenda</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-xl border-l-4 border-[#792f59] bg-white p-3 shadow-sm">
              <p className="text-xs font-bold text-[#792f59]">{appointmentTime}</p>
              <p className="mt-1 truncate text-sm font-bold">{appointment?.customer_name}</p>
              <p className="truncate text-xs text-stone-500">{appointment?.service_name}</p>
            </div>
            <div className="min-w-0 rounded-xl border-l-4 border-amber-500 bg-white p-3 shadow-sm">
              <p className="text-xs font-bold text-amber-700">
                {overlaps[0] && formatTime(overlaps[0].starts_at)}
              </p>
              <p className="mt-1 truncate text-sm font-bold">{overlaps[0]?.customer_name}</p>
              <p className="truncate text-xs text-stone-500">{overlaps[0]?.service_name}</p>
            </div>
          </div>
        </div>
      </Dialog>
      <Dialog
        contained
        footer={<><Button onClick={closeAppointmentEditor} variant="outline">Annulla</Button><Button disabled={savingAppointment} onClick={() => void saveAppointment()} variant="primary">{savingAppointment ? "Salvataggio…" : "Salva modifiche"}</Button></>}
        onClose={closeAppointmentEditor}
        open={editingAppointment && !isClosed}
        title="Modifica appuntamento"
      >
        <p className="text-sm leading-6 text-stone-600">Aggiorna data, orario, durata e note senza modificare il servizio a catalogo.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_130px]">
          <div className="min-w-0"><p className="text-xs font-bold text-stone-600">Data e ora</p><DateTimeField aria-label="Data e ora dell’appuntamento" className="mt-2" onChange={(value) => { setAppointmentDate(value.slice(0, 10)); setAppointmentTime(value.slice(11, 16)); }} required step={300} value={`${appointmentDate}T${appointmentTime}`} /></div>
          <label className="text-xs font-bold text-stone-600">Durata<input className="mt-2 w-full" max={720} min={5} onChange={(event) => setAppointmentDuration(event.target.value)} step={5} type="number" value={appointmentDuration} />{editedEndTime && <span className="mt-1.5 block text-[11px] font-semibold text-stone-500">Termina alle {editedEndTime}</span>}</label>
          <label className="text-xs font-bold text-stone-600 sm:col-span-2">Note<textarea className="mt-2 min-h-24 w-full resize-y" onChange={(event) => setAppointmentNotes(event.target.value)} value={appointmentNotes} /></label>
        </div>
      </Dialog>
      <header className="z-30 shrink-0 border-b border-stone-200 bg-white px-4 py-4 sm:px-6 lg:px-7">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <Link aria-label={appointment ? `Apri anagrafica di ${appointment.customer_name}` : "Appuntamento"} className="grid size-12 shrink-0 place-items-center rounded-full bg-[#f3e2eb] text-sm font-black text-[#792f59]" href={appointment ? `/clients/${appointment.customer_id}` : "/clients"}>{appointment ? initials(appointment.customer_name) : "—"}</Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#792f59]">Gestione appuntamento</p>{appointment && <StatusBadge status={appointment.status} />}{isClosed && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-800">Conto chiuso</span>}</div>
            <h1 className="mt-1 truncate text-xl font-black tracking-tight text-stone-950 sm:text-2xl">{appointment?.customer_name ?? "Appuntamento"}</h1>
            {appointment && <p className="mt-1 truncate text-xs font-semibold text-stone-500 sm:text-sm">{appointment.service_name} · {formatDate(appointment.starts_at)} · {formatTime(appointment.starts_at)}–{formatTime(appointment.ends_at)}</p>}
          </div>
          {appointment && !isClosed && <Button className="hidden sm:inline-flex" onClick={() => setEditingAppointment(true)} size="sm" variant="secondary"><Pencil aria-hidden="true" className="size-4" />Modifica</Button>}
          <button aria-label="Chiudi gestione appuntamento" className="grid size-11 shrink-0 place-items-center rounded-xl border border-stone-200 bg-white text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20" data-appointment-close onClick={onClose} title="Chiudi" type="button"><X aria-hidden="true" className="size-5" /></button>
        </div>
        {appointment && <div className="mt-4 flex min-w-0 items-center gap-2">
          <span className="mr-1 shrink-0 text-[10px] font-black uppercase tracking-[.14em] text-stone-400">Stato</span>
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1">{statusActions.map((status) => {
              const active = appointment.status === status;
              const palette = statusActionPalette(status, active);
              return <button aria-pressed={active} className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20 disabled:cursor-not-allowed ${active ? "shadow-sm disabled:opacity-100" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50 disabled:opacity-35"}`} disabled={isClosed || statusUpdating || active || !nextAppointmentStatuses(appointment.status).includes(status)} key={status} onClick={() => void updateStatus(status)} style={active ? { background: palette?.background, borderColor: palette?.border, color: palette?.text } : undefined} title={isClosed ? "Stato bloccato: vendita registrata" : appointmentStatusLabel(status)} type="button"><span className="[&_svg]:size-4"><StatusActionIcon status={status} /></span>{appointmentStatusLabel(status)}</button>;
            })}</div>
          <div className="ml-auto flex shrink-0 items-center gap-2">{!isClosed && <Button className="sm:hidden" onClick={() => setEditingAppointment(true)} size="sm" variant="outline"><Pencil aria-hidden="true" className="size-4" />Modifica</Button>}<button aria-label="Elimina appuntamento" className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100" onClick={() => setConfirmDelete(true)} type="button"><Trash2 aria-hidden="true" className="size-4" /><span className="hidden sm:inline">Elimina</span></button></div>
        </div>}
      </header>
      {!appointment ? (
        <div className="grid flex-1 place-items-center p-6"><EmptyState title="Appuntamento non trovato" description="Potrebbe essere stato eliminato o non essere accessibile." /></div>
      ) : (
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <main className="mx-auto w-full max-w-6xl space-y-4 p-4 sm:p-5 lg:p-6">
              {error && <InlineError>{error}</InlineError>}
              <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                <div className="grid divide-y divide-stone-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                  <div className="p-4 sm:p-5"><div className="flex items-center gap-2 text-[#792f59]"><CalendarDays aria-hidden="true" className="size-4" /><p className="text-[10px] font-black uppercase tracking-[.16em]">Quando</p></div><p className="mt-2 font-black text-stone-950">{formatDate(appointment.starts_at)}</p><p className="mt-1 text-sm font-semibold text-stone-600">{formatTime(appointment.starts_at)}–{formatTime(appointment.ends_at)} · {minutesBetween(appointment.starts_at, appointment.ends_at)} min</p></div>
                  <div className="p-4 sm:p-5">
                    <div className="flex items-center gap-2 text-[#792f59]">
                      <UserRound aria-hidden="true" className="size-4" />
                      <p className="text-[10px] font-black uppercase tracking-[.16em]">Con</p>
                    </div>
                    <select
                      aria-label="Collaboratore assegnato"
                      className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-black text-stone-950 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500"
                      disabled={isClosed || staffUpdating}
                      onChange={(event) => void changeStaff(event.target.value)}
                      value={appointment.staff_id}
                    >
                      {!staffOptions.some((staff) => staff.id === appointment.staff_id) && (
                        <option value={appointment.staff_id}>{appointment.staff_name}</option>
                      )}
                      {staffOptions.map((staff) => (
                        <option key={staff.id} value={staff.id}>{staff.name}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-sm font-semibold text-stone-600">
                      {staffUpdating ? "Aggiornamento collaboratore…" : appointment.service_name}
                    </p>
                  </div>
                </div>
                <div className="border-t border-stone-100 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#792f59]">Cliente</p><Link className="mt-1 inline-block text-lg font-black text-stone-950 hover:text-[#792f59] hover:underline" href={`/clients/${appointment.customer_id}`}>{appointment.customer_name}</Link></div><Link className="text-sm font-bold text-[#792f59] hover:underline" href={`/clients/${appointment.customer_id}`}>Apri anagrafica</Link></div>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><span className="flex min-w-0 items-center gap-2 text-stone-600"><Phone aria-hidden="true" className="size-4 shrink-0 text-stone-400" /><span className="truncate">{appointment.customer_phone || "Telefono non disponibile"}</span></span><span className="flex min-w-0 items-center gap-2 text-stone-600"><Mail aria-hidden="true" className="size-4 shrink-0 text-stone-400" /><span className="truncate">{appointment.customer_email || "Email non disponibile"}</span></span></div>
                  {appointment.notes && <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-sm leading-6 text-stone-600"><strong className="text-stone-800">Nota:</strong> {appointment.notes}</p>}
                </div>
              </section>

              <DocumentsModuleGate enabled={documentsEnabled}>
                <details className="group overflow-hidden rounded-xl border border-stone-200 bg-white">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 marker:hidden hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#b85888]/20 sm:px-5 [&::-webkit-details-marker]:hidden">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#f3e2eb] text-[#792f59]"><CheckCheck aria-hidden="true" className="size-4" /></span>
                    <span className="min-w-0 flex-1"><strong className="block text-sm text-stone-950">Consensi e documenti</strong><span className="mt-0.5 block text-xs text-stone-500">Richieste, firme e stato dei consensi del cliente</span></span>
                    <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-stone-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-stone-100 p-3 sm:p-4">
                    <ConsentRecordsPanel appointmentId={appointment.id} customerId={appointment.customer_id} title="Consensi" />
                  </div>
                </details>
              </DocumentsModuleGate>

              <section className="rounded-xl border border-[#d9a7c2] bg-[#fffafd] p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f3e2eb] text-[#792f59]">
                    <ShoppingBag aria-hidden="true" className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#792f59]">Azione principale</p>
                    <h2 className="mt-1 text-lg font-black text-stone-950">Porta in cassa</h2>
                    <p className="mt-1 text-sm leading-6 text-stone-600">
                      Porta l’appuntamento in Cassa già caricato, quindi completa il conto con eventuali prodotti,
                      sconti, buoni e modalità di pagamento.
                    </p>
                  </div>
                </div>

                {isClosed ? (
                  <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
                    La vendita di questo appuntamento è già stata registrata.
                  </div>
                ) : checkoutEnabled ? (
                  <Link
                    className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#792f59] px-4 text-sm font-black text-white transition-colors hover:bg-[#66264b] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b85888]/20"
                    href={`/sales?appointment=${encodeURIComponent(appointment.id)}`}
                  >
                    Porta in cassa
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                ) : (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                    Conferma prima l’appuntamento per portarlo in Cassa.
                  </div>
                )}
              </section>
            </main>

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
