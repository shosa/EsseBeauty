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

export default function StaffPage() {
  const [staff, setStaff] = useState<OperationalStaff[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<OperationalStaff>();
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
      return;
    }
    await load();
  }

  return (
    <AppPage>
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
                  className={`rounded-3xl border p-5 text-left shadow-sm ring-1 ring-stone-950/5 transition hover:-translate-y-0.5 hover:shadow-md ${selected?.id === member.id ? "border-[#792f59] bg-[#fffafd]" : "border-white/70 bg-white"}`}
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

            <SectionCard title="Assenza last-minute" subtitle="Azione operativa rapida: non modifica orari contrattuali o ruoli.">
              <form action={markAbsence} className="grid gap-3">
                <p className="rounded-2xl bg-[#fffafd] p-4 text-sm font-bold text-[#792f59]">{selected?.display_name ?? "Seleziona collaboratore"}</p>
                <FormField label="Inizio" required><input name="starts_at" required type="datetime-local" /></FormField>
                <FormField label="Fine" required><input name="ends_at" required type="datetime-local" /></FormField>
                <FormField label="Motivo"><input name="reason" placeholder="Malattia, emergenza, permesso..." /></FormField>
                <Button disabled={!selected} type="submit" variant="primary">Segna assenza</Button>
              </form>
            </SectionCard>
          </div>
        )}
      </PageTransition>
    </AppPage>
  );
}
