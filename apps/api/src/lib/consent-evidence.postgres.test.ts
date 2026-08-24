import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

import { createDatabase, type DrizzleDB } from "@esse-beauty/db";
import {
  authSessions,
  consentTemplates,
  customerConsents,
  customers,
  salonModules,
  salons,
  users,
} from "@esse-beauty/db/schema";

import { createApp } from "../app.js";
import { hashSessionToken } from "../routes/auth/local-auth.js";
import { testDatabaseUrl } from "../test/postgres.js";
import {
  createConsentRequest,
  createConsentTemplate,
  createDrizzleConsentRepository,
  renderConsentEvidence,
  resendConsentRequest,
  resolveConsent,
  signConsent,
} from "./consent-evidence.js";
import { issuePublicToken } from "./public-tokens.js";

const databaseUrl = testDatabaseUrl();
const postgresSuite = databaseUrl ? describe : describe.skip;

interface TenantFixture {
  customerId: string;
  ownerId: string;
  salonId: string;
  sessionToken: string;
}

postgresSuite("consent lifecycle with PostgreSQL", () => {
  let db: DrizzleDB;

  beforeAll(() => {
    db = createDatabase(databaseUrl!);
  });

  afterAll(async () => {
    await db.$client.end();
  });

  async function createTenant(): Promise<TenantFixture> {
    const salonId = randomUUID();
    const customerId = randomUUID();
    const ownerId = randomUUID();
    const sessionToken = `session-${randomUUID()}`;
    await db.insert(salons).values({
      id: salonId,
      locale: "it-IT",
      name: "Consent PostgreSQL Test",
      slug: `consent-postgres-${salonId}`,
      timezone: "Europe/Rome",
    });
    await db.insert(customers).values({
      fullName: "Mario Rossi",
      id: customerId,
      salonId,
    });
    await db.insert(users).values({
      active: true,
      email: `${ownerId}@example.invalid`,
      fullName: "Owner Test",
      id: ownerId,
      role: "owner",
      salonId,
    });
    await db.insert(authSessions).values({
      expiresAt: new Date(Date.now() + 60_000),
      tokenHash: hashSessionToken(sessionToken),
      userId: ownerId,
    });
    await db.insert(salonModules).values({
      enabled: true,
      moduleKey: "documents",
      salonId,
    });
    return { customerId, ownerId, salonId, sessionToken };
  }

  async function withTenant<T>(work: (fixture: TenantFixture) => Promise<T>): Promise<T> {
    const fixture = await createTenant();
    try {
      return await work(fixture);
    } finally {
      await db.delete(salons).where(eq(salons.id, fixture.salonId));
    }
  }

  it("has the migrated lifecycle columns and hash constraints", async () => {
    const columns = await db.execute(sql<{ column_name: string }>`
      select column_name
      from information_schema.columns
      where table_name = 'customer_consents'
        and column_name in (
          'token_hash', 'expires_at', 'delivery_channel', 'signer_name',
          'document_hash', 'revoked_by_user_id', 'revocation_reason'
        )
    `);
    const constraints = await db.execute(sql<{ conname: string }>`
      select conname
      from pg_constraint
      where conrelid = 'customer_consents'::regclass
        and conname in (
          'customer_consents_token_hash_format',
          'customer_consents_document_hash_format'
        )
    `);

    expect(columns.map((row) => row.column_name).sort()).toEqual([
      "delivery_channel",
      "document_hash",
      "expires_at",
      "revocation_reason",
      "revoked_by_user_id",
      "signer_name",
      "token_hash",
    ]);
    expect(constraints.map((row) => row.conname).sort()).toEqual([
      "customer_consents_document_hash_format",
      "customer_consents_token_hash_format",
    ]);
  });

  it("rotates tokens, consumes one concurrent signature, and detects evidence tampering", async () => {
    await withTenant(async ({ customerId, salonId }) => {
      const repository = createDrizzleConsentRepository(db);
      const template = await createConsentTemplate(repository, {
        body: "Testo PostgreSQL",
        name: "Consenso PostgreSQL",
        salonId,
        type: "treatment",
      });
      const created = await createConsentRequest(repository, {
        customerId,
        deliveryChannel: "email",
        expiresAt: new Date(Date.now() + 60_000),
        salonId,
        templateId: template.id,
      });
      const resent = await resendConsentRequest(repository, created.consent.id, {
        deliveryChannel: "sms",
        expiresAt: new Date(Date.now() + 120_000),
        salonId,
      });

      await expect(resolveConsent(repository, created.rawToken)).rejects.toThrow("TOKEN_INVALID");
      await expect(resolveConsent(repository, resent.rawToken)).resolves.toMatchObject({
        deliveryChannel: "sms",
        status: "pending",
      });

      const signatures = await Promise.allSettled([
        signConsent(repository, resent.rawToken, {
          accepted: true,
          signature: { type: "typed", value: "Mario Rossi" },
          signerName: "Mario Rossi",
        }),
        signConsent(repository, resent.rawToken, {
          accepted: true,
          signature: { type: "typed", value: "Mario Rossi" },
          signerName: "Mario Rossi",
        }),
      ]);
      expect(signatures.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(signatures.filter((result) => result.status === "rejected")).toHaveLength(1);
      expect(String(signatures.find((result) => result.status === "rejected")?.reason)).toContain(
        "TOKEN_CONSUMED",
      );

      const evidence = await renderConsentEvidence(repository, created.consent.id, { salonId });
      expect(evidence.content).toContain(`Template ID: ${template.id}`);
      expect(evidence.content).toContain("Tipo: treatment");

      const row = (await db.select({ signatureData: customerConsents.signatureData })
        .from(customerConsents)
        .where(eq(customerConsents.id, created.consent.id)))[0]!;
      const signatureData = structuredClone(row.signatureData);
      (signatureData.document as Record<string, unknown>).body = "Testo manomesso";
      await db.update(customerConsents)
        .set({ signatureData })
        .where(eq(customerConsents.id, created.consent.id));
      await expect(renderConsentEvidence(repository, created.consent.id, { salonId }))
        .rejects.toThrow("CONSENT_EVIDENCE_TAMPERED");
    });
  });

  it("persists expired status through public resolve, sign, and authenticated list", async () => {
    await withTenant(async ({ customerId, salonId, sessionToken }) => {
      const repository = createDrizzleConsentRepository(db);
      const template = await createConsentTemplate(repository, {
        body: "Testo scaduto",
        name: "Consenso scaduto",
        salonId,
        type: "privacy",
      });
      const expired = issuePublicToken("consent", randomUUID(), new Date(Date.now() - 60_000));
      const consentId = randomUUID();
      await db.insert(customerConsents).values({
        customerId,
        deliveryChannel: "email",
        expiresAt: expired.expiresAt,
        id: consentId,
        salonId,
        status: "pending",
        templateId: template.id,
        tokenHash: expired.tokenHash,
      });

      const app = createApp({
        db,
        env: { API_CORS_ORIGIN: "http://localhost:3000" },
      });
      try {
        const publicResolve = await app.inject({
          method: "GET",
          url: `/api/public/consents/${expired.raw}`,
        });
        expect(publicResolve.statusCode, publicResolve.body).toBe(410);
        expect(publicResolve.json()).toEqual({ error: "TOKEN_EXPIRED" });

        const publicSign = await app.inject({
          method: "POST",
          payload: {
            accepted: true,
            signature: { type: "typed", value: "Mario Rossi" },
            signer_name: "Mario Rossi",
          },
          url: `/api/public/consents/${expired.raw}/sign`,
        });
        expect(publicSign.statusCode, publicSign.body).toBe(410);
        expect(publicSign.json()).toEqual({ error: "TOKEN_EXPIRED" });

        const response = await app.inject({
          headers: { cookie: `esse-session=${sessionToken}` },
          method: "GET",
          url: `/api/salons/${salonId}/customer-consents`,
        });
        expect(response.statusCode, response.body).toBe(200);
        const listed = response.json<Array<Record<string, unknown>>>();
        expect(listed[0]).toMatchObject({ id: consentId, status: "expired" });
        expect(listed[0]).not.toHaveProperty("tokenHash");
        expect(listed[0]).not.toHaveProperty("token_hash");
        expect(listed[0]).not.toHaveProperty("signatureData");
        expect(listed[0]).not.toHaveProperty("signature_data");
        expect(listed[0]).not.toHaveProperty("ipAddress");
        expect(listed[0]).not.toHaveProperty("ip_address");
        expect(listed[0]).not.toHaveProperty("userAgent");
        expect(listed[0]).not.toHaveProperty("user_agent");
      } finally {
        await app.close();
      }

      const stored = (await db.select({ status: customerConsents.status })
        .from(customerConsents)
        .where(eq(customerConsents.id, consentId)))[0];
      expect(stored?.status).toBe("expired");
    });
  });

  it("allocates every concurrent template version without a unique-constraint failure", async () => {
    await withTenant(async ({ salonId }) => {
      const repository = createDrizzleConsentRepository(db);
      const results = await Promise.allSettled(
        Array.from({ length: 12 }, (_, index) => createConsentTemplate(repository, {
          body: `Testo ${index}`,
          name: "Famiglia concorrente",
          salonId,
          type: "treatment",
        })),
      );
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(0);
      const created = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );

      expect(created.map((item) => item.version).sort((left, right) => left - right)).toEqual(
        Array.from({ length: 12 }, (_, index) => index + 1),
      );
      const persisted = await db.select({ version: consentTemplates.version })
        .from(consentTemplates)
        .where(eq(consentTemplates.salonId, salonId));
      expect(persisted).toHaveLength(12);
    });
  });
});
