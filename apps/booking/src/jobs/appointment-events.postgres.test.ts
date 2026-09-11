import { randomUUID } from "node:crypto";

import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import { createDatabase, type DrizzleDB } from "@esse-beauty/db";
import { appointments, customers, salonModules, salons, services, staff } from "@esse-beauty/db/schema";

import { testDatabaseUrl } from "../test/postgres.js";
import { registerAppointmentEventHooks } from "./appointment-events.js";

const databaseUrl = testDatabaseUrl();
const postgresSuite = databaseUrl ? describe : describe.skip;

postgresSuite("appointment cancellation hook with PostgreSQL", () => {
  let db: DrizzleDB;
  beforeAll(() => { db = createDatabase(databaseUrl!); });
  afterAll(async () => { await db.$client.end(); });

  it("schedules a waitlist rematch follow-up job instead of notifying inline", async () => {
    const salonId = randomUUID();
    const appointmentCustomerId = randomUUID();
    const staffId = randomUUID();
    const serviceId = randomUUID();
    const appointmentId = randomUUID();
    await db.insert(salons).values({ id: salonId, locale: "it-IT", name: "Waitlist Hook", slug: `waitlist-hook-${salonId}`, timezone: "Europe/Rome" });
    try {
      await db.insert(customers).values({ fullName: "Appointment Customer", id: appointmentCustomerId, salonId });
      await db.insert(staff).values({ color: "#000000", displayName: "Anna", id: staffId, salonId, workingHours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } });
      await db.insert(services).values({ category: "Viso", durationMinutes: 30, id: serviceId, name: "Pulizia viso", priceCents: 5000, salonId });
      await db.insert(appointments).values({ customerId: appointmentCustomerId, endsAt: new Date(Date.now() + 30 * 60_000), id: appointmentId, salonId, serviceId, source: "manual", staffId, startsAt: new Date(), status: "confirmed" });
      await db.insert(salonModules).values({ enabled: true, moduleKey: "waitlist", salonId });
      const queueAdd = vi.fn(async (
        _name: "rematch-waitlist",
        _data: { appointmentId: string },
        _options?: { jobId?: string },
      ) => undefined);
      const app = Fastify();
      app.decorate("db", db);
      registerAppointmentEventHooks(app, { followupQueue: { add: queueAdd } });
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
        await vi.waitFor(() => expect(queueAdd).toHaveBeenCalledTimes(1));
        expect(queueAdd).toHaveBeenCalledWith(
          "rematch-waitlist",
          { appointmentId },
          expect.objectContaining({ jobId: `waitlist-rematch-${appointmentId}` }),
        );
      } finally { await app.close(); }
    } finally { await db.delete(salons).where(eq(salons.id, salonId)); }
  });
});
