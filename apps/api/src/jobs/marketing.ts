import { Worker, type Job } from "bullmq";
import { and, eq, inArray } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import {
  campaignRecipients,
  marketingCampaigns,
} from "@esse-beauty/db/schema";

import { sendEmail, sendSms } from "./notifications.js";
import { QUEUE_NAMES, redisConnection } from "./queues.js";

export interface CampaignBatchJob {
  campaignId: string;
  recipientIds: string[];
}

async function processBatch(db: DrizzleDB, job: Job<CampaignBatchJob>) {
  const campaigns = await db
    .select()
    .from(marketingCampaigns)
    .where(eq(marketingCampaigns.id, job.data.campaignId));
  const campaign = campaigns[0];
  if (!campaign) return;
  const recipients = await db
    .select()
    .from(campaignRecipients)
    .where(
      and(
        eq(campaignRecipients.campaignId, campaign.id),
        inArray(campaignRecipients.id, job.data.recipientIds),
      ),
    );

  for (const recipient of recipients) {
    try {
      if (campaign.channel === "email") {
        await sendEmail(recipient.destination, campaign.name, campaign.content);
      } else {
        await sendSms(recipient.destination, campaign.content);
      }
      await db
        .update(campaignRecipients)
        .set({ status: "sent", sentAt: new Date(), error: null })
        .where(eq(campaignRecipients.id, recipient.id));
    } catch (error) {
      await db
        .update(campaignRecipients)
        .set({
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        })
        .where(eq(campaignRecipients.id, recipient.id));
    }
  }
}

export function startMarketingWorker(db: DrizzleDB): Worker<CampaignBatchJob> {
  return new Worker(
    QUEUE_NAMES.CAMPAIGNS,
    (job) => processBatch(db, job),
    {
      connection: redisConnection(),
    },
  );
}
