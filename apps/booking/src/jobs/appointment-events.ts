import type { FastifyInstance, FastifyRequest } from "fastify";
import { Worker, type Job, type JobsOptions } from "bullmq";
import { and, asc, eq, gte, inArray, isNull, lt, or } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import {
  appointments,
  customers,
  notifications,
  salons,
  services,
  waitlistEntries,
} from "@esse-beauty/db/schema";
import { isModuleEnabled, MODULE_KEYS } from "@esse-beauty/feature-flags";
import { enqueueCommunication, sendEmail } from "@esse-beauty/comms-contracts";
import { getQueue, QUEUE_NAMES, redisConnection } from "@esse-beauty/queue-client";

interface Transition {
  appointmentId: string;
  previousStatus: string;
  nextStatus: "cancelled";
}

declare module "fastify" {
  interface FastifyRequest {
    appointmentTransition?: Transition;
  }
}

// Only PATCH .../appointments/:id can transition to "cancelled" here — a
// direct "completed" PATCH is refused by routes/appointments (see
// APPOINTMENT_COMPLETION_REQUIRES_CHECKOUT); completion only ever happens
// through apps/api's sale checkout, which schedules its own loyalty-award
// and review-request follow-ups after its transaction commits (see
// routes/sales/index.ts) since it isn't on this Fastify app to share this
// hook. This hook only needs to cover the one transition that can happen
// here: cancellation, which re-matches the freed slot against the waitlist.
export function detectAppointmentTransition(input: {
  body?: { status?: string };
  method: string;
  params?: { appointmentId?: string };
}) {
  const { body, method, params } = input;
  if (method !== "PATCH" || !params?.appointmentId || body?.status !== "cancelled") {
    return undefined;
  }
  return { appointmentId: params.appointmentId, nextStatus: "cancelled" as const };
}

// A re-add while the previous job is still queued/active is a no-op dedup;
// a re-add after the previous job has completed/expired starts a fresh,
// still-idempotent attempt (guarded by the "status = waiting" filter the
// rematch query itself runs against).
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
    name: "rematch-waitlist",
    data: AppointmentFollowupJobData,
    options?: JobsOptions,
  ): Promise<unknown>;
}

interface AppointmentEventDependencies {
  followupQueue?: AppointmentFollowupQueue;
}

function transitionFrom(request: FastifyRequest) {
  return detectAppointmentTransition({
    body: request.body as { status?: string } | undefined,
    method: request.method,
    params: request.params as { appointmentId?: string } | undefined,
  });
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
      if (job.name === "rematch-waitlist") await processWaitlistRematch(db, job);
    },
    { connection: redisConnection() },
  );
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
    if (rows[0] && rows[0].status !== candidate.nextStatus) {
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
      await scheduleWaitlistRematch(app.db, appointment, dependencies.followupQueue);
    } catch (error) {
      request.log.error(error, "Optional module appointment trigger failed");
    }
  });
}
