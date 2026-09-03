"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

function toISODate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA").format(date);
}

function parseISODate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year ?? new Date().getFullYear(), (month ?? 1) - 1, day ?? 1);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

const WEEKDAY_LABELS = ["L", "M", "M", "G", "V", "S", "D"];

interface DateFieldProps {
  disabled?: boolean;
  id?: string;
  label?: string;
  max?: string;
  min?: string;
  onChange: (value: string) => void;
  primary: string;
  value: string;
}

export function DateField({ disabled, id, label, max, min, onChange, primary, value }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => startOfMonth(value ? parseISODate(value) : new Date()));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutsideClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  const selected = value ? parseISODate(value) : undefined;
  const minDate = min ? parseISODate(min) : undefined;
  const maxDate = max ? parseISODate(max) : undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstWeekday = (cursor.getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: Array<Date | undefined> = [
    ...Array.from({ length: firstWeekday }, () => undefined),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(cursor.getFullYear(), cursor.getMonth(), index + 1)),
  ];

  function selectDay(day: Date) {
    onChange(toISODate(day));
    setOpen(false);
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        className="flex min-h-12 w-full items-center gap-2.5 rounded-2xl border border-stone-200 bg-white px-4 text-left text-sm font-bold text-stone-800 transition-colors disabled:opacity-50"
        disabled={disabled}
        id={id}
        onClick={() => setOpen((state) => !state)}
        type="button"
      >
        <CalendarDays className="size-4 shrink-0" style={{ color: primary }} />
        {selected ? selected.toLocaleDateString("it-IT", { day: "numeric", month: "long", weekday: "short", year: "numeric" }) : label || "Seleziona data"}
      </button>

      {open && (
        <div className="animate-pop absolute left-0 top-[calc(100%+8px)] z-20 w-72 origin-top rounded-2xl border border-stone-100 bg-white p-4 shadow-[0_18px_44px_rgb(45_29_39_/_0.18)]">
          <div className="flex items-center justify-between">
            <button className="grid size-8 place-items-center rounded-full text-stone-500 hover:bg-stone-100" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} type="button"><ChevronLeft className="size-4" /></button>
            <p className="text-sm font-black capitalize text-stone-800">{cursor.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}</p>
            <button className="grid size-8 place-items-center rounded-full text-stone-500 hover:bg-stone-100" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} type="button"><ChevronRight className="size-4" /></button>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-black text-stone-400">
            {WEEKDAY_LABELS.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} />;
              const iso = toISODate(day);
              const isSelected = selected && toISODate(selected) === iso;
              const isToday = toISODate(today) === iso;
              const isDisabled = (minDate && day < minDate) || (maxDate && day > maxDate);
              return (
                <button
                  className={`grid size-9 place-items-center rounded-full text-sm font-bold transition ${isSelected ? "text-white" : isDisabled ? "text-stone-300" : "text-stone-700 hover:bg-stone-100"}`}
                  disabled={Boolean(isDisabled)}
                  key={iso}
                  onClick={() => selectDay(day)}
                  style={isSelected ? { background: primary } : isToday ? { boxShadow: `inset 0 0 0 1.5px ${primary}` } : undefined}
                  type="button"
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
