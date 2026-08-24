import { randomUUID } from "node:crypto";

import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";

import { createDatabase, type DrizzleDB } from "@esse-beauty/db";
import { appointments, customers, salonModules, salons, services, staff } from "@esse-beauty/db/schema";

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
});
