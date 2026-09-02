import { asc, eq } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import { salonLocations, type salons } from "@esse-beauty/db/schema";

type SalonRow = typeof salons.$inferSelect;

export async function ensurePrimaryLocation(db: DrizzleDB, salon: SalonRow) {
  const existing = await db.select().from(salonLocations)
    .where(eq(salonLocations.salonId, salon.id))
    .orderBy(asc(salonLocations.displayOrder), asc(salonLocations.createdAt));
  if (existing[0]) return existing[0];
  try {
    const inserted = await db.insert(salonLocations).values({
      address: salon.address,
      displayOrder: 0,
      email: salon.email,
      name: salon.name,
      phone: salon.phone,
      salonId: salon.id,
      timezone: salon.timezone,
    }).returning();
    if (inserted[0]) return inserted[0];
  } catch {
    const concurrent = await db.select().from(salonLocations)
      .where(eq(salonLocations.salonId, salon.id))
      .orderBy(asc(salonLocations.displayOrder), asc(salonLocations.createdAt));
    if (concurrent[0]) return concurrent[0];
    throw new Error("PRIMARY_LOCATION_NOT_CREATED");
  }
  throw new Error("PRIMARY_LOCATION_NOT_CREATED");
}
