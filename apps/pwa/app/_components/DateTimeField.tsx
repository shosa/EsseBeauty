"use client";

import { Clock } from "lucide-react";

import { DateField } from "./DateField";

function splitValue(value: string): { date: string; time: string } {
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

interface DateTimeFieldProps {
  min?: string;
  onChange: (value: string) => void;
  primary: string;
  value: string;
}

export function DateTimeField({ min, onChange, primary, value }: DateTimeFieldProps) {
  const { date, time } = splitValue(value);
  const minDate = min ? splitValue(min).date : undefined;

  return (
    <div className="mt-2 grid grid-cols-[1fr,auto] gap-2">
      <DateField min={minDate} onChange={(nextDate) => onChange(`${nextDate}T${time || "09:00"}`)} primary={primary} value={date} />
      <label className="relative flex min-h-12 w-[92px] items-center gap-1.5 rounded-2xl border border-stone-200 bg-white px-2.5 text-sm font-bold text-stone-800">
        <Clock className="size-4 shrink-0" style={{ color: primary }} />
        <input
          className="w-full min-h-0 appearance-none border-0 bg-transparent p-0 text-sm font-bold text-stone-800 shadow-none outline-none"
          onChange={(event) => onChange(`${date || new Date().toISOString().slice(0, 10)}T${event.target.value}`)}
          type="time"
          value={time}
        />
      </label>
    </div>
  );
}
