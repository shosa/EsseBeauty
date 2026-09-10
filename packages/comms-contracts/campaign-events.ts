import type { JobsOptions } from "bullmq";

import { getQueue, QUEUE_NAMES } from "./queues.js";

// The apps/communications outbox worker updates campaignRecipients directly
// (same shared Postgres, a plain row update) when a WhatsApp send accepts
// or fails, but recomputing the campaign's aggregate status is marketing
// business logic owned by apps/api. It enqueues this event instead of
// importing that logic across the process boundary.
export interface CampaignStatusRefreshJob {
  campaignId: string;
}

export interface CampaignEventQueue {
  add(name: "refresh", data: CampaignStatusRefreshJob, options?: JobsOptions): Promise<unknown>;
}

export async function scheduleCampaignStatusRefresh(
  campaignId: string,
  queue: CampaignEventQueue = getQueue(QUEUE_NAMES.CAMPAIGN_STATUS_REFRESH),
): Promise<void> {
  await queue.add("refresh", { campaignId }, {
    attempts: 5,
    backoff: { delay: 15_000, type: "exponential" },
    jobId: `campaign-status-refresh-${campaignId}-${Date.now()}`,
    removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
    removeOnFail: { age: 24 * 60 * 60 },
  });
}
