import { createDeterministicRandom } from "./deterministic.js";
import {
  DEMO_IDENTITY,
  DEMO_VOLUME_PROFILE,
  type DemoScenario,
  type DemoSeedOptions,
  type DemoTableRows,
} from "./scenario-types.js";

const WORKING_HOURS = {
  mon: [{ from: "09:00", to: "19:00" }],
  tue: [{ from: "09:00", to: "19:00" }],
  wed: [{ from: "09:00", to: "19:00" }],
  thu: [{ from: "09:00", to: "20:00" }],
  fri: [{ from: "09:00", to: "20:00" }],
  sat: [{ from: "09:00", to: "18:00" }],
  sun: [],
};

const FIRST_NAMES = [
  "Alessandra", "Alice", "Anna", "Arianna", "Aurora", "Beatrice", "Camilla", "Caterina",
  "Chiara", "Claudia", "Cristina", "Daniela", "Debora", "Elena", "Elisa", "Emma", "Federica",
  "Francesca", "Gaia", "Giorgia", "Giulia", "Ilaria", "Laura", "Lidia", "Lucia", "Maria",
  "Marta", "Martina", "Monica", "Nicole", "Noemi", "Paola", "Patrizia", "Rachele", "Rita",
  "Roberta", "Sara", "Serena", "Silvia", "Simona", "Sofia", "Teresa", "Valentina", "Veronica",
];

const LAST_NAMES = [
  "Amato", "Barbieri", "Bianco", "Caruso", "Conti", "Costa", "De Luca", "Esposito", "Fabbri",
  "Ferrara", "Ferri", "Fiore", "Fontana", "Gallo", "Grassi", "Greco", "Leone", "Lombardi",
  "Longo", "Marchetti", "Mariani", "Marino", "Martini", "Messina", "Monti", "Moretti", "Neri",
  "Orlando", "Palmieri", "Parisi", "Pellegrini", "Piras", "Rinaldi", "Rizzo", "Romano", "Russo",
  "Sala", "Santoro", "Serra", "Testa", "Villa", "Vitale",
];

const CATEGORY_DEFINITIONS = [
  ["Capelli", "scissors", "piega"],
  ["Colore", "palette", "colore"],
  ["Viso", "sparkles", "viso"],
  ["Corpo", "flower-2", "corpo"],
  ["Mani e piedi", "hand", "nails"],
  ["Massaggi", "heart", "massaggio"],
  ["Epilazione", "zap", "epilazione"],
  ["Sopracciglia e ciglia", "eye", "sguardo"],
] as const;

const SERVICE_VARIANTS = [
  ["Express", 30, 2_500], ["Essenziale", 45, 3_500], ["Premium", 60, 5_500],
  ["Intensivo", 75, 7_000], ["Rituale", 90, 8_500], ["Signature", 120, 11_000],
] as const;

const STAFF_PROFILES = [
  ["Demo Owner", "Titolare", "#793059"], ["Giulia Bianchi", "Salon manager", "#9B4D76"],
  ["Marta Rossi", "Receptionist", "#B85C88"], ["Elena Romano", "Receptionist", "#D175A0"],
  ["Sara Conti", "Hair stylist", "#7E57C2"], ["Alice Ferri", "Color specialist", "#5C6BC0"],
  ["Chiara Gallo", "Hair stylist", "#42A5F5"], ["Sofia Greco", "Beauty specialist", "#26A69A"],
  ["Aurora Costa", "Facial specialist", "#66BB6A"], ["Emma Rizzo", "Nail artist", "#9CCC65"],
  ["Gaia Marino", "Nail artist", "#D4E157"], ["Noemi Lombardi", "Massage therapist", "#FFB300"],
  ["Ilaria Moretti", "Body specialist", "#FB8C00"], ["Valentina Serra", "Lash & brow artist", "#F4511E"],
] as const;

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function atUtcHour(date: Date, hour: number): Date {
  const result = new Date(date);
  result.setUTCHours(hour, 0, 0, 0);
  return result;
}

function ascii(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, ".").toLowerCase();
}

