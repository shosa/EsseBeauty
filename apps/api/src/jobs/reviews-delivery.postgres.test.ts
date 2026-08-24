import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import type { Job } from "bullmq";

import { createDatabase, type DrizzleDB } from "@esse-beauty/db";
import { appointments, customers, salons, services, staff } from "@esse-beauty/db/schema";

import { testDatabaseUrl } from "../test/postgres.js";

const senders = vi.hoisted(() => ({
  sendEmail: vi.fn(async (_to: string, _subject: string, _html: string) => undefined),
  sendSms: vi.fn(async (_to: string, _body: string) => undefined),
}));

vi.mock("./notifications.js", () => senders);

import {
  ensureReviewInvitation,
  processReviewRequest,
  type ReviewRequestJob,
} from "./reviews.js";

const databaseUrl = testDatabaseUrl();
const postgresSuite = databaseUrl ? describe : describe.skip;

postgresSuite("review delivery with PostgreSQL", () => {
  let db: DrizzleDB;
  beforeAll(() => { db = createDatabase(databaseUrl!); });
  afterAll(async () => { await db.$client.end(); });

  it("passes the raw invitation only to the sender and persists delivery state by hash", async () => {
    const salonId = randomUUID();
    const customerId = randomUUID();
    const staffId = randomUUID();
    const serviceId = randomUUID();
    const appointmentId = randomUUID();
    await db.insert(salons).values({ id: salonId, locale: "it-IT", name: "Delivery Test", slug: `delivery-${salonId}`, timezone: "Europe/Rome" });
    try {
      await db.insert(customers).values({ email: "delivery@example.invalid", fullName: "Mario Rossi", id: customerId, salonId });
      await db.insert(staff).values({ color: "#000000", displayName: "Anna", id: staffId, salonId, workingHours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } });
      await db.insert(services).values({ category: "Viso", durationMinutes: 30, id: serviceId, name: "Pulizia viso", priceCents: 5000, salonId });
      await db.insert(appointments).values({ customerId, endsAt: new Date(Date.now() + 30 * 60_000), id: appointmentId, salonId, serviceId, source: "manual", staffId, startsAt: new Date(), status: "completed" });
      const invitation = await ensureReviewInvitation(db, appointmentId, { expiresAt: new Date(Date.now() + 60_000) });

      senders.sendEmail.mockClear();
      const job = { data: { invitationId: invitation.id } } as Job<ReviewRequestJob>;
      await processReviewRequest(db, job);
      await processReviewRequest(db, job);
      expect(senders.sendEmail).toHaveBeenCalledTimes(1);
      const senderHtml = String(senders.sendEmail.mock.calls[0]?.[2]);
      const rawToken = senderHtml.match(/\/review\/(v1\.review\.[A-Za-z0-9._-]+)/)?.[1];
      expect(rawToken).toMatch(/^v1\.review\./);

      const rows = await db.execute(sql<{
        delivery_attempts: number;
        delivery_status: string;
        token_hash: string;
      }>`select delivery_attempts, delivery_status, token_hash from review_invitations where id = ${invitation.id}::uuid`);
      expect(rows).toEqual([{
        delivery_attempts: 1,
        delivery_status: "sent",
        token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }]);
      expect(JSON.stringify(rows)).not.toContain(rawToken);
      expect(JSON.stringify({ invitationId: invitation.id })).not.toContain(rawToken);
    } finally {
      await db.delete(salons).where(eq(salons.id, salonId));
    }
  });
});
