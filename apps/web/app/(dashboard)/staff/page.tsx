"use client";

import { useEffect, useMemo, useState } from "react";

import { type WorkingHours } from "@esse-beauty/shared";
import { AppPage, Button, EmptyState, FormField, InlineError, PageHeader, PageTransition, SectionCard, StatCard, StatGrid, StatusBadge } from "@esse-beauty/ui";

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

  const totalAppointments = useMemo(() => staff.reduce((sum, item) => sum + item.appointment_count, 0), [staff]);
  const completed = useMemo(() => staff.reduce((sum, item) => sum + item.completed_count, 0), [staff]);

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
        <StatGrid className="mb-6 md:grid-cols-3">
          <StatCard label="Collaboratori" value={staff.length} detail="Attivi oggi" />
          <StatCard label="Appuntamenti" value={totalAppointments} detail="Carico giornaliero" />
          <StatCard label="Completati" value={completed} detail="Servizi chiusi" />
        </StatGrid>

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
                    {Object.entries(member.working_hours).map(([day, hours]) => (
                      <div key={day} className="text-center">
                        <span className="text-[10px] font-bold uppercase text-stone-400">{day}</span>
                        <div className={`mt-1 h-8 rounded-md ${hours.length ? "bg-rose-100" : "bg-stone-100"}`} />
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
