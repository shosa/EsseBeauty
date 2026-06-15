import { Worker, type Job } from "bullmq";
import { eq } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import {
  appointments,
  customers,
  salons,
  services,
} from "@esse-beauty/db/schema";

import { sendEmail } from "./notifications.js";
import { QUEUE_NAMES, redisConnection } from "./queues.js";

export interface ReviewRequestJob {
  appointmentId: string;
}

async function processReviewRequest(
  db: DrizzleDB,
  job: Job<ReviewRequestJob>,
): Promise<void> {
  try {
    const rows = await db
      .select({
        email: customers.email,
        customerName: customers.fullName,
        salonName: salons.name,
        serviceName: services.name,
      })
      .from(appointments)
      .innerJoin(customers, eq(customers.id, appointments.customerId))
      .innerJoin(salons, eq(salons.id, appointments.salonId))
      .innerJoin(services, eq(services.id, appointments.serviceId))
      .where(eq(appointments.id, job.data.appointmentId));
    const item = rows[0];
    if (!item?.email) return;
    const pwaUrl = process.env.PWA_URL ?? "http://localhost:3002";
    await sendEmail(
      item.email,
      `Come è andato il tuo appuntamento da ${item.salonName}?`,
      `<p>Ciao ${item.customerName},</p><p>raccontaci come è andato ${item.serviceName}.</p><p><a href="${pwaUrl}/review/${job.data.appointmentId}">Lascia una recensione</a></p>`,
    );
  } catch {
    // BullMQ records the failed attempt; the worker remains alive.
  }
}

export function startReviewWorker(db: DrizzleDB): Worker<ReviewRequestJob> {
  return new Worker(
    QUEUE_NAMES.REVIEWS,
    (job) => processReviewRequest(db, job),
    {
      connection: redisConnection(),
    },
  );
}
