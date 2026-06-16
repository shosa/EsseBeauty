"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PERMISSION_KEYS } from "@esse-beauty/shared";
import { AppPage, Button, InlineError, PageHeader, PageTransition } from "@esse-beauty/ui";

import { useAuth } from "../../../lib/auth-context";

const api = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Appointment {
  color: string;
  customer_name: string;
  ends_at: string;
  id: string;
  service_name: string;
  staff_name: string;
  starts_at: string;
  status?: string;
}

export default function CalendarPage() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [error, setError] = useState("");
  const { hasPermission, salon } = useAuth();
  const canCreate =
    hasPermission(PERMISSION_KEYS.CALENDAR_MANAGE_OTHERS) ||
    hasPermission(PERMISSION_KEYS.CALENDAR_MANAGE_OWN);

  const monday = useMemo(() => {
    const date = new Date();
    const offset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - offset + weekOffset * 7);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [weekOffset]);
  const days = Array.from({ length: 7 }, (_, index) => new Date(monday.getTime() + index * 86400000));

  useEffect(() => {
    if (!salon) return;
    const to = new Date(monday.getTime() + 7 * 86400000);
    void fetch(`${api}/api/salons/${salon.id}/appointments?from=${monday.toISOString()}&to=${to.toISOString()}`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Impossibile caricare il calendario.");
        const data: unknown = await response.json();
        setItems(Array.isArray(data) ? data as Appointment[] : []);
        setError("");
      })
      .catch((reason: Error) => setError(reason.message));
  }, [monday, salon?.id]);

  return (
    <AppPage maxWidth="max-w-[1500px]">
      <PageTransition>
        <PageHeader
          eyebrow="Agenda"
          title="Calendario"
          subtitle="Vista settimanale degli appuntamenti."
          actions={<div className="flex flex-wrap items-center gap-2">
            {canCreate && <Link href="/calendar/appointments/new" className="inline-flex min-h-11 items-center rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-stone-800">Nuovo appuntamento</Link>}
            <Button onClick={() => setWeekOffset((value) => value - 1)} variant="outline">Prec.</Button>
            <Button onClick={() => setWeekOffset(0)} variant="secondary">Oggi</Button>
            <Button onClick={() => setWeekOffset((value) => value + 1)} variant="outline">Succ.</Button>
          </div>}
        />

        {error && <InlineError className="mb-4">{error}</InlineError>}

        <div className="overflow-x-auto rounded-3xl border border-white/70 bg-white/80 shadow-lg shadow-stone-200/60 ring-1 ring-stone-950/5 backdrop-blur">
          <div className="grid min-w-[900px] grid-cols-7">
            {days.map((day) => (
              <section key={day.toISOString()} className="min-h-[650px] border-r border-stone-100 last:border-0">
                <header className="sticky top-0 z-10 border-b border-stone-100 bg-white/90 p-3 text-center backdrop-blur">
                  <p className="text-xs uppercase tracking-wider text-stone-400">{day.toLocaleDateString("it-IT", { weekday: "short" })}</p>
                  <strong className="text-lg">{day.getDate()}</strong>
                </header>
                <div className="space-y-2 p-2">
                  {items
                    .filter((item) => new Date(item.starts_at).toDateString() === day.toDateString())
                    .map((item) => (
                      <Link
                        key={item.id}
                        href={`/calendar/appointments/${item.id}`}
                        className="block rounded-2xl border border-stone-100 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#792f59] hover:shadow-md"
                        style={{ borderLeft: `4px solid ${item.color}` }}
                      >
                        <strong className="block text-xs text-stone-500">{new Date(item.starts_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</strong>
                        <span className="mt-1 block truncate text-sm font-bold text-stone-950">{item.customer_name}</span>
                        <span className="block truncate text-xs text-stone-500">{item.service_name} - {item.staff_name}</span>
                      </Link>
                    ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </PageTransition>
    </AppPage>
  );
}
