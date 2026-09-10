import type { FastifyInstance, FastifyRequest } from "fastify";
import { Worker, type Job, type JobsOptions } from "bullmq";
import { and, asc, eq, gte, inArray, isNull, lt, or } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import {
  appointments,
  customers,
  notifications,
  reviewRequestSettings,
  salons,
  services,
  waitlistEntries,
} from "@esse-beauty/db/schema";
import { isModuleEnabled, MODULE_KEYS } from "@esse-beauty/feature-flags";
import {
  enqueueCommunication,
  scheduledReviewTime,
  scheduleReviewInvitation,
  scheduleReviewRequest,
  sendEmail,
} from "@esse-beauty/comms-contracts";
import { getQueue, QUEUE_NAMES, redisConnection } from "@esse-beauty/queue-client";
import { scheduleAppointmentCompletedLoyaltyAward } from "@esse-beauty/domain-events";

interface Transition {
  appointmentId: string;
  previousStatus: string;
  nextStatus: "completed" | "cancelled";
}

declare module "fastify" {
  interface FastifyRequest {
    appointmentTransition?: Transition;
  }
}

export function detectAppointmentTransition(input: {
  body?: { status?: string };
  method: string;
  params?: { appointmentId?: string };
  routeUrl?: string;
}) {
  const { body, method, params, routeUrl } = input;
  if (
    method === "POST" &&
    params?.appointmentId &&
    routeUrl === "/api/salons/:id/appointments/:appointmentId/checkout"
  ) {
    return { appointmentId: params.appointmentId, nextStatus: "completed" as const };
  }
  if (
    method !== "PATCH" ||
    !params?.appointmentId ||
    (body?.status !== "completed" && body?.status !== "cancelled")
  ) {
    return undefined;
  }
  return {
    appointmentId: params.appointmentId,
    nextStatus: body.status as "completed" | "cancelled",
  };
}

// Both follow-ups key their BullMQ job id off the appointment id alone: a
// re-add while the previous job is still queued/active is a no-op dedup
// (matches the existing double-checkout dedup the review scheduler relies
// on), and a re-add after the previous job has completed/expired starts a
// fresh, still-idempotent attempt (loyalty award is guarded by the
// loyalty_points_appointment_unique index; waitlist rematch is guarded by
// the "status = waiting" filter it queries against).
export const APPOINTMENT_FOLLOWUP_JOB_OPTIONS = {
  attempts: 5,
  backoff: { delay: 30_000, type: "exponential" as const },
  removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
  removeOnFail: { age: 7 * 24 * 60 * 60 },
} satisfies JobsOptions;

export interface AppointmentFollowupJobData {
  appointmentId: string;
}

export interface AppointmentFollowupQueue {
  add(
    name: "award-loyalty" | "rematch-waitlist",
    data: AppointmentFollowupJobData,
    options?: JobsOptions,
  ): Promise<unknown>;
}

interface AppointmentEventDependencies {
  followupQueue?: AppointmentFollowupQueue;
  scheduleReviewInvitation?: typeof scheduleReviewInvitation;
}

function transitionFrom(request: FastifyRequest) {
  return detectAppointmentTransition({
    body: request.body as { status?: string } | undefined,
    method: request.method,
    params: request.params as { appointmentId?: string } | undefined,
    routeUrl: request.routeOptions.url,
  });
}

export async function scheduleLoyaltyAward(
  db: DrizzleDB,
  appointment: Pick<typeof appointments.$inferSelect, "id" | "salonId">,
  queue: AppointmentFollowupQueue = getQueue(QUEUE_NAMES.APPOINTMENT_FOLLOWUPS),
): Promise<void> {
  if (!(await isModuleEnabled(appointment.salonId, MODULE_KEYS.LOYALTY, db))) return;
  await queue.add(
    "award-loyalty",
    { appointmentId: appointment.id },
    { ...APPOINTMENT_FOLLOWUP_JOB_OPTIONS, jobId: `loyalty-award-${appointment.id}` },
  );
}

