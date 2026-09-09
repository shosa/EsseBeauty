import type { WorkingHours } from "@esse-beauty/shared";

export const weekdayKeys: Array<keyof WorkingHours> = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function dayRange(days = 1) {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + days);
  return new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
}

export function weekRange(offset: number) {
  const from = new Date();
  const weekdayOffset = (from.getDay() + 6) % 7;
  from.setDate(from.getDate() - weekdayOffset + offset * 7);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  return {
    from,
    label: `${from.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })} - ${new Date(to.getTime() - 1).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}`,
    params: new URLSearchParams({ from: from.toISOString(), to: to.toISOString() }),
    to,
  };
}

export function time(value: string) {
  return new Date(value).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export function dayLabel(value: string) {
  return new Date(value).toLocaleDateString("it-IT", { day: "2-digit", month: "short", weekday: "short" }).toUpperCase();
}

export function dateTime(value: string) {
  return new Date(value).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });
}

export function minutesOfPeriod(value: string) {
  const [hours = "0", minute = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minute);
}

export function sameDate(value: string, day: Date) {
  return new Date(value).toDateString() === day.toDateString();
}

export function durationLabel(startsAt: string, endsAt: string) {
  const minutes = Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours}h ${rest}min`;
  if (hours) return `${hours}h`;
  return `${minutes} min`;
}

export function isoDateLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
