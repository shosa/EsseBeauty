"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

import { PERMISSION_KEYS, type PermissionKey } from "@esse-beauty/shared";
import { Button, EmptyState, FormField, InlineError, SaveToast, SectionCard, StatCard, StatGrid, StatusBadge } from "@esse-beauty/ui";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface StaffSession {
  modules: { staff_performance: boolean };
  permissions: PermissionKey[];
  salon_id: string;
  staff: {
    color: string;
    display_name: string;
    id: string;
    job_title?: string | null;
  };
}

interface Appointment {
  customer_name: string;
  customer_notes?: string | null;
  ends_at: string;
  id: string;
  notes?: string | null;
  service_name: string;
  starts_at: string;
  status: string;
}

interface AvailabilityRequest {
  ends_at: string;
  id: string;
  reason?: string | null;
  review_note?: string | null;
  starts_at: string;
  status: string;
}

interface Report {
  appointment_count: number;
  completed_count: number;
  no_show_count: number;
  unique_customers: number;
}

function dayRange(days = 1) {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + days);
  return new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
}

function time(value: string) {
  return new Date(value).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function dateTime(value: string) {
  return new Date(value).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

export default function StaffPwaHome() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRequest[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [rangeMode, setRangeMode] = useState<"day" | "week">("day");
  const [report, setReport] = useState<Report>();
  const [selectedId, setSelectedId] = useState("");
  const [session, setSession] = useState<StaffSession | null>(null);
  const [loading, setLoading] = useState(true);

  const permissionSet = useMemo(() => new Set(session?.permissions ?? []), [session?.permissions]);
  const canViewAgenda = permissionSet.has(PERMISSION_KEYS.CALENDAR_VIEW_OWN);
  const canManageAgenda = permissionSet.has(PERMISSION_KEYS.CALENDAR_MANAGE_OWN);
  const canViewReports = permissionSet.has(PERMISSION_KEYS.REPORTS_VIEW_OWN) && session?.modules.staff_performance;
  const selected = appointments.find((item) => item.id === selectedId) ?? appointments[0];
  const completed = appointments.filter((item) => item.status === "completed").length;

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${api}${path}`, {
      credentials: "include",
      headers: { "content-type": "application/json", ...init?.headers },
      ...init,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(typeof body.error === "string" ? body.error : "REQUEST_FAILED");
    }
    return (await response.json()) as T;
  }

  async function loadSession() {
    const current = await request<StaffSession>("/api/staff-app/me");
    setSession(current);
  }

  async function loadWork() {
    const params = dayRange(rangeMode === "day" ? 1 : 7);
    const rows = await request<Appointment[]>(`/api/staff-app/appointments?${params}`);
    setAppointments(rows);
    setSelectedId((current) => current || rows[0]?.id || "");
    setAvailability(await request<AvailabilityRequest[]>("/api/staff-app/availability-requests"));
    if (canViewReports) {
      setReport(await request<Report>(`/api/staff-app/reports?${params}`));
    }
  }

  useEffect(() => {
    void loadSession()
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!session || !canViewAgenda) return;
    void loadWork().catch((caught) => setError(caught instanceof Error ? caught.message : "Agenda non disponibile."));
  }, [session, rangeMode, canViewAgenda, canViewReports]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await request("/api/auth/login", {
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
        method: "POST",
      });
      await loadSession();
    } catch {
      setError("Credenziali non valide o profilo staff non collegato.");
    }
  }

  async function setStatus(appointment: Appointment, status: "confirmed" | "completed" | "no_show") {
    setError("");
    try {
      await request(`/api/staff-app/appointments/${appointment.id}/status`, {
        body: JSON.stringify({ status }),
        method: "PATCH",
      });
      setAppointments((current) => current.map((item) => item.id === appointment.id ? { ...item, status } : item));
      setMessage("Appuntamento aggiornato.");
    } catch {
      setError("Non puoi aggiornare questo appuntamento.");
    }
  }

  async function requestAvailability(formData: FormData) {
    setError("");
    try {
      await request("/api/staff-app/availability-requests", {
        body: JSON.stringify({
          ends_at: formData.get("ends_at"),
          reason: formData.get("reason"),
          starts_at: formData.get("starts_at"),
        }),
        method: "POST",
      });
      setMessage("Richiesta inviata per approvazione.");
      setAvailability(await request<AvailabilityRequest[]>("/api/staff-app/availability-requests"));
    } catch {
      setError("Richiesta non inviata.");
    }
  }

  async function changePassword(formData: FormData) {
    setError("");
    try {
      await request("/api/auth/change-password", {
        body: JSON.stringify({
          current_password: formData.get("current_password"),
          new_password: formData.get("new_password"),
        }),
        method: "POST",
      });
      setMessage("Password aggiornata.");
    } catch {
      setError("Cambio password non riuscito.");
    }
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center text-sm font-black text-[#792f59]">Caricamento app staff...</main>;
  }

  if (!session) {
    return (
      <main className="grid min-h-screen place-items-center p-5">
        <section className="w-full max-w-sm rounded-[2rem] bg-white p-6 shadow-[0_24px_70px_rgb(45_29_39_/_0.16)]">
          <p className="text-xs font-black uppercase tracking-[.22em] text-[#792f59]">EsseBeauty Staff</p>
          <h1 className="mt-3 text-3xl font-black text-[#2d1d27]">Accedi</h1>
          <p className="mt-2 text-sm leading-6 text-stone-500">Usa le credenziali staff del salone.</p>
          {error && <InlineError className="mt-4">{error}</InlineError>}
          <form className="mt-5 space-y-4" onSubmit={login}>
            <FormField label="Email" required>
              <input className="w-full" name="email" required type="email" />
            </FormField>
            <FormField label="Password" required>
              <input className="w-full" name="password" required type="password" />
            </FormField>
            <Button className="w-full" type="submit" variant="primary">Entra nell'app staff</Button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-24">
      <SaveToast visible={Boolean(message)}>{message}</SaveToast>
      <header className="sticky top-0 z-20 border-b border-white/70 bg-white/82 px-4 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#792f59]">App staff</p>
            <h1 className="text-xl font-black text-[#2d1d27]">{session.staff.display_name}</h1>
          </div>
          <StatusBadge status="active">{session.staff.job_title ?? "Staff"}</StatusBadge>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 p-4">
        {error && <InlineError>{error}</InlineError>}

        <nav className="grid grid-cols-5 gap-2 rounded-[1.6rem] bg-white/82 p-2 shadow-sm">
          {["Agenda", "Dettaglio", "Ferie", "Report", "Profilo"].map((item) => (
            <a className="rounded-2xl px-2 py-3 text-center text-[11px] font-black text-stone-600 hover:bg-[#f3e2eb] hover:text-[#792f59]" href={`#${item.toLowerCase()}`} key={item}>{item}</a>
          ))}
        </nav>

        <section id="agenda">
          <div className="mb-3 flex gap-2">
            <Button active={rangeMode === "day"} onClick={() => setRangeMode("day")} size="sm" variant="outline">Giorno</Button>
            <Button active={rangeMode === "week"} onClick={() => setRangeMode("week")} size="sm" variant="outline">Settimana</Button>
          </div>
          <StatGrid className="mb-4 grid-cols-3 md:grid-cols-3">
            <StatCard label="Agenda" value={appointments.length} detail={rangeMode === "day" ? "Oggi" : "7 giorni"} />
            <StatCard label="Completati" value={completed} detail="Servizi" />
            <StatCard label="Clienti" value={report?.unique_customers ?? "-"} detail="Unici" />
          </StatGrid>
          <SectionCard title="Agenda personale" subtitle="Filtrata sempre sul tuo profilo staff.">
            {appointments.length === 0 ? <EmptyState title="Nessun appuntamento" description="Non hai appuntamenti nel periodo selezionato." /> : (
              <div className="space-y-3">
                {appointments.map((item) => (
                  <button className={`w-full rounded-2xl border p-4 text-left shadow-sm ${selected?.id === item.id ? "border-[#792f59] bg-[#fffafd]" : "border-white/80 bg-white"}`} key={item.id} onClick={() => setSelectedId(item.id)} type="button">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[.14em] text-[#792f59]">{time(item.starts_at)} - {time(item.ends_at)}</p>
                        <h2 className="mt-1 font-black text-stone-950">{item.customer_name}</h2>
                        <p className="text-sm text-stone-500">{item.service_name}</p>
                      </div>
                      <StatusBadge status={item.status}>{item.status}</StatusBadge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </SectionCard>
        </section>

        <SectionCard id="dettaglio" title="Dettaglio appuntamento" subtitle="Note cliente e azioni operative rapide.">
          {!selected ? <EmptyState title="Seleziona un appuntamento" /> : (
            <div className="space-y-4">
              <div className="rounded-2xl bg-[#fffafd] p-4">
                <p className="text-xs font-black uppercase tracking-[.14em] text-[#792f59]">{dateTime(selected.starts_at)}</p>
                <h2 className="mt-1 text-2xl font-black text-stone-950">{selected.customer_name}</h2>
                <p className="text-sm text-stone-500">{selected.service_name}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-white p-4"><b>Note cliente</b><p className="mt-2 text-sm leading-6 text-stone-500">{selected.customer_notes || "Nessuna nota cliente."}</p></div>
                <div className="rounded-2xl bg-white p-4"><b>Note interne</b><p className="mt-2 text-sm leading-6 text-stone-500">{selected.notes || "Nessuna nota interna."}</p></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={!canManageAgenda} onClick={() => void setStatus(selected, "confirmed")} variant="outline">Check-in</Button>
                <Button disabled={!canManageAgenda} onClick={() => void setStatus(selected, "completed")} variant="primary">Completa</Button>
                <Button disabled={!canManageAgenda} onClick={() => void setStatus(selected, "no_show")} variant="outline">No-show</Button>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard id="ferie" title="Richiesta blocco disponibilità" subtitle="Ferie, permessi o indisponibilità: sempre con stato approvazione.">
          <form action={requestAvailability} className="grid gap-3">
            <FormField label="Inizio" required>
              <input name="starts_at" required type="datetime-local" />
            </FormField>
            <FormField label="Fine" required>
              <input name="ends_at" required type="datetime-local" />
            </FormField>
            <FormField label="Motivo">
              <textarea name="reason" placeholder="Ferie, visita, permesso..." />
            </FormField>
            <Button disabled={!canManageAgenda} type="submit" variant="primary">Invia richiesta</Button>
          </form>
          <div className="mt-5 space-y-2">
            {availability.map((item) => (
              <div className="rounded-2xl bg-white p-3" key={item.id}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold">{dateTime(item.starts_at)} - {dateTime(item.ends_at)}</p>
                  <StatusBadge status={item.status}>{item.status}</StatusBadge>
                </div>
                {item.reason && <p className="mt-1 text-sm text-stone-500">{item.reason}</p>}
              </div>
            ))}
          </div>
        </SectionCard>

        {canViewReports && (
          <SectionCard id="report" title="Report personale" subtitle="Disponibile solo con modulo Performance staff attivo.">
            <StatGrid className="grid-cols-2 md:grid-cols-4">
              <StatCard label="Appuntamenti" value={report?.appointment_count ?? 0} />
              <StatCard label="Completati" value={report?.completed_count ?? 0} />
              <StatCard label="No-show" value={report?.no_show_count ?? 0} />
              <StatCard label="Clienti" value={report?.unique_customers ?? 0} />
            </StatGrid>
          </SectionCard>
        )}

        <SectionCard id="profilo" title="Profilo" subtitle="Sicurezza account staff.">
          <form action={changePassword} className="grid gap-3">
            <FormField label="Password attuale" required>
              <input name="current_password" required type="password" />
            </FormField>
            <FormField label="Nuova password" required description="Minimo 10 caratteri.">
              <input name="new_password" required type="password" />
            </FormField>
            <Button type="submit" variant="outline">Cambia password</Button>
          </form>
        </SectionCard>
      </div>
    </main>
  );
}
