import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Job } from "bullmq";

import { createDatabase, type DrizzleDB } from "@esse-beauty/db";
import { appointments, customers, reminders, salons, services, staff } from "@esse-beauty/db/schema";

import { processReminder } from "./reminders.js";
import { testDatabaseUrl } from "../test/postgres.js";

const databaseUrl = testDatabaseUrl();
const postgresSuite = databaseUrl ? describe : describe.skip;

postgresSuite("reminder delivery with PostgreSQL", () => {
  let db: DrizzleDB;

  beforeAll(() => { db = createDatabase(databaseUrl!); });
  afterAll(async () => { await db.$client.end(); });

  it("enqueues an appointment reminder as a WhatsApp template", async () => {
    const salonId = randomUUID();
    const customerId = randomUUID();
    const staffId = randomUUID();
    const serviceId = randomUUID();
    const appointmentId = randomUUID();
    await db.insert(salons).values({ id: salonId, locale: "it-IT", name: "Reminder Test", slug: `reminder-${salonId}`, timezone: "Europe/Rome" });
    try {
      await db.insert(customers).values({ fullName: "Mario Rossi", id: customerId, phone: "+393331234567", phoneNormalized: "+393331234567", salonId });
      await db.insert(staff).values({ color: "#000", displayName: "Anna", id: staffId, salonId, workingHours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } });
      await db.insert(services).values({ category: "Viso", durationMinutes: 30, id: serviceId, name: "Pulizia", priceCents: 5000, salonId });
      await db.insert(appointments).values({ customerId, endsAt: new Date(), id: appointmentId, salonId, serviceId, source: "manual", staffId, startsAt: new Date(), status: "confirmed" });
      const reminder = (await db.insert(reminders).values({
        appointmentId,
        channel: "whatsapp",
        payload: { customerName: "Mario Rossi", phone: "+393331234567", salonName: "Reminder Test", serviceName: "Pulizia", staffName: "Anna", startsAt: "2026-08-25T10:00:00.000Z" },
        salonId,
        scheduledAt: new Date(),
      }).returning())[0]!;
      const enqueued: Array<{ idempotencyKey: string; kind: string; sourceId?: string; template: { name: string }; to: string }> = [];

      await processReminder(db, { data: { reminderId: reminder.id } } as Job<{ reminderId: string }>, {
        enqueue: async (_db, input) => {
          if (input.kind !== "template") throw new Error("Expected a template");
          enqueued.push(input);
          return { messageId: "message-1", outboxId: "outbox-1" };
        },
      });

      expect(enqueued).toEqual([expect.objectContaining({
        idempotencyKey: `appointment-reminder-${reminder.id}`,
        kind: "template",
        sourceId: reminder.id,
        template: expect.objectContaining({ name: "appointment_reminder" }),
        to: "+393331234567",
      })]);
      const stored = (await db.select({ status: reminders.status }).from(reminders).where(eq(reminders.id, reminder.id)))[0];
      expect(stored?.status).toBe("sent");
    } finally {
      await db.delete(salons).where(eq(salons.id, salonId));
    }
  });
});
