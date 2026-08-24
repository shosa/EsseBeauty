import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createDatabase, type DrizzleDB } from "@esse-beauty/db";
import {
  authSessions,
  campaignRecipients,
  customers,
  marketingCampaigns,
  salonModules,
  salons,
  users,
} from "@esse-beauty/db/schema";
import { and, eq } from "drizzle-orm";

import { createApp } from "../../app.js";
import {
  aggregateCampaignStatus,
  processCampaignBatch,
} from "../../jobs/marketing.js";
import type {
  CommunicationMessage,
  CommunicationProviderRegistry,
} from "../../providers/communications.js";
import { ProviderNotConfiguredError } from "../../providers/communications.js";
import { hashSessionToken } from "../auth/local-auth.js";
import { testDatabaseUrl } from "../../test/postgres.js";

const databaseUrl = testDatabaseUrl();
const postgresSuite = databaseUrl ? describe : describe.skip;

describe("aggregateCampaignStatus", () => {
  it("reports a mixed successful and failed audience as partial", () => {
    expect(
      aggregateCampaignStatus([{ status: "sent" }, { status: "failed" }]),
    ).toBe("partial");
  });

  it("does not report queued delivery as sent", () => {
    expect(aggregateCampaignStatus([{ status: "queued" }])).toBe("queued");
  });

  it("stays processing while any recipient still has work outstanding", () => {
    expect(
      aggregateCampaignStatus([{ status: "sent" }, { status: "queued" }]),
    ).toBe("processing");
  });
});

