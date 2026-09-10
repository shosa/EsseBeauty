import type { DemoScenario } from "./scenario-types.js";

export interface DemoValidationReport {
  errors: string[];
  tableCounts: Record<string, number>;
  warnings: string[];
}

/**
 * Maps a foreign-key-shaped field name (ending in "Id") to the DemoScenario
 * table it is expected to reference. `null` marks a field that is
 * ambiguous across tables and is intentionally not checked generically.
 */
const FIELD_TO_TABLE: Record<string, string | null> = {
  accountId: "communicationProviderAccounts",
  actorUserId: "users",
  adjustmentReasonId: "loyaltyAdjustmentReasons",
  appointmentId: "appointments",
  approvedByUserId: "users",
  assignedUserId: "users",
  authorUserId: "users",
  campaignId: "marketingCampaigns",
  cancelledByUserId: "users",
  cashMovementId: "cashMovements",
  categoryId: "serviceCategories",
  closedByUserId: "users",
  conversationId: "communicationConversations",
  countId: "inventoryCounts",
  createdByUserId: "users",
  customerId: "customers",
  customerPackageId: "customerServicePackages",
  disposedByUserId: "users",
  documentId: "inventoryDocuments",
  documentLineId: "inventoryDocumentLines",
  invitationId: "reviewInvitations",
  issuedByUserId: "users",
  locationId: "salonLocations",
  mergedIntoCustomerId: "customers",
  packageId: "servicePackages",
  packageItemId: "servicePackageItems",
  postedByUserId: "users",
  preferredSupplierId: "inventorySuppliers",
  purchaserCustomerId: "customers",
  redemptionId: "loyaltyRewardRedemptions",
  resolvedByUserId: "users",
  resourceId: "salonResources",
  reversalOfDocumentId: "inventoryDocuments",
  reversesAssetId: "inventoryAssets",
  reversesDocumentLineId: "inventoryDocumentLines",
  reversesExpenseId: "inventoryExpenses",
  reversesMovementId: "inventoryMovements",
  revokedByUserId: "users",
  reviewedByUserId: "users",
  rewardId: "loyaltyRewards",
  saleId: "sales",
  saleItemId: "saleItems",
  salonId: "salons",
  serviceId: "services",
  staffId: "staff",
  supplierId: "inventorySuppliers",
  templateId: null,
  updatedByUserId: "users",
  userId: "users",
  voidedByUserId: "users",
  voucherId: "purchaseVouchers",
};

const MINIMUM_VOLUMES: Record<string, number> = {
  appointments: 1_500,
  customers: 300,
  inventoryProducts: 100,
  salonLocations: 1,
  salonResources: 3,
  services: 40,
  staff: 5,
};

const DEMO_WORKING_WINDOWS: Record<number, Array<[number, number]>> = {
  // JS weekday: 0 Sunday -> 6 Saturday
  2: [[9 * 60, 13 * 60], [16 * 60, 20 * 60]],
  3: [[9 * 60, 17 * 60]],
  4: [[9 * 60, 13 * 60], [16 * 60, 20 * 60]],
  5: [[9 * 60, 13 * 60], [16 * 60, 20 * 60]],
  6: [[9 * 60, 17 * 60]],
};

function checkForeignKeys(rows: Record<string, Array<Record<string, unknown>>>, errors: string[]): void {
  const idSets: Record<string, Set<string>> = {};

  for (const [table, tableRows] of Object.entries(rows)) {
    idSets[table] = new Set(
      tableRows.map((row) => row.id).filter((value): value is string => typeof value === "string"),
    );
  }

  for (const [table, tableRows] of Object.entries(rows)) {
    tableRows.forEach((row, index) => {
      for (const [field, value] of Object.entries(row)) {
        if (value === null || value === undefined || !field.endsWith("Id")) continue;
        if (!(field in FIELD_TO_TABLE)) continue;

        const targetTable = FIELD_TO_TABLE[field];
        if (targetTable == null || typeof value !== "string") continue;

        if (!idSets[targetTable]?.has(value)) {
          errors.push(`${table}[${index}].${field} = "${value}" does not reference an existing ${targetTable} row`);
        }
      }
    });
  }
}

function checkSaleTotals(scenario: DemoScenario, errors: string[]): void {
  const itemTotals = new Map<string, number>();

  for (const item of scenario.rows.saleItems) {
    itemTotals.set(item.saleId, (itemTotals.get(item.saleId) ?? 0) + item.totalCents);
  }

  for (const sale of scenario.rows.sales) {
    const total = itemTotals.get(sale.id!) ?? 0;
    if (total !== sale.totalCents) {
      errors.push(`sale ${sale.id} totalCents=${sale.totalCents} does not match its item totals (${total})`);
    }
  }
}

