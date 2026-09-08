import type { WorkingHours } from "@esse-beauty/shared";

export interface SalonClosure {
  date: string;
  recurringYearly: boolean;
}

function toISODate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA").format(date);
}

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function isDateClosed(date: Date, closures: SalonClosure[] | undefined, openingHours?: WorkingHours): boolean {
  const iso = toISODate(date);
  const isClosure = closures?.some((closure) => closure.date === iso || (closure.recurringYearly && closure.date.slice(5) === iso.slice(5))) ?? false;
  const weekday = WEEKDAYS[date.getDay()] ?? "sun";
  const isNonWorkingDay = openingHours ? (openingHours[weekday]?.length ?? 0) === 0 : false;
  return isClosure || isNonWorkingDay;
}
