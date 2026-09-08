"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, CalendarCheck, CalendarDays, CalendarX, Clock3, Mail, Pencil, Phone, Trash2, UserRound } from "lucide-react";
import { Button, ConfirmDialog, DateTimeField, Dialog, InlineError, Select, StatusBadge } from "@esse-beauty/ui";
import { APPOINTMENT_STATUS_PALETTE, appointmentStatusLabel } from "@esse-beauty/shared";
import { useAuth } from "../../../../lib/auth-context";

type Appointment = {
  id: string; starts_at: string; ends_at: string; status: string; notes: string | null;
  staff_id: string | null; customer_name: string | null; customer_email: string | null;
  customer_phone: string | null; service_id: string | null; service_name: string | null;
  staff_name: string | null; color?: string | null;
};
type Staff = { id: string; display_name: string };
type ReminderSettings = { appEnabled: boolean; emailEnabled: boolean; hoursBefore: number[]; whatsappEnabled: boolean };
const api = process.env.NEXT_PUBLIC_API_URL ?? "";
const apiFetch = (path: string, init?: RequestInit) => fetch(`${api}${path}`, { credentials: "include", ...init });
const statusLabels: Record<string, string> = { pending: "Da confermare", confirmed: "Confermato", cancelled: "Non confermato", completed: "Completato", no_show: "Non presentato" };

