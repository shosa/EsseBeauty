import type { FastifyInstance } from "fastify";
import { and, eq, gt, inArray } from "drizzle-orm";

import {
  appointmentRescheduleRequests,
  appointments,
  customers,
  notifications,
  services,
  staff,
  staffAvailabilityRequests,
} from "@esse-beauty/db/schema";

const REVIEW_ROLES = ["owner", "manager"] as const;

export async function ensureStaffRequestReviewNotifications(
  app: FastifyInstance,
  salonId: string,
  requestId?: string,
): Promise<void> {
  const requests = await app.db
    .select({
      endsAt: staffAvailabilityRequests.endsAt,
      id: staffAvailabilityRequests.id,
      staffName: staff.displayName,
      startsAt: staffAvailabilityRequests.startsAt,
    })
    .from(staffAvailabilityRequests)
    .innerJoin(staff, eq(staff.id, staffAvailabilityRequests.staffId))
    .where(and(
      eq(staffAvailabilityRequests.salonId, salonId),
      eq(staffAvailabilityRequests.status, "pending"),
      ...(requestId ? [eq(staffAvailabilityRequests.id, requestId)] : []),
    ));

  for (const item of requests) {
    const existing = await app.db
      .select({ targetRole: notifications.targetRole })
      .from(notifications)
      .where(and(
        eq(notifications.salonId, salonId),
        eq(notifications.entityType, "staff_availability_request"),
        eq(notifications.entityId, item.id),
        eq(notifications.type, "staff_availability_request"),
      ));
    const existingRoles = new Set(existing.map((row) => row.targetRole));

    for (const role of REVIEW_ROLES) {
      if (existingRoles.has(role)) continue;
      await app.db.insert(notifications).values({
        body: `${item.staffName} richiede indisponibilità dal ${item.startsAt.toLocaleString("it-IT")} al ${item.endsAt.toLocaleString("it-IT")}.`,
        category: "staff",
        entityId: item.id,
        entityType: "staff_availability_request",
        payload: { href: "/settings/staff/requests" },
        priority: "high",
        salonId,
        targetRole: role,
        title: "Nuova richiesta disponibilità",
        type: "staff_availability_request",
      }).onConflictDoNothing();
    }
  }
}

export async function ensureOnlineBookingNotifications(
  app: FastifyInstance,
  salonId: string,
  appointmentId?: string,
): Promise<void> {
  const bookings = await app.db
    .select({
      customerName: customers.fullName,
      id: appointments.id,
      serviceName: services.name,
      staffName: staff.displayName,
      startsAt: appointments.startsAt,
      status: appointments.status,
    })
    .from(appointments)
    .innerJoin(customers, eq(customers.id, appointments.customerId))
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(staff, eq(staff.id, appointments.staffId))
    .where(and(
      eq(appointments.salonId, salonId),
      eq(appointments.source, "online"),
      inArray(appointments.status, ["pending", "confirmed"]),
      gt(appointments.endsAt, new Date()),
      ...(appointmentId ? [eq(appointments.id, appointmentId)] : []),
    ));

  for (const booking of bookings) {
    const existing = await app.db
      .select({ targetRole: notifications.targetRole })
      .from(notifications)
      .where(and(
        eq(notifications.salonId, salonId),
        eq(notifications.entityType, "appointment"),
        eq(notifications.entityId, booking.id),
        eq(notifications.type, "online_booking_received"),
      ));
    const existingRoles = new Set(existing.map((row) => row.targetRole));

    for (const role of REVIEW_ROLES) {
      if (existingRoles.has(role)) continue;
      await app.db.insert(notifications).values({
        body: `${booking.customerName} ha prenotato ${booking.serviceName} con ${booking.staffName} per ${booking.startsAt.toLocaleString("it-IT")}.`,
        category: "calendar",
        entityId: booking.id,
        entityType: "appointment",
        payload: { href: `/calendar/appointments/${booking.id}` },
        priority: booking.status === "pending" ? "high" : "normal",
        salonId,
        targetRole: role,
        title: booking.status === "pending" ? "Prenotazione online da confermare" : "Prenotazione online confermata",
        type: "online_booking_received",
      }).onConflictDoNothing();
    }
  }
}

export async function ensureRescheduleRequestNotifications(
  app: FastifyInstance,
  salonId: string,
  requestId: string,
  applied: boolean,
): Promise<void> {
  const rows = await app.db
    .select({
      appointmentId: appointmentRescheduleRequests.appointmentId,
      customerName: customers.fullName,
      id: appointmentRescheduleRequests.id,
      requestedStartsAt: appointmentRescheduleRequests.requestedStartsAt,
      serviceName: services.name,
      staffName: staff.displayName,
    })
    .from(appointmentRescheduleRequests)
    .innerJoin(appointments, eq(appointments.id, appointmentRescheduleRequests.appointmentId))
    .innerJoin(customers, eq(customers.id, appointments.customerId))
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(staff, eq(staff.id, appointments.staffId))
    .where(and(
      eq(appointmentRescheduleRequests.id, requestId),
      eq(appointmentRescheduleRequests.salonId, salonId),
    ));
  const item = rows[0];
  if (!item) return;

  for (const role of REVIEW_ROLES) {
    await app.db.insert(notifications).values({
      body: applied
        ? `${item.customerName} ha spostato ${item.serviceName} con ${item.staffName} al ${item.requestedStartsAt.toLocaleString("it-IT")}. Il nuovo orario è già confermato.`
        : `${item.customerName} richiede di spostare ${item.serviceName} con ${item.staffName} al ${item.requestedStartsAt.toLocaleString("it-IT")}.`,
      category: "calendar",
      entityId: item.id,
      entityType: "appointment_reschedule_request",
      payload: { href: `/calendar/appointments/${item.appointmentId}` },
      priority: applied ? "normal" : "high",
      salonId,
      targetRole: role,
      title: applied ? "Cliente ha spostato l’appuntamento" : "Richiesta cambio orario da confermare",
      type: "reschedule_request",
    }).onConflictDoNothing();
  }
}

export async function ensureCustomerCancellationNotification(
  app: FastifyInstance,
  salonId: string,
  appointmentId: string,
): Promise<void> {
  const rows = await app.db
    .select({
      customerName: customers.fullName,
      id: appointments.id,
      serviceName: services.name,
      staffName: staff.displayName,
      startsAt: appointments.startsAt,
    })
    .from(appointments)
    .innerJoin(customers, eq(customers.id, appointments.customerId))
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(staff, eq(staff.id, appointments.staffId))
    .where(and(eq(appointments.id, appointmentId), eq(appointments.salonId, salonId)));
  const item = rows[0];
  if (!item) return;

  for (const role of REVIEW_ROLES) {
    await app.db.insert(notifications).values({
      body: `${item.customerName} ha annullato ${item.serviceName} con ${item.staffName} del ${item.startsAt.toLocaleString("it-IT")}.`,
      category: "calendar",
      entityId: item.id,
      entityType: "appointment",
      payload: { href: `/calendar/appointments/${item.id}` },
      priority: "normal",
      salonId,
      targetRole: role,
      title: "Il cliente ha annullato un appuntamento",
      type: "customer_cancelled_appointment",
    }).onConflictDoNothing();
  }
}
