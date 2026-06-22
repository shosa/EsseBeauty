import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, asc, eq, gte, isNull, lt, or } from "drizzle-orm";

import {
  appointments,
  customers,
  notifications,
  salons,
  services,
  waitlistEntries,
} from "@esse-beauty/db/schema";
import { isModuleEnabled, MODULE_KEYS } from "@esse-beauty/feature-flags";

import { awardAppointmentCompletion } from "../lib/loyalty-engine.js";
import { createNotification, sendEmail, sendSms } from "./notifications.js";
import { getQueue, QUEUE_NAMES } from "./queues.js";
import type { ReviewRequestJob } from "./reviews.js";

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

function transitionFrom(request: FastifyRequest) {
  const body = request.body as { status?: string } | undefined;
  const params = request.params as { appointmentId?: string } | undefined;
  if (
    request.method !== "PATCH" ||
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

async function awardLoyalty(
  app: FastifyInstance,
  appointment: typeof appointments.$inferSelect,
) {
  if (
    !(await isModuleEnabled(
      appointment.salonId,
      MODULE_KEYS.LOYALTY,
      app.db,
    ))
  ) {
    return;
  }
  await awardAppointmentCompletion(app.db, {
    appointmentId: appointment.id,
    customerId: appointment.customerId,
    salonId: appointment.salonId,
  });
}

async function notifyAppointmentTransition(
  app: FastifyInstance,
  appointment: typeof appointments.$inferSelect,
  status: "completed" | "cancelled",
) {
  await createNotification(app, {
    body:
      status === "completed"
        ? "Un appuntamento e stato completato. Verifica eventuali punti, recensioni o note operative."
        : "Un appuntamento e stato cancellato. Controlla eventuali richieste in lista d'attesa.",
    category: "calendar",
    entityId: appointment.id,
    entityType: "appointment",
    href: `/calendar/appointments/${appointment.id}`,
    priority: status === "cancelled" ? "high" : "normal",
    salonId: appointment.salonId,
    targetRole: "owner",
    title: status === "completed" ? "Appuntamento completato" : "Appuntamento cancellato",
    type: `appointment_${status}`,
  });
}

async function enqueueReview(
  app: FastifyInstance,
  appointment: typeof appointments.$inferSelect,
) {
  if (
    await isModuleEnabled(
      appointment.salonId,
      MODULE_KEYS.REVIEWS,
      app.db,
    )
  ) {
    await getQueue(QUEUE_NAMES.REVIEWS).add(
      "send-request",
      { appointmentId: appointment.id } satisfies ReviewRequestJob,
      { delay: 30 * 60_000, jobId: `review-${appointment.id}` },
    );
  }
}

async function notifyWaitlist(
  app: FastifyInstance,
  appointment: typeof appointments.$inferSelect,
) {
  if (
    !(await isModuleEnabled(
      appointment.salonId,
      MODULE_KEYS.WAITLIST,
      app.db,
    ))
  ) {
    return;
  }
  const start = new Date(appointment.startsAt);
  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const entries = await app.db
    .select({
      id: waitlistEntries.id,
      email: customers.email,
      phone: customers.phone,
      customerName: customers.fullName,
      salonSlug: salons.slug,
      serviceName: services.name,
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
  await app.db
    .update(waitlistEntries)
    .set({ status: "notified" })
    .where(eq(waitlistEntries.id, entry.id));
  const bookingUrl = `${process.env.PWA_URL ?? "http://localhost:3002"}/${entry.salonSlug}/book`;
  const message = `A slot has opened on ${start.toLocaleDateString("it-IT")} for ${entry.serviceName}. Book now: ${bookingUrl}`;
  try {
    if (entry.email) {
      await sendEmail(
        entry.email,
        `Posto disponibile per ${entry.serviceName}`,
        `<p>Ciao ${entry.customerName},</p><p>${message}</p>`,
      );
    } else if (entry.phone) {
      await sendSms(entry.phone, message);
    }
  } catch {
    await app.db
      .update(waitlistEntries)
      .set({ status: "waiting" })
      .where(eq(waitlistEntries.id, entry.id));
  }
}

export function registerAppointmentEventHooks(app: FastifyInstance): void {
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
      if (transition.nextStatus === "completed") {
        await Promise.all([
          awardLoyalty(app, appointment),
          enqueueReview(app, appointment),
          notifyAppointmentTransition(app, appointment, "completed"),
        ]);
      } else {
        await Promise.all([
          notifyWaitlist(app, appointment),
          notifyAppointmentTransition(app, appointment, "cancelled"),
        ]);
      }
    } catch (error) {
      request.log.error(error, "Optional module appointment trigger failed");
    }
  });
}
