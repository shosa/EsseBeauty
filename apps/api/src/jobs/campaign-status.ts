import { eq } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import { campaignRecipients, marketingCampaigns } from "@esse-beauty/db/schema";

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
