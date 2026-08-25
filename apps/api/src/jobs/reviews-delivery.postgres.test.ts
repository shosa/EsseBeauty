import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import type { Job } from "bullmq";

import { createDatabase, type DrizzleDB } from "@esse-beauty/db";
import { appointments, communicationMessages, communicationProviderAccounts, customers, salons, services, staff } from "@esse-beauty/db/schema";

import { testDatabaseUrl } from "../test/postgres.js";

const senders = vi.hoisted(() => ({
  sendEmail: vi.fn(async (_to: string, _subject: string, _html: string) => undefined),
}));

vi.mock("./notifications.js", () => senders);

import {
  ensureReviewInvitation,
  processReviewRequest,
  type ReviewRequestJob,
} from "./reviews.js";
import { enqueueCommunication } from "./communications.js";

const databaseUrl = testDatabaseUrl();
const postgresSuite = databaseUrl ? describe : describe.skip;

postgresSuite("review delivery with PostgreSQL", () => {
  let db: DrizzleDB;
  beforeAll(() => {
    process.env.REVIEW_TOKEN_SECRET = "test-review-token-secret-with-at-least-32-bytes";
    db = createDatabase(databaseUrl!);
  });
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
      const reviewHref = senderHtml.match(/href="([^"]+)"/)?.[1];
      const rawToken = new URL(reviewHref!).hash.replace(/^#token=/, "");
      expect(rawToken).toMatch(/^v1\.review\./);
      const parsedHref = new URL(reviewHref!);
      expect(parsedHref.pathname).toBe("/review");
      expect(parsedHref.search).toBe("");
      expect(parsedHref.hash).toBe(`#token=${rawToken}`);
      expect(`${parsedHref.origin}${parsedHref.pathname}${parsedHref.search}`).not.toContain(rawToken);

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

  it("allows only one concurrent worker to deliver an invitation", async () => {
    const salonId = randomUUID();
    const customerId = randomUUID();
    const staffId = randomUUID();
    const serviceId = randomUUID();
    const appointmentId = randomUUID();
    await db.insert(salons).values({ id: salonId, locale: "it-IT", name: "Concurrent Delivery", slug: `concurrent-delivery-${salonId}`, timezone: "Europe/Rome" });
    try {
      await db.insert(customers).values({ email: "concurrent@example.invalid", fullName: "Mario Rossi", id: customerId, salonId });
      await db.insert(staff).values({ color: "#000000", displayName: "Anna", id: staffId, salonId, workingHours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } });
      await db.insert(services).values({ category: "Viso", durationMinutes: 30, id: serviceId, name: "Pulizia viso", priceCents: 5000, salonId });
      await db.insert(appointments).values({ customerId, endsAt: new Date(Date.now() + 30 * 60_000), id: appointmentId, salonId, serviceId, source: "manual", staffId, startsAt: new Date(), status: "completed" });
      const invitation = await ensureReviewInvitation(db, appointmentId, { expiresAt: new Date(Date.now() + 60_000) });
      let release!: () => void;
      let entered!: () => void;
      const providerGate = new Promise<void>((resolve) => { release = resolve; });
      const providerEntered = new Promise<void>((resolve) => { entered = resolve; });
      senders.sendEmail.mockClear();
      senders.sendEmail.mockImplementation(async () => {
        entered();
        await providerGate;
      });
      const job = { data: { invitationId: invitation.id } } as Job<ReviewRequestJob>;

      const first = processReviewRequest(db, job);
      await providerEntered;
      const second = processReviewRequest(db, job);
      release();
      await Promise.all([first, second]);

      expect(senders.sendEmail).toHaveBeenCalledTimes(1);
    } finally {
      senders.sendEmail.mockImplementation(async () => undefined);
      await db.delete(salons).where(eq(salons.id, salonId));
    }
  });

  it("reuses one valid token after a provider failure", async () => {
    const salonId = randomUUID();
    const customerId = randomUUID();
    const staffId = randomUUID();
    const serviceId = randomUUID();
    const appointmentId = randomUUID();
    await db.insert(salons).values({ id: salonId, locale: "it-IT", name: "Retry Delivery", slug: `retry-delivery-${salonId}`, timezone: "Europe/Rome" });
    try {
      await db.insert(customers).values({ email: "retry@example.invalid", fullName: "Mario Rossi", id: customerId, salonId });
      await db.insert(staff).values({ color: "#000000", displayName: "Anna", id: staffId, salonId, workingHours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } });
      await db.insert(services).values({ category: "Viso", durationMinutes: 30, id: serviceId, name: "Pulizia viso", priceCents: 5000, salonId });
      await db.insert(appointments).values({ customerId, endsAt: new Date(Date.now() + 30 * 60_000), id: appointmentId, salonId, serviceId, source: "manual", staffId, startsAt: new Date(), status: "completed" });
      const invitation = await ensureReviewInvitation(db, appointmentId, { expiresAt: new Date(Date.now() + 60_000) });
      const urls: string[] = [];
      senders.sendEmail.mockClear();
      senders.sendEmail
        .mockImplementationOnce(async (_to, _subject, html) => {
          urls.push(html.match(/href="([^"]+)"/)?.[1] ?? "");
          throw new Error("provider unavailable");
        })
        .mockImplementationOnce(async (_to, _subject, html) => {
          urls.push(html.match(/href="([^"]+)"/)?.[1] ?? "");
        });
      const job = { data: { invitationId: invitation.id } } as Job<ReviewRequestJob>;

      await expect(processReviewRequest(db, job)).rejects.toThrow("REVIEW_DELIVERY_FAILED");
      await processReviewRequest(db, job);

      expect(urls).toHaveLength(2);
      expect(urls[1]).toBe(urls[0]);
    } finally {
      senders.sendEmail.mockImplementation(async () => undefined);
      await db.delete(salons).where(eq(salons.id, salonId));
    }
  });

  it("does not mint a token or count an attempt when no destination exists", async () => {
    const salonId = randomUUID();
    const customerId = randomUUID();
    const staffId = randomUUID();
    const serviceId = randomUUID();
    const appointmentId = randomUUID();
    await db.insert(salons).values({ id: salonId, locale: "it-IT", name: "Skipped Delivery", slug: `skipped-delivery-${salonId}`, timezone: "Europe/Rome" });
    try {
      await db.insert(customers).values({ fullName: "Mario Rossi", id: customerId, salonId });
      await db.insert(staff).values({ color: "#000000", displayName: "Anna", id: staffId, salonId, workingHours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } });
      await db.insert(services).values({ category: "Viso", durationMinutes: 30, id: serviceId, name: "Pulizia viso", priceCents: 5000, salonId });
      await db.insert(appointments).values({ customerId, endsAt: new Date(Date.now() + 30 * 60_000), id: appointmentId, salonId, serviceId, source: "manual", staffId, startsAt: new Date(), status: "completed" });
      const invitation = await ensureReviewInvitation(db, appointmentId, { expiresAt: new Date(Date.now() + 60_000) });

      await processReviewRequest(db, { data: { invitationId: invitation.id } } as Job<ReviewRequestJob>);

      const rows = await db.execute(sql<{ delivery_attempts: number; delivery_status: string; token_hash: string | null }>`
        select delivery_attempts, delivery_status, token_hash from review_invitations where id = ${invitation.id}::uuid
      `);
      expect(rows).toEqual([{ delivery_attempts: 0, delivery_status: "skipped", token_hash: null }]);
    } finally {
      await db.delete(salons).where(eq(salons.id, salonId));
    }
  });

  it("enqueues a WhatsApp review template when email is unavailable", async () => {
    const salonId = randomUUID();
    const customerId = randomUUID();
    const staffId = randomUUID();
    const serviceId = randomUUID();
    const appointmentId = randomUUID();
    await db.insert(salons).values({ id: salonId, locale: "it-IT", name: "WhatsApp Delivery", slug: `whatsapp-delivery-${salonId}`, timezone: "Europe/Rome" });
    try {
      await db.insert(customers).values({ fullName: "Mario Rossi", id: customerId, phone: "+393331234567", phoneNormalized: "+393331234567", salonId });
      await db.insert(staff).values({ color: "#000000", displayName: "Anna", id: staffId, salonId, workingHours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } });
      await db.insert(services).values({ category: "Viso", durationMinutes: 30, id: serviceId, name: "Trattamento viso ultra completo con descrizione molto lunga che non deve troncare il collegamento", priceCents: 5000, salonId });
      await db.insert(appointments).values({ customerId, endsAt: new Date(Date.now() + 30 * 60_000), id: appointmentId, salonId, serviceId, source: "manual", staffId, startsAt: new Date(), status: "completed" });
      const invitation = await ensureReviewInvitation(db, appointmentId, { expiresAt: new Date(Date.now() + 60_000) });
      await db.insert(communicationProviderAccounts).values({ enabled: true, phoneNumberId: `phone-${salonId}`, salonId, status: "ready", wabaId: `waba-${salonId}` });

      await processReviewRequest(db, { data: { invitationId: invitation.id } } as Job<ReviewRequestJob>, {
        enqueue: (executor, input) => enqueueCommunication(executor, input, { add: async () => undefined }),
      });

      const message = (await db.select().from(communicationMessages).where(eq(communicationMessages.sourceId, invitation.id)))[0];
      expect(message).toMatchObject({ kind: "template", templateName: "review_invitation" });
      expect(JSON.stringify(message?.templateParameters)).toContain("__review_url__");
      expect(JSON.stringify(message?.templateParameters)).not.toContain("v1.review.");
      const rows = await db.execute(sql<{ delivery_status: string }>`select delivery_status from review_invitations where id = ${invitation.id}::uuid`);
      expect(rows[0]?.delivery_status).toBe("queued");
    } finally {
      await db.delete(salons).where(eq(salons.id, salonId));
    }
  });

  it("stops permanent provider failures at the persisted delivery cost ceiling", async () => {
    const salonId = randomUUID();
    const customerId = randomUUID();
    const staffId = randomUUID();
    const serviceId = randomUUID();
    const appointmentId = randomUUID();
    await db.insert(salons).values({ id: salonId, locale: "it-IT", name: "Exhausted Delivery", slug: `exhausted-delivery-${salonId}`, timezone: "Europe/Rome" });
    try {
      await db.insert(customers).values({ email: "exhausted@example.invalid", fullName: "Mario Rossi", id: customerId, salonId });
      await db.insert(staff).values({ color: "#000000", displayName: "Anna", id: staffId, salonId, workingHours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } });
      await db.insert(services).values({ category: "Viso", durationMinutes: 30, id: serviceId, name: "Pulizia viso", priceCents: 5000, salonId });
      await db.insert(appointments).values({ customerId, endsAt: new Date(Date.now() + 30 * 60_000), id: appointmentId, salonId, serviceId, source: "manual", staffId, startsAt: new Date(), status: "completed" });
      const invitation = await ensureReviewInvitation(db, appointmentId, { expiresAt: new Date(Date.now() + 60_000) });
      senders.sendEmail.mockClear();
      senders.sendEmail.mockRejectedValue(new Error("provider permanently unavailable"));
      const job = { data: { invitationId: invitation.id } } as Job<ReviewRequestJob>;

      for (let invocation = 0; invocation < 8; invocation += 1) {
        await processReviewRequest(db, job).catch(() => undefined);
      }

      expect(senders.sendEmail).toHaveBeenCalledTimes(5);
      const rows = await db.execute(sql<{ delivery_attempts: number; delivery_status: string }>`
        select delivery_attempts, delivery_status from review_invitations where id = ${invitation.id}::uuid
      `);
      expect(rows).toEqual([{ delivery_attempts: 5, delivery_status: "exhausted" }]);
    } finally {
      senders.sendEmail.mockImplementation(async () => undefined);
      await db.delete(salons).where(eq(salons.id, salonId));
    }
  });
});