function checkStockBalances(scenario: DemoScenario, errors: string[]): void {
  const stockTotals = new Map<string, number>();

  for (const movement of scenario.rows.inventoryMovements) {
    stockTotals.set(movement.productId, (stockTotals.get(movement.productId) ?? 0) + movement.delta);
  }

  for (const product of scenario.rows.inventoryProducts) {
    const total = stockTotals.get(product.id!) ?? 0;
    if (total !== product.stockQuantity) {
      errors.push(`product ${product.id} stockQuantity=${product.stockQuantity} does not match its movement ledger (${total})`);
    }
  }
}

function checkNoOverlaps(scenario: DemoScenario, errors: string[]): void {
  const active = scenario.rows.appointments.filter((row) => row.status !== "cancelled");

  for (const key of ["staffId", "resourceId"] as const) {
    const byKey = new Map<string, typeof active>();

    for (const appointment of active) {
      const value = appointment[key];
      if (!value) continue;

      const list = byKey.get(value) ?? [];
      list.push(appointment);
      byKey.set(value, list);
    }

    for (const [id, list] of byKey) {
      const sorted = [...list].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

      for (let index = 1; index < sorted.length; index += 1) {
        if (sorted[index]!.startsAt.getTime() < sorted[index - 1]!.endsAt.getTime()) {
          errors.push(`appointments overlap for ${key}=${id}: ${sorted[index - 1]!.id} and ${sorted[index]!.id}`);
        }
      }
    }
  }
}

function checkStaffServiceCompatibility(scenario: DemoScenario, errors: string[]): void {
  const assignments = new Set(
    scenario.rows.serviceStaff.map((row) => `${row.serviceId}:${row.staffId}`),
  );

  for (const appointment of scenario.rows.appointments) {
    if (!assignments.has(`${appointment.serviceId}:${appointment.staffId}`)) {
      errors.push(
        `appointment ${appointment.id} assigns staff ${appointment.staffId} to service ${appointment.serviceId} without a matching serviceStaff row`,
      );
    }
  }
}

function checkChronology(scenario: DemoScenario, errors: string[]): void {
  for (const appointment of scenario.rows.appointments) {
    if (appointment.endsAt.getTime() <= appointment.startsAt.getTime()) {
      errors.push(`appointment ${appointment.id} ends before (or when) it starts`);
    }
  }
}

function romeParts(date: Date): { day: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);

  const dayByName: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    day: dayByName[weekday ?? ""] ?? -1,
    minute: hour * 60 + minute,
  };
}

function checkDemoCalendarProfile(scenario: DemoScenario, errors: string[]): void {
  if (scenario.rows.salonLocations.length !== 1) {
    errors.push(`demo must contain exactly 1 salon location; found ${scenario.rows.salonLocations.length}`);
  }

  if (scenario.rows.salonResources.length !== 3) {
    errors.push(`demo must contain exactly 3 salon resources; found ${scenario.rows.salonResources.length}`);
  }

  if (scenario.rows.staff.length !== 5) {
    errors.push(`demo must contain exactly 5 staff members; found ${scenario.rows.staff.length}`);
  }

  const pendingCount = scenario.rows.appointments.filter((row) => row.status === "pending").length;
  if (pendingCount > 3) {
    errors.push(`demo must contain at most 3 pending appointments; found ${pendingCount}`);
  }

  for (const appointment of scenario.rows.appointments) {
    const start = romeParts(appointment.startsAt);
    const end = romeParts(appointment.endsAt);
    const windows = DEMO_WORKING_WINDOWS[start.day] ?? [];

    const validWindow = windows.some(
      ([from, to]) => start.minute >= from && end.minute <= to,
    );

    if (!validWindow || start.day !== end.day) {
      errors.push(
        `appointment ${appointment.id} is outside demo opening hours (${appointment.startsAt.toISOString()} -> ${appointment.endsAt.toISOString()})`,
      );
    }
  }
}

function checkMinimumVolumes(rows: Record<string, Array<Record<string, unknown>>>, warnings: string[]): void {
  for (const [table, minimum] of Object.entries(MINIMUM_VOLUMES)) {
    const count = rows[table]?.length ?? 0;

    if (count < minimum) {
      warnings.push(`${table} has ${count} rows, below the recommended minimum of ${minimum}`);
    }
  }
}

/**
 * Validates a deterministic Demo scenario before it is ever applied to a
 * database: referential integrity, sale/stock reconciliation, calendar
 * consistency, compact demo constraints, and minimum representative volumes.
 */
export function validateDemoScenario(scenario: DemoScenario): DemoValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rows = scenario.rows as unknown as Record<string, Array<Record<string, unknown>>>;
  const tableCounts: Record<string, number> = {};

  for (const [table, tableRows] of Object.entries(rows)) {
    tableCounts[table] = tableRows.length;
  }

  checkForeignKeys(rows, errors);
  checkSaleTotals(scenario, errors);
  checkStockBalances(scenario, errors);
  checkNoOverlaps(scenario, errors);
  checkStaffServiceCompatibility(scenario, errors);
  checkChronology(scenario, errors);
  checkDemoCalendarProfile(scenario, errors);
  checkMinimumVolumes(rows, warnings);

  return { errors, tableCounts, warnings };
}
