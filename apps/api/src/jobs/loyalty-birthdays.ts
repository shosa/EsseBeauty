import { Worker } from "bullmq";
import { and, eq, isNull, sql } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import { customers, salons } from "@esse-beauty/db/schema";
import { isModuleEnabled, MODULE_KEYS } from "@esse-beauty/feature-flags";

import { todayMonthDayInTimezone } from "../lib/birthday.js";
import { awardBirthdayPoints, ensureLoyaltyRules } from "../lib/loyalty-engine.js";
import { getQueue, QUEUE_NAMES, redisConnection } from "@esse-beauty/comms-contracts";

export async function scanBirthdayLoyalty(db: DrizzleDB): Promise<number> {
  const salonRows = await db.select({ id: salons.id, timezone: salons.timezone }).from(salons);
  let awarded = 0;
  for (const salon of salonRows) {
    if (!(await isModuleEnabled(salon.id, MODULE_KEYS.LOYALTY, db))) continue;
    const rules = await ensureLoyaltyRules(db, salon.id);
    const rule = rules.find((item: any) => item.action === "birthday");
    if (!rule?.active || rule.points <= 0) continue;
    const monthDay = todayMonthDayInTimezone(salon.timezone ?? "Europe/Rome");
    const eligibleCustomers = await db.select({ id: customers.id }).from(customers).where(and(
      eq(customers.salonId, salon.id),
      eq(customers.blocked, false),
      isNull(customers.archivedAt),
      sql`${customers.birthday} is not null and substr(${customers.birthday}, 6, 5) = ${monthDay}`,
    ));
    for (const customer of eligibleCustomers) {
      const granted = await awardBirthdayPoints(db, { customerId: customer.id, points: rule.points, salonId: salon.id });
      if (granted) awarded += 1;
    }
  }
  return awarded;
}

export function startLoyaltyBirthdayWorker(db: DrizzleDB): Worker {
  return new Worker(
    QUEUE_NAMES.LOYALTY_BIRTHDAYS,
    async () => { await scanBirthdayLoyalty(db); },
    { connection: redisConnection() },
  );
}

export async function registerLoyaltyBirthdaySchedule(): Promise<void> {
  await getQueue(QUEUE_NAMES.LOYALTY_BIRTHDAYS).upsertJobScheduler(
    "scan-birthday-loyalty",
    { every: 24 * 60 * 60_000 },
    { name: "scan" },
  );
}
