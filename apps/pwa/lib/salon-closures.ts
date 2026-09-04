export interface SalonClosure {
  date: string;
  recurringYearly: boolean;
}

function toISODate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA").format(date);
}

export function isDateClosed(date: Date, closures: SalonClosure[] | undefined): boolean {
  if (!closures?.length) return false;
  const iso = toISODate(date);
  return closures.some((closure) => closure.date === iso || (closure.recurringYearly && closure.date.slice(5) === iso.slice(5)));
}