export function buildDemoScenario(options: DemoSeedOptions): DemoScenario {
  if (!(options.anchor instanceof Date) || Number.isNaN(options.anchor.getTime())) {
    throw new Error("Demo anchor must be a valid date");
  }
  const random = createDeterministicRandom(options.seed);
  const salonId = random.uuid("salon");
  const ownerUserId = random.uuid("user");
  const now = new Date(options.anchor);

  const salonLocations = [
    ["Centro", "Via della Bellezza 12, Milano", "+39 02 00000001"],
    ["Navigli", "Alzaia Demo 28, Milano", "+39 02 00000002"],
    ["CityLife", "Piazza Demo 7, Milano", "+39 02 00000003"],
  ].map(([name, address, phone], index) => ({
    active: true,
    address,
    displayOrder: index,
    email: `${name!.toLowerCase()}@salonedemo.invalid`,
    id: random.uuid("location"),
    name: name!,
    phone,
    salonId,
    timezone: "Europe/Rome",
  }));

  const resourceKinds = ["Cabina viso", "Cabina corpo", "Postazione nails", "Postazione styling"];
  const salonResources = salonLocations.flatMap((location) => resourceKinds.map((name, index) => ({
    active: true,
    capacity: 1,
    id: random.uuid("resource"),
    locationId: location.id,
    metadata: { equipment: index === 0 ? ["vaporizzatore", "lampada led"] : ["lettino", "carrello"] },
    name: `${name} ${location.name}`,
    salonId,
    type: index < 2 ? "cabin" : "station",
  })));

  const users = [{
    active: true,
    email: DEMO_IDENTITY.ownerEmail,
    fullName: "Demo Owner",
    id: ownerUserId,
    role: "owner" as const,
    salonId,
  }];

  const staff = STAFF_PROFILES.map(([displayName, jobTitle, color], index) => ({
    active: true,
    bio: `Profilo dimostrativo: ${jobTitle.toLowerCase()} con esperienza in accoglienza e trattamenti personalizzati.`,
    color,
    displayName,
    email: index === 0 ? DEMO_IDENTITY.ownerEmail : `${ascii(displayName)}@staff.salonedemo.invalid`,
    id: random.uuid("staff"),
    jobTitle,
    locationId: salonLocations[index % salonLocations.length]!.id,
    phone: `+39 320 555 ${String(1000 + index).slice(-4)}`,
    salonId,
    specializations: [jobTitle, index % 2 === 0 ? "Consulenza" : "Trattamenti premium"],
    userId: index === 0 ? ownerUserId : null,
    workingHours: WORKING_HOURS,
  }));

  const staffAvailabilityRequests = staff.slice(1, 7).map((member, index) => {
    const startsAt = atUtcHour(addUtcDays(now, 5 + index * 9), 9);
    return {
      endsAt: addUtcDays(startsAt, 1 + (index % 3)),
      id: random.uuid("staff-availability"),
      reason: index % 2 === 0 ? "Richiesta ferie" : "Impegno personale",
      reviewNote: index % 4 === 0 ? "Approvato, copertura garantita." : null,
      reviewedAt: index % 4 === 0 ? addUtcDays(now, -1) : null,
      reviewedByUserId: index % 4 === 0 ? ownerUserId : null,
      salonId,
      staffId: member.id,
      startsAt,
      status: (["pending", "approved", "approved", "rejected"] as const)[index % 4]!,
    };
  });

  const availabilityBlocks = staff.slice(0, 5).map((member, index) => {
    const startsAt = atUtcHour(addUtcDays(now, -40 - index * 30), 9);
    return {
      endsAt: addUtcDays(startsAt, 5),
      id: random.uuid("availability-block"),
      locationId: member.locationId,
      reason: "Formazione professionale",
      recurring: false,
      recurrenceRule: null,
      salonId,
      staffId: member.id,
      startsAt,
    };
  });

  const userPermissions = [
    "settings.manage",
    "staff.manage",
    "reports.view",
    "warehouse.manage",
    "marketing.manage",
  ].map((permissionKey) => ({
    granted: true,
    id: random.uuid("user-permission"),
    permissionKey,
    salonId,
    userId: ownerUserId,
  }));

  const userInterfacePreferences = [{
    id: random.uuid("ui-preference"),
    navigationCollapsed: false,
    salonId,
    userId: ownerUserId,
  }];

  const savedViews = [
    { columns: ["name", "phone", "tags", "lastVisit"], entityType: "customers", filters: {}, name: "Clienti VIP", sort: { direction: "desc", field: "lastVisit" } },
    { columns: ["startsAt", "customer", "staff", "status"], entityType: "appointments", filters: { status: ["confirmed", "pending"] }, name: "Agenda di oggi", sort: null },
  ].map((view) => ({
    columns: view.columns,
    entityType: view.entityType,
    filters: view.filters,
    id: random.uuid("saved-view"),
    name: view.name,
    salonId,
    sort: view.sort,
    userId: ownerUserId,
  }));

  const dataExchangeSettings = ["customers", "appointments"].map((entityType) => ({
    entityType,
    exportFormats: ["csv", "xlsx"],
    id: random.uuid("data-exchange-settings"),
    importMapping: {},
    salonId,
    validationRules: {},
  }));

  const integrationSettings = [
    { config: {}, enabled: false, label: "Google Calendar", provider: "google_calendar" },
    { config: {}, enabled: false, label: "Fatturazione elettronica", provider: "e_invoice" },
  ].map((row) => ({
    config: row.config,
    enabled: row.enabled,
    id: random.uuid("integration-settings"),
    label: row.label,
    provider: row.provider,
    salonId,
  }));

  const salonClosures = (() => {
    const anchorYear = now.getUTCFullYear();
    return [
      { date: `${anchorYear}-01-01`, reason: "Capodanno" },
      { date: `${anchorYear}-12-25`, reason: "Natale" },
      { date: `${anchorYear + 1}-01-01`, reason: "Capodanno" },
    ].map((row) => ({
      date: row.date,
      id: random.uuid("salon-closure"),
      reason: row.reason,
      recurringYearly: true,
      salonId,
    }));
  })();

  const serviceCategories = CATEGORY_DEFINITIONS.map(([name, icon], index) => ({
    active: true,
    displayOrder: index * 10,
    icon,
    id: random.uuid("service-category"),
    name,
    salonId,
  }));

  const services = CATEGORY_DEFINITIONS.flatMap(([category], categoryIndex) =>
    SERVICE_VARIANTS.map(([variant, durationMinutes, basePrice], variantIndex) => ({
      active: !(categoryIndex === 7 && variantIndex === 5),
      bufferAfterMinutes: categoryIndex === 1 ? 15 : 0,
      bufferBeforeMinutes: categoryIndex === 5 ? 10 : 0,
      category,
      categoryId: serviceCategories[categoryIndex]!.id,
      color: STAFF_PROFILES[(categoryIndex + variantIndex) % STAFF_PROFILES.length]![2],
      description: `${category} ${variant.toLowerCase()} con consulenza personalizzata e prodotti professionali.`,
      displayOrder: categoryIndex * 10 + variantIndex,
      durationMinutes,
      id: random.uuid("service"),
      name: `${category} ${variant}`,
      onlineBookingEnabled: variant !== "Signature",
      priceCents: basePrice + categoryIndex * 350,
      salonId,
      taxRateBasisPoints: 2200,
    })),
  );

  const serviceStaff = services.flatMap((service) => staff.map((member) => ({
    id: random.uuid("service-staff"), salonId, serviceId: service.id, staffId: member.id,
  })));

  const serviceResources = services.flatMap((service, serviceIndex) =>
    salonLocations.map((location, locationIndex) => {
      const kindIndex = serviceIndex % resourceKinds.length;
      return {
        id: random.uuid("service-resource"),
        quantity: 1,
        required: true,
        resourceId: salonResources[locationIndex * resourceKinds.length + kindIndex]!.id,
        salonId,
        serviceId: service.id,
      };
    }),
  );

  const customerTags = [
    ["vip", "#D4AF37"],
    ["abituale", "#793059"],
    ["nuova", "#42A5F5"],
  ].map(([name, color]) => ({ color, id: random.uuid("customer-tag"), name: name!, salonId }));

  const customers = Array.from({ length: DEMO_VOLUME_PROFILE.customers }, (_, index) => {
    const firstName = FIRST_NAMES[index % FIRST_NAMES.length]!;
    const lastName = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length]!;
    const suffix = String(index + 1).padStart(3, "0");
    return {
      blocked: index % 97 === 0,
      email: `${ascii(firstName)}.${ascii(lastName)}.${suffix}@clienti.salonedemo.invalid`,
      firstName,
      fullName: `${firstName} ${lastName}`,
      id: random.uuid("customer"),
      lastName,
      marketingEmailConsent: index % 5 !== 0,
      marketingSmsConsent: index % 3 !== 0,
      notes: index % 11 === 0 ? "Preferisce appuntamenti al mattino e prodotti delicati." : null,
      phone: `+39 320 000 ${String(1000 + index).slice(-4)}`,
      phoneNormalized: `39320000${String(1000 + index).slice(-4)}`,
      salonId,
      tags: index % 17 === 0 ? ["vip", "abituale"] : index % 4 === 0 ? ["nuova"] : ["abituale"],
    };
  });

  const communicationProviderAccounts = [{
    businessPortfolioId: null,
    displayPhoneNumber: "+39 02 00000099",
    enabled: false,
    graphApiVersion: "v23.0",
    id: random.uuid("comm-account"),
    lastErrorCode: null,
    lastHealthCheckAt: null,
    lastWebhookAt: null,
    phoneNumberId: "000000000000001",
    provider: "meta_cloud_api" as const,
    salonId,
    status: "not_configured" as const,
    tokenExpiresAt: null,
    wabaId: "000000000000000",
    webhookKey: random.uuid("comm-webhook"),
    webhookSubscriptionStatus: "not_subscribed",
  }];

  const communicationConsents = customers.slice(0, 250).map((customer, index) => ({
    capturedAt: addUtcDays(now, -(index % 200) - 1),
    capturedSource: "demo-seed",
    channel: (["email", "whatsapp"] as const)[index % 2]!,
    customerId: customer.id,
    evidence: { method: "demo-import" },
    id: random.uuid("comm-consent"),
    purpose: "marketing" as const,
    revokedAt: index % 11 === 0 ? addUtcDays(now, -3) : null,
    salonId,
    status: index % 11 === 0 ? ("revoked" as const) : ("granted" as const),
  }));

  const communicationConversations = customers.slice(0, 40).map((customer, index) => ({
    accountId: communicationProviderAccounts[0]!.id,
    assignedUserId: ownerUserId,
    customerId: customer.id,
    id: random.uuid("comm-conversation"),
    lastInboundAt: addUtcDays(now, -(index % 20) - 1),
    lastMessageAt: addUtcDays(now, -(index % 20)),
    lastMessagePreview: "Grazie mille, a presto!",
    participantPhone: customer.phone!,
    salonId,
    status: index % 9 === 0 ? ("archived" as const) : ("open" as const),
    unreadCount: index % 5 === 0 ? 1 : 0,
  }));

  const communicationMessages = communicationConversations.flatMap((conversation, index) => {
    const sentAt = conversation.lastInboundAt!;
    const readAt = index % 3 === 0 ? null : addUtcDays(sentAt, 0);
    return [
      {
        accountId: conversation.accountId,
        body: "Ciao, vorrei confermare l'appuntamento di domani.",
        conversationId: conversation.id,
        direction: "inbound" as const,
        id: random.uuid("comm-message"),
        kind: "text" as const,
        providerTimestamp: sentAt,
        salonId,
        sentAt,
        status: "delivered" as const,
      },
      {
        accountId: conversation.accountId,
        actorUserId: ownerUserId,
        body: "Confermato! Ti aspettiamo in salone.",
        conversationId: conversation.id,
        deliveredAt: conversation.lastMessageAt!,
        direction: "outbound" as const,
        id: random.uuid("comm-message"),
        kind: "text" as const,
        readAt,
        sentAt: conversation.lastMessageAt!,
        salonId,
        status: readAt ? ("read" as const) : ("delivered" as const),
      },
    ];
  });

  const appointments = Array.from({ length: DEMO_VOLUME_PROFILE.appointments }, (_, index) => {
    const historical = index < 800;
    const position = historical ? index : index - 800;
    const population = historical ? 800 : DEMO_VOLUME_PROFILE.appointments - 800;
    const dayOffset = historical
      ? -365 + Math.floor((position * 364) / population)
      : 1 + Math.floor((position * 363) / population);
    const member = staff[index % staff.length]!;
    const service = services[(index * 7) % services.length]!;
    const locationIndex = index % salonLocations.length;
    const startsAt = atUtcHour(addUtcDays(now, dayOffset), 8 + (Math.floor(index / staff.length) % 9));
    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
    const status = historical
      ? index % 19 === 0 ? "cancelled" as const : index % 23 === 0 ? "no_show" as const : "completed" as const
      : index % 9 === 0 ? "pending" as const : "confirmed" as const;
    return {
      cancelledAt: status === "cancelled" ? addUtcDays(startsAt, -1) : null,
      cancellationReason: status === "cancelled" ? "Imprevisto personale" : null,
      confirmedAt: status === "pending" ? null : addUtcDays(startsAt, -2),
      customerId: customers[(index * 11) % customers.length]!.id,
      endsAt,
      id: random.uuid("appointment"),
      internalNotes: index % 13 === 0 ? "Richiesta dimostrativa: attenzione alle preferenze cliente." : null,
      locationId: salonLocations[locationIndex]!.id,
      resourceId: salonResources[locationIndex * resourceKinds.length + ((index * 7) % services.length) % resourceKinds.length]!.id,
      salonId,
      serviceId: service.id,
      source: index % 4 === 0 ? "online" as const : "manual" as const,
      staffId: member.id,
      startsAt,
      status,
    };
  });

  const completedAppointments = appointments.filter((row) => row.status === "completed");
  const pendingAppointments = appointments.filter((row) => row.status === "pending");

  const appointmentNotes = completedAppointments.filter((_, index) => index % 6 === 0).map((appointment) => ({
    appointmentId: appointment.id,
    authorUserId: ownerUserId,
    body: "Cliente soddisfatta, consigliato trattamento di mantenimento a 4 settimane.",
    id: random.uuid("appointment-note"),
    salonId,
  }));

  const appointmentRescheduleRequests = pendingAppointments.slice(0, 25).map((appointment, index) => ({
    appointmentId: appointment.id,
    id: random.uuid("reschedule-request"),
    reason: "Imprevisto di lavoro",
    requestedStartsAt: addUtcDays(appointment.startsAt, 2),
    resolvedAt: index % 3 === 0 ? addUtcDays(now, -1) : null,
    resolvedByUserId: index % 3 === 0 ? ownerUserId : null,
    salonId,
    status: (["pending", "pending", "approved"] as const)[index % 3]!,
  }));

  const reminders = appointments
    .filter((appointment) => appointment.status === "confirmed" || appointment.status === "completed")
    .slice(0, 900)
    .map((appointment) => {
      const scheduledAt = addUtcDays(appointment.startsAt, -1);
      const sent = appointment.startsAt < now;
      return {
        appointmentId: appointment.id,
        channel: "whatsapp" as const,
        id: random.uuid("reminder"),
        payload: { appointmentId: appointment.id, template: "appointment_reminder" },
        salonId,
        scheduledAt,
        sentAt: sent ? scheduledAt : null,
        status: sent ? ("sent" as const) : ("pending" as const),
      };
    });

  const reminderSettings = [{
    emailEnabled: true,
    hoursBefore: [24, 2],
    id: random.uuid("reminder-settings"),
    salonId,
    whatsappEnabled: true,
  }];

  const inventorySuppliers = ["Beauty Professional", "Dermalab Italia", "Nail Pro Milano", "Body Ritual", "Salon Tools"]
    .map((name, index) => ({
      active: true, address: `Via Fornitori ${index + 1}`, city: "Milano", contactName: `Referente ${index + 1}`,
      country: "Italia", email: `ordini.${index + 1}@fornitori.salonedemo.invalid`, id: random.uuid("supplier"),
      name, paymentTerms: index % 2 === 0 ? "30 giorni" : "Pagamento immediato", phone: `+39 02 1000000${index}`,
      postalCode: "20100", salonId,
    }));

  const productCategories = ["Hair care", "Styling", "Viso", "Corpo", "Nails", "Epilazione", "Accessori", "Consumabili"];
  const inventoryProducts = Array.from({ length: DEMO_VOLUME_PROFILE.products }, (_, index) => {
    const supplier = inventorySuppliers[index % inventorySuppliers.length]!;
    const stockQuantity = index % 20 === 0 ? 0 : index % 11 === 0 ? 2 : 8 + (index % 24);
    return {
      active: index % 53 !== 0,
      allowNegativeStock: false,
      averageCostCents: 600 + index * 9,
      barcode: `8059000${String(index).padStart(6, "0")}`,
      brand: supplier.name,
      category: productCategories[index % productCategories.length],
      costCents: 600 + index * 9,
      description: `Prodotto professionale dimostrativo numero ${index + 1}.`,
      id: random.uuid("product"),
      internallyConsumable: index % 4 === 0,
      itemType: index % 4 === 0 ? "consumable" : "resale",
      lastCostCents: 620 + index * 9,
      lowStockThreshold: 4,
      name: `${productCategories[index % productCategories.length]} Demo ${String(index + 1).padStart(3, "0")}`,
      preferredSupplier: supplier.name,
      preferredSupplierId: supplier.id,
      reorderQuantity: 12,
      salonId,
      sellable: index % 4 !== 0,
      sku: `DEMO-${String(index + 1).padStart(4, "0")}`,
      stockQuantity,
      storageLocation: `Scaffale ${String.fromCharCode(65 + (index % 8))}`,
      supplier: supplier.name,
      trackStock: true,
      unit: "pz",
      unitPriceCents: 1_400 + index * 17,
      unitScale: 1,
      vatRateBasisPoints: 2200,
    };
  });

  const sales = completedAppointments.slice(0, DEMO_VOLUME_PROFILE.sales).map((appointment, index) => {
    const service = services.find((candidate) => candidate.id === appointment.serviceId)!;
    const product = index % 3 === 0 ? inventoryProducts[index % inventoryProducts.length]! : null;
    const totalCents = service.priceCents + (product?.unitPriceCents ?? 0);
    return {
      appointmentId: appointment.id,
      closedAt: appointment.endsAt,
      closedByUserId: ownerUserId,
      customerId: appointment.customerId,
      discountCents: 0,
      id: random.uuid("sale"),
      notes: "Vendita dimostrativa riconciliata.",
      salonId,
      staffId: appointment.staffId,
      status: "paid" as const,
      subtotalCents: totalCents,
      totalCents,
    };
  });

  const saleItems = sales.flatMap((sale, index) => {
    const appointment = completedAppointments[index]!;
    const service = services.find((candidate) => candidate.id === appointment.serviceId)!;
    const serviceItem = {
      description: service.name, discountCents: 0, id: random.uuid("sale-item"), itemType: "service" as const,
      productId: null, quantity: 1, saleId: sale.id, salonId, serviceId: service.id, staffId: appointment.staffId,
      totalCents: service.priceCents, unitPriceCents: service.priceCents,
    };
    if (index % 3 !== 0) return [serviceItem];
    const product = inventoryProducts[index % inventoryProducts.length]!;
    const productItem = {
      description: product.name, discountCents: 0, id: random.uuid("sale-item"), itemType: "product" as const,
      productId: product.id, quantity: 1, saleId: sale.id, salonId, serviceId: null, staffId: appointment.staffId,
      totalCents: product.unitPriceCents, unitPriceCents: product.unitPriceCents,
    };
    return [serviceItem, productItem];
  });

  const productSales = new Map<string, number>();
  for (const item of saleItems) {
    if (item.productId) productSales.set(item.productId, (productSales.get(item.productId) ?? 0) + item.quantity);
  }

  const purchaseVouchers = customers.slice(10, 20).map((customer, index) => {
    const isRedeemed = index < 2;
    const originalAmountCents = isRedeemed ? sales[index]!.totalCents : 3_000 + index * 400;
    const balanceCents = isRedeemed ? 0 : index % 3 === 0 ? 0 : Math.floor(originalAmountCents / 2);
    return {
      balanceCents,
      code: `DEMO-VOU-${String(index + 1).padStart(4, "0")}`,
      customerId: customer.id,
      exhaustedAt: balanceCents === 0 ? addUtcDays(now, -5) : null,
      id: random.uuid("voucher"),
      issuedByUserId: ownerUserId,
      message: "Buono regalo Salone Demo",
      originalAmountCents,
      purchaserCustomerId: index % 4 === 0 ? customers[(index + 60) % customers.length]!.id : null,
      salonId,
      status: balanceCents === 0 ? ("exhausted" as const) : ("active" as const),
    };
  });

  const salePayments = sales.map((sale, index) => {
    const voucher = index < 2 ? purchaseVouchers[index]! : null;
    return {
      amountCents: sale.totalCents, id: random.uuid("sale-payment"),
      method: voucher ? ("voucher" as const) : (["card", "cash", "bank_transfer"] as const)[index % 3]!,
      paidAt: sale.closedAt!, reference: `DEMO-PAY-${String(index + 1).padStart(5, "0")}`, saleId: sale.id, salonId,
      voucherId: voucher ? voucher.id : null,
    };
  });

  const purchaseVoucherMovements = purchaseVouchers.flatMap((voucher, index) => {
    const relatedPayment = salePayments.find((payment) => payment.voucherId === voucher.id);
    const spent = relatedPayment ? relatedPayment.amountCents : voucher.originalAmountCents - voucher.balanceCents;
    if (spent <= 0) return [];
    return [{
      balanceAfterCents: voucher.balanceCents,
      createdByUserId: ownerUserId,
      deltaCents: -spent,
      id: random.uuid("voucher-movement"),
      reason: relatedPayment ? "Utilizzo in vendita" : "Utilizzo manuale in cassa",
      saleId: relatedPayment ? relatedPayment.saleId : null,
      salonId,
      voucherId: voucher.id,
    }];
  });

  const countDiscrepancyProductIds = new Set(
    inventoryProducts.filter((_, index) => index === 3 || index === 47).map((product) => product.id),
  );

  const openingDocumentId = random.uuid("inventory-document");
  const restockDocumentId = random.uuid("inventory-document");
  const countDocumentId = random.uuid("inventory-document");
  const openingDocumentDate = addUtcDays(now, -400);
  const restockDocumentDate = addUtcDays(now, -60);
  const countDocumentDate = addUtcDays(now, -14);

  const openingLines: DemoTableRows["inventoryDocumentLines"] = [];
  const restockLines: DemoTableRows["inventoryDocumentLines"] = [];
  const inventoryMovements: DemoTableRows["inventoryMovements"] = [];

  inventoryProducts.forEach((product, index) => {
    const sold = productSales.get(product.id) ?? 0;
    const extraForCountDemo = countDiscrepancyProductIds.has(product.id) ? 1 : 0;
    const totalReceived = product.stockQuantity + sold + extraForCountDemo;
    const isRestocked = index % 5 === 0;
    const openingQty = isRestocked ? Math.ceil(totalReceived / 2) : totalReceived;
    const restockQty = totalReceived - openingQty;
    const unitCost = product.costCents ?? 0;

    const openingLineId = random.uuid("inventory-document-line");
    openingLines.push({
      description: product.name, discountCents: 0, documentId: openingDocumentId, id: openingLineId,
      itemType: "resale", lineNumber: openingLines.length + 1, netCents: openingQty * unitCost, productId: product.id,
      quantity: openingQty, salonId, stockDelta: openingQty, supplierId: product.preferredSupplierId,
      taxCents: 0, taxRateBasisPoints: 0, totalCents: openingQty * unitCost, unit: "pz", unitCostCents: unitCost, unitScale: 1,
    });
    inventoryMovements.push({
      createdByUserId: ownerUserId, delta: openingQty, documentId: openingDocumentId, documentLineId: openingLineId,
      id: random.uuid("stock-movement"), movementType: "opening", note: "Giacenza iniziale dataset Demo",
      productId: product.id, reason: "Carico iniziale demo", salonId, stockAfter: openingQty, stockBefore: 0,
      unitCostCents: unitCost, valueCents: openingQty * unitCost,
    });

    let runningStock = openingQty;
    if (restockQty > 0) {
      const restockLineId = random.uuid("inventory-document-line");
      restockLines.push({
        description: product.name, discountCents: 0, documentId: restockDocumentId, id: restockLineId,
        itemType: "resale", lineNumber: restockLines.length + 1, netCents: restockQty * unitCost, productId: product.id,
        quantity: restockQty, salonId, stockDelta: restockQty, supplierId: product.preferredSupplierId,
        taxCents: 0, taxRateBasisPoints: 0, totalCents: restockQty * unitCost, unit: "pz", unitCostCents: unitCost, unitScale: 1,
      });
      inventoryMovements.push({
        createdByUserId: ownerUserId, delta: restockQty, documentId: restockDocumentId, documentLineId: restockLineId,
        id: random.uuid("stock-movement"), movementType: "purchase", note: "Riordino fornitore",
        productId: product.id, reason: "Riordino fornitore", salonId, stockAfter: runningStock + restockQty,
        stockBefore: runningStock, unitCostCents: unitCost, valueCents: restockQty * unitCost,
      });
      runningStock += restockQty;
    }

    if (sold > 0) {
      inventoryMovements.push({
        createdByUserId: ownerUserId, delta: -sold, id: random.uuid("stock-movement"), movementType: "sale",
        note: "Scarico aggregato vendite demo", productId: product.id, reason: "Vendite demo", salonId,
        stockAfter: runningStock - sold, stockBefore: runningStock, unitCostCents: unitCost, valueCents: -(sold * unitCost),
      });
      runningStock -= sold;
    }

    if (extraForCountDemo > 0) {
      inventoryMovements.push({
        createdByUserId: ownerUserId, delta: -extraForCountDemo, documentId: countDocumentId,
        id: random.uuid("stock-movement"), movementType: "adjustment", note: "Rettifica da inventario fisico",
        productId: product.id, reason: "Rettifica inventario", salonId, stockAfter: runningStock - extraForCountDemo,
        stockBefore: runningStock, unitCostCents: unitCost, valueCents: -(extraForCountDemo * unitCost),
      });
      runningStock -= extraForCountDemo;
    }
  });

  const sumCents = (rows: Array<{ totalCents: number }>) => rows.reduce((total, row) => total + row.totalCents, 0);
  const sumNet = (rows: Array<{ netCents: number }>) => rows.reduce((total, row) => total + row.netCents, 0);

  const inventoryDocumentsBase = [
    {
      competenceDate: openingDocumentDate, createdByUserId: ownerUserId, documentDate: openingDocumentDate,
      id: openingDocumentId, internalNumber: "DEMO-OPEN-0001", kind: "opening",
      netTotalCents: sumNet(openingLines as Array<{ netCents: number }>), notes: "Carico di apertura del dataset Demo",
      postedAt: openingDocumentDate, postedByUserId: ownerUserId, salonId, status: "posted", supplierId: null,
      taxTotalCents: 0, totalCents: sumCents(openingLines as Array<{ totalCents: number }>),
    },
    ...(restockLines.length > 0 ? [{
      competenceDate: restockDocumentDate, createdByUserId: ownerUserId, documentDate: restockDocumentDate,
      id: restockDocumentId, internalNumber: "DEMO-PURCH-0001", kind: "purchase",
      netTotalCents: sumNet(restockLines as Array<{ netCents: number }>), notes: "Riordino periodico fornitori",
      postedAt: restockDocumentDate, postedByUserId: ownerUserId, salonId, status: "posted",
      supplierId: inventorySuppliers[0]!.id, taxTotalCents: 0, totalCents: sumCents(restockLines as Array<{ totalCents: number }>),
    }] : []),
    {
      competenceDate: countDocumentDate, createdByUserId: ownerUserId, documentDate: countDocumentDate,
      id: countDocumentId, internalNumber: "DEMO-COUNT-0001", kind: "count", netTotalCents: 0,
      notes: "Inventario fisico periodico", postedAt: addUtcDays(countDocumentDate, 1), postedByUserId: ownerUserId,
      salonId, status: "posted", supplierId: null, taxTotalCents: 0, totalCents: 0,
    },
  ];

  const inventoryDocumentLines = [...openingLines, ...restockLines];

  const countedProducts = inventoryProducts.slice(0, 20);
  const inventoryCounts = [{
    category: "Selezione periodica", createdByUserId: ownerUserId, documentId: countDocumentId, id: random.uuid("inventory-count"),
    notes: "Conteggio a campione del magazzino", openedAt: countDocumentDate, postedAt: addUtcDays(countDocumentDate, 1),
    postedByUserId: ownerUserId, salonId, status: "posted",
  }];

  const inventoryCountLines = countedProducts.map((product) => {
    const extraForCountDemo = countDiscrepancyProductIds.has(product.id) ? 1 : 0;
    const theoreticalQuantity = product.stockQuantity + extraForCountDemo;
    const countedQuantity = product.stockQuantity;
    return {
      countId: inventoryCounts[0]!.id, countedQuantity, differenceQuantity: countedQuantity - theoreticalQuantity,
      differenceValueCents: (countedQuantity - theoreticalQuantity) * (product.costCents ?? 0),
      id: random.uuid("inventory-count-line"), productId: product.id, salonId, theoreticalQuantity,
    };
  });

  const inventoryExpenseCategories = ["Utenze", "Affitto", "Lavanderia professionale", "Formazione", "Marketing locale"];
  const inventoryExpenses = Array.from({ length: 15 }, (_, index) => {
    const documentId = random.uuid("inventory-document");
    const competenceDate = addUtcDays(now, -(index + 1) * 20);
    const netCents = 8_000 + index * 350;
    const taxCents = Math.round(netCents * 0.22);
    const totalCents = netCents + taxCents;
    const isCashPaid = index % 4 === 0;
    return {
      cashMovementId: isCashPaid ? random.uuid("cash-movement") : null,
      category: inventoryExpenseCategories[index % inventoryExpenseCategories.length]!,
      competenceDate, description: `${inventoryExpenseCategories[index % inventoryExpenseCategories.length]} demo`,
      documentId, id: random.uuid("inventory-expense"), idempotencyKey: `demo-expense-${index + 1}`,
      netCents, notes: null, salonId, supplierId: null, taxCents, totalCents,
    };
  });

  const inventoryExpenseDocuments = inventoryExpenses.map((expense) => ({
    competenceDate: expense.competenceDate, createdByUserId: ownerUserId, documentDate: expense.competenceDate,
    id: expense.documentId, internalNumber: `DEMO-EXP-${String(inventoryExpenses.indexOf(expense) + 1).padStart(4, "0")}`,
    kind: "expense", netTotalCents: expense.netCents, notes: null, postedAt: expense.competenceDate,
    postedByUserId: ownerUserId, salonId, status: "posted", supplierId: null, taxTotalCents: expense.taxCents,
    totalCents: expense.totalCents,
  }));

  const inventoryAssetDescriptions = ["Poltrona styling premium", "Casco asciugacapelli professionale", "Terminale POS", "Lettino massaggio elettrico", "Lampada UV per unghie", "Vaporizzatore viso"];
  const inventoryAssets = inventoryAssetDescriptions.map((description, index) => {
    const documentId = random.uuid("inventory-document");
    const purchaseDate = addUtcDays(now, -(200 + index * 45));
    return {
      cashMovementId: null, description, documentId, id: random.uuid("inventory-asset"),
      idempotencyKey: `demo-asset-${index + 1}`, location: salonLocations[index % salonLocations.length]!.name,
      purchaseCostCents: 45_000 + index * 12_000, purchaseDate, salonId, serialNumber: `SN-DEMO-${String(index + 1).padStart(4, "0")}`,
      status: "active", supplierId: null, warrantyExpiresAt: addUtcDays(purchaseDate, 730),
    };
  });

  const inventoryAssetDocuments = inventoryAssets.map((asset, index) => ({
    competenceDate: asset.purchaseDate, createdByUserId: ownerUserId, documentDate: asset.purchaseDate,
    id: asset.documentId, internalNumber: `DEMO-ASSET-${String(index + 1).padStart(4, "0")}`, kind: "equipment_purchase",
    netTotalCents: asset.purchaseCostCents, notes: null, postedAt: asset.purchaseDate, postedByUserId: ownerUserId,
    salonId, status: "posted", supplierId: null, taxTotalCents: 0, totalCents: asset.purchaseCostCents,
  }));

  const inventoryDocuments = [...inventoryDocumentsBase, ...inventoryExpenseDocuments, ...inventoryAssetDocuments];

  const cashMovements = [
    ...salePayments.filter((payment) => payment.method === "cash").map((payment) => ({
      amountCents: payment.amountCents, category: "vendita", createdByUserId: ownerUserId, direction: "in" as const,
      id: random.uuid("cash-movement"), idempotencyKey: `demo-sale-payment-${payment.id}`, notes: null,
      occurredAt: payment.paidAt, paymentMethod: "cash" as const, reason: "Incasso vendita cliente", salonId,
      sourceId: payment.saleId, sourceType: "sale_payment",
    })),
    ...inventoryExpenses.filter((expense) => expense.cashMovementId).map((expense) => ({
      amountCents: expense.totalCents, category: expense.category, createdByUserId: ownerUserId, direction: "out" as const,
      id: expense.cashMovementId!, idempotencyKey: `demo-expense-cash-${expense.id}`, notes: null,
      occurredAt: expense.competenceDate, paymentMethod: "cash" as const, reason: `Pagamento spesa: ${expense.category}`, salonId,
      sourceId: expense.id, sourceType: "inventory_expense",
    })),
  ];

  const reviews = completedAppointments.filter((_, index) => index % 5 === 0).slice(0, 120).map((appointment, index) => ({
    appointmentId: appointment.id, comment: index % 4 === 0 ? "Esperienza eccellente, staff attento e ambiente curato." : "Servizio puntuale e professionale.",
    customerId: appointment.customerId, id: random.uuid("review"), published: index % 7 !== 0,
    rating: index % 13 === 0 ? 4 : 5, reply: index % 3 === 0 ? "Grazie, ti aspettiamo presto!" : null, salonId,
  }));

  const reviewRequestSettings = [{
    automaticEnabled: true, channels: ["email"] as Array<"email" | "whatsapp">, delayPreset: "one_hour" as const,
    id: random.uuid("review-request-settings"), salonId, updatedByUserId: ownerUserId,
  }];

  const reviewInvitations = reviews.map((review, index) => {
    const expiresAt = addUtcDays(now, 30 + index);
    return {
      appointmentId: review.appointmentId, channel: "email" as const, consumedAt: review.rating ? addUtcDays(expiresAt, -25) : null,
      deliveredAt: addUtcDays(expiresAt, -29), deliveryAttempts: 1, deliveryStatus: "sent" as const,
      expiresAt, id: random.uuid("review-invitation"), salonId, tokenHash: String(index + 1).padStart(64, "b").slice(-64),
    };
  });

  const reviewInvitationDeliveries = reviewInvitations.map((invitation) => ({
    attempts: 1, channel: invitation.channel, deliveredAt: invitation.deliveredAt, generation: 0,
    id: random.uuid("review-invitation-delivery"), invitationId: invitation.id, salonId,
    scheduledAt: addUtcDays(invitation.deliveredAt!, -1), status: "delivered",
  }));

  const notifications = [
    ...inventoryProducts.filter((product) => product.stockQuantity <= product.lowStockThreshold).slice(0, 20).map((product) => ({
      category: "inventory", channel: "in_app" as const, entityId: product.id, entityType: "inventory_product",
      id: random.uuid("notification"), payload: { productId: product.id }, priority: "high" as const, salonId,
      targetRole: "owner" as const, title: `Scorta minima raggiunta: ${product.name}`, type: "low_stock",
    })),
    ...appointmentRescheduleRequests.filter((request) => request.status === "pending").slice(0, 15).map((request) => ({
      category: "appointments", channel: "in_app" as const, entityId: request.appointmentId, entityType: "appointment",
      id: random.uuid("notification"), payload: { appointmentId: request.appointmentId }, priority: "normal" as const,
      salonId, targetRole: "receptionist" as const, title: "Richiesta di riprogrammazione in attesa", type: "reschedule_requested",
    })),
  ];

  const notificationPreferences = (["owner", "manager", "receptionist"] as const).flatMap((role) =>
    (["appointments", "inventory", "marketing"] as const).map((category) => ({
      category, channel: "in_app" as const, enabled: true, id: random.uuid("notification-preference"),
      quietHours: {}, role, salonId,
    })),
  );

  const activityLog = [
    { action: "salon.created", entityType: "salon", summary: "Salone Demo creato dal generatore dimostrativo." },
    { action: "catalog.populated", entityType: "service", summary: "Catalogo servizi dimostrativo popolato." },
    { action: "calendar.populated", entityType: "appointment", summary: "Calendario dimostrativo popolato con dodici mesi di appuntamenti." },
  ].map((entry) => ({
    action: entry.action, actorUserId: ownerUserId, diff: {}, entityId: null, entityType: entry.entityType,
    id: random.uuid("activity-log"), payload: {}, salonId, summary: entry.summary,
  }));

  const waitlistEntries = Array.from({ length: 35 }, (_, index) => ({
    customerId: customers[index]!.id, id: random.uuid("waitlist"), requestedDate: addUtcDays(now, 3 + index),
    salonId, serviceId: services[index % services.length]!.id, staffId: index % 2 ? staff[index % staff.length]!.id : null,
    status: index % 8 === 0 ? "notified" as const : "waiting" as const,
    timePreference: (["any", "morning", "afternoon", "evening"] as const)[index % 4]!,
  }));

  const loyaltyTiers = [["Bronze", 0], ["Silver", 250], ["Gold", 600], ["Platinum", 1200]].map(([name, minPoints], index) => ({
    active: true, benefits: { discountPercent: index * 3, priorityBooking: index > 1 }, displayOrder: index,
    id: random.uuid("loyalty-tier"), minPoints: Number(minPoints), name: String(name), salonId,
  }));
  const loyaltyRewards = [["Piega omaggio", 300], ["Sconto 20 euro", 450], ["Trattamento premium", 750]].map(([name, pointsRequired]) => ({
    active: true, description: "Premio dimostrativo del programma fedeltà.", id: random.uuid("loyalty-reward"),
    name: String(name), pointsRequired: Number(pointsRequired), salonId,
  }));
  const loyaltyPointsFromAppointments = completedAppointments.filter((_, index) => index % 2 === 0).slice(0, 500).map((appointment) => ({
    appointmentId: appointment.id, customerId: appointment.customerId, delta: 10, expiresAt: addUtcDays(appointment.endsAt, 365),
    id: random.uuid("loyalty-point"), reason: "Appuntamento completato", ruleKey: "completed_appointment", salonId,
  }));

  const loyaltyAdjustmentReasons = [
    { active: true, code: "manual_correction", label: "Rettifica manuale", requiresNote: true },
    { active: true, code: "goodwill", label: "Gesto di cortesia", requiresNote: false },
  ].map((row) => ({ active: row.active, code: row.code, id: random.uuid("loyalty-adjustment-reason"), label: row.label, requiresNote: row.requiresNote, salonId }));

  const vipCustomers = customers.filter((customer) => customer.tags.includes("vip"));
  const loyaltyPointsVipBonus = vipCustomers.flatMap((customer, customerIndex) =>
    Array.from({ length: 6 }, (_, bonusIndex) => ({
      adjustmentReasonId: loyaltyAdjustmentReasons[0]!.id, createdByUserId: ownerUserId, customerId: customer.id,
      delta: 100, expiresAt: addUtcDays(now, 365), id: random.uuid("loyalty-point"),
      reason: "Bonus fedeltà cliente VIP", ruleKey: null,
      salonId,
    })),
  );

  const vipPointBalances = new Map<string, number>();
  for (const row of [...loyaltyPointsFromAppointments, ...loyaltyPointsVipBonus]) {
    vipPointBalances.set(row.customerId, (vipPointBalances.get(row.customerId) ?? 0) + row.delta);
  }

  const loyaltyRewardRedemptions: DemoTableRows["loyaltyRewardRedemptions"] = [];
  const loyaltyPointsRedemptions: DemoTableRows["loyaltyPoints"] = [];
  const smallestReward = [...loyaltyRewards].sort((a, b) => a.pointsRequired - b.pointsRequired)[0]!;
  for (const customer of vipCustomers) {
    const balance = vipPointBalances.get(customer.id) ?? 0;
    if (balance < smallestReward.pointsRequired || loyaltyRewardRedemptions.length >= 5) continue;
    const redemptionId = random.uuid("loyalty-redemption");
    loyaltyRewardRedemptions.push({
      approvedByUserId: ownerUserId, customerId: customer.id, id: redemptionId,
      idempotencyKey: `demo-redemption-${redemptionId}`, notes: null, pointsSpent: smallestReward.pointsRequired,
      redeemedAt: addUtcDays(now, -7), rewardId: smallestReward.id, salonId, status: "redeemed",
    });
    loyaltyPointsRedemptions.push({
      createdByUserId: ownerUserId, customerId: customer.id, delta: -smallestReward.pointsRequired,
      id: random.uuid("loyalty-point"), reason: "Riscatto premio fedeltà", redemptionId, ruleKey: null, salonId,
    });
    vipPointBalances.set(customer.id, balance - smallestReward.pointsRequired);
  }

  const loyaltyPoints = [...loyaltyPointsFromAppointments, ...loyaltyPointsVipBonus, ...loyaltyPointsRedemptions];

  const campaignTemplates = ["Bentornata", "Compleanno", "Novità stagionali"].map((name, index) => ({
    active: true, channel: index === 1 ? "sms" as const : "email" as const,
    content: `Ciao {{nome}}, scopri ${name.toLowerCase()} nel Salone Demo. Messaggio dimostrativo non inviato.`,
    id: random.uuid("campaign-template"), name, salonId, variables: ["nome"],
  }));
  const marketingCampaigns = campaignTemplates.map((template, index) => ({
    channel: template.channel, content: template.content, id: random.uuid("campaign"), name: `${template.name} Demo`,
    recipientPreview: [], salonId, status: "sent" as const, sentAt: addUtcDays(now, -(30 + index * 40)),
    targetSegment: { tags: index === 0 ? ["abituale"] : [] }, templateId: template.id,
  }));
  const campaignRecipients = marketingCampaigns.flatMap((campaign, campaignIndex) => customers.slice(campaignIndex * 40, campaignIndex * 40 + 40).map((customer, index) => ({
    campaignId: campaign.id, customerId: customer.id, deliveryAttempts: 1, destination: customer.email!,
    id: random.uuid("campaign-recipient"), providerName: "demo-disabled", salonId,
    sentAt: campaign.sentAt, status: index % 13 === 0 ? "failed" : "sent",
    error: index % 13 === 0 ? "Casella demo non raggiungibile" : null,
  })));

  const consentTemplates = ["Privacy e trattamento dati", "Consenso trattamento estetico", "Uso immagini"]
    .map((name, index) => ({ active: true, body: `${name}: documento dimostrativo per il Salone Demo.`, id: random.uuid("consent-template"),
      name, requiredForServices: index === 1 ? services.slice(0, 8).map((service) => service.id) : [], salonId, type: index === 0 ? "privacy" : "treatment", version: 1 }));
  const customerConsents = customers.slice(0, 180).map((customer, index) => ({
    customerId: customer.id, deliveryChannel: "email" as const, documentHash: String(index + 1).padStart(64, "a").slice(-64),
    id: random.uuid("customer-consent"), salonId, signatureData: { method: "demo" }, signedAt: addUtcDays(now, -(index % 180)),
    signerName: customer.fullName, status: "signed" as const, templateId: consentTemplates[index % consentTemplates.length]!.id,
  }));

  const servicePackages = services.slice(0, 8).map((service, index) => ({
    active: true, description: `Percorso Demo da ${4 + (index % 3)} sedute.`, id: random.uuid("service-package"),
    includedSessions: 4 + (index % 3), name: `Percorso ${service.name}`, priceCents: service.priceCents * 4 - 2_000,
    salonId, serviceId: service.id, validityDays: 365,
  }));
  const servicePackageItems = servicePackages.map((packageRow, index) => ({
    id: random.uuid("service-package-item"), itemType: "service" as const, packageId: packageRow.id,
    quantity: packageRow.includedSessions, salonId, serviceId: services[index]!.id,
  }));

  const customerServicePackages = customers.slice(20, 80).map((customer, index) => {
    const packageRow = servicePackages[index % servicePackages.length]!;
    const usedSessions = index % 4 === 0
      ? packageRow.includedSessions
      : index % 3 === 0
        ? 0
        : Math.min(packageRow.includedSessions - 1, 1 + (index % packageRow.includedSessions));
    const startsAt = addUtcDays(now, -(30 + index));
    return {
      active: usedSessions < packageRow.includedSessions,
      customerId: customer.id, expiresAt: addUtcDays(startsAt, packageRow.validityDays ?? 365),
      id: random.uuid("customer-package"), notes: null, packageId: packageRow.id, purchaseSaleId: null,
      salonId, startsAt, totalSessions: packageRow.includedSessions, usedSessions,
    };
  });

  const customerPackageItemBalances = customerServicePackages.map((customerPackage) => {
    const packageItem = servicePackageItems.find((item) => item.packageId === customerPackage.packageId)!;
    return {
      customerPackageId: customerPackage.id, id: random.uuid("customer-package-balance"),
      packageItemId: packageItem.id, salonId, totalQuantity: customerPackage.totalSessions, usedQuantity: customerPackage.usedSessions,
    };
  });

  const servicePackageUsages = customerServicePackages.flatMap((customerPackage) => {
    const packageItem = servicePackageItems.find((item) => item.packageId === customerPackage.packageId)!;
    return Array.from({ length: customerPackage.usedSessions }, () => ({
      createdByUserId: ownerUserId, customerPackageId: customerPackage.id, id: random.uuid("package-usage"),
      note: null, packageItemId: packageItem.id, quantityUsed: 1, salonId, sessionsUsed: 1,
    }));
  });

  return {
    anchor: new Date(now),
    rows: {
      activityLog,
      appointmentNotes,
      appointmentRescheduleRequests,
      appointments,
      availabilityBlocks,
      calendarSettings: [{ allowOverbooking: false, bufferMinutes: 5, cancellationPolicyHours: 24, defaultView: "week", enableResourceView: true, id: random.uuid("calendar-settings"), minBookingNoticeHours: 2, minSlotMinutes: 15, overbookingLimit: 0, printableFields: ["customer", "service", "staff", "resource"], salonId }],
      campaignRecipients,
      campaignTemplates,
      cashMovements,
      communicationConsents,
      communicationConversations,
      communicationMessages,
      communicationProviderAccounts,
      consentTemplates,
      customerConsents,
      customerPackageItemBalances,
      customerServicePackages,
      customerTags,
      customers,
      dataExchangeSettings,
      integrationSettings,
      inventoryAssets,
      inventoryCountLines,
      inventoryCounts,
      inventoryDocumentLines,
      inventoryDocuments,
      inventoryExpenses,
      inventoryMovements,
      inventoryProducts,
      inventoryReorderRequests: inventoryProducts.filter((product) => product.stockQuantity <= product.lowStockThreshold).map((product) => ({ createdByUserId: ownerUserId, id: random.uuid("reorder"), notes: "Riordino suggerito dal dataset Demo", productId: product.id, quantity: product.reorderQuantity, salonId, status: "open", supplier: product.supplier })),
      inventorySuppliers,
      loyaltyAdjustmentReasons,
      loyaltyEarningRules: [{ action: "completed_appointment", active: true, id: random.uuid("loyalty-rule"), points: 10, salonId }, { action: "review", active: true, id: random.uuid("loyalty-rule"), points: 25, salonId }],
      loyaltyPoints,
      loyaltyRewardRedemptions,
      loyaltyRewards,
      loyaltySettings: [{ allowNegativeBalance: false, id: random.uuid("loyalty-settings"), pointsExpireAfterDays: 365, pointsPerAppointment: 10, redemptionRequiresApproval: true, salonId }],
      loyaltyTiers,
      marketingCampaigns,
      notificationPreferences,
      notifications,
      purchaseVoucherMovements,
      purchaseVouchers,
      pwaBrandingSettings: [{ accentColor: "#DCA3C1", bookingSuccessText: "Prenotazione ricevuta!", heroSubtitle: "La demo completa di EsseBeauty", heroTitle: "Benvenuta nel Salone Demo", id: random.uuid("pwa-branding"), installPromptEnabled: true, primaryColor: "#793059", salonId, welcomeText: "Esplora servizi e disponibilità della nostra esperienza dimostrativa." }],
      reminderSettings,
      reminders,
      reviewInvitationDeliveries,
      reviewInvitations,
      reviewRequestSettings,
      reviews,
      saleItems,
      salePayments,
      sales,
      salonClosures,
      salonLocations,
      salonModules: [...new Set(options.moduleKeys)].sort().map((moduleKey) => ({ enabled: true, id: random.uuid("salon-module"), moduleKey, salonId })),
      salonResources,
      salons: [{ active: true, address: "Via della Bellezza 12", brandColor: "#793059", cancellationPolicyHours: 24, city: "Milano", country: "Italia", email: "demo@salonedemo.invalid", id: salonId, locale: "it-IT", name: DEMO_IDENTITY.salonName, onboardingCompletedAt: now, onboardingStep: 9, onlineBookingEnabled: true, openingHours: WORKING_HOURS, phone: "+39 02 00000000", platformStatus: "active", postalCode: "20100", province: "MI", slug: DEMO_IDENTITY.salonSlug, timezone: "Europe/Rome" }],
      salonSettings: [{ category: "business", id: random.uuid("salon-setting"), salonId, settings: { currency: "EUR", demo: true, fiscalRegime: "ordinario" }, updatedByUserId: ownerUserId }],
      savedViews,
      serviceCategories,
      servicePackageItems,
      servicePackageUsages,
      servicePackages,
      serviceResources,
      services,
      serviceStaff,
      staff,
      staffAvailabilityRequests,
      userInterfacePreferences,
      userPermissions,
      users,
      waitlistEntries,
    },
    seed: options.seed,
  };
}
