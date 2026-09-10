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


const DEMO_SERVICE_CATALOG = [
  { name: "Piega", category: "Capelli", durationMinutes: 45, priceCents: 2500, cabin: 2 },
  { name: "Taglio Donna", category: "Capelli", durationMinutes: 45, priceCents: 3000, cabin: 2 },
  { name: "Trattamento Capelli Secchi", category: "Capelli", durationMinutes: 45, priceCents: 3500, cabin: 2 },
  { name: "Colore Ricrescita", category: "Capelli", durationMinutes: 90, priceCents: 5500, cabin: 2 },

  { name: "Pulizia Viso", category: "Viso", durationMinutes: 60, priceCents: 4500, cabin: 0 },
  { name: "Pulizia Viso Profonda", category: "Viso", durationMinutes: 75, priceCents: 6000, cabin: 0 },
  { name: "Trattamento Idratante Viso", category: "Viso", durationMinutes: 50, priceCents: 5000, cabin: 0 },

  { name: "Trattamento Corpo Drenante", category: "Corpo", durationMinutes: 60, priceCents: 6000, cabin: 1 },
  { name: "Trattamento Corpo Tonificante", category: "Corpo", durationMinutes: 60, priceCents: 6500, cabin: 1 },

  { name: "Manicure", category: "Mani e piedi", durationMinutes: 40, priceCents: 2500, cabin: 2 },
  { name: "Semipermanente Mani", category: "Mani e piedi", durationMinutes: 60, priceCents: 3500, cabin: 2 },
  { name: "Pedicure Estetico", category: "Mani e piedi", durationMinutes: 50, priceCents: 3000, cabin: 2 },
  { name: "Semipermanente Piedi", category: "Mani e piedi", durationMinutes: 50, priceCents: 3500, cabin: 2 },

  { name: "Massaggio Relax 50 min", category: "Massaggi", durationMinutes: 50, priceCents: 5000, cabin: 1 },
  { name: "Linfodrenaggio Vodder 50 min", category: "Massaggi", durationMinutes: 50, priceCents: 5500, cabin: 1 },
  { name: "Massaggio Decontratturante 50 min", category: "Massaggi", durationMinutes: 50, priceCents: 6000, cabin: 1 },

  { name: "Ceretta Braccia Donna", category: "Epilazione", durationMinutes: 30, priceCents: 2000, cabin: 0 },
  { name: "Ceretta Gambe Intere", category: "Epilazione", durationMinutes: 45, priceCents: 3000, cabin: 0 },
  { name: "Ceretta Inguine Donna", category: "Epilazione", durationMinutes: 25, priceCents: 1800, cabin: 0 },

  { name: "Laminazione Ciglia", category: "Sopracciglia e ciglia", durationMinutes: 60, priceCents: 5000, cabin: 0 },
] as const;

