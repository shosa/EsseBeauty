import { Worker, type Job, type JobsOptions } from "bullmq";
import { and, eq, inArray, sql } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import { campaignRecipients, marketingCampaigns } from "@esse-beauty/db/schema";

import {
  createCommunicationProviderRegistry,
  type CommunicationProviderRegistry,
  ProviderNotConfiguredError,
} from "../providers/communications.js";
import { QUEUE_NAMES, redisConnection } from "./queues.js";

export interface CampaignBatchJob {
  campaignId: string;
  recipientIds: string[];
}

export interface CampaignQueue {
  add(name: string, data: CampaignBatchJob, options?: JobsOptions): Promise<unknown>;
}

export type AggregatedCampaignStatus =
  | "queued"
  | "processing"
  | "sent"
  | "failed"
  | "partial"
  | "cancelled";

export function aggregateCampaignStatus(
  recipients: ReadonlyArray<{ status: string }>,
): AggregatedCampaignStatus {
  if (recipients.length === 0) return "failed";
  const statuses = new Set(recipients.map((recipient) => recipient.status));
  if ([...statuses].every((status) => status === "cancelled")) return "cancelled";
  if ([...statuses].every((status) => status === "sent")) return "sent";
  if ([...statuses].every((status) => status === "failed")) return "failed";
  if (statuses.has("processing")) return "processing";
  if (statuses.has("pending") || statuses.has("queued")) {
    return statuses.size === 1 ? "queued" : "processing";
  }
  if (statuses.has("sent") && statuses.has("failed")) return "partial";
  return "processing";
}

async function refreshCampaignStatus(db: DrizzleDB, campaignId: string) {
  const recipients = await db
    .select({ status: campaignRecipients.status })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaignId));
  const status = aggregateCampaignStatus(recipients);
  const terminal = ["sent", "failed", "partial", "cancelled"].includes(status);
  await db
    .update(marketingCampaigns)
    .set({
      sentAt: terminal && status !== "cancelled" ? new Date() : null,
      status,
      updatedAt: new Date(),
    })
    .where(eq(marketingCampaigns.id, campaignId));
  return status;
}

export async function processCampaignBatch(
  db: DrizzleDB,
  job: Pick<Job<CampaignBatchJob>, "data">,
  providers: CommunicationProviderRegistry = createCommunicationProviderRegistry(),
): Promise<void> {
  const campaigns = await db
    .select()
    .from(marketingCampaigns)
    .where(eq(marketingCampaigns.id, job.data.campaignId));
  const campaign = campaigns[0];
  if (!campaign || campaign.status === "cancelled") return;

  const claimed = await db.transaction(async (tx) => {
    const started = await tx
      .update(marketingCampaigns)
      .set({
        processingStartedAt: campaign.processingStartedAt ?? new Date(),
        status: "processing",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(marketingCampaigns.id, campaign.id),
          inArray(marketingCampaigns.status, ["queued", "scheduled", "processing"]),
        ),
      )
      .returning({ id: marketingCampaigns.id });
    if (!started[0]) return [];
    return tx
      .update(campaignRecipients)
      .set({
        deliveryAttempts: sql`${campaignRecipients.deliveryAttempts} + 1`,
        error: null,
        lastAttemptAt: new Date(),
        status: "processing",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(campaignRecipients.campaignId, campaign.id),
          eq(campaignRecipients.salonId, campaign.salonId),
          inArray(campaignRecipients.id, job.data.recipientIds),
          eq(campaignRecipients.status, "queued"),
        ),
      )
      .returning();
  });
  if (claimed.length === 0) return;

  for (const recipient of claimed) {
    try {
      const receipt = await providers.send(
        campaign.channel === "email"
          ? {
              channel: "email",
              html: campaign.content,
              idempotencyKey: `campaign-recipient-${recipient.id}`,
              subject: campaign.name,
              to: recipient.destination,
            }
          : {
              channel: "sms",
              idempotencyKey: `campaign-recipient-${recipient.id}`,
              text: campaign.content,
              to: recipient.destination,
            },
      );
      await db
        .update(campaignRecipients)
        .set({
          error: null,
          providerMessageId: receipt.providerMessageId,
          providerName: receipt.provider,
          sentAt: receipt.acceptedAt,
          status: "sent",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(campaignRecipients.id, recipient.id),
            eq(campaignRecipients.status, "processing"),
          ),
        );
    } catch (error) {
      await db
        .update(campaignRecipients)
        .set({
          error:
            error instanceof ProviderNotConfiguredError
              ? "PROVIDER_NOT_CONFIGURED"
              : "PROVIDER_DELIVERY_FAILED",
          providerMessageId: null,
          providerName: null,
          status: "failed",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(campaignRecipients.id, recipient.id),
            eq(campaignRecipients.status, "processing"),
          ),
        );
    }
  }

  await refreshCampaignStatus(db, campaign.id);
}

export function startMarketingWorker(
  db: DrizzleDB,
  providers: CommunicationProviderRegistry = createCommunicationProviderRegistry(),
): Worker<CampaignBatchJob> {
  return new Worker(
    QUEUE_NAMES.CAMPAIGNS,
    (job) => processCampaignBatch(db, job, providers),
    { connection: redisConnection() },
  );
}
