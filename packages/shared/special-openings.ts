import { and, eq } from "drizzle-orm";

import { salonSpecialOpeningStaff, salonSpecialOpenings, type TimePeriods } from "@esse-beauty/db/schema";
import type { Weekday, WorkingHours } from "./types.js";

const weekdayByIndex: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export interface SpecialOpening {
  id: string;
  periods: TimePeriods;
  reason: string | null;
  staff: Array<{ periods: TimePeriods | null; staffId: string }>;
}

export function weekdayForDate(date: string): Weekday {
  const [year, month, day] = date.split("-").map(Number);
  return weekdayByIndex[new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay()]!;
}

export async function findSpecialOpening(db: any, salonId: string, date: string): Promise<SpecialOpening | undefined> {
  const openingRows = await db.select().from(salonSpecialOpenings).where(and(
    eq(salonSpecialOpenings.salonId, salonId),
    eq(salonSpecialOpenings.date, date),
  ));
  const opening = openingRows[0];
  if (!opening) return undefined;
  const staffRows = await db.select({
    periods: salonSpecialOpeningStaff.periods,
    staffId: salonSpecialOpeningStaff.staffId,
  }).from(salonSpecialOpeningStaff).where(eq(salonSpecialOpeningStaff.specialOpeningId, opening.id));
  return { id: opening.id, periods: opening.periods, reason: opening.reason, staff: staffRows };
}

export async function hasSpecialOpening(db: any, salonId: string, date: string): Promise<boolean> {
  return Boolean(await findSpecialOpening(db, salonId, date));
}

export function applySpecialOpeningHours(
  workingHours: WorkingHours,
  date: string,
  opening: SpecialOpening | undefined,
  staffId: string,
): WorkingHours {
  if (!opening) return workingHours;
  const entry = opening.staff.find((item) => item.staffId === staffId);
  if (!entry) return workingHours;
  return { ...workingHours, [weekdayForDate(date)]: entry.periods ?? opening.periods };
}
