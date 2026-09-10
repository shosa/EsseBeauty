"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DateField } from "@esse-beauty/ui";

import { staffRequest } from "../../lib/staff-auth";
import { isoDateLocal, sameDate, weekRange } from "../../lib/format";
import type { Appointment, CalendarBlock } from "../../lib/types";
import { DayTimeline } from "../_components/DayTimeline";
import { useStaffAuth } from "../_components/StaffAuthProvider";

export default function StaffAgendaPage() {
  const { session } = useStaffAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [calendarBlocks, setCalendarBlocks] = useState<CalendarBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => (new Date().getDay() + 6) % 7);

  const selectedWeek = useMemo(() => weekRange(weekOffset), [weekOffset]);
  const selectedDay = useMemo(() => {
    const day = new Date(selectedWeek.from);
    day.setDate(day.getDate() + selectedDayIndex);
    return day;
  }, [selectedDayIndex, selectedWeek.from]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    setError("");
    Promise.all([
      staffRequest<Appointment[]>(`/api/staff-app/appointments?${selectedWeek.params}`),
      staffRequest<CalendarBlock[]>(`/api/staff-app/calendar-blocks?${selectedWeek.params}`),
    ])
      .then(([rows, blocks]) => {
        setAppointments(rows);
        setCalendarBlocks(blocks);
      })
      .catch(() => setError("Agenda non disponibile."))
      .finally(() => setLoading(false));
  }, [session, selectedWeek.params]);

  function shiftWeek(delta: number) {
    const next = weekOffset + delta;
    setWeekOffset(next);
    setSelectedDayIndex(next === 0 ? (new Date().getDay() + 6) % 7 : 0);
  }

  function resetWeek() {
    setWeekOffset(0);
    setSelectedDayIndex((new Date().getDay() + 6) % 7);
  }

  function selectDate(iso: string) {
    if (!iso) return;
    const [year, month, day] = iso.split("-").map(Number);
    if (!year || !month || !day) return;
    const target = new Date(year, month - 1, day);
    const currentMonday = weekRange(0).from;
    const diffDays = Math.round((target.getTime() - currentMonday.getTime()) / 86400000);
    setWeekOffset(Math.floor(diffDays / 7));
    setSelectedDayIndex(((diffDays % 7) + 7) % 7);
  }

  if (!session) return null;

  return (
    <main className="mx-auto max-w-md space-y-4 p-4 lg:max-w-3xl lg:p-8">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#8f3a68]">Calendario personale</p>
        <h1 className="mt-1 text-3xl font-bold leading-tight tracking-[-.025em] text-stone-950">La tua agenda</h1>
        <p className="mt-2 text-sm leading-6 text-stone-500">{appointments.length} appuntamenti · {selectedWeek.label}</p>
      </header>
      {error && <p className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
      <div className="grid grid-cols-[48px_1fr_48px_48px] gap-2 rounded-2xl border border-stone-200 bg-white p-2">
        <button aria-label="Settimana precedente" className="grid min-h-11 place-items-center rounded-xl text-2xl font-bold text-[#792f59] transition active:bg-[#f3e2eb]" onClick={() => shiftWeek(-1)} type="button">‹</button>
        <button className="min-h-11 rounded-xl bg-[#faf3f7] px-3 text-sm font-black text-[#792f59] transition active:scale-[.98]" onClick={resetWeek} type="button">
          {weekOffset === 0 ? "Questa settimana" : "Torna a oggi"}
        </button>
        <DateField aria-label="Vai a una data" onChange={selectDate} value={isoDateLocal(selectedDay)} variant="icon" />
        <button aria-label="Settimana successiva" className="grid min-h-11 place-items-center rounded-xl text-2xl font-bold text-[#792f59] transition active:bg-[#f3e2eb]" onClick={() => shiftWeek(1)} type="button">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 rounded-2xl border border-stone-200 bg-white p-2">
        {Array.from({ length: 7 }, (_, index) => {
          const day = new Date(selectedWeek.from);
          day.setDate(day.getDate() + index);
          const count = appointments.filter((item) => sameDate(item.starts_at, day)).length;
          const active = selectedDayIndex === index;
          return (
            <button className={`min-w-0 rounded-xl py-2 text-center transition ${active ? "text-white shadow-md" : "text-stone-500"}`} key={day.toISOString()} onClick={() => setSelectedDayIndex(index)} style={active ? { background: session.staff.color } : undefined} type="button">
              <span className="block text-[9px] font-black uppercase">{day.toLocaleDateString("it-IT", { weekday: "short" })}</span>
              <strong className="mt-1 block text-base">{day.getDate()}</strong>
              <span className={`mx-auto mt-1 block size-1.5 rounded-full ${count ? active ? "bg-white" : "bg-[#792f59]" : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>
      {loading ? <div className="h-96 animate-pulse rounded-3xl bg-stone-100" /> : (
        <DayTimeline
          appointments={appointments.filter((item) => sameDate(item.starts_at, selectedDay))}
          blocks={calendarBlocks.filter((item) => sameDate(item.starts_at, selectedDay))}
          color={session.staff.color}
          day={selectedDay}
          name={session.staff.display_name}
          onOpen={(id) => router.push(`/agenda/${id}`)}
          workingHours={session.staff.working_hours}
        />
      )}
    </main>
  );
}
