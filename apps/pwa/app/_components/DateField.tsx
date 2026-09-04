"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const POPOVER_WIDTH = 288;

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
  isDateDisabled?: (date: Date) => boolean;
  label?: string;
  max?: string;
  min?: string;
  onChange: (value: string) => void;
  primary: string;
  value: string;
}

export function DateField({ disabled, id, isDateDisabled, label, max, min, onChange, primary, value }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => startOfMonth(value ? parseISODate(value) : new Date()));
  const [position, setPosition] = useState<{ left: number; top: number }>();
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => setPortalNode(document.body), []);

  useEffect(() => {
    function onOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({
        left: Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 12),
        top: rect.bottom + 8,
      });
    }
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

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
        ref={buttonRef}
        type="button"
      >
        <CalendarDays className="size-4 shrink-0" style={{ color: primary }} />
        {selected ? selected.toLocaleDateString("it-IT", { day: "numeric", month: "long", weekday: "short", year: "numeric" }) : label || "Seleziona data"}
      </button>

      {open && position && portalNode && createPortal(
        <div
          className="animate-pop fixed z-50 rounded-2xl border border-stone-100 bg-white p-4 shadow-[0_18px_44px_rgb(45_29_39_/_0.18)]"
          ref={popoverRef}
          style={{ left: position.left, top: position.top, width: POPOVER_WIDTH }}
        >
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
              const isDisabled = (minDate && day < minDate) || (maxDate && day > maxDate) || Boolean(isDateDisabled?.(day));
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
        </div>,
        portalNode,
      )}
    </div>
  );
}
