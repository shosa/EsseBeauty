import { Worker } from "bullmq";
import { eq } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import { campaignRecipients, marketingCampaigns } from "@esse-beauty/db/schema";
import {
  QUEUE_NAMES,
  redisConnection,
  type CampaignStatusRefreshJob,
} from "@esse-beauty/comms-contracts";

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
  const active = [...statuses].some((status) => ["pending", "queued", "processing"].includes(status));
  if (active) {
    return statuses.size === 1 && (statuses.has("pending") || statuses.has("queued"))
      ? "queued"
      : "processing";
  }
  if ([...statuses].every((status) => status === "cancelled")) return "cancelled";
  if ([...statuses].every((status) => status === "sent")) return "sent";
  if (statuses.has("sent")) return "partial";
  return "failed";
}

export async function refreshCampaignStatus(db: DrizzleDB, campaignId: string) {
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

// Consumes the campaign-status-refresh events apps/communications emits
// after updating a campaign recipient's delivery status, since it can no
// longer call refreshCampaignStatus in-process once that worker lives in a
// different service.
export function startCampaignStatusRefreshWorker(db: DrizzleDB): Worker<CampaignStatusRefreshJob> {
  return new Worker<CampaignStatusRefreshJob>(
    QUEUE_NAMES.CAMPAIGN_STATUS_REFRESH,
    async (job) => {
      await refreshCampaignStatus(db, job.data.campaignId);
    },
    { connection: redisConnection() },
  );
}