function localValue(iso: string) {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function AgendaPreview({ appointmentId, refresh }: { appointmentId: string; refresh: number }) {
  const { salon } = useAuth();
  const [target, setTarget] = useState<Appointment | null>(null);
  const [items, setItems] = useState<Appointment[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!salon?.id) return;
    let active = true;
    setTarget(null); setError("");
    void (async () => {
      try {
        const detailResponse = await apiFetch(`/api/salons/${salon.id}/appointments/${appointmentId}`);
        if (!detailResponse.ok) throw new Error("Impossibile caricare la richiesta.");
        const detail = await detailResponse.json() as Appointment;
        const day = new Date(detail.starts_at);
        const from = new Date(day); from.setHours(0, 0, 0, 0);
        const to = new Date(day); to.setHours(23, 59, 59, 999);
        const response = await apiFetch(`/api/salons/${salon.id}/appointments?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);
        if (!response.ok) throw new Error("Impossibile caricare l'agenda.");
        const payload = await response.json() as Appointment[];
        if (active) {
          setTarget(detail);
          setItems(payload.some((item) => item.id === detail.id) ? payload : [...payload, detail]);
        }
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "Errore di caricamento."); }
    })();
    return () => { active = false; };
  }, [apiFetch, appointmentId, refresh, salon?.id]);

  const windowStartHour = Math.max(0, Math.min(18, new Date(target?.starts_at ?? 0).getHours() - 2));
  const windowEndHour = windowStartHour + 6;
  const visible = useMemo(() => items.filter((item) => {
    if (item.status === "cancelled") return false;
    if (item.id !== target?.id && item.staff_id !== target?.staff_id) return false;
    const hour = new Date(item.starts_at).getHours();
    return hour >= windowStartHour && hour < windowEndHour;
  }), [items, target?.id, target?.staff_id, windowEndHour, windowStartHour]);
  if (error) return <InlineError>{error}</InlineError>;
  if (!target) return <div className="grid min-h-[430px] place-items-center text-sm text-slate-500">Caricamento agenda…</div>;
  const label = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(new Date(target.starts_at));

  return <section className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm" aria-label="Anteprima agenda">
    <div className="flex items-center justify-between border-b border-stone-200 bg-[#faf9f7] px-4 py-3"><div><p className="text-xs font-black text-[#792f59]">Anteprima agenda</p><h3 className="mt-0.5 text-sm font-black capitalize text-stone-950">{label}</h3></div><CalendarDays className="h-5 w-5 text-[#792f59]" /></div>
    <div className="grid border-b-2 border-stone-200 bg-white shadow-sm" style={{ gridTemplateColumns: "76px minmax(0, 1fr)" }}><div className="flex items-end justify-center border-r border-stone-200 pb-3 pt-4 text-[10px] font-black uppercase tracking-[.16em] text-stone-400">Ora</div><div className="flex items-center justify-center gap-3 px-4 py-3"><span className="grid h-10 w-10 place-items-center rounded-full text-sm font-black text-white shadow-md ring-2 ring-white" style={{ background: target.color || "#792f59" }}>{(target.staff_name || "?").slice(0, 1).toUpperCase()}</span><div><p className="text-sm font-black text-stone-950">{target.staff_name || "Operatore da assegnare"}</p><p className="text-[11px] font-semibold text-stone-400">{visible.length} appuntamenti nella fascia</p></div></div></div>
    <div className="grid" style={{ gridTemplateColumns: "76px minmax(0, 1fr)" }}>
      <div className="relative border-r border-stone-200 bg-[#faf9f7]" style={{ height: 432 }}>
        {Array.from({ length: 7 }, (_, index) => <div key={index} className="absolute inset-x-0 pr-3 text-right text-xs font-black text-stone-500" style={{ top: index === 6 ? 410 : index * 72 - (index ? 8 : -8) }}>{String(windowStartHour + index).padStart(2, "0")}:00</div>)}
      </div>
      <div className="relative" style={{ height: 432 }}>
        {Array.from({ length: 6 }, (_, hour) => <div key={hour}>{<div className="absolute inset-x-0 border-t border-stone-100" style={{ top: hour * 72 }} />}{[15, 30, 45].map((minute) => <div className="absolute inset-x-0 border-t border-dashed border-stone-100" key={minute} style={{ top: hour * 72 + minute * 1.2 }} />)}</div>)}
      {visible.map((item) => {
        const start = new Date(item.starts_at), end = new Date(item.ends_at);
        const startMinutes = start.getHours() * 60 + start.getMinutes() - windowStartHour * 60;
        const top = Math.max(0, startMinutes * 1.2);
        const height = Math.max(56, Math.min(432 - top, (end.getTime() - start.getTime()) / 60000 * 1.2));
        const selected = item.id === appointmentId;
        const palette = APPOINTMENT_STATUS_PALETTE[item.status as keyof typeof APPOINTMENT_STATUS_PALETTE];
        const confirmed = item.status === "confirmed";
        return <div key={item.id} className={`absolute left-2 right-2 overflow-hidden rounded-lg border px-2.5 py-1.5 text-xs shadow-sm ${confirmed ? "text-white" : ""} ${selected ? "z-10 ring-2 ring-[#792f59]/25 ring-offset-1" : "z-[2]"}`} style={{ top, height, ...(confirmed ? { background: `linear-gradient(135deg, ${item.color || "#792f59"}, color-mix(in srgb, ${item.color || "#792f59"} 72%, white))`, borderColor: item.color || "#792f59" } : { background: palette?.background, borderColor: palette?.border, color: palette?.text }) }}><span className="block text-[10px] font-black text-stone-700">{start.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</span><p className="mt-1 truncate text-[12px] font-black uppercase">{item.customer_name || "Appuntamento"}</p><p className={`mt-1 truncate text-[11px] font-semibold ${confirmed ? "text-white/80" : "opacity-75"}`}>{item.service_name || "Servizio"}</p><span className="absolute bottom-1.5 right-2 text-[10px] font-black" title={appointmentStatusLabel(item.status)}>{selected ? "RICHIESTA" : appointmentStatusLabel(item.status)}</span></div>;
      })}
      </div>
    </div>
  </section>;
}

function RequestActions({ appointmentId, onClose, onChanged, refreshAgenda }: { appointmentId: string; onClose: () => void; onChanged?: () => void; refreshAgenda: () => void }) {
  const { salon } = useAuth();
  const [item, setItem] = useState<Appointment | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings | null>(null);
  const [editing, setEditing] = useState(false), [deleting, setDeleting] = useState(false), [saving, setSaving] = useState(false);
  const [startsAt, setStartsAt] = useState(""), [staffId, setStaffId] = useState(""), [notes, setNotes] = useState(""), [error, setError] = useState("");

  async function load() {
    if (!salon?.id) return;
    const response = await apiFetch(`/api/salons/${salon.id}/appointments/${appointmentId}`);
    if (!response.ok) throw new Error("Impossibile caricare la richiesta.");
    const detail = await response.json() as Appointment;
    setItem(detail); setStartsAt(localValue(detail.starts_at)); setStaffId(detail.staff_id ?? ""); setNotes(detail.notes ?? "");
    const reminderResponse = await apiFetch(`/api/salons/${salon.id}/reminders/settings`);
    if (reminderResponse.ok) setReminderSettings(await reminderResponse.json() as ReminderSettings);
    else setReminderSettings(null);
    if (detail.service_id) {
      const staffResponse = await apiFetch(`/api/salons/${salon.id}/operations/staff?serviceId=${encodeURIComponent(detail.service_id)}&strictAssignments=true`);
      if (staffResponse.ok) {
        const payload = await staffResponse.json() as Staff[] | { items?: Staff[] };
        setStaff(Array.isArray(payload) ? payload : payload.items ?? []);
      }
    }
  }
  useEffect(() => { setError(""); void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Errore di caricamento.")); }, [appointmentId, salon?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function update(payload: Record<string, unknown>, close = false) {
    if (!salon?.id) return;
    setSaving(true); setError("");
    try {
      const response = await apiFetch(`/api/salons/${salon.id}/appointments/${appointmentId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => null) as { message?: string; error?: string } | null;
      if (!response.ok) throw new Error(body?.message || body?.error || "Impossibile aggiornare l'appuntamento.");
      await load(); refreshAgenda(); onChanged?.(); setEditing(false); if (close) onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Errore durante l'aggiornamento."); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!salon?.id) return;
    setSaving(true);
    try {
      const response = await apiFetch(`/api/salons/${salon.id}/appointments/${appointmentId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Impossibile eliminare l'appuntamento.");
      onChanged?.(); onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Errore durante l'eliminazione."); }
    finally { setSaving(false); setDeleting(false); }
  }

  if (!item) return error ? <InlineError>{error}</InlineError> : <div className="grid min-h-[430px] place-items-center text-sm text-slate-500">Caricamento richiesta…</div>;
  const starts = new Date(item.starts_at), pending = item.status === "pending", cancelled = item.status === "cancelled";
  const reminderChannels = reminderSettings ? [
    reminderSettings.whatsappEnabled ? "WhatsApp" : "",
    reminderSettings.emailEnabled ? "email" : "",
    reminderSettings.appEnabled ? "app" : "",
  ].filter(Boolean) : [];
  const reminderHours = (reminderSettings?.hoursBefore ?? [])
    .filter((hours) => starts.getTime() - hours * 60 * 60_000 >= Date.now() - 10 * 60_000)
    .sort((a, b) => b - a);
  const formatHours = (hours: number) => hours % 24 === 0
    ? `${hours / 24} ${hours === 24 ? "giorno" : "giorni"}`
    : `${hours} ${hours === 1 ? "ora" : "ore"}`;
  const joinItalian = (values: string[]) => values.length < 2 ? values[0] ?? "" : `${values.slice(0, -1).join(", ")} e ${values.at(-1)}`;
  return <section className="flex min-h-[430px] flex-col" aria-label="Gestione richiesta">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#793059]">Richiesta online</p><h2 className="mt-1 text-2xl font-semibold text-slate-950">{item.customer_name || "Cliente"}</h2></div><StatusBadge status={item.status}>{statusLabels[item.status] ?? item.status}</StatusBadge></div>
    <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="flex gap-3 font-semibold text-slate-900"><CalendarDays className="mt-0.5 h-4 w-4 text-[#793059]" />{item.service_name || "Servizio"}</p>
      <p className="flex items-center gap-3 text-sm text-slate-700"><Clock3 className="h-4 w-4 text-[#793059]" />{starts.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}, {starts.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</p>
      <p className="flex items-center gap-3 text-sm text-slate-700"><UserRound className="h-4 w-4 text-[#793059]" />{item.staff_name || "Operatore da assegnare"}</p>
      {item.customer_phone && <a className="flex items-center gap-3 text-sm text-slate-700 hover:text-[#793059]" href={`tel:${item.customer_phone}`}><Phone className="h-4 w-4 text-[#793059]" />{item.customer_phone}</a>}
      {item.customer_email && <a className="flex items-center gap-3 text-sm text-slate-700 hover:text-[#793059]" href={`mailto:${item.customer_email}`}><Mail className="h-4 w-4 text-[#793059]" />{item.customer_email}</a>}
    </div>
    {error && <div className="mt-4"><InlineError>{error}</InlineError></div>}
    {editing ? <div className="mt-5 space-y-4 rounded-2xl bg-slate-50 p-4">
      <label className="block text-sm font-medium text-slate-800">Data e ora<DateTimeField className="mt-1.5" value={startsAt} onChange={setStartsAt} /></label>
      <label className="block text-sm font-medium text-slate-800">Operatore<Select className="mt-1.5" value={staffId} onChange={(event) => setStaffId(event.target.value)}><option value="">Nessuna preferenza</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</Select></label>
      <label className="block text-sm font-medium text-slate-800">Note<textarea className="mt-1.5 min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#793059]" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setEditing(false)}>Annulla</Button><Button disabled={saving || !startsAt} onClick={() => void update({ starts_at: new Date(startsAt).toISOString(), staff_id: staffId || null, notes: notes.trim() || null })}>Salva modifiche</Button></div>
    </div> : <Button className="mt-5 w-full" variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Modifica dettagli</Button>}
    <div className="mt-auto pt-5">
      {pending && reminderChannels.length > 0 && <div className="mb-3 flex gap-3 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3 text-sm text-sky-950" role="note"><BellRing className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" /><p>{reminderHours.length > 0 ? <>Confermando, il cliente riceverà un promemoria tramite <strong>{joinItalian(reminderChannels)}</strong>, {joinItalian(reminderHours.map((hours) => `${formatHours(hours)} prima`))}.</> : <>I promemoria sono attivi tramite <strong>{joinItalian(reminderChannels)}</strong>, ma l’appuntamento è troppo vicino per gli anticipi configurati.</>}</p></div>}
      {pending ? <div className="grid gap-2 sm:grid-cols-2"><Button disabled={saving} onClick={() => void update({ status: "confirmed" }, true)}><CalendarCheck className="h-4 w-4" /> Conferma</Button><Button disabled={saving} variant="outline" className="border-rose-200 text-rose-700" onClick={() => void update({ status: "cancelled" }, true)}><CalendarX className="h-4 w-4" /> Non confermare</Button></div> : !cancelled && <Button disabled={saving} variant="outline" className="w-full border-rose-200 text-rose-700" onClick={() => void update({ status: "cancelled" }, true)}><CalendarX className="h-4 w-4" /> Cancella appuntamento</Button>}
      <button type="button" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-medium text-slate-400 hover:bg-rose-50 hover:text-rose-700" onClick={() => setDeleting(true)}><Trash2 className="h-3.5 w-3.5" /> Elimina definitivamente</button>
    </div>
    <ConfirmDialog open={deleting} title="Eliminare definitivamente?" description="L'appuntamento verrà rimosso dall'agenda e non potrà essere recuperato." confirmLabel="Elimina" destructive onCancel={() => setDeleting(false)} onConfirm={() => void remove()} />
  </section>;
}

export function AppointmentRequestModal({ appointmentId, onClose, onChanged }: { appointmentId: string | null; onClose: () => void; onChanged?: () => void }) {
  const [refresh, setRefresh] = useState(0);
  return <Dialog open={Boolean(appointmentId)} onClose={onClose} title="Gestisci richiesta appuntamento" size="2xl">
    {appointmentId && <><p className="mb-5 text-sm text-slate-500">Valuta la richiesta nel contesto dell'agenda e intervieni senza cambiare pagina.</p><div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]"><AgendaPreview appointmentId={appointmentId} refresh={refresh} /><RequestActions appointmentId={appointmentId} onClose={onClose} onChanged={onChanged} refreshAgenda={() => setRefresh((value) => value + 1)} /></div></>}
  </Dialog>;
}
