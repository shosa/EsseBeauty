import type { DemoScenario, DemoTableRows } from "./scenario-types.js";

type WorkingDayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type WorkingHours = Record<WorkingDayKey, Array<{ from: string; to: string }>>;

const DEMO_WORKING_HOURS: WorkingHours = {
  mon: [],
  tue: [{ from: "09:00", to: "13:00" }, { from: "16:00", to: "20:00" }],
  wed: [{ from: "09:00", to: "17:00" }],
  thu: [{ from: "09:00", to: "13:00" }, { from: "16:00", to: "20:00" }],
  fri: [{ from: "09:00", to: "13:00" }, { from: "16:00", to: "20:00" }],
  sat: [{ from: "09:00", to: "17:00" }],
  sun: [],
};

const ROME_TIME_ZONE = "Europe/Rome";


function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function dateKeyInRome(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ROME_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function weekdayInRome(date: Date): WorkingDayKey {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: ROME_TIME_ZONE,
    weekday: "short",
  }).format(date).toLowerCase();

  return weekday.slice(0, 3) as WorkingDayKey;
}

function localMinuteToUtc(dateKey: string, minuteOfDay: number): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;

  const targetAsUtc = Date.UTC(year!, month! - 1, day!, hour, minute);
  let instant = new Date(targetAsUtc);

  // Two passes are enough to converge for Europe/Rome, including DST changes.
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: ROME_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant);

    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]),
    ) as Record<string, number>;

    const renderedAsUtc = Date.UTC(
      values.year!,
      values.month! - 1,
      values.day!,
      values.hour!,
      values.minute!,
    );

    instant = new Date(instant.getTime() + (targetAsUtc - renderedAsUtc));
  }

  return instant;
}

function parseMinute(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour! * 60 + minute!;
}

function cloneRows(rows: DemoTableRows): DemoTableRows {
  return Object.fromEntries(
    Object.entries(rows).map(([table, tableRows]) => [
      table,
      (tableRows as Array<Record<string, unknown>>).map((row) => ({ ...row })),
    ]),
  ) as unknown as DemoTableRows;
}

function compactAppointmentGroup(
  appointments: DemoTableRows["appointments"],
  rows: DemoTableRows,
  anchor: Date,
  dayOffsets: number[],
  pendingIds: Set<string>,
): void {
  const location = rows.salonLocations[0]!;
  const resources = rows.salonResources;
  const staff = rows.staff;
  const serviceById = new Map(rows.services.map((service) => [service.id!, service]));
  const closedDates = new Set(rows.salonClosures.map((closure) => closure.date));

  let appointmentIndex = 0;
  let workingDayOrdinal = 0;

  for (const dayOffset of dayOffsets) {
    if (appointmentIndex >= appointments.length) break;

    const day = addUtcDays(anchor, dayOffset);
    const dateKey = dateKeyInRome(day);
    const dayKey = weekdayInRome(day);
    const windows = DEMO_WORKING_HOURS[dayKey];

    if (windows.length === 0 || closedDates.has(dateKey)) continue;

    const staffForResource = resources.map(
      (_, resourceIndex) => staff[(workingDayOrdinal + resourceIndex) % staff.length]!,
    );

    for (const window of windows) {
      if (appointmentIndex >= appointments.length) break;

      const windowStart = parseMinute(window.from);
      const windowEnd = parseMinute(window.to);
      const cursors = resources.map(() => windowStart);

      while (appointmentIndex < appointments.length) {
        const appointment = appointments[appointmentIndex]!;
        const service = serviceById.get(appointment.serviceId!);

        if (!service) {
          throw new Error(`Demo appointment ${appointment.id} references an unknown service`);
        }

        const durationMinutes = service.durationMinutes;
        const candidateIndexes = resources
          .map((_, index) => index)
          .filter((index) => cursors[index]! + durationMinutes <= windowEnd)
          .sort((a, b) => cursors[a]! - cursors[b]!);

        if (candidateIndexes.length === 0) break;

        const resourceIndex = candidateIndexes[0]!;
        const startsAt = localMinuteToUtc(dateKey, cursors[resourceIndex]!);
        const endsAt = localMinuteToUtc(
          dateKey,
          cursors[resourceIndex]! + durationMinutes,
        );

        appointment.locationId = location.id!;
        appointment.resourceId = resources[resourceIndex]!.id!;
        appointment.staffId = staffForResource[resourceIndex]!.id!;
        appointment.startsAt = startsAt;
        appointment.endsAt = endsAt;

        if (dayOffset < 0) {
          const originalStatus = appointment.status;
          appointment.status =
            originalStatus === "cancelled" || originalStatus === "no_show"
              ? originalStatus
              : "completed";

          appointment.cancelledAt =
            appointment.status === "cancelled"
              ? addUtcDays(startsAt, -1)
              : null;

          appointment.cancellationReason =
            appointment.status === "cancelled"
              ? appointment.cancellationReason ?? "Imprevisto personale"
              : null;

          appointment.confirmedAt =
            appointment.status === "cancelled"
              ? appointment.confirmedAt ?? addUtcDays(startsAt, -2)
              : addUtcDays(startsAt, -2);
        } else {
          appointment.status = pendingIds.has(appointment.id!)
            ? "pending"
            : "confirmed";
          appointment.cancelledAt = null;
          appointment.cancellationReason = null;
          appointment.confirmedAt =
            appointment.status === "pending"
              ? null
              : addUtcDays(startsAt, -2);
        }

        cursors[resourceIndex] = cursors[resourceIndex]! + durationMinutes;
        appointmentIndex += 1;
      }
    }

    workingDayOrdinal += 1;
  }

  if (appointmentIndex < appointments.length) {
    throw new Error(
      `Compact demo calendar capacity exhausted: scheduled ${appointmentIndex}/${appointments.length} appointments`,
    );
  }
}

