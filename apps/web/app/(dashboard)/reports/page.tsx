"use client";

import { useEffect, useMemo, useState } from "react";

import { PERMISSION_KEYS } from "@esse-beauty/shared";
import { AppPage, Button, EmptyState, InlineError, PageHeader, SectionCard, StatCard, StatGrid, StatusBadge } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface StaffRow {
  appointment_count: number;
  cancellation_count: number;
  completed_count: number;
  most_performed_service?: string;
  no_show_count: number;
  staff_id: string;
  staff_name: string;
  unique_customers: number;
}

interface ServiceRow {
  appointment_count: number;
  service_id: string;
  service_name: string;
}

function dates(preset: string) {
  const now = new Date();
  const from = new Date(now);
  const to = new Date(now);
  if (preset === "today") from.setHours(0, 0, 0, 0);
  if (preset === "week") from.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  if (preset === "month") {
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
  }
  if (preset === "last") {
    from.setMonth(now.getMonth() - 1, 1);
    from.setHours(0, 0, 0, 0);
    to.setDate(0);
    to.setHours(23, 59, 59, 999);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function ReportsPage() {
  const { salon, hasPermission } = useAuth();
  const [preset, setPreset] = useState("month");
  const [staffRows, setStaffRows] = useState<StaffRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canAll = hasPermission(PERMISSION_KEYS.REPORTS_VIEW_ALL);

  useEffect(() => {
    if (!salon) return;
    const controller = new AbortController();
    const query = new URLSearchParams(dates(preset));
    const staffPath = canAll ? "staff" : "own";
    setLoading(true);
    setError("");

    void Promise.all([
      fetch(`${api}/api/salons/${salon.id}/reports/${staffPath}?${query}`, {
        credentials: "include",
        signal: controller.signal,
      }),
      canAll
        ? fetch(`${api}/api/salons/${salon.id}/reports/services?${query}`, {
            credentials: "include",
            signal: controller.signal,
          })
        : Promise.resolve(null),
    ])
      .then(async ([staffResponse, serviceResponse]) => {
        if (!staffResponse.ok || (serviceResponse && !serviceResponse.ok)) {
          throw new Error(
            staffResponse.status === 403 || serviceResponse?.status === 403
              ? "Il modulo Performance staff non e attivo o non hai i permessi necessari."
              : "Impossibile caricare i report.",
          );
        }
        const staffData: unknown = await staffResponse.json();
        const serviceData: unknown = serviceResponse ? await serviceResponse.json() : [];
        if (!Array.isArray(staffData) || !Array.isArray(serviceData)) {
          throw new Error("La risposta dei report non e valida.");
        }
        setStaffRows(staffData as StaffRow[]);
        setServices(serviceData as ServiceRow[]);
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setStaffRows([]);
          setServices([]);
          setError(reason instanceof Error ? reason.message : "Impossibile caricare i report.");
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [canAll, preset, salon]);

  const max = Math.max(1, ...services.map((item) => Number(item.appointment_count)));
  const totals = useMemo(
    () => staffRows.reduce(
      (acc, item) => ({
        appointments: acc.appointments + Number(item.appointment_count),
        completed: acc.completed + Number(item.completed_count),
        customers: acc.customers + Number(item.unique_customers),
      }),
      { appointments: 0, completed: 0, customers: 0 },
    ),
    [staffRows],
  );

  function exportCsv() {
    const query = new URLSearchParams(dates(preset));
    window.location.href = `${api}/api/salons/${salon?.id}/reports/export?${query}`;
  }

  return (
    <AppPage>
      <PageHeader
        actions={hasPermission(PERMISSION_KEYS.REPORTS_EXPORT) ? <Button onClick={exportCsv} variant="primary">Esporta CSV</Button> : undefined}
        eyebrow="Andamento"
        title="Performance staff"
        subtitle="Leggi appuntamenti, clienti e servizi richiesti con un taglio operativo."
        status={<StatusBadge status={error ? "waiting" : "active"}>{canAll ? "Vista completa" : "Vista personale"}</StatusBadge>}
      />

      <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-white/80 bg-white/75 p-2 shadow-sm ring-1 ring-stone-950/5 backdrop-blur">
        {[
          { value: "today", label: "Oggi" },
          { value: "week", label: "Settimana" },
          { value: "month", label: "Mese" },
          { value: "last", label: "Mese scorso" },
        ].map((option) => (
          <Button key={option.value} onClick={() => setPreset(option.value)} size="sm" variant={preset === option.value ? "primary" : "ghost"}>
            {option.label}
          </Button>
        ))}
      </div>

      <StatGrid className="mb-6 md:grid-cols-3">
        <StatCard label="Appuntamenti" value={totals.appointments} detail="Nel periodo" />
        <StatCard label="Completati" value={totals.completed} detail="Servizi chiusi" />
        <StatCard label="Clienti unici" value={totals.customers} detail="Persone servite" />
      </StatGrid>

      {loading && <SectionCard><div className="h-36 animate-pulse rounded-2xl bg-stone-100" /></SectionCard>}
      {error && <InlineError>{error}</InlineError>}

      {!loading && !error && canAll && (
        <SectionCard title="Servizi piu richiesti" subtitle="I servizi che stanno portando piu appuntamenti nel periodo selezionato.">
          {services.length === 0 ? (
            <EmptyState title="Nessun servizio nel periodo" description="Cambia intervallo o attendi nuovi appuntamenti completati." />
          ) : (
            <div className="space-y-4">
              {services.slice(0, 5).map((item) => (
                <div key={item.service_id}>
                  <div className="mb-2 flex justify-between gap-3 text-sm">
                    <b className="text-stone-950">{item.service_name}</b>
                    <span className="font-black text-[#792f59]">{item.appointment_count}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[#f3e2eb]">
                    <div className="h-full rounded-full bg-[linear-gradient(90deg,#792f59,#d99aba,#f4d8a8)]" style={{ width: `${Number(item.appointment_count) / max * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {!loading && !error && (
        <SectionCard className="mt-6" title="Rendimento collaboratori" subtitle="Confronta volumi, assenze e servizio piu eseguito.">
          {staffRows.length === 0 ? (
            <EmptyState title="Nessun dato nel periodo" description="Cambia intervallo o attendi nuovi appuntamenti." />
          ) : (
            <div className="overflow-x-auto rounded-[1.75rem] border border-white/80 bg-white/90 ring-1 ring-stone-950/5">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-[#faf3f7] text-xs uppercase tracking-wider text-[#792f59]">
                  <tr>{["Staff", "Appuntamenti", "Completati", "No-show", "Cancellati", "Clienti unici", "Servizio top"].map((label) => <th key={label} className="p-4">{label}</th>)}</tr>
                </thead>
                <tbody>
                  {staffRows.map((item, index) => (
                    <tr key={item.staff_id ?? index} className="border-t border-stone-100 transition hover:bg-[#fffafd]">
                      <td className="p-4 font-bold text-stone-950">{item.staff_name ?? "Il tuo profilo"}</td>
                      <td>{item.appointment_count}</td>
                      <td>{item.completed_count}</td>
                      <td>{item.no_show_count}</td>
                      <td>{item.cancellation_count}</td>
                      <td>{item.unique_customers}</td>
                      <td>{item.most_performed_service ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
    </AppPage>
  );
}
