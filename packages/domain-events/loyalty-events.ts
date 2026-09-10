import type { JobsOptions } from "bullmq";

import { getQueue, QUEUE_NAMES } from "@esse-beauty/queue-client";

// Three different services trigger a loyalty award (apps/communications on
// review submission, apps/api on appointment completion and on sale
// checkout) but none of them own the loyalty domain anymore, so none of
// them can award points in the same DB transaction as the write that
// triggers it. Each schedules one of these jobs on the shared
// LOYALTY_AWARDS queue instead; the loyalty service consumes it and calls
// the real loyalty-engine award function. This trades the old
// same-transaction atomicity for eventual consistency (retried up to 5
// times on failure), an accepted cost of the service split.
export interface ReviewSubmittedLoyaltyAwardJob {
  customerId: string;
  reviewInvitationId: string;
  salonId: string;
}

export interface AppointmentCompletedLoyaltyAwardJob {
  appointmentId: string;
  customerId: string;
  salonId: string;
}

export interface SaleCompletedLoyaltyAwardJob {
  saleId: string;
  salonId: string;
}

export interface SaleVoidedLoyaltyExpiryJob {
  saleId: string;
  salonId: string;
}

export interface LoyaltyEventQueue {
  add(
    name: "award-review" | "award-appointment" | "award-sale" | "expire-sale",
    data:
      | ReviewSubmittedLoyaltyAwardJob
      | AppointmentCompletedLoyaltyAwardJob
      | SaleCompletedLoyaltyAwardJob
      | SaleVoidedLoyaltyExpiryJob,
    options?: JobsOptions,
  ): Promise<unknown>;
}

const LOYALTY_AWARD_JOB_OPTIONS = {
  attempts: 5,
  backoff: { delay: 30_000, type: "exponential" as const },
  removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
  removeOnFail: { age: 7 * 24 * 60 * 60 },
} satisfies JobsOptions;

export async function scheduleReviewSubmittedLoyaltyAward(
  input: ReviewSubmittedLoyaltyAwardJob,
  queue: LoyaltyEventQueue = getQueue(QUEUE_NAMES.LOYALTY_AWARDS),
): Promise<void> {
  await queue.add("award-review", input, {
    ...LOYALTY_AWARD_JOB_OPTIONS,
    jobId: `review-loyalty-award-${input.reviewInvitationId}`,
  });
}

export async function scheduleAppointmentCompletedLoyaltyAward(
  input: AppointmentCompletedLoyaltyAwardJob,
  queue: LoyaltyEventQueue = getQueue(QUEUE_NAMES.LOYALTY_AWARDS),
): Promise<void> {
  await queue.add("award-appointment", input, {
    ...LOYALTY_AWARD_JOB_OPTIONS,
    jobId: `appointment-loyalty-award-${input.appointmentId}`,
  });
}

export async function scheduleSaleCompletedLoyaltyAward(
  input: SaleCompletedLoyaltyAwardJob,
  queue: LoyaltyEventQueue = getQueue(QUEUE_NAMES.LOYALTY_AWARDS),
): Promise<void> {
  await queue.add("award-sale", input, {
    ...LOYALTY_AWARD_JOB_OPTIONS,
    jobId: `sale-loyalty-award-${input.saleId}`,
  });
}

export async function scheduleSaleVoidedLoyaltyExpiry(
  input: SaleVoidedLoyaltyExpiryJob,
  queue: LoyaltyEventQueue = getQueue(QUEUE_NAMES.LOYALTY_AWARDS),
): Promise<void> {
  await queue.add("expire-sale", input, {
    ...LOYALTY_AWARD_JOB_OPTIONS,
    jobId: `sale-loyalty-expiry-${input.saleId}`,
  });
}