postgresSuite("campaign lifecycle routes with PostgreSQL", () => {
  let db: DrizzleDB;

  beforeAll(() => {
    db = createDatabase(databaseUrl!);
  });

  afterAll(async () => {
    await db?.$client.end();
  });

  async function fixture() {
    const salonId = randomUUID();
    const ownerId = randomUUID();
    const receptionistId = randomUUID();
    const ownerToken = `owner-${randomUUID()}`;
    const receptionistToken = `reception-${randomUUID()}`;
    await db.insert(salons).values({
      id: salonId,
      locale: "it-IT",
      name: "Marketing Test",
      slug: `marketing-${salonId}`,
      timezone: "Europe/Rome",
    });
    await db.insert(salonModules).values({
      enabled: true,
      moduleKey: "marketing",
      salonId,
    });
    await db.insert(users).values([
      {
        active: true,
        email: `${ownerId}@example.test`,
        fullName: "Owner",
        id: ownerId,
        role: "owner",
        salonId,
      },
      {
        active: true,
        email: `${receptionistId}@example.test`,
        fullName: "Receptionist",
        id: receptionistId,
        role: "receptionist",
        salonId,
      },
    ]);
    await db.insert(authSessions).values([
      {
        expiresAt: new Date(Date.now() + 60_000),
        tokenHash: hashSessionToken(ownerToken),
        userId: ownerId,
      },
      {
        expiresAt: new Date(Date.now() + 60_000),
        tokenHash: hashSessionToken(receptionistToken),
        userId: receptionistId,
      },
    ]);
    const customerRows = await db
      .insert(customers)
      .values([
        {
          email: "uno@example.test",
          fullName: "Cliente Uno",
          salonId,
        },
        {
          email: "due@example.test",
          fullName: "Cliente Due",
          salonId,
        },
      ])
      .returning();

    return {
      cleanup: async () => {
        await db.delete(salons).where(eq(salons.id, salonId));
      },
      customers: customerRows,
      ownerToken,
      receptionistToken,
      salonId,
    };
  }

  function testDependencies() {
    const messages: CommunicationMessage[] = [];
    const provider = {
      async send(message: CommunicationMessage) {
        messages.push(message);
        return {
          acceptedAt: new Date("2026-08-24T10:00:00.000Z"),
          provider: message.channel === "email" ? "resend" : "twilio",
          providerMessageId: `provider-${messages.length}`,
        };
      },
    };
    const providers = {
      require: vi.fn(() => provider),
      send: provider.send,
      status: () => ({ email: "ready", sms: "ready" }),
    } as CommunicationProviderRegistry;
    const jobs: Array<{ data: { campaignId: string; recipientIds: string[] } }> = [];
    const campaignQueue = {
      async add(_name: string, data: { campaignId: string; recipientIds: string[] }) {
        jobs.push({ data });
      },
    };
    return { campaignQueue, jobs, messages, providers };
  }

  it("exposes readiness and test-send only to the authenticated tenant with permission", async () => {
    const data = await fixture();
    const dependencies = testDependencies();
    const app = createApp({
      campaignProviders: dependencies.providers,
      campaignQueue: dependencies.campaignQueue,
      db,
      env: { API_CORS_ORIGIN: "http://localhost:3000" },
    });
    try {
      const denied = await app.inject({
        headers: { cookie: `esse-session=${data.receptionistToken}` },
        method: "GET",
        url: `/api/salons/${data.salonId}/campaigns/readiness`,
      });
      expect(denied.statusCode).toBe(403);
      expect(denied.json()).toMatchObject({
        error: "PERMISSION_DENIED",
        required: "marketing.send",
      });

      const wrongTenant = await app.inject({
        headers: { cookie: `esse-session=${data.ownerToken}` },
        method: "GET",
        url: `/api/salons/${randomUUID()}/campaigns/readiness`,
      });
      expect(wrongTenant.statusCode).toBe(403);
      expect(wrongTenant.json()).toEqual({ error: "FORBIDDEN" });

      const ready = await app.inject({
        headers: { cookie: `esse-session=${data.ownerToken}` },
        method: "GET",
        url: `/api/salons/${data.salonId}/campaigns/readiness`,
      });
      expect(ready.statusCode, ready.body).toBe(200);
      expect(ready.json()).toEqual({ email: "ready", sms: "ready" });

      const testSend = await app.inject({
        headers: { cookie: `esse-session=${data.ownerToken}` },
        method: "POST",
        payload: {
          channel: "email",
          content: "<p>Anteprima</p>",
          destination: "owner@example.test",
          subject: "Test campagna",
        },
        url: `/api/salons/${data.salonId}/campaigns/test-send`,
      });
      expect(testSend.statusCode, testSend.body).toBe(200);
      expect(testSend.json()).toMatchObject({ provider_message_id: "provider-1" });
      expect(dependencies.messages).toHaveLength(1);
      expect(dependencies.jobs).toEqual([]);
    } finally {
      await app.close();
      await data.cleanup();
    }
  });

  it("queues an immediate campaign durably and can cancel only before processing", async () => {
    const data = await fixture();
    const dependencies = testDependencies();
    const campaign = (
      await db
        .insert(marketingCampaigns)
        .values({
          channel: "email",
          content: "<p>Promo</p>",
          name: "Promo",
          salonId: data.salonId,
          targetSegment: { type: "all" },
        })
        .returning()
    )[0]!;
    const app = createApp({
      campaignProviders: dependencies.providers,
      campaignQueue: dependencies.campaignQueue,
      db,
      env: { API_CORS_ORIGIN: "http://localhost:3000" },
    });
    try {
      const scheduled = await app.inject({
        headers: { cookie: `esse-session=${data.ownerToken}` },
        method: "POST",
        url: `/api/salons/${data.salonId}/campaigns/${campaign.id}/schedule`,
      });
      expect(scheduled.statusCode, scheduled.body).toBe(202);
      expect(scheduled.json()).toMatchObject({ status: "queued" });
      const storedRecipients = await db
        .select()
        .from(campaignRecipients)
        .where(eq(campaignRecipients.campaignId, campaign.id));
      expect(storedRecipients).toHaveLength(2);
      expect(storedRecipients.every((recipient) => recipient.status === "queued")).toBe(true);
      expect(dependencies.jobs).toHaveLength(1);

      const cancelled = await app.inject({
        headers: { cookie: `esse-session=${data.ownerToken}` },
        method: "POST",
        url: `/api/salons/${data.salonId}/campaigns/${campaign.id}/cancel`,
      });
      expect(cancelled.statusCode, cancelled.body).toBe(200);
      expect(cancelled.json()).toMatchObject({ status: "cancelled" });

      await db
        .update(marketingCampaigns)
        .set({ status: "processing" })
        .where(eq(marketingCampaigns.id, campaign.id));
      const refused = await app.inject({
        headers: { cookie: `esse-session=${data.ownerToken}` },
        method: "POST",
        url: `/api/salons/${data.salonId}/campaigns/${campaign.id}/cancel`,
      });
      expect(refused.statusCode).toBe(409);
      expect(refused.json()).toEqual({ error: "CAMPAIGN_ALREADY_PROCESSING" });
    } finally {
      await app.close();
      await data.cleanup();
    }
  });

  it("retry-failures queues only failed recipients and leaves successful delivery intact", async () => {
    const data = await fixture();
    const dependencies = testDependencies();
    const campaign = (
      await db
        .insert(marketingCampaigns)
        .values({
          channel: "email",
          content: "<p>Promo</p>",
          name: "Promo",
          salonId: data.salonId,
          status: "partial",
          targetSegment: { type: "all" },
        })
        .returning()
    )[0]!;
    const recipientRows = await db
      .insert(campaignRecipients)
      .values([
        {
          campaignId: campaign.id,
          customerId: data.customers[0]!.id,
          destination: "uno@example.test",
          salonId: data.salonId,
          status: "sent",
        },
        {
          campaignId: campaign.id,
          customerId: data.customers[1]!.id,
          destination: "due@example.test",
          error: "PROVIDER_DELIVERY_FAILED",
          salonId: data.salonId,
          status: "failed",
        },
      ])
      .returning();
    const app = createApp({
      campaignProviders: dependencies.providers,
      campaignQueue: dependencies.campaignQueue,
      db,
      env: { API_CORS_ORIGIN: "http://localhost:3000" },
    });
    try {
      const response = await app.inject({
        headers: { cookie: `esse-session=${data.ownerToken}` },
        method: "POST",
        url: `/api/salons/${data.salonId}/campaigns/${campaign.id}/retry-failures`,
      });
      expect(response.statusCode, response.body).toBe(202);
      expect(response.json()).toMatchObject({ queued: 1, status: "processing" });
      expect(dependencies.jobs[0]?.data.recipientIds).toEqual([recipientRows[1]!.id]);

      const stored = await db
        .select({ id: campaignRecipients.id, status: campaignRecipients.status })
        .from(campaignRecipients)
        .where(
          and(
            eq(campaignRecipients.campaignId, campaign.id),
            eq(campaignRecipients.salonId, data.salonId),
          ),
        );
      expect(stored.find((row) => row.id === recipientRows[0]!.id)?.status).toBe("sent");
      expect(stored.find((row) => row.id === recipientRows[1]!.id)?.status).toBe("queued");
    } finally {
      await app.close();
      await data.cleanup();
    }
  });

  it("persists a stable configuration failure instead of disguising it as provider delivery failure", async () => {
    const data = await fixture();
    try {
      const campaign = (
        await db
          .insert(marketingCampaigns)
          .values({
            channel: "email",
            content: "<p>Promo</p>",
            name: "Promo",
            salonId: data.salonId,
            status: "queued",
            targetSegment: { type: "all" },
          })
          .returning()
      )[0]!;
      const recipient = (
        await db
          .insert(campaignRecipients)
          .values({
            campaignId: campaign.id,
            customerId: data.customers[0]!.id,
            destination: "uno@example.test",
            salonId: data.salonId,
            status: "queued",
          })
          .returning()
      )[0]!;
      const providers = {
        require() {
          throw new ProviderNotConfiguredError("email");
        },
        async send() {
          throw new ProviderNotConfiguredError("email");
        },
        status: () => ({ email: "not_configured", sms: "not_configured" }),
      } as CommunicationProviderRegistry;

      await processCampaignBatch(
        db,
        { data: { campaignId: campaign.id, recipientIds: [recipient.id] } },
        providers,
      );

      const storedRecipient = (
        await db
          .select()
          .from(campaignRecipients)
          .where(eq(campaignRecipients.id, recipient.id))
      )[0]!;
      const storedCampaign = (
        await db
          .select()
          .from(marketingCampaigns)
          .where(eq(marketingCampaigns.id, campaign.id))
      )[0]!;
      expect(storedRecipient.error).toBe("PROVIDER_NOT_CONFIGURED");
      expect(storedRecipient.deliveryAttempts).toBe(1);
      expect(storedCampaign.status).toBe("failed");
    } finally {
      await data.cleanup();
    }
  });

  it("records queue publication failure durably so an operator can retry it", async () => {
    const data = await fixture();
    const dependencies = testDependencies();
    const campaign = (
      await db
        .insert(marketingCampaigns)
        .values({
          channel: "email",
          content: "<p>Promo</p>",
          name: "Promo",
          salonId: data.salonId,
          targetSegment: { type: "all" },
        })
        .returning()
    )[0]!;
    const app = createApp({
      campaignProviders: dependencies.providers,
      campaignQueue: {
        async add() {
          throw new Error("Redis unavailable");
        },
      },
      db,
      env: { API_CORS_ORIGIN: "http://localhost:3000" },
    });
    try {
      const response = await app.inject({
        headers: { cookie: `esse-session=${data.ownerToken}` },
        method: "POST",
        url: `/api/salons/${data.salonId}/campaigns/${campaign.id}/schedule`,
      });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({ error: "CAMPAIGN_QUEUE_UNAVAILABLE" });

      const storedCampaign = (
        await db
          .select()
          .from(marketingCampaigns)
          .where(eq(marketingCampaigns.id, campaign.id))
      )[0]!;
      const storedRecipients = await db
        .select()
        .from(campaignRecipients)
        .where(eq(campaignRecipients.campaignId, campaign.id));
      expect(storedCampaign.status).toBe("failed");
      expect(storedRecipients.every((recipient) => recipient.status === "failed")).toBe(true);
      expect(storedRecipients.every((recipient) => recipient.error === "CAMPAIGN_QUEUE_UNAVAILABLE")).toBe(true);
    } finally {
      await app.close();
      await data.cleanup();
    }
  });
});
