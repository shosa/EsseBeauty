import { and, eq, gt, lt, ne } from "drizzle-orm";

import {
  appointments,
  salonResources,
  serviceResources,
  serviceStaff,
} from "@esse-beauty/db/schema";

export async function isStaffQualified(
  db: any,
  salonId: string,
  serviceId: string,
  staffId: string,
) {
  const rows = await db
    .select({ staffId: serviceStaff.staffId })
    .from(serviceStaff)
    .where(and(
      eq(serviceStaff.salonId, salonId),
      eq(serviceStaff.serviceId, serviceId),
    ));
  return rows.length === 0 || rows.some((row: { staffId: string }) => row.staffId === staffId);
}

export async function qualifiedStaffIds(db: any, salonId: string, serviceId: string) {
  const rows = await db
    .select({ staffId: serviceStaff.staffId })
    .from(serviceStaff)
    .where(and(
      eq(serviceStaff.salonId, salonId),
      eq(serviceStaff.serviceId, serviceId),
    ));
  return rows.length === 0 ? null : new Set(rows.map((row: { staffId: string }) => row.staffId));
}

export async function availableResourceFor(
  db: any,
  salonId: string,
  serviceId: string,
  startsAt: Date,
  endsAt: Date,
  locationId?: string | null,
  excludeAppointmentId?: string,
) {
  const resources = await db
    .select({
      id: salonResources.id,
      locationId: salonResources.locationId,
      name: salonResources.name,
    })
    .from(serviceResources)
    .innerJoin(salonResources, eq(salonResources.id, serviceResources.resourceId))
    .where(and(
      eq(serviceResources.salonId, salonId),
      eq(serviceResources.serviceId, serviceId),
      eq(salonResources.active, true),
    ));

  if (resources.length === 0) {
    return { required: false as const, resource: null };
  }

  const compatible = locationId
    ? resources.filter((resource: { locationId: string | null }) => !resource.locationId || resource.locationId === locationId)
    : resources;

  for (const resource of compatible) {
    const conflicts = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(
        eq(appointments.salonId, salonId),
        eq(appointments.resourceId, resource.id),
        ne(appointments.status, "cancelled"),
        lt(appointments.startsAt, endsAt),
        gt(appointments.endsAt, startsAt),
        ...(excludeAppointmentId ? [ne(appointments.id, excludeAppointmentId)] : []),
      ));
    if (conflicts.length === 0) {
      return { required: true as const, resource };
    }
  }

  return { required: true as const, resource: null };
}
