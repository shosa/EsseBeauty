import { randomUUID } from "node:crypto";

import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";

import { createDatabase, type DrizzleDB } from "@esse-beauty/db";
import { appointments, customers, reviewRequestSettings, salonModules, salons, services, staff, waitlistEntries } from "@esse-beauty/db/schema";

import { testDatabaseUrl } from "../test/postgres.js";

const fallbackQueue = vi.hoisted(() => ({
  add: vi.fn(async () => undefined),
  upsertJobScheduler: vi.fn(async () => undefined),
}));

vi.mock("./queues.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("./queues.js")>(),
  getQueue: () => fallbackQueue,
}));

import { registerAppointmentEventHooks } from "./appointment-events.js";
import { scheduleReviewInvitation, type ReviewQueue } from "./reviews.js";

const databaseUrl = testDatabaseUrl();
const postgresSuite = databaseUrl ? describe : describe.skip;

postgresSuite("appointment completion review hook with PostgreSQL", () => {
  let db: DrizzleDB;
  beforeAll(() => { db = createDatabase(databaseUrl!); });
  afterAll(async () => { await db.$client.end(); });

  it("re-publishes a repeated successful completion through one durable invitation and job id", async () => {
    const salonId = randomUUID();
    const customerId = randomUUID();
    const staffId = randomUUID();
    const serviceId = randomUUID();
    const appointmentId = randomUUID();
    await db.insert(salons).values({ id: salonId, locale: "it-IT", name: "Completion Hook", slug: `completion-hook-${salonId}`, timezone: "Europe/Rome" });
    try {
      await db.insert(customers).values({ email: "hook@example.invalid", fullName: "Mario Rossi", id: customerId, salonId });
      await db.insert(staff).values({ color: "#000000", displayName: "Anna", id: staffId, salonId, workingHours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } });
      await db.insert(services).values({ category: "Viso", durationMinutes: 30, id: serviceId, name: "Pulizia viso", priceCents: 5000, salonId });
      await db.insert(appointments).values({ customerId, endsAt: new Date(Date.now() + 30 * 60_000), id: appointmentId, salonId, serviceId, source: "manual", staffId, startsAt: new Date(), status: "confirmed" });
      await db.insert(salonModules).values({ enabled: true, moduleKey: "reviews", salonId });
      await db.insert(reviewRequestSettings).values({ automaticEnabled: true, channels: ["email"], delayPreset: "immediate", salonId });
      const queueAdd = vi.fn(async (
        _name: string,
        _data: { invitationId: string },
        _options?: { jobId?: string },
      ) => undefined);
      const queue = {
        add: queueAdd,
        upsertJobScheduler: vi.fn(async () => undefined),
      } as unknown as ReviewQueue;
      let secondScheduled!: () => void;
      const secondSchedule = new Promise<void>((resolve) => { secondScheduled = resolve; });
      const schedule = vi.fn(async (executor: DrizzleDB, id: string) => {
        const result = await scheduleReviewInvitation(executor, id, queue);
        if (schedule.mock.calls.length >= 2) secondScheduled();
        return result;
      });
      const app = Fastify();
      app.decorate("db", db);
      registerAppointmentEventHooks(app, { scheduleReviewInvitation: schedule });
      app.post<{ Params: { appointmentId: string } }>(
        "/api/salons/:id/appointments/:appointmentId/checkout",
        async (request) => {
          await db.update(appointments).set({ status: "completed" }).where(eq(appointments.id, request.params.appointmentId));
          return { ok: true };
        },
      );
      try {
        const first = await app.inject({ method: "POST", url: `/api/salons/${salonId}/appointments/${appointmentId}/checkout` });
        const second = await app.inject({ method: "POST", url: `/api/salons/${salonId}/appointments/${appointmentId}/checkout` });
        await Promise.race([
          secondSchedule,
          new Promise((_, reject) => setTimeout(() => reject(new Error("second completion was not scheduled")), 1_000)),
        ]);
        expect(first.statusCode).toBe(200);
        expect(second.statusCode).toBe(200);
        expect(schedule).toHaveBeenCalledTimes(2);
        const invitations = await db.execute(sql<{ count: number }>`select count(*)::int as count from review_invitations where appointment_id = ${appointmentId}::uuid`);
        expect(invitations[0]?.count).toBe(1);
        expect(new Set(queueAdd.mock.calls.map((call) => call[2]?.jobId)).size).toBe(1);
      } finally {
        await app.close();
      }
    } finally {
      await db.delete(salons).where(eq(salons.id, salonId));
    }
  });

  it("enqueues a cancelled-slot waitlist notice as a durable WhatsApp template", async () => {
    const salonId = randomUUID();
    const appointmentCustomerId = randomUUID();
    const waitlistCustomerId = randomUUID();
    const staffId = randomUUID();
    const serviceId = randomUUID();
    const appointmentId = randomUUID();
    const salonSlug = `waitlist-hook-${salonId}`;
    const startsAt = new Date("2026-08-26T10:00:00.000Z");
    await db.insert(salons).values({ id: salonId, locale: "it-IT", name: "Waitlist Hook", slug: salonSlug, timezone: "Europe/Rome" });
    try {
      await db.insert(customers).values([
        { fullName: "Appointment Customer", id: appointmentCustomerId, salonId },
        { fullName: "Waitlist Customer", id: waitlistCustomerId, phone: "+393331234567", phoneNormalized: "+393331234567", salonId },
      ]);
      await db.insert(staff).values({ color: "#000000", displayName: "Anna", id: staffId, salonId, workingHours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } });
      await db.insert(services).values({ category: "Viso", durationMinutes: 30, id: serviceId, name: "Pulizia viso", priceCents: 5000, salonId });
      await db.insert(appointments).values({ customerId: appointmentCustomerId, endsAt: new Date(startsAt.getTime() + 30 * 60_000), id: appointmentId, salonId, serviceId, source: "manual", staffId, startsAt, status: "confirmed" });
      await db.insert(salonModules).values({ enabled: true, moduleKey: "waitlist", salonId });
      const entry = (await db.insert(waitlistEntries).values({ customerId: waitlistCustomerId, requestedDate: startsAt, salonId, serviceId, status: "waiting", staffId }).returning())[0]!;
      const enqueued: Array<{ idempotencyKey: string; sourceId?: string; sourceType?: string; template: { name: string; parameters: string[] }; to: string }> = [];
      let enqueueObserved!: () => void;
      const enqueueComplete = new Promise<void>((resolve) => { enqueueObserved = resolve; });
      const app = Fastify();
      app.decorate("db", db);
      registerAppointmentEventHooks(app, {
        enqueue: async (_db, input) => {
          if (input.kind !== "template") throw new Error("Expected template delivery");
          enqueued.push(input);
          enqueueObserved();
          return { messageId: "message-1", outboxId: "outbox-1" };
        },
      });
      app.patch<{ Params: { appointmentId: string }; Body: { status: "cancelled" } }>(
        "/api/salons/:id/appointments/:appointmentId",
        async (request) => {
          await db.update(appointments).set({ status: request.body.status }).where(eq(appointments.id, request.params.appointmentId));
          return { ok: true };
        },
      );
      try {
        const response = await app.inject({ method: "PATCH", payload: { status: "cancelled" }, url: `/api/salons/${salonId}/appointments/${appointmentId}` });
        expect(response.statusCode).toBe(200);
        await enqueueComplete;
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
      } finally { await app.close(); }
    } finally { await db.delete(salons).where(eq(salons.id, salonId)); }
  });
});
