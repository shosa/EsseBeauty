import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import type { Job } from "bullmq";

import { createDatabase, type DrizzleDB } from "@esse-beauty/db";
import {
  communicationConversations,
  communicationOutbox,
  communicationProviderAccounts,
  communicationProviderSecrets,
  campaignRecipients,
  marketingCampaigns,
  salons,
} from "@esse-beauty/db/schema";

import { encryptProviderSecret } from "../lib/provider-credentials.js";
import { testDatabaseUrl } from "../test/postgres.js";
import {
  enqueueCommunication,
  processCommunicationOutbox,
  type CommunicationOutboxJob,
} from "./communications.js";

const databaseUrl = testDatabaseUrl();
const postgresSuite = databaseUrl ? describe : describe.skip;

postgresSuite("durable WhatsApp outbox with PostgreSQL", () => {
  let db: DrizzleDB;
  beforeAll(() => {
    process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 23).toString("base64");
    process.env.PROVIDER_CREDENTIAL_KEY_VERSION = "v1";
    db = createDatabase(databaseUrl!);
  });
  afterAll(async () => { await db.$client.end(); });

  async function fixture() {
    const salonId = randomUUID();
    const accountId = randomUUID();
    await db.insert(salons).values({ id: salonId, locale: "it-IT", name: "Outbox Test", slug: `outbox-${salonId}`, timezone: "Europe/Rome" });
    await db.insert(communicationProviderAccounts).values({
      enabled: true,
      id: accountId,
      phoneNumberId: `phone-${salonId}`,
      salonId,
      status: "ready",
      wabaId: `waba-${salonId}`,
    });
    await db.insert(communicationProviderSecrets).values({
      accountId,
      kind: "access_token",
      salonId,
      ...encryptProviderSecret("token", { accountId, provider: "meta_cloud_api", salonId }),
    });
    return { accountId, salonId };
  }

  it("persists message and outbox transactionally and delivers an idempotency key once", async () => {
    const data = await fixture();
    const queue = { add: vi.fn(async () => undefined) };
    const sender = vi.fn(async () => ({ acceptedAt: new Date(), provider: "meta_cloud_api" as const, providerMessageId: "wamid.once" }));
    try {
      const first = await enqueueCommunication(db, {
        idempotencyKey: "appointment-reminder-1",
        kind: "template",
        salonId: data.salonId,
        template: { locale: "it", name: "promemoria", parameters: ["Mario"] },
        to: "+393331234567",
      }, queue);
      const duplicate = await enqueueCommunication(db, {
        idempotencyKey: "appointment-reminder-1",
        kind: "template",
        salonId: data.salonId,
        template: { locale: "it", name: "promemoria", parameters: ["Mario"] },
        to: "+393331234567",
      }, queue);
      expect(duplicate.messageId).toBe(first.messageId);

      const job = { data: { outboxId: first.outboxId } } as Job<CommunicationOutboxJob>;
      await processCommunicationOutbox(db, job, { sender });
      await processCommunicationOutbox(db, job, { sender });

      expect(sender).toHaveBeenCalledTimes(1);
      const rows = await db.execute(sql<{ message_status: string; outbox_status: string; provider_message_id: string }>`
        select m.status message_status, o.status outbox_status, m.provider_message_id
        from communication_messages m join communication_outbox o on o.message_id = m.id
        where m.id = ${first.messageId}::uuid
      `);
      expect(rows).toEqual([{ message_status: "accepted", outbox_status: "delivered", provider_message_id: "wamid.once" }]);
    } finally {
      await db.delete(salons).where(eq(salons.id, data.salonId));
    }
  });

  it("recovers an expired lease and stops at the persisted attempt ceiling", async () => {
    const data = await fixture();
    const sender = vi.fn(async () => { throw Object.assign(new Error("safe"), { code: "META_UNAVAILABLE", retryable: true }); });
    try {
      const queued = await enqueueCommunication(db, {
        idempotencyKey: "lease-recovery-1",
        kind: "template",
        salonId: data.salonId,
        template: { locale: "it", name: "promemoria", parameters: [] },
        to: "+393331234567",
      }, { add: vi.fn(async () => undefined) });
      await db.update(communicationOutbox).set({
        attempts: 4,
        leaseExpiresAt: new Date(Date.now() - 60_000),
        leaseOwner: "dead-worker",
        status: "processing",
      }).where(eq(communicationOutbox.id, queued.outboxId));

      await expect(processCommunicationOutbox(db, { data: { outboxId: queued.outboxId } } as Job<CommunicationOutboxJob>, { sender })).rejects.toThrow("COMMUNICATION_DELIVERY_FAILED");
      await processCommunicationOutbox(db, { data: { outboxId: queued.outboxId } } as Job<CommunicationOutboxJob>, { sender });

      const rows = await db.select({ attempts: communicationOutbox.attempts, status: communicationOutbox.status }).from(communicationOutbox).where(eq(communicationOutbox.id, queued.outboxId));
      expect(rows).toEqual([{ attempts: 5, status: "exhausted" }]);
      expect(sender).toHaveBeenCalledTimes(1);
    } finally {
      await db.delete(salons).where(eq(salons.id, data.salonId));
    }
  });

  it("does not leave a message without an outbox row when queue wake-up fails", async () => {
    const data = await fixture();
    try {
      const result = await enqueueCommunication(db, {
        idempotencyKey: "durable-before-redis",
        kind: "template",
        salonId: data.salonId,
        template: { locale: "it", name: "promemoria", parameters: [] },
        to: "+393331234567",
      }, { add: vi.fn(async () => { throw new Error("redis unavailable"); }) });
      const rows = await db.execute(sql<{ count: number }>`select count(*)::int count from communication_outbox where id = ${result.outboxId}::uuid`);
      expect(rows).toEqual([{ count: 1 }]);
    } finally {
      await db.delete(salons).where(eq(salons.id, data.salonId));
    }
  });

  it("refreshes the parent campaign only after the outbox provider accepts its recipient", async () => {
    const data = await fixture();
    const queue = { add: vi.fn(async () => undefined) };
    try {
      const campaign = (await db.insert(marketingCampaigns).values({
        channel: "whatsapp",
        content: "Promo",
        name: "Promo",
        salonId: data.salonId,
        status: "queued",
        targetSegment: { type: "all" },
      }).returning())[0]!;
      const recipient = (await db.insert(campaignRecipients).values({
        campaignId: campaign.id,
        destination: "+393331234567",
        salonId: data.salonId,
        status: "queued",
      }).returning())[0]!;
      const queued = await enqueueCommunication(db, {
        idempotencyKey: `campaign-recipient-${recipient.id}`,
        kind: "template",
        salonId: data.salonId,
        sourceId: recipient.id,
        sourceType: "campaign_recipient",
        template: { locale: "it", name: "promo", parameters: [] },
        to: recipient.destination,
      }, queue);
      await processCommunicationOutbox(db, { data: { outboxId: queued.outboxId } } as Job<CommunicationOutboxJob>, {
        sender: async () => ({ acceptedAt: new Date(), provider: "meta_cloud_api", providerMessageId: "wamid.campaign" }),
      });
      expect((await db.select({ status: campaignRecipients.status }).from(campaignRecipients).where(eq(campaignRecipients.id, recipient.id)))[0]?.status).toBe("sent");
      expect((await db.select({ status: marketingCampaigns.status }).from(marketingCampaigns).where(eq(marketingCampaigns.id, campaign.id)))[0]?.status).toBe("sent");
    } finally {
      await db.delete(salons).where(eq(salons.id, data.salonId));
    }
  });

  it("reactivates an exhausted campaign recipient outbox for an explicit stable-idempotency retry", async () => {
    const data = await fixture();
    const queue = { add: vi.fn(async () => undefined) };
    try {
      const campaign = (await db.insert(marketingCampaigns).values({
        channel: "whatsapp", content: "Promo", name: "Promo", salonId: data.salonId, status: "queued", targetSegment: { type: "all" },
      }).returning())[0]!;
      const recipient = (await db.insert(campaignRecipients).values({
        campaignId: campaign.id, destination: "+393331234567", salonId: data.salonId, status: "queued",
      }).returning())[0]!;
      const input = {
        idempotencyKey: `campaign-recipient-${recipient.id}`,
        kind: "template" as const,
        salonId: data.salonId,
        sourceId: recipient.id,
        sourceType: "campaign_recipient",
        template: { locale: "it", name: "promo", parameters: [] },
        to: recipient.destination,
      };
      const first = await enqueueCommunication(db, input, queue);
      await db.update(communicationOutbox).set({ attempts: 4 }).where(eq(communicationOutbox.id, first.outboxId));
      await expect(processCommunicationOutbox(db, { data: { outboxId: first.outboxId } } as Job<CommunicationOutboxJob>, {
        sender: async () => { throw Object.assign(new Error("temporary"), { code: "META_UNAVAILABLE", retryable: true }); },
      })).rejects.toThrow("COMMUNICATION_DELIVERY_FAILED");
      expect((await db.select({ status: campaignRecipients.status }).from(campaignRecipients).where(eq(campaignRecipients.id, recipient.id)))[0]?.status).toBe("failed");
      expect((await db.select({ status: marketingCampaigns.status }).from(marketingCampaigns).where(eq(marketingCampaigns.id, campaign.id)))[0]?.status).toBe("failed");

      await db.update(campaignRecipients).set({ error: null, status: "queued" }).where(eq(campaignRecipients.id, recipient.id));
      const retried = await enqueueCommunication(db, input, queue);
      expect(retried).toEqual(first);
      await processCommunicationOutbox(db, { data: { outboxId: retried.outboxId } } as Job<CommunicationOutboxJob>, {
        sender: async () => ({ acceptedAt: new Date(), provider: "meta_cloud_api", providerMessageId: "wamid.retry" }),
      });
      expect((await db.select({ status: campaignRecipients.status }).from(campaignRecipients).where(eq(campaignRecipients.id, recipient.id)))[0]?.status).toBe("sent");
      expect((await db.select({ status: marketingCampaigns.status }).from(marketingCampaigns).where(eq(marketingCampaigns.id, campaign.id)))[0]?.status).toBe("sent");
      expect((await db.select({ attempts: communicationOutbox.attempts, status: communicationOutbox.status }).from(communicationOutbox).where(eq(communicationOutbox.id, retried.outboxId)))[0]).toEqual({ attempts: 1, status: "delivered" });
    } finally {
      await db.delete(salons).where(eq(salons.id, data.salonId));
    }
  });
});
