"use client";

import { useEffect, useState } from "react";

import { type WorkingHours } from "@esse-beauty/shared";
import { AppPage, Button, EmptyState, FormField, InlineError, PageHeader, PageTransition, SectionCard, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface OperationalStaff {
  active: boolean;
  appointment_count: number;
  color: string;
  completed_count: number;
  display_name: string;
  id: string;
  next_service?: string | null;
  working_hours: WorkingHours;
}

const orderedDays: Array<{ key: keyof WorkingHours; label: string }> = [
  { key: "mon", label: "LUN" },
  { key: "tue", label: "MAR" },
  { key: "wed", label: "MER" },
  { key: "thu", label: "GIO" },
  { key: "fri", label: "VEN" },
  { key: "sat", label: "SAB" },
  { key: "sun", label: "DOM" },
];

function dailyHours(intervals: WorkingHours[keyof WorkingHours]) {
  const minutes = intervals.reduce((total, interval) => {
    const [fromHour = 0, fromMinute = 0] = interval.from.split(":").map(Number);
    const [toHour = 0, toMinute = 0] = interval.to.split(":").map(Number);
    return total + Math.max(0, toHour * 60 + toMinute - fromHour * 60 - fromMinute);
  }, 0);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function todayParams() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
}

function dateTimeInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function defaultAbsenceRange() {
  const start = new Date();
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60_000);
  return { end: dateTimeInputValue(end), start: dateTimeInputValue(start) };
}

export default function StaffPage() {
  const initialRange = defaultAbsenceRange();
  const [staff, setStaff] = useState<OperationalStaff[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<OperationalStaff>();
  const [absenceStart, setAbsenceStart] = useState(initialRange.start);
  const [absenceEnd, setAbsenceEnd] = useState(initialRange.end);
  const [absenceReason, setAbsenceReason] = useState("");
  const [savingAbsence, setSavingAbsence] = useState(false);
  const { salon } = useAuth();

  async function load() {
    if (!salon) return;
    const response = await fetch(`${api}/api/salons/${salon.id}/operations/staff?${todayParams()}`, { credentials: "include" });
    if (!response.ok) {
      setError("Disponibilità staff non disponibile.");
      return;
    }
    const data = await response.json() as OperationalStaff[];
    setStaff(data);
    setSelected((current) => current ?? data[0]);
  }

  useEffect(() => { void load(); }, [salon?.id]);

  async function markAbsence(data: FormData) {
    if (!salon || !selected) return;
    const startsAt = new Date(String(data.get("starts_at")));
    const endsAt = new Date(String(data.get("ends_at")));
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      setError("La fine dell’assenza deve essere successiva all’inizio.");
      return;
    }
    setSavingAbsence(true);
    setError("");
    const response = await fetch(`${api}/api/salons/${salon.id}/operations/staff/${selected.id}/absence`, {
      body: JSON.stringify({
        ends_at: data.get("ends_at"),
        reason: data.get("reason"),
        starts_at: data.get("starts_at"),
      }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      setError("Assenza non registrata.");
      setSavingAbsence(false);
      return;
    }
    const nextRange = defaultAbsenceRange();
    setAbsenceStart(nextRange.start);
    setAbsenceEnd(nextRange.end);
    setAbsenceReason("");
    await load();
    setSavingAbsence(false);
  }

  return (
    <AppPage maxWidth="max-w-[1600px]">
      <PageTransition>
        <PageHeader
          eyebrow="Team operativo"
          title="Staff"
          subtitle="Disponibilità di oggi, carico di lavoro e assenze last-minute. La configurazione collaboratori vive in Impostazioni."
          status={<StatusBadge status="active">{staff.length} collaboratori attivi</StatusBadge>}
        />

        {error && <InlineError className="mb-5">{error}</InlineError>}
        {staff.length === 0 ? (
          <EmptyState title="Nessuno staff operativo" description="Controlla configurazione collaboratori in Impostazioni." />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
            <section className="grid gap-4 md:grid-cols-2">
              {staff.map((member) => (
                <button
                  className={`rounded-2xl border p-5 text-left shadow-[0_10px_30px_rgb(45_29_39_/_0.055)] transition hover:-translate-y-0.5 hover:shadow-md ${selected?.id === member.id ? "border-[#792f59] bg-[#fffafd]" : "border-[#e8dfe4] bg-white"}`}
                  key={member.id}
                  onClick={() => setSelected(member)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      <span className="mt-1 h-12 w-2 rounded-full" style={{ background: member.color }} />
                      <div>
                        <h2 className="text-lg font-bold text-stone-950">{member.display_name}</h2>
                        <p className="text-sm text-stone-500">{member.next_service ?? "Nessun servizio imminente"}</p>
                      </div>
                    </div>
                    <StatusBadge status={member.appointment_count > 0 ? "scheduled" : "inactive"}>{member.appointment_count} oggi</StatusBadge>
                  </div>
                  <div className="mt-5 grid grid-cols-7 gap-1">
                    {orderedDays.map((day) => (
                      <div key={day.key} className="text-center">
                        <span className="text-[10px] font-bold uppercase text-stone-400">{day.label}</span>
                        <div className={`mt-1 flex min-h-12 flex-col items-center justify-center rounded-lg px-1 py-1.5 text-[8px] font-black leading-tight ${member.working_hours[day.key]?.length ? "border border-emerald-200 bg-emerald-50 text-emerald-800" : "border border-stone-200 bg-stone-100 text-stone-400"}`}>
                          {member.working_hours[day.key]?.length
                            ? <span className="text-[11px]">{dailyHours(member.working_hours[day.key])}</span>
                            : <span>CHIUSO</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </section>

            <SectionCard className="self-start lg:sticky lg:top-24" title="Assenza last-minute" subtitle="Registra rapidamente un’indisponibilità senza modificare gli orari contrattuali.">
              <form action={markAbsence} className="grid gap-5">
                <div className="flex items-center gap-3 rounded-2xl border border-[#ead1df] bg-[#fffafd] p-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full font-black text-white" style={{ background: selected?.color ?? "#792f59" }}>
                    {selected?.display_name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("") ?? "—"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#8f3a68]">Collaboratore selezionato</p>
                    <strong className="mt-1 block truncate text-lg text-stone-950">{selected?.display_name ?? "Seleziona un collaboratore"}</strong>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <FormField label="Inizio assenza" required>
                    <input className="w-full" name="starts_at" onChange={(event) => setAbsenceStart(event.target.value)} required step={900} type="datetime-local" value={absenceStart} />
                  </FormField>
                  <FormField label="Fine assenza" required>
                    <input className="w-full" min={absenceStart} name="ends_at" onChange={(event) => setAbsenceEnd(event.target.value)} required step={900} type="datetime-local" value={absenceEnd} />
                  </FormField>
                </div>

                <FormField label="Motivo" description="Nota interna visibile nella gestione delle disponibilità.">
                  <textarea className="min-h-24 w-full" name="reason" onChange={(event) => setAbsenceReason(event.target.value)} placeholder="Descrivi brevemente il motivo dell’assenza" value={absenceReason} />
                </FormField>

                <div className="flex justify-end border-t border-stone-100 pt-4">
                  <Button className="min-w-44" disabled={!selected || savingAbsence} type="submit" variant="primary">
                    {savingAbsence ? "Registrazione…" : "Registra assenza"}
                  </Button>
                </div>
              </form>
            </SectionCard>
          </div>
        )}
      </PageTransition>
    </AppPage>
  );
}
