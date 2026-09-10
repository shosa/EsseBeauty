import { Worker, type Job } from "bullmq";

import type { DrizzleDB } from "@esse-beauty/db";
import { saleItems, sales } from "@esse-beauty/db/schema";
import { eq } from "drizzle-orm";
import { isModuleEnabled, MODULE_KEYS } from "@esse-beauty/feature-flags";
import { QUEUE_NAMES, redisConnection } from "@esse-beauty/queue-client";
import type {
  AppointmentCompletedLoyaltyAwardJob,
  ReviewSubmittedLoyaltyAwardJob,
  SaleCompletedLoyaltyAwardJob,
  SaleVoidedLoyaltyExpiryJob,
} from "@esse-beauty/domain-events";

import {
  awardAppointmentCompletion,
  awardReviewSubmission,
  awardSaleLoyalty,
  expireSaleLoyaltyPoints,
} from "../lib/loyalty-engine.js";

type LoyaltyAwardJobData =
  | ReviewSubmittedLoyaltyAwardJob
  | AppointmentCompletedLoyaltyAwardJob
  | SaleCompletedLoyaltyAwardJob
  | SaleVoidedLoyaltyExpiryJob;

// Consumes the loyalty-award events apps/api and apps/communications emit
// after committing a write they used to award loyalty points for in the
// same DB transaction, back when this logic still lived in their process.
async function processReviewAward(db: DrizzleDB, job: Job<ReviewSubmittedLoyaltyAwardJob>): Promise<void> {
  if (!(await isModuleEnabled(job.data.salonId, MODULE_KEYS.LOYALTY, db))) return;
  await awardReviewSubmission(db, {
    customerId: job.data.customerId,
    salonId: job.data.salonId,
  });
}

async function processAppointmentAward(db: DrizzleDB, job: Job<AppointmentCompletedLoyaltyAwardJob>): Promise<void> {
  if (!(await isModuleEnabled(job.data.salonId, MODULE_KEYS.LOYALTY, db))) return;
  await awardAppointmentCompletion(db, {
    appointmentId: job.data.appointmentId,
    customerId: job.data.customerId,
    salonId: job.data.salonId,
  });
}

async function processSaleAward(db: DrizzleDB, job: Job<SaleCompletedLoyaltyAwardJob>): Promise<void> {
  if (!(await isModuleEnabled(job.data.salonId, MODULE_KEYS.LOYALTY, db))) return;
  const sale = (await db.select().from(sales).where(eq(sales.id, job.data.saleId)))[0];
  if (!sale || !sale.customerId) return;
  const items = await db.select({
    item_type: saleItems.itemType,
    quantity: saleItems.quantity,
    totalCents: saleItems.totalCents,
  }).from(saleItems).where(eq(saleItems.saleId, sale.id));
  await awardSaleLoyalty(db, {
    appointmentId: sale.appointmentId,
    customerId: sale.customerId,
    discountCents: sale.discountCents,
    items,
    saleId: sale.id,
    salonId: sale.salonId,
  });
}

async function processSaleVoidExpiry(db: DrizzleDB, job: Job<SaleVoidedLoyaltyExpiryJob>): Promise<void> {
  await expireSaleLoyaltyPoints(db, { saleId: job.data.saleId, salonId: job.data.salonId });
}

export function startLoyaltyAwardWorker(db: DrizzleDB): Worker<LoyaltyAwardJobData> {
  return new Worker<LoyaltyAwardJobData>(
    QUEUE_NAMES.LOYALTY_AWARDS,
    async (job) => {
      if (job.name === "award-review") await processReviewAward(db, job as Job<ReviewSubmittedLoyaltyAwardJob>);
      else if (job.name === "award-appointment") await processAppointmentAward(db, job as Job<AppointmentCompletedLoyaltyAwardJob>);
      else if (job.name === "award-sale") await processSaleAward(db, job as Job<SaleCompletedLoyaltyAwardJob>);
      else if (job.name === "expire-sale") await processSaleVoidExpiry(db, job as Job<SaleVoidedLoyaltyExpiryJob>);
    },
    { connection: redisConnection() },
  );
}
