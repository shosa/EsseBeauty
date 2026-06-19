import type { FastifyInstance } from "fastify";
import { and, eq, gt } from "drizzle-orm";

import {
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
    })
    .from(appointments)
    .innerJoin(customers, eq(customers.id, appointments.customerId))
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(staff, eq(staff.id, appointments.staffId))
    .where(and(
      eq(appointments.salonId, salonId),
      eq(appointments.source, "online"),
      eq(appointments.status, "pending"),
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
        priority: "high",
        salonId,
        targetRole: role,
        title: "Nuova prenotazione online",
        type: "online_booking_received",
      }).onConflictDoNothing();
    }
  }
}
