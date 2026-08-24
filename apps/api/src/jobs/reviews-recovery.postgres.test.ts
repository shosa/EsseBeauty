import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";

import { createDatabase, type DrizzleDB } from "@esse-beauty/db";
import { appointments, customers, salons, services, staff } from "@esse-beauty/db/schema";

import { testDatabaseUrl } from "../test/postgres.js";
import * as reviewJobs from "./reviews.js";

interface FakeReviewQueue {
  add: ReturnType<typeof vi.fn>;
  upsertJobScheduler: ReturnType<typeof vi.fn>;
}

type ScheduleReview = (db: DrizzleDB, appointmentId: string, queue: FakeReviewQueue) => Promise<{ id: string }>;
type RecoverReviews = (db: DrizzleDB, queue: FakeReviewQueue) => Promise<number>;
type RetryReview = (
  db: DrizzleDB,
  salonId: string,
  invitationId: string,
  queue: FakeReviewQueue,
) => Promise<{ id: string }>;

const databaseUrl = testDatabaseUrl();
const postgresSuite = databaseUrl ? describe : describe.skip;

postgresSuite("review queue recovery with PostgreSQL", () => {
  let db: DrizzleDB;
  beforeAll(() => { db = createDatabase(databaseUrl!); });
  afterAll(async () => { await db.$client.end(); });

  it("recovers a durable invitation after queue add failure and reuses a stable job id", async () => {
    const schedule = (reviewJobs as unknown as { scheduleReviewInvitation?: ScheduleReview }).scheduleReviewInvitation;
    const recover = (reviewJobs as unknown as { recoverReviewInvitations?: RecoverReviews }).recoverReviewInvitations;
    expect(schedule).toBeTypeOf("function");
    expect(recover).toBeTypeOf("function");
    if (!schedule || !recover) return;

    const salonId = randomUUID();
    const customerId = randomUUID();
    const staffId = randomUUID();
    const serviceId = randomUUID();
    const appointmentId = randomUUID();
    await db.insert(salons).values({ id: salonId, locale: "it-IT", name: "Queue Recovery", slug: `queue-recovery-${salonId}`, timezone: "Europe/Rome" });
    try {
      await db.insert(customers).values({ email: "queue@example.invalid", fullName: "Mario Rossi", id: customerId, salonId });
      await db.insert(staff).values({ color: "#000000", displayName: "Anna", id: staffId, salonId, workingHours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } });
      await db.insert(services).values({ category: "Viso", durationMinutes: 30, id: serviceId, name: "Pulizia viso", priceCents: 5000, salonId });
      await db.insert(appointments).values({ customerId, endsAt: new Date(Date.now() + 30 * 60_000), id: appointmentId, salonId, serviceId, source: "manual", staffId, startsAt: new Date(), status: "completed" });
      const failingQueue: FakeReviewQueue = {
        add: vi.fn(async () => { throw new Error("redis unavailable"); }),
        upsertJobScheduler: vi.fn(),
      };

      await expect(schedule(db, appointmentId, failingQueue)).rejects.toThrow("redis unavailable");
      const durable = await db.execute(sql<{ delivery_attempts: number; delivery_status: string; id: string; token_hash: string | null }>`
        select id, delivery_attempts, delivery_status, token_hash from review_invitations where appointment_id = ${appointmentId}::uuid
      `);
      expect(durable).toEqual([{
        delivery_attempts: 0,
        delivery_status: "pending",
        id: expect.any(String),
        token_hash: null,
      }]);
      const invitationId = String(durable[0]!.id);

      const recoveryQueue: FakeReviewQueue = {
        add: vi.fn(async () => undefined),
        upsertJobScheduler: vi.fn(),
      };
      expect(await recover(db, recoveryQueue)).toBeGreaterThanOrEqual(1);
      expect(recoveryQueue.add).toHaveBeenCalledWith(
        "send-request",
        { invitationId },
        expect.objectContaining({
          attempts: 5,
          backoff: { delay: 30_000, type: "exponential" },
          jobId: `review-${invitationId}-0-0`,
        }),
      );

      await schedule(db, appointmentId, recoveryQueue);
      const jobIds = recoveryQueue.add.mock.calls.map((call) => call[2]?.jobId);
      expect(new Set(jobIds)).toEqual(new Set([`review-${invitationId}-0-0`]));

      await db.execute(sql`
        update review_invitations
        set delivery_attempts = 5, delivery_status = 'exhausted', delivery_failure = 'DELIVERY_ATTEMPTS_EXHAUSTED'
        where id = ${invitationId}::uuid
      `);
      recoveryQueue.add.mockClear();
      expect(await recover(db, recoveryQueue)).toBe(0);
      expect(await recover(db, recoveryQueue)).toBe(0);
      expect(recoveryQueue.add).not.toHaveBeenCalled();

      const retry = (reviewJobs as unknown as { retryReviewInvitation?: RetryReview }).retryReviewInvitation;
      expect(retry).toBeTypeOf("function");
      if (!retry) return;
      await retry(db, salonId, invitationId, recoveryQueue);
      const retried = await db.execute(sql<{ delivery_attempts: number; delivery_status: string }>`
        select delivery_attempts, delivery_status from review_invitations where id = ${invitationId}::uuid
      `);
      expect(retried).toEqual([{ delivery_attempts: 0, delivery_status: "pending" }]);
      expect(recoveryQueue.add).toHaveBeenCalledWith(
        "send-request",
        { invitationId },
        expect.objectContaining({ jobId: `review-${invitationId}-1-0` }),
      );
    } finally {
      await db.delete(salons).where(eq(salons.id, salonId));
    }
  });
});

describe("review recovery scheduler", () => {
  it("registers a periodic recovery scan without Redis in the test", async () => {
    const register = (reviewJobs as unknown as {
      registerReviewRecoverySchedule?: (queue: FakeReviewQueue) => Promise<void>;
    }).registerReviewRecoverySchedule;
    expect(register).toBeTypeOf("function");
    if (!register) return;
    const queue: FakeReviewQueue = { add: vi.fn(), upsertJobScheduler: vi.fn(async () => undefined) };

    await register(queue);

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      "recover-review-invitations",
      { every: 5 * 60_000 },
      { name: "recover" },
    );
  });
});
