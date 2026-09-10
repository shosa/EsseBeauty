import { Worker } from "bullmq";

import type { DrizzleDB } from "@esse-beauty/db";
import { isModuleEnabled, MODULE_KEYS } from "@esse-beauty/feature-flags";
import {
  QUEUE_NAMES,
  redisConnection,
  type ReviewSubmittedLoyaltyAwardJob,
} from "@esse-beauty/comms-contracts";

import { awardReviewSubmission } from "../lib/loyalty-engine.js";

// Consumes the review-submitted event apps/communications emits after
// committing a review (it can no longer award loyalty points in the same
// DB transaction once review submission lives in a different service).
export function startReviewLoyaltyAwardWorker(db: DrizzleDB): Worker<ReviewSubmittedLoyaltyAwardJob> {
  return new Worker<ReviewSubmittedLoyaltyAwardJob>(
    QUEUE_NAMES.REVIEW_LOYALTY_AWARDS,
    async (job) => {
      if (!(await isModuleEnabled(job.data.salonId, MODULE_KEYS.LOYALTY, db))) return;
      await awardReviewSubmission(db, {
        customerId: job.data.customerId,
        salonId: job.data.salonId,
      });
    },
    { connection: redisConnection() },
  );
}
