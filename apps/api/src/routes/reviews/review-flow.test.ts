import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";

import { createDatabase, type DrizzleDB } from "@esse-beauty/db";
import { appointments, authSessions, customers, salonModules, salons, services, staff, users } from "@esse-beauty/db/schema";

import { createApp } from "../../app.js";
import * as reviewJobs from "../../jobs/reviews.js";
import { issuePublicToken } from "../../lib/public-tokens.js";
import { testDatabaseUrl } from "../../test/postgres.js";
import { hashSessionToken } from "../auth/local-auth.js";

const databaseUrl = testDatabaseUrl();
const postgresSuite = databaseUrl ? describe : describe.skip;
type InvitationEnsurer = (db: DrizzleDB, appointmentId: string, options?: { expiresAt?: Date }) => Promise<{ id: string }>;
interface Fixture { appointmentId: string; salonId: string }

postgresSuite("secure review lifecycle with PostgreSQL", () => {
  let db: DrizzleDB;
  beforeAll(() => { db = createDatabase(databaseUrl!); });
  afterAll(async () => { await db.$client.end(); });

  async function createFixture(): Promise<Fixture> {
    const appointmentId = randomUUID();
    const customerId = randomUUID();
    const salonId = randomUUID();
    const serviceId = randomUUID();
    const staffId = randomUUID();
    const startsAt = new Date("2026-08-24T08:00:00.000Z");
    await db.insert(salons).values({ id: salonId, locale: "it-IT", name: "Review PostgreSQL Test", slug: `review-postgres-${salonId}`, timezone: "Europe/Rome" });
    await db.insert(customers).values({ email: "mario@example.invalid", fullName: "Mario Rossi", id: customerId, salonId });
    await db.insert(staff).values({ color: "#792f59", displayName: "Anna Bianchi", id: staffId, salonId, workingHours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } });
    await db.insert(services).values({ category: "Viso", durationMinutes: 60, id: serviceId, name: "Trattamento viso", priceCents: 8000, salonId });
    await db.insert(appointments).values({ customerId, endsAt: new Date(startsAt.getTime() + 60 * 60_000), id: appointmentId, salonId, serviceId, source: "manual", staffId, startsAt, status: "completed" });
    await db.insert(salonModules).values({ enabled: true, moduleKey: "reviews", salonId });
    return { appointmentId, salonId };
  }

  async function withFixture<T>(work: (fixture: Fixture) => Promise<T>): Promise<T> {
    const fixture = await createFixture();
    try { return await work(fixture); }
    finally { await db.delete(salons).where(eq(salons.id, fixture.salonId)); }
  }

  async function ensureInvitation(appointmentId: string, options?: { expiresAt?: Date }): Promise<{ id: string }> {
    const ensure = (reviewJobs as unknown as { ensureReviewInvitation?: InvitationEnsurer }).ensureReviewInvitation;
    expect(ensure).toBeTypeOf("function");
    if (!ensure) return { id: "missing" };
    return ensure(db, appointmentId, options);
  }

  async function storeToken(invitationId: string, rawToken: string, tokenHash: string) {
    await db.execute(sql`update review_invitations set token_hash = ${tokenHash}, updated_at = now() where id = ${invitationId}::uuid`);
    expect(JSON.stringify(await db.execute(sql`select token_hash from review_invitations where id = ${invitationId}::uuid`))).not.toContain(rawToken);
  }

  it("does not expose a review by appointment UUID", async () => {
    await withFixture(async ({ appointmentId }) => {
      const app = createApp({ db, env: { API_CORS_ORIGIN: "http://localhost:3002" } });
      try {
        const response = await app.inject({ method: "GET", url: `/api/public/reviews/${appointmentId}` });
        expect(response.statusCode, response.body).toBe(404);
      } finally { await app.close(); }
    });
  });

  it("creates one durable invitation for repeated and concurrent completion events", async () => {
    await withFixture(async ({ appointmentId }) => {
      const results = await Promise.all([ensureInvitation(appointmentId), ensureInvitation(appointmentId), ensureInvitation(appointmentId)]);
      expect(new Set(results.map((result) => result.id)).size).toBe(1);
      const rows = await db.execute(sql<{ appointment_id: string; delivery_attempts: number; delivery_status: string; token_hash: string | null }>`
        select appointment_id, delivery_attempts, delivery_status, token_hash from review_invitations where appointment_id = ${appointmentId}::uuid
      `);
      expect(rows).toEqual([{ appointment_id: appointmentId, delivery_attempts: 0, delivery_status: "pending", token_hash: null }]);
    });
  });

  it("returns a minimal public DTO and consumes one concurrent submission", async () => {
    await withFixture(async ({ appointmentId }) => {
      const invitation = await ensureInvitation(appointmentId);
      const token = issuePublicToken("review", invitation.id, new Date(Date.now() + 60_000));
      await storeToken(invitation.id, token.raw, token.tokenHash);
      const app = createApp({ db, env: { API_CORS_ORIGIN: "http://localhost:3002" } });
      try {
        const resolved = await app.inject({
          method: "POST",
          payload: { token: token.raw },
          url: "/api/public/reviews/resolve",
        });
        expect(resolved.statusCode, resolved.body).toBe(200);
        expect(resolved.json()).toEqual({ salon_name: "Review PostgreSQL Test", service_name: "Trattamento viso", starts_at: "2026-08-24T08:00:00.000Z" });
        expect(resolved.body).not.toContain(appointmentId);
        expect(resolved.body).not.toContain("Mario Rossi");
        const submissions = await Promise.all([
          app.inject({ method: "POST", payload: { comment: "Ottimo servizio", rating: 5, token: token.raw }, url: "/api/public/reviews/submit" }),
          app.inject({ method: "POST", payload: { comment: "Secondo invio", rating: 1, token: token.raw }, url: "/api/public/reviews/submit" }),
        ]);
        expect(submissions.map((response) => response.statusCode).sort()).toEqual([201, 409]);
        expect(submissions.find((response) => response.statusCode === 409)?.json()).toEqual({ error: "TOKEN_CONSUMED" });
        const stored = await db.execute(sql<{ count: number }>`select count(*)::int as count from reviews where appointment_id = ${appointmentId}::uuid`);
        expect(stored[0]?.count).toBe(1);
      } finally { await app.close(); }
    });
  });

  it("distinguishes expired, consumed, revoked, and invalid public tokens", async () => {
    await withFixture(async ({ appointmentId }) => {
      const invitation = await ensureInvitation(appointmentId, { expiresAt: new Date(Date.now() + 60_000) });
      const token = issuePublicToken("review", invitation.id, new Date(Date.now() + 60_000));
      await storeToken(invitation.id, token.raw, token.tokenHash);
      const app = createApp({ db, env: { API_CORS_ORIGIN: "http://localhost:3002" } });
      try {
        await db.execute(sql`update review_invitations set expires_at = now() - interval '1 minute' where id = ${invitation.id}::uuid`);
        const expired = await app.inject({ method: "POST", payload: { token: token.raw }, url: "/api/public/reviews/resolve" });
        expect([expired.statusCode, expired.json()]).toEqual([410, { error: "TOKEN_EXPIRED" }]);
        await db.execute(sql`update review_invitations set expires_at = now() + interval '1 hour', consumed_at = now() where id = ${invitation.id}::uuid`);
        const consumed = await app.inject({ method: "POST", payload: { token: token.raw }, url: "/api/public/reviews/resolve" });
        expect([consumed.statusCode, consumed.json()]).toEqual([409, { error: "TOKEN_CONSUMED" }]);
        await db.execute(sql`update review_invitations set consumed_at = null, revoked_at = now() where id = ${invitation.id}::uuid`);
        const revoked = await app.inject({ method: "POST", payload: { token: token.raw }, url: "/api/public/reviews/resolve" });
        expect([revoked.statusCode, revoked.json()]).toEqual([410, { error: "TOKEN_REVOKED" }]);
        const invalid = await app.inject({ method: "POST", payload: { token: "not-a-token" }, url: "/api/public/reviews/resolve" });
        expect([invalid.statusCode, invalid.json()]).toEqual([404, { error: "TOKEN_INVALID" }]);
      } finally { await app.close(); }
    });
  });

  it("rejects malformed public review DTOs without consuming the invitation", async () => {
    await withFixture(async ({ appointmentId }) => {
      const invitation = await ensureInvitation(appointmentId);
      const token = issuePublicToken("review", invitation.id, new Date(Date.now() + 60_000));
      await storeToken(invitation.id, token.raw, token.tokenHash);
      const app = createApp({ db, env: { API_CORS_ORIGIN: "http://localhost:3002" } });
      try {
        const response = await app.inject({
          method: "POST",
          payload: { comment: 42, rating: 5, token: token.raw },
          url: "/api/public/reviews/submit",
        });
        expect(response.statusCode, response.body).toBe(400);
        expect(response.json()).toEqual({
          error: "INVALID_REQUEST",
          fields: { comment: ["Commento non valido"] },
        });
        const stored = await db.execute(sql<{ consumed_at: Date | null }>`select consumed_at from review_invitations where id = ${invitation.id}::uuid`);
        expect(stored[0]?.consumed_at).toBeNull();
      } finally { await app.close(); }
    });
  });

  it("enforces authenticated tenant and permission boundaries for review management", async () => {
    await withFixture(async ({ appointmentId, salonId }) => {
      const ownerId = randomUUID();
      const receptionistId = randomUUID();
      const ownerToken = `owner-${randomUUID()}`;
      const receptionistToken = `receptionist-${randomUUID()}`;
      await db.insert(users).values([
        { active: true, email: `${ownerId}@example.invalid`, fullName: "Owner", id: ownerId, role: "owner", salonId },
        { active: true, email: `${receptionistId}@example.invalid`, fullName: "Receptionist", id: receptionistId, role: "receptionist", salonId },
      ]);
      await db.insert(authSessions).values([
        { expiresAt: new Date(Date.now() + 60_000), tokenHash: hashSessionToken(ownerToken), userId: ownerId },
        { expiresAt: new Date(Date.now() + 60_000), tokenHash: hashSessionToken(receptionistToken), userId: receptionistId },
      ]);
      const invitation = await ensureInvitation(appointmentId);
      await db.execute(sql`
        update review_invitations
        set delivery_attempts = 5, delivery_status = 'exhausted', delivery_failure = 'DELIVERY_ATTEMPTS_EXHAUSTED'
        where id = ${invitation.id}::uuid
      `);
      const queue = {
        add: vi.fn(async () => undefined),
        upsertJobScheduler: vi.fn(async () => undefined),
      };
      const app = createApp({ db, env: { API_CORS_ORIGIN: "http://localhost:3000" }, reviewQueue: queue });
      try {
        const denied = await app.inject({
          headers: { cookie: `esse-session=${receptionistToken}` },
          method: "GET",
          url: `/api/salons/${salonId}/reviews`,
        });
        expect(denied.statusCode).toBe(403);
        expect(denied.json()).toMatchObject({ error: "PERMISSION_DENIED", required: "reviews.reply" });

        const wrongTenant = await app.inject({
          headers: { cookie: `esse-session=${ownerToken}` },
          method: "GET",
          url: `/api/salons/${randomUUID()}/reviews`,
        });
        expect(wrongTenant.statusCode).toBe(403);
        expect(wrongTenant.json()).toEqual({ error: "FORBIDDEN" });

        const allowed = await app.inject({
          headers: { cookie: `esse-session=${ownerToken}` },
          method: "GET",
          url: `/api/salons/${salonId}/reviews`,
        });
        expect(allowed.statusCode, allowed.body).toBe(200);

        const retry = await app.inject({
          headers: { cookie: `esse-session=${ownerToken}` },
          method: "POST",
          url: `/api/salons/${salonId}/review-invitations/${invitation.id}/retry`,
        });
        expect(retry.statusCode, retry.body).toBe(202);
        expect(retry.json()).toEqual({ queued: true });
        expect(queue.add).toHaveBeenCalledTimes(1);
      } finally {
        await app.close();
      }
    });
  });
});

describe("review token log safety", () => {
  it("keeps the raw review bearer out of request URLs and logs", async () => {
    const token = issuePublicToken("review", randomUUID(), new Date(Date.now() + 60_000));
    let logs = "";
    const app = createApp({ db: {} as DrizzleDB, env: { API_CORS_ORIGIN: "http://localhost:3002" }, logger: true, loggerStream: { write(message) { logs += message; } } });
    try {
      await app.inject({
        method: "POST",
        payload: { token: token.raw },
        url: "/api/public/reviews/resolve",
      });
      expect(logs).not.toContain(token.raw);
      expect(logs).toContain("/api/public/reviews/resolve");
      expect(logs).not.toContain("/api/public/reviews/token/");
    } finally { await app.close(); }
  });
});
