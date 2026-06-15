import type {
  ComputeAvailableSlotsInput,
  TimeRange,
  TimeSlot,
  Weekday,
} from "../types.js";

const weekdayByIndex: Weekday[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

function zonedDateToUtc(date: string, time: string, timezone: string): Date {
  const dateParts = date.split("-").map(Number);
  const timeParts = time.split(":").map(Number);
  const year = dateParts[0]!;
  const month = dateParts[1]!;
  const day = dateParts[2]!;
  const hour = timeParts[0]!;
  const minute = timeParts[1]!;
  let timestamp = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(timestamp))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]),
    ) as Record<string, number>;
    const represented = Date.UTC(
      parts.year!,
      parts.month! - 1,
      parts.day!,
      parts.hour!,
      parts.minute!,
      parts.second!,
    );
    timestamp += Date.UTC(year, month - 1, day, hour, minute) - represented;
  }

  return new Date(timestamp);
}

function overlaps(start: Date, end: Date, range: TimeRange): boolean {
  return start < new Date(range.endsAt) && end > new Date(range.startsAt);
}

export function computeAvailableSlots({
  date,
  timezone,
  workingHours,
  durationMinutes,
  appointments = [],
  blocks = [],
  intervalMinutes = 15,
}: ComputeAvailableSlotsInput): TimeSlot[] {
  const dateParts = date.split("-").map(Number);
  const year = dateParts[0]!;
  const month = dateParts[1]!;
  const day = dateParts[2]!;
  const weekday = weekdayByIndex[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]!;
  const durationMs = durationMinutes * 60_000;
  const intervalMs = intervalMinutes * 60_000;
  const busy = [...appointments, ...blocks];
  const slots: TimeSlot[] = [];

  for (const interval of workingHours[weekday] ?? []) {
    const opening = zonedDateToUtc(date, interval.from, timezone);
    const closing = zonedDateToUtc(date, interval.to, timezone);

    for (
      let startsAt = opening.getTime();
      startsAt + durationMs <= closing.getTime();
      startsAt += intervalMs
    ) {
      const start = new Date(startsAt);
      const end = new Date(startsAt + durationMs);
      slots.push({
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        available: !busy.some((range) => overlaps(start, end, range)),
      });
    }
  }

  return slots;
}