export async function scheduleWaitlistRematch(
  db: DrizzleDB,
  appointment: Pick<typeof appointments.$inferSelect, "id" | "salonId">,
  queue: AppointmentFollowupQueue = getQueue(QUEUE_NAMES.APPOINTMENT_FOLLOWUPS),
): Promise<void> {
  if (!(await isModuleEnabled(appointment.salonId, MODULE_KEYS.WAITLIST, db))) return;
  await queue.add(
    "rematch-waitlist",
    { appointmentId: appointment.id },
    { ...APPOINTMENT_FOLLOWUP_JOB_OPTIONS, jobId: `waitlist-rematch-${appointment.id}` },
  );
}

export async function processLoyaltyAward(
  db: DrizzleDB,
  job: Job<AppointmentFollowupJobData>,
): Promise<void> {
  const appointment = (
    await db.select().from(appointments).where(eq(appointments.id, job.data.appointmentId))
  )[0];
  if (!appointment || appointment.status !== "completed") return;
  if (!(await isModuleEnabled(appointment.salonId, MODULE_KEYS.LOYALTY, db))) return;
  await scheduleAppointmentCompletedLoyaltyAward({
    appointmentId: appointment.id,
    customerId: appointment.customerId,
    salonId: appointment.salonId,
  });
}

interface WaitlistRematchDependencies {
  enqueue?: typeof enqueueCommunication;
  sendEmail?: typeof sendEmail;
}

export async function processWaitlistRematch(
  db: DrizzleDB,
  job: Job<AppointmentFollowupJobData>,
  dependencies: WaitlistRematchDependencies = {},
): Promise<void> {
  const appointment = (
    await db.select().from(appointments).where(eq(appointments.id, job.data.appointmentId))
  )[0];
  if (!appointment || appointment.status !== "cancelled") return;
  if (!(await isModuleEnabled(appointment.salonId, MODULE_KEYS.WAITLIST, db))) return;

  const start = new Date(appointment.startsAt);
  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const timePreference = start.getHours() < 12 ? "morning" : start.getHours() < 18 ? "afternoon" : "evening";
  const entries = await db
    .select({
      id: waitlistEntries.id,
      salonId: waitlistEntries.salonId,
      email: customers.email,
      phone: customers.phone,
      customerName: customers.fullName,
      salonSlug: salons.slug,
      serviceName: services.name,
      serviceId: waitlistEntries.serviceId,
      staffId: waitlistEntries.staffId,
    })
    .from(waitlistEntries)
    .innerJoin(customers, eq(customers.id, waitlistEntries.customerId))
    .innerJoin(salons, eq(salons.id, waitlistEntries.salonId))
    .innerJoin(services, eq(services.id, waitlistEntries.serviceId))
    .where(
      and(
        eq(waitlistEntries.salonId, appointment.salonId),
        eq(waitlistEntries.serviceId, appointment.serviceId),
        eq(waitlistEntries.status, "waiting"),
        gte(waitlistEntries.requestedDate, dayStart),
        lt(waitlistEntries.requestedDate, dayEnd),
        inArray(waitlistEntries.timePreference, ["any", timePreference]),
        or(
          isNull(waitlistEntries.staffId),
          eq(waitlistEntries.staffId, appointment.staffId),
        ),
      ),
    )
    .orderBy(asc(waitlistEntries.createdAt))
    .limit(1);
  const entry = entries[0];
  if (!entry) return;
  await db
    .update(waitlistEntries)
    .set({ status: "notified" })
    .where(eq(waitlistEntries.id, entry.id));
  const bookingQuery = new URLSearchParams({ date: start.toISOString().slice(0, 10), serviceId: entry.serviceId });
  if (entry.staffId) bookingQuery.set("staffId", entry.staffId);
  const bookingUrl = `${process.env.PWA_URL ?? "http://localhost:3002"}/${entry.salonSlug}/book?${bookingQuery}`;
  const message = `A slot has opened on ${start.toLocaleDateString("it-IT")} for ${entry.serviceName}. Book now: ${bookingUrl}`;
  try {
    if (entry.email) {
      await (dependencies.sendEmail ?? sendEmail)(
        entry.email,
        `Posto disponibile per ${entry.serviceName}`,
        `<p>Ciao ${entry.customerName},</p><p>${message}</p>`,
      );
    } else if (entry.phone) {
      await (dependencies.enqueue ?? enqueueCommunication)(db, {
        idempotencyKey: `waitlist-notification-${entry.id}`,
        kind: "template",
        salonId: entry.salonId,
        sourceId: entry.id,
        sourceType: "waitlist_entry",
        template: {
          locale: "it",
          name: "waitlist_slot_available",
          parameters: [
            entry.customerName,
            entry.serviceName,
            start.toLocaleDateString("it-IT"),
            bookingUrl,
          ],
        },
        to: entry.phone,
      });
    }
  } catch {
    await db
      .update(waitlistEntries)
      .set({ status: "waiting" })
      .where(eq(waitlistEntries.id, entry.id));
    throw new Error("WAITLIST_REMATCH_NOTIFY_FAILED");
  }
}