const DEMO_STAFF_PROFILES = [
  {
    displayName: "Titolare Demo",
    jobTitle: "Titolare / Estetista senior",
    categories: ["Viso", "Corpo", "Massaggi", "Epilazione"],
    specializations: ["Trattamenti viso", "Trattamenti corpo", "Massaggi", "Epilazione"],
  },
  {
    displayName: "Giulia Bianchi",
    jobTitle: "Hair stylist",
    categories: ["Capelli"],
    specializations: ["Piega", "Taglio donna", "Colore", "Trattamenti capelli"],
  },
  {
    displayName: "Sofia Greco",
    jobTitle: "Estetista",
    categories: ["Viso", "Epilazione", "Sopracciglia e ciglia"],
    specializations: ["Pulizia viso", "Ceretta", "Laminazione ciglia"],
  },
  {
    displayName: "Emma Rizzo",
    jobTitle: "Onicotecnica",
    categories: ["Mani e piedi"],
    specializations: ["Manicure", "Semipermanente mani", "Pedicure"],
  },
  {
    displayName: "Noemi Lombardi",
    jobTitle: "Massaggiatrice / Body specialist",
    categories: ["Corpo", "Massaggi"],
    specializations: ["Linfodrenaggio", "Massaggio relax", "Trattamenti corpo"],
  },
] as const;



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
  const entries = Object.entries(rows) as Array<
    [keyof DemoTableRows, Array<Record<string, unknown>>]
  >;

  return Object.fromEntries(
    entries.map(([table, tableRows]) => [
      table,
      tableRows.map((row: Record<string, unknown>) => ({ ...row })),
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
  const serviceById = new Map(rows.services.map((service) => [service.id!, service]));
  const closedDates = new Set(rows.salonClosures.map((closure) => closure.date));

  const staffIdsByService = new Map<string, string[]>();
  for (const assignment of rows.serviceStaff) {
    const list = staffIdsByService.get(assignment.serviceId!) ?? [];
    list.push(assignment.staffId!);
    staffIdsByService.set(assignment.serviceId!, list);
  }

  const resourceIdsByService = new Map<string, string[]>();
  for (const assignment of rows.serviceResources) {
    const list = resourceIdsByService.get(assignment.serviceId!) ?? [];
    list.push(assignment.resourceId!);
    resourceIdsByService.set(assignment.serviceId!, list);
  }

  let appointmentIndex = 0;

  for (const dayOffset of dayOffsets) {
    if (appointmentIndex >= appointments.length) break;

    const day = addUtcDays(anchor, dayOffset);
    const dateKey = dateKeyInRome(day);
    const dayKey = weekdayInRome(day);
    const windows = DEMO_WORKING_HOURS[dayKey];

    if (windows.length === 0 || closedDates.has(dateKey)) continue;

    for (const window of windows) {
      if (appointmentIndex >= appointments.length) break;

      const windowStart = parseMinute(window.from);
      const windowEnd = parseMinute(window.to);

      const staffCursor = new Map(rows.staff.map((member) => [member.id!, windowStart]));
      const resourceCursor = new Map(rows.salonResources.map((resource) => [resource.id!, windowStart]));

      while (appointmentIndex < appointments.length) {
        const appointment = appointments[appointmentIndex]!;
        const service = serviceById.get(appointment.serviceId!);

        if (!service) {
          throw new Error(`Demo appointment ${appointment.id} references an unknown service`);
        }

        const compatibleStaff = staffIdsByService.get(service.id!) ?? [];
        const compatibleResources = resourceIdsByService.get(service.id!) ?? [];

        if (compatibleStaff.length === 0) {
          throw new Error(`Demo service "${service.name}" has no compatible staff`);
        }
        if (compatibleResources.length === 0) {
          throw new Error(`Demo service "${service.name}" has no associated cabin`);
        }

        const durationMinutes = service.durationMinutes;
        const candidates: Array<{
          staffId: string;
          resourceId: string;
          startMinute: number;
        }> = [];

        for (const staffId of compatibleStaff) {
          for (const resourceId of compatibleResources) {
            const startMinute = Math.max(
              staffCursor.get(staffId) ?? windowStart,
              resourceCursor.get(resourceId) ?? windowStart,
            );

            if (startMinute + durationMinutes <= windowEnd) {
              candidates.push({ staffId, resourceId, startMinute });
            }
          }
        }

        candidates.sort((left, right) =>
          left.startMinute - right.startMinute ||
          left.staffId.localeCompare(right.staffId),
        );

        const candidate = candidates[0];
        if (!candidate) break;

        const startsAt = localMinuteToUtc(dateKey, candidate.startMinute);
        const endsAt = localMinuteToUtc(
          dateKey,
          candidate.startMinute + durationMinutes,
        );

        appointment.locationId = location.id!;
        appointment.resourceId = candidate.resourceId;
        appointment.staffId = candidate.staffId;
        appointment.startsAt = startsAt;
        appointment.endsAt = endsAt;

        if (dayOffset < 0) {
          const originalStatus = appointment.status;
          appointment.status =
            originalStatus === "cancelled" || originalStatus === "no_show"
              ? originalStatus
              : "completed";
          appointment.cancelledAt =
            appointment.status === "cancelled" ? addUtcDays(startsAt, -1) : null;
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
            appointment.status === "pending" ? null : addUtcDays(startsAt, -2);
        }

        staffCursor.set(candidate.staffId, candidate.startMinute + durationMinutes);
        resourceCursor.set(candidate.resourceId, candidate.startMinute + durationMinutes);
        appointmentIndex += 1;
      }
    }
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

  // Exactly five staff members with real, differentiated competencies.
  if (rows.staff.length < DEMO_STAFF_PROFILES.length) {
    throw new Error("Demo scenario requires at least five staff members");
  }

  rows.staff = rows.staff.slice(0, DEMO_STAFF_PROFILES.length).map((member, index) => {
    const profile = DEMO_STAFF_PROFILES[index]!;
    return {
      ...member,
      displayName: profile.displayName,
      jobTitle: profile.jobTitle,
      locationId: location.id!,
      specializations: [...profile.specializations],
      workingHours: DEMO_WORKING_HOURS,
    };
  });

  rows.users = rows.users.map((user, index) => ({
    ...user,
    fullName: index === 0 ? "Titolare Demo" : user.fullName,
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

  // Replace the synthetic 48-service matrix with a compact, plausible salon menu.
  const categoryByName = new Map(
    rows.serviceCategories.map((category) => [category.name, category]),
  );

  if (rows.services.length < DEMO_SERVICE_CATALOG.length) {
    throw new Error("Demo scenario does not contain enough source service rows");
  }

  rows.services = rows.services.slice(0, DEMO_SERVICE_CATALOG.length).map((service, index) => {
    const definition = DEMO_SERVICE_CATALOG[index]!;
    const category = categoryByName.get(definition.category);
    if (!category) {
      throw new Error(`Missing demo service category "${definition.category}"`);
    }

    return {
      ...service,
      active: true,
      bufferAfterMinutes: 0,
      bufferBeforeMinutes: 0,
      category: definition.category,
      categoryId: category.id!,
      description: `${definition.name}: servizio dimostrativo con consulenza personalizzata.`,
      displayOrder: index,
      durationMinutes: definition.durationMinutes,
      name: definition.name,
      onlineBookingEnabled: true,
      priceCents: definition.priceCents,
    };
  });

  const servicesByCategory = new Map<string, DemoTableRows["services"]>();
  for (const service of rows.services) {
    const list = servicesByCategory.get(service.category) ?? [];
    list.push(service);
    servicesByCategory.set(service.category, list);
  }

  // Explicit service -> staff assignments based on competencies.
  const sourceServiceStaff = [...rows.serviceStaff];
  let serviceStaffIndex = 0;
  rows.serviceStaff = [];

  for (const [staffIndex, member] of rows.staff.entries()) {
    const profile = DEMO_STAFF_PROFILES[staffIndex]!;
    for (const category of profile.categories) {
      for (const service of servicesByCategory.get(category) ?? []) {
        const source = sourceServiceStaff[serviceStaffIndex++];
        if (!source) throw new Error("Not enough source serviceStaff rows");

        rows.serviceStaff.push({
          ...source,
          serviceId: service.id!,
          staffId: member.id!,
        });
      }
    }
  }

  // Explicit service -> cabin assignments.
  const sourceServiceResources = [...rows.serviceResources];
  rows.serviceResources = rows.services.map((service, index) => {
    const source = sourceServiceResources[index];
    if (!source) throw new Error("Not enough source serviceResources rows");

    const definition = DEMO_SERVICE_CATALOG[index]!;
    return {
      ...source,
      quantity: 1,
      required: true,
      resourceId: rows.salonResources[definition.cabin]!.id!,
      serviceId: service.id!,
    };
  });

  // Remap all generated appointments to the new compact service catalog.
  rows.appointments = rows.appointments.map((appointment, index) => ({
    ...appointment,
    serviceId: rows.services[index % rows.services.length]!.id!,
  }));

  // Waitlist: retain "no staff preference"; explicit preferences are restricted
  // to staff members who can actually perform the requested service.
  const staffIdsByService = new Map<string, string[]>();
  for (const assignment of rows.serviceStaff) {
    const list = staffIdsByService.get(assignment.serviceId!) ?? [];
    list.push(assignment.staffId!);
    staffIdsByService.set(assignment.serviceId!, list);
  }

  rows.waitlistEntries = rows.waitlistEntries
    .slice(0, 6)
    .map((entry, index) => {
      const service = rows.services[index % rows.services.length]!;
      const compatibleStaff = staffIdsByService.get(service.id!) ?? [];

      return {
        ...entry,
        serviceId: service.id!,
        staffId: entry.staffId && compatibleStaff.length > 0
          ? compatibleStaff[index % compatibleStaff.length]!
          : null,
      };
    });

  // Keep demo service packages coherent with the reduced catalog.
  rows.servicePackages = rows.servicePackages.map((packageRow, index) => {
    const service = rows.services[index % rows.services.length]!;
    return {
      ...packageRow,
      description: `Percorso da ${packageRow.includedSessions} sedute di ${service.name}.`,
      name: `Percorso ${service.name}`,
      serviceId: service.id!,
    };
  });

  rows.servicePackageItems = rows.servicePackageItems.map((item, index) => ({
    ...item,
    serviceId: rows.services[index % rows.services.length]!.id!,
  }));

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

  // Keep exactly the three pending appointment requests tied to the three
  // appointments that still require confirmation.
  rows.appointmentRescheduleRequests = rows.appointmentRescheduleRequests
    .filter((request) => pendingIds.has(request.appointmentId!))
    .slice(0, 3)
    .map((request) => ({
      ...request,
      resolvedAt: null,
      resolvedByUserId: null,
      status: "pending" as const,
    }));

  // Keep exactly three appointment notifications to confirm. Reuse existing
  // notification rows so IDs stay deterministic and schema-compatible.
  const appointmentNotificationTemplates = rows.notifications
    .filter((notification) => notification.type === "reschedule_requested")
    .slice(0, 3);

  const otherNotifications = rows.notifications.filter(
    (notification) => notification.type !== "reschedule_requested",
  );

  const pendingAppointmentsForNotifications = futureAppointments.filter(
    (appointment) => pendingIds.has(appointment.id!),
  );

  if (
    pendingAppointmentsForNotifications.length !== 3 ||
    appointmentNotificationTemplates.length < 3
  ) {
    throw new Error("Demo scenario requires exactly three appointment notification templates");
  }

  rows.notifications = [
    ...otherNotifications,
    ...pendingAppointmentsForNotifications.map((appointment, index) => ({
      ...appointmentNotificationTemplates[index]!,
      entityId: appointment.id!,
      entityType: "appointment",
      payload: { appointmentId: appointment.id },
      priority: "normal" as const,
      targetRole: "receptionist" as const,
      title: "Appuntamento da confermare",
      type: "reschedule_requested",
    })),
  ];

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
    if (!sale) return item;

    if (item.itemType !== "service" || !sale.appointmentId) {
      return { ...item, staffId: sale.staffId };
    }

    const appointment = appointmentById.get(sale.appointmentId);
    const service = appointment
      ? rows.services.find((candidate) => candidate.id === appointment.serviceId)
      : undefined;

    return service
      ? {
          ...item,
          description: service.name,
          serviceId: service.id!,
          staffId: sale.staffId,
        }
      : { ...item, staffId: sale.staffId };
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
