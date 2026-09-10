import type { JobsOptions } from "bullmq";

import { getQueue, QUEUE_NAMES } from "./queues.js";

// apps/communications owns review submission (routes/reviews) but not the
// loyalty domain, so it can no longer award points in the same DB
// transaction as the review write. It enqueues this event instead; a
// worker in apps/api consumes it and calls the real loyalty-engine award
// function. This trades the old same-transaction atomicity for eventual
// consistency (retried up to 5 times on failure), which is an accepted
// cost of the service split.
export interface ReviewSubmittedLoyaltyAwardJob {
  customerId: string;
  reviewInvitationId: string;
  salonId: string;
}

export interface LoyaltyEventQueue {
  add(name: "award-review", data: ReviewSubmittedLoyaltyAwardJob, options?: JobsOptions): Promise<unknown>;
}

export async function scheduleReviewSubmittedLoyaltyAward(
  input: ReviewSubmittedLoyaltyAwardJob,
  queue: LoyaltyEventQueue = getQueue(QUEUE_NAMES.REVIEW_LOYALTY_AWARDS),
): Promise<void> {
  await queue.add("award-review", input, {
    attempts: 5,
    backoff: { delay: 30_000, type: "exponential" },
    jobId: `review-loyalty-award-${input.reviewInvitationId}`,
    removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
    removeOnFail: { age: 7 * 24 * 60 * 60 },
  });
}