export function startAppointmentFollowupWorker(db: DrizzleDB): Worker<AppointmentFollowupJobData> {
  return new Worker<AppointmentFollowupJobData>(
    QUEUE_NAMES.APPOINTMENT_FOLLOWUPS,
    async (job) => {
      if (job.name === "award-loyalty") await processLoyaltyAward(db, job);
      else if (job.name === "rematch-waitlist") await processWaitlistRematch(db, job);
    },
    { connection: redisConnection() },
  );
}

async function enqueueReview(
  app: FastifyInstance,
  appointment: typeof appointments.$inferSelect,
  dependencies: AppointmentEventDependencies,
) {
  if (
    await isModuleEnabled(
      appointment.salonId,
      MODULE_KEYS.REVIEWS,
      app.db,
    )
  ) {
    const policy = (await app.db.select().from(reviewRequestSettings).where(eq(reviewRequestSettings.salonId, appointment.salonId)))[0];
    if (!policy?.automaticEnabled) return;
    const salon = (await app.db.select({ timezone: salons.timezone }).from(salons).where(eq(salons.id, appointment.salonId)))[0];
    if (!salon) return;
    if (dependencies.scheduleReviewInvitation) await dependencies.scheduleReviewInvitation(app.db, appointment.id);
    else await scheduleReviewRequest(app.db, appointment.id, { channels: policy.channels, scheduledAt: scheduledReviewTime(new Date(), policy.delayPreset, salon.timezone) });
  }
}

export function registerAppointmentEventHooks(
  app: FastifyInstance,
  dependencies: AppointmentEventDependencies = {},
): void {
  app.decorateRequest("appointmentTransition");
  app.addHook("preHandler", async (request) => {
    const candidate = transitionFrom(request);
    if (!candidate) return;
    const rows = await app.db
      .select({ status: appointments.status })
      .from(appointments)
      .where(eq(appointments.id, candidate.appointmentId));
    if (
      rows[0] &&
      (rows[0].status !== candidate.nextStatus || candidate.nextStatus === "completed")
    ) {
      request.appointmentTransition = {
        ...candidate,
        previousStatus: rows[0].status,
      };
    }
  });
  app.addHook("onResponse", async (request, reply) => {
    const transition = request.appointmentTransition;
    if (!transition || reply.statusCode >= 400) return;
    const rows = await app.db
      .select()
      .from(appointments)
      .where(eq(appointments.id, transition.appointmentId));
    const appointment = rows[0];
    if (!appointment || appointment.status !== transition.nextStatus) return;
    try {
      await app.db.update(notifications).set({
        archivedAt: new Date(),
        readAt: new Date(),
      }).where(and(
        eq(notifications.salonId, appointment.salonId),
        eq(notifications.entityType, "appointment"),
        eq(notifications.entityId, appointment.id),
        eq(notifications.type, "online_booking_received"),
      ));
      if (transition.nextStatus === "completed") {
        await Promise.all([
          scheduleLoyaltyAward(app.db, appointment, dependencies.followupQueue),
          enqueueReview(app, appointment, dependencies),
        ]);
      } else {
        await Promise.all([
          scheduleWaitlistRematch(app.db, appointment, dependencies.followupQueue),
        ]);
      }
    } catch (error) {
      request.log.error(error, "Optional module appointment trigger failed");
    }
  });
}
