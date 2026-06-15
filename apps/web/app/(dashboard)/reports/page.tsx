"use client";

import { useEffect, useState } from "react";

import { PERMISSION_KEYS } from "@esse-beauty/shared";

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
              ? "Il modulo Performance staff non è attivo o non hai i permessi necessari."
              : "Impossibile caricare i report.",
          );
        }
        const staffData: unknown = await staffResponse.json();
        const serviceData: unknown = serviceResponse
          ? await serviceResponse.json()
          : [];
        if (!Array.isArray(staffData) || !Array.isArray(serviceData)) {
          throw new Error("La risposta dei report non è valida.");
        }
        setStaffRows(staffData as StaffRow[]);
        setServices(serviceData as ServiceRow[]);
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setStaffRows([]);
          setServices([]);
          setError(
            reason instanceof Error
              ? reason.message
              : "Impossibile caricare i report.",
          );
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [canAll, preset, salon]);

  const max = Math.max(
    1,
    ...services.map((item) => Number(item.appointment_count)),
  );

  function exportCsv() {
    const query = new URLSearchParams(dates(preset));
    window.location.href = `${api}/api/salons/${salon?.id}/reports/export?${query}`;
  }

  return (
    <main className="min-h-screen bg-[#f6f2f4] p-5 md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#792f59]">Andamento</p>
            <h1 className="mt-2 text-3xl font-bold">Performance staff</h1>
          </div>
          {hasPermission(PERMISSION_KEYS.REPORTS_EXPORT) && (
            <button onClick={exportCsv} className="rounded-xl bg-[#402334] px-5 py-3 font-bold text-white">
              Esporta CSV
            </button>
          )}
        </header>

        <div className="mt-6 flex flex-wrap gap-2">
          {[
            { value: "today", label: "Oggi" },
            { value: "week", label: "Settimana" },
            { value: "month", label: "Mese" },
            { value: "last", label: "Mese scorso" },
          ].map((option) => (
            <button key={option.value} onClick={() => setPreset(option.value)} className={`rounded-full px-4 py-2 text-sm ${preset === option.value ? "bg-[#792f59] text-white" : "bg-white"}`}>
              {option.label}
            </button>
          ))}
        </div>

        {loading && <div className="mt-6 h-40 animate-pulse rounded-[2rem] bg-white" />}
        {error && <p className="mt-6 rounded-2xl bg-amber-50 p-5 text-sm text-amber-900">{error}</p>}

        {!loading && !error && canAll && (
          <section className="mt-6 rounded-[2rem] bg-white p-6">
            <h2 className="text-xl font-bold">Servizi più richiesti</h2>
            <div className="mt-5 space-y-4">
              {services.slice(0, 5).map((item) => (
                <div key={item.service_id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <b>{item.service_name}</b>
                    <span>{item.appointment_count}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full rounded-full bg-[#a33d72]" style={{ width: `${Number(item.appointment_count) / max * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && !error && (
          <div className="mt-6 overflow-x-auto rounded-[2rem] bg-white">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-[#402334] text-white">
                <tr>{["Staff", "Appuntamenti", "Completati", "No-show", "Cancellati", "Clienti unici", "Servizio top"].map((label) => <th key={label} className="p-4">{label}</th>)}</tr>
              </thead>
              <tbody>
                {staffRows.map((item, index) => (
                  <tr key={item.staff_id ?? index} className="border-b border-stone-100">
                    <td className="p-4 font-bold">{item.staff_name ?? "Il tuo profilo"}</td>
                    <td>{item.appointment_count}</td>
                    <td>{item.completed_count}</td>
                    <td>{item.no_show_count}</td>
                    <td>{item.cancellation_count}</td>
                    <td>{item.unique_customers}</td>
                    <td>{item.most_performed_service ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
