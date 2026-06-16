"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PERMISSION_KEYS } from "@esse-beauty/shared";
import { AppPage, Button, EmptyState, InlineError, PageHeader, SectionCard, StatCard, StatGrid, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Appointment {
  customer_name?: string;
  ends_at: string;
  id: string;
  service_name?: string;
  staff_name?: string;
  starts_at: string;
  status: string;
}

interface ReportRow {
  appointment_count: number;
  completed_count: number;
  most_performed_service?: string;
  unique_customers: number;
}

function todayRange() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
}

export default function StaffPwaPage() {
  const { hasPermission, salon, user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [error, setError] = useState("");

  const canViewAgenda = hasPermission(PERMISSION_KEYS.CALENDAR_VIEW_OWN);
  const canManageAgenda = hasPermission(PERMISSION_KEYS.CALENDAR_MANAGE_OWN);
  const canViewReports = hasPermission(PERMISSION_KEYS.REPORTS_VIEW_OWN);

  useEffect(() => {
    if (!salon || !canViewAgenda) return;
    const query = todayRange();
    void fetch(`${api}/api/salons/${salon.id}/appointments?${query}`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Agenda personale non disponibile.");
        setAppointments(await response.json() as Appointment[]);
        setError("");
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Agenda personale non disponibile."));
  }, [canViewAgenda, salon]);

  useEffect(() => {
    if (!salon || !canViewReports) return;
    const query = todayRange();
    void fetch(`${api}/api/salons/${salon.id}/reports/own?${query}`, { credentials: "include" })
      .then(async (response) => {
        if (response.ok) setReports(await response.json() as ReportRow[]);
      });
  }, [canViewReports, salon]);

  const completed = useMemo(() => appointments.filter((item) => item.status === "completed").length, [appointments]);
  const nextAppointment = appointments.find((item) => new Date(item.starts_at).getTime() >= Date.now());
  const report = reports[0];

  async function updateStatus(appointment: Appointment, status: "completed" | "confirmed") {
    if (!salon || !canManageAgenda) return;
    await fetch(`${api}/api/salons/${salon.id}/appointments/${appointment.id}`, {
      body: JSON.stringify({ status }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    setAppointments((current) => current.map((item) => item.id === appointment.id ? { ...item, status } : item));
  }

  return (
    <AppPage maxWidth="max-w-md">
      <PageHeader
        eyebrow="App staff"
        title={`Ciao ${user?.full_name.split(" ")[0] ?? ""}`}
        subtitle="Agenda personale, note operative e performance essenziali in formato app."
        status={<StatusBadge status={canViewAgenda ? "active" : "inactive"}>{canViewAgenda ? "Operativa" : "Permesso richiesto"}</StatusBadge>}
      />

      {error && <InlineError className="mb-5">{error}</InlineError>}

      <StatGrid className="mb-6 grid-cols-3 md:grid-cols-3">
        <StatCard label="Oggi" value={appointments.length} detail="Appuntamenti" />
        <StatCard label="Completati" value={completed} detail="Servizi" />
        <StatCard label="Clienti" value={report?.unique_customers ?? 0} detail="Unici" />
      </StatGrid>

      {nextAppointment && (
        <SectionCard className="mb-6" title="Prossimo appuntamento" subtitle="Azione rapida senza aprire il calendario completo.">
          <div className="rounded-3xl border border-[#ead1df] bg-[#fffafd] p-5">
            <p className="text-xs font-black uppercase tracking-[.16em] text-[#792f59]">{new Date(nextAppointment.starts_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</p>
            <h2 className="mt-2 text-xl font-bold text-stone-950">{nextAppointment.customer_name ?? "Cliente"}</h2>
            <p className="mt-1 text-sm text-stone-500">{nextAppointment.service_name ?? "Servizio"}</p>
            <div className="mt-4 flex gap-2">
              <Button disabled={!canManageAgenda} onClick={() => void updateStatus(nextAppointment, "confirmed")} size="sm" variant="outline">Check-in</Button>
              <Button disabled={!canManageAgenda} onClick={() => void updateStatus(nextAppointment, "completed")} size="sm" variant="primary">Completa</Button>
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Agenda di oggi" subtitle="Vista compatta personale.">
        {appointments.length === 0 ? (
          <EmptyState description="Nessun appuntamento assegnato per oggi." title="Giornata libera" />
        ) : (
          <div className="space-y-3">
            {appointments.map((item) => (
              <Link className="block rounded-2xl border border-white/80 bg-white/86 p-4 shadow-sm ring-1 ring-stone-950/5" href={`/calendar/appointments/${item.id}`} key={item.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.14em] text-[#792f59]">{new Date(item.starts_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</p>
                    <h3 className="mt-1 font-bold text-stone-950">{item.customer_name ?? "Cliente"}</h3>
                    <p className="text-sm text-stone-500">{item.service_name ?? "Servizio"}</p>
                  </div>
                  <StatusBadge status={item.status}>{item.status}</StatusBadge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      {canViewReports && (
        <SectionCard className="mt-6" title="Performance personale" subtitle="Dato rapido del periodo corrente.">
          <div className="grid gap-3">
            <div className="rounded-2xl bg-[#fffafd] p-4"><b>{report?.appointment_count ?? 0}</b><p className="text-sm text-stone-500">Appuntamenti gestiti</p></div>
            <div className="rounded-2xl bg-[#fffafd] p-4"><b>{report?.most_performed_service ?? "-"}</b><p className="text-sm text-stone-500">Servizio piu richiesto</p></div>
          </div>
        </SectionCard>
      )}
    </AppPage>
  );
}
