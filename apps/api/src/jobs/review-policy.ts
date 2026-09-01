export type ReviewDelayPreset = "immediate" | "one_hour" | "three_hours" | "next_day" | "two_days";

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { day: "2-digit", hour: "2-digit", hourCycle: "h23", month: "2-digit", timeZone: timezone, year: "numeric" }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function localTimeToUtc(year: number, month: number, day: number, hour: number, timezone: string) {
  let candidate = new Date(Date.UTC(year, month - 1, day, hour));
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = zonedParts(candidate, timezone);
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour));
    candidate = new Date(candidate.getTime() + (Date.UTC(year, month - 1, day, hour) - represented));
  }
  return candidate;
}

export function scheduledReviewTime(completedAt: Date, preset: ReviewDelayPreset, timezone: string): Date {
  if (preset === "immediate") return new Date(completedAt);
  if (preset === "one_hour") return new Date(completedAt.getTime() + 60 * 60_000);
  if (preset === "three_hours") return new Date(completedAt.getTime() + 3 * 60 * 60_000);
  const parts = zonedParts(completedAt, timezone);
  const localNoon = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12));
  localNoon.setUTCDate(localNoon.getUTCDate() + (preset === "next_day" ? 1 : 2));
  return localTimeToUtc(localNoon.getUTCFullYear(), localNoon.getUTCMonth() + 1, localNoon.getUTCDate(), 10, timezone);
}