export function compactDemoScenario(input: DemoScenario): DemoScenario {
  const rows = cloneRows(input.rows);

  // One demonstrative location.
  const location = rows.salonLocations[0];
  if (!location) throw new Error("Demo scenario requires at least one salon location");

  rows.salons = rows.salons.map((salon) => ({
    ...salon,
    openingHours: DEMO_WORKING_HOURS,
  }));

  rows.salonLocations = [{
    ...location,
    active: true,
    displayOrder: 0,
    isDefault: true,
  }];

  // Exactly three cabins in the single location.
  if (rows.salonResources.length < 3) {
    throw new Error("Demo scenario requires at least three resources");
  }

  rows.salonResources = rows.salonResources.slice(0, 3).map((resource, index) => ({
    ...resource,
    active: true,
    capacity: 1,
    locationId: location.id!,
    name: `Cabina ${index + 1}`,
    type: "cabin" as const,
  }));

  // Exactly five staff members, all assigned to the single location.
  if (rows.staff.length < 5) {
    throw new Error("Demo scenario requires at least five staff members");
  }

  rows.staff = rows.staff.slice(0, 5).map((member) => ({
    ...member,
    locationId: location.id!,
    workingHours: DEMO_WORKING_HOURS,
  }));

  const allowedStaffIds = new Set(rows.staff.map((member) => member.id!));

  rows.staffAvailabilityRequests = rows.staffAvailabilityRequests.filter(
    (request) => allowedStaffIds.has(request.staffId!),
  );

  rows.availabilityBlocks = rows.availabilityBlocks
    .filter((block) => allowedStaffIds.has(block.staffId!))
    .map((block) => ({
      ...block,
      locationId: location.id!,
    }));

  rows.serviceStaff = rows.serviceStaff.filter((assignment) =>
    allowedStaffIds.has(assignment.staffId!),
  );

  // Waitlist rows generated before compaction can still reference one of the
  // removed staff members. Keep "no preference" entries untouched and
  // deterministically remap explicit staff preferences to one of the five
  // retained staff members.
  rows.waitlistEntries = rows.waitlistEntries.map((entry, index) => ({
    ...entry,
    staffId: entry.staffId
      ? rows.staff[index % rows.staff.length]!.id!
      : null,
  }));

  // Keep one resource requirement per service, distributed across the three cabins.
  const firstResourceAssignmentByService = new Map<
    string,
    DemoTableRows["serviceResources"][number]
  >();

  for (const assignment of rows.serviceResources) {
    if (!firstResourceAssignmentByService.has(assignment.serviceId!)) {
      firstResourceAssignmentByService.set(assignment.serviceId!, assignment);
    }
  }

  rows.serviceResources = rows.services.map((service, index) => {
    const existing = firstResourceAssignmentByService.get(service.id!);
    if (!existing) {
      throw new Error(`Service ${service.id} has no demo resource assignment`);
    }

    return {
      ...existing,
      resourceId: rows.salonResources[index % rows.salonResources.length]!.id!,
    };
  });

  const originalAppointments = rows.appointments;
  const historicalAppointments = originalAppointments.slice(0, 800);
  const futureAppointments = originalAppointments.slice(800);

  // Reuse three of the appointments that were already generated as pending,
  // so dependent reschedule rows can stay referentially coherent.
  const pendingIds = new Set(
    futureAppointments
      .filter((appointment) => appointment.status === "pending")
      .slice(0, 3)
      .map((appointment) => appointment.id!),
  );

  // Dense demo: roughly ten weeks of history and ten weeks ahead instead of ~1 year.
  compactAppointmentGroup(
    historicalAppointments,
    rows,
    input.anchor,
    Array.from({ length: 70 }, (_, index) => -70 + index),
    new Set(),
  );

  compactAppointmentGroup(
    futureAppointments,
    rows,
    input.anchor,
    Array.from({ length: 70 }, (_, index) => index + 1),
    pendingIds,
  );

  rows.appointments = [...historicalAppointments, ...futureAppointments];

  // Keep at most the three pending reschedule requests tied to the three pending appointments.
  rows.appointmentRescheduleRequests = rows.appointmentRescheduleRequests
    .filter((request) => pendingIds.has(request.appointmentId!))
    .slice(0, 3);

  rows.notifications = rows.notifications.filter((notification) =>
    notification.type !== "reschedule_requested" ||
    (notification.entityId != null && pendingIds.has(notification.entityId)),
  );

  // Realign reminder dates with the newly compacted appointment dates.
  const appointmentById = new Map(
    rows.appointments.map((appointment) => [appointment.id!, appointment]),
  );

  rows.reminders = rows.reminders.map((reminder) => {
    const appointment = appointmentById.get(reminder.appointmentId!);
    if (!appointment) return reminder;

    const scheduledAt = addUtcDays(appointment.startsAt, -1);
    const sent = appointment.startsAt.getTime() < input.anchor.getTime();

    return {
      ...reminder,
      scheduledAt,
      sentAt: sent ? scheduledAt : null,
      status: sent ? ("sent" as const) : ("pending" as const),
    };
  });

  // Sales created from historical completed appointments should follow the compacted dates too.
  rows.sales = rows.sales.map((sale) => {
    if (!sale.appointmentId) return sale;

    const appointment = appointmentById.get(sale.appointmentId);
    if (!appointment) return sale;

    return {
      ...sale,
      closedAt: appointment.endsAt,
      staffId: appointment.staffId,
    };
  });

  const updatedSaleById = new Map(rows.sales.map((sale) => [sale.id!, sale]));

  rows.saleItems = rows.saleItems.map((item) => {
    const sale = updatedSaleById.get(item.saleId!);
    return sale ? { ...item, staffId: sale.staffId } : item;
  });

  rows.salePayments = rows.salePayments.map((payment) => {
    const sale = updatedSaleById.get(payment.saleId!);
    return sale?.closedAt ? { ...payment, paidAt: sale.closedAt } : payment;
  });

  rows.cashMovements = rows.cashMovements.map((movement) => {
    if (movement.sourceType !== "sale_payment" || !movement.sourceId) {
      return movement;
    }

    const sale = updatedSaleById.get(movement.sourceId);
    return sale?.closedAt ? { ...movement, occurredAt: sale.closedAt } : movement;
  });

  return {
    ...input,
    rows,
  };
}
