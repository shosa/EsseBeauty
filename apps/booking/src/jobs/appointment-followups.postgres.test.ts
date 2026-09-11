import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Job } from "bullmq";

import { createDatabase, type DrizzleDB } from "@esse-beauty/db";
import {
  appointments,
  customers,
  salonModules,
  salons,
  services,
  staff,
  waitlistEntries,
} from "@esse-beauty/db/schema";

import { testDatabaseUrl } from "../test/postgres.js";

import {
  processWaitlistRematch,
  type AppointmentFollowupJobData,
} from "./appointment-events.js";

const databaseUrl = testDatabaseUrl();
const postgresSuite = databaseUrl ? describe : describe.skip;

postgresSuite("appointment follow-up worker with PostgreSQL", () => {
  let db: DrizzleDB;
  beforeAll(() => { db = createDatabase(databaseUrl!); });
  afterAll(async () => { await db.$client.end(); });

  it("matches a waiting entry, notifies it by WhatsApp, and marks it notified", async () => {
    const salonId = randomUUID();
    const appointmentCustomerId = randomUUID();
    const waitlistCustomerId = randomUUID();
    const staffId = randomUUID();
    const serviceId = randomUUID();
    const appointmentId = randomUUID();
    const salonSlug = `waitlist-followup-${salonId}`;
    const startsAt = new Date("2026-08-26T10:00:00.000Z");
    await db.insert(salons).values({ id: salonId, locale: "it-IT", name: "Waitlist Follow-up", slug: salonSlug, timezone: "Europe/Rome" });
    try {
      await db.insert(customers).values([
        { fullName: "Appointment Customer", id: appointmentCustomerId, salonId },
        { fullName: "Waitlist Customer", id: waitlistCustomerId, phone: "+393331234567", phoneNormalized: "+393331234567", salonId },
      ]);
      await db.insert(staff).values({ color: "#000000", displayName: "Anna", id: staffId, salonId, workingHours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } });
      await db.insert(services).values({ category: "Viso", durationMinutes: 30, id: serviceId, name: "Pulizia viso", priceCents: 5000, salonId });
      await db.insert(appointments).values({ customerId: appointmentCustomerId, endsAt: new Date(startsAt.getTime() + 30 * 60_000), id: appointmentId, salonId, serviceId, source: "manual", staffId, startsAt, status: "cancelled" });
      await db.insert(salonModules).values({ enabled: true, moduleKey: "waitlist", salonId });
      const entry = (await db.insert(waitlistEntries).values({ customerId: waitlistCustomerId, requestedDate: startsAt, salonId, serviceId, status: "waiting", staffId }).returning())[0]!;

      const enqueued: Array<{ idempotencyKey: string; sourceId?: string; sourceType?: string; template: { name: string; parameters: string[] }; to: string }> = [];
      const job = { data: { appointmentId } } as Job<AppointmentFollowupJobData>;
      await processWaitlistRematch(db, job, {
        enqueue: async (_db, input) => {
          if (input.kind !== "template") throw new Error("Expected template delivery");
          enqueued.push(input);
          return { messageId: "message-1", outboxId: "outbox-1" };
        },
      });

      expect((await db.select({ status: waitlistEntries.status }).from(waitlistEntries).where(eq(waitlistEntries.id, entry.id)))[0]?.status).toBe("notified");
      expect(enqueued).toEqual([expect.objectContaining({
        idempotencyKey: `waitlist-notification-${entry.id}`,
        sourceId: entry.id,
        sourceType: "waitlist_entry",
        template: {
          locale: "it",
          name: "waitlist_slot_available",
          parameters: [
            "Waitlist Customer",
            "Pulizia viso",
            "26/08/2026",
            `http://localhost:3002/${salonSlug}/book?date=2026-08-26&serviceId=${serviceId}&staffId=${staffId}`,
          ],
        },
        to: "+393331234567",
      })]);
    } finally { await db.delete(salons).where(eq(salons.id, salonId)); }
  });

  it("reverts the entry to waiting and re-throws if notification delivery fails", async () => {
    const salonId = randomUUID();
    const appointmentCustomerId = randomUUID();
    const waitlistCustomerId = randomUUID();
    const staffId = randomUUID();
    const serviceId = randomUUID();
    const appointmentId = randomUUID();
    const startsAt = new Date("2026-08-26T10:00:00.000Z");
    await db.insert(salons).values({ id: salonId, locale: "it-IT", name: "Waitlist Failure", slug: `waitlist-failure-${salonId}`, timezone: "Europe/Rome" });
    try {
      await db.insert(customers).values([
        { fullName: "Appointment Customer", id: appointmentCustomerId, salonId },
        { fullName: "Waitlist Customer", id: waitlistCustomerId, phone: "+393331234567", phoneNormalized: "+393331234567", salonId },
      ]);
      await db.insert(staff).values({ color: "#000000", displayName: "Anna", id: staffId, salonId, workingHours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } });
      await db.insert(services).values({ category: "Viso", durationMinutes: 30, id: serviceId, name: "Pulizia viso", priceCents: 5000, salonId });
      await db.insert(appointments).values({ customerId: appointmentCustomerId, endsAt: new Date(startsAt.getTime() + 30 * 60_000), id: appointmentId, salonId, serviceId, source: "manual", staffId, startsAt, status: "cancelled" });
      await db.insert(salonModules).values({ enabled: true, moduleKey: "waitlist", salonId });
      const entry = (await db.insert(waitlistEntries).values({ customerId: waitlistCustomerId, requestedDate: startsAt, salonId, serviceId, status: "waiting", staffId }).returning())[0]!;

      const job = { data: { appointmentId } } as Job<AppointmentFollowupJobData>;
      await expect(processWaitlistRematch(db, job, {
        enqueue: async () => { throw new Error("provider unavailable"); },
      })).rejects.toThrow("WAITLIST_REMATCH_NOTIFY_FAILED");

      expect((await db.select({ status: waitlistEntries.status }).from(waitlistEntries).where(eq(waitlistEntries.id, entry.id)))[0]?.status).toBe("waiting");
    } finally { await db.delete(salons).where(eq(salons.id, salonId)); }
  });
});
