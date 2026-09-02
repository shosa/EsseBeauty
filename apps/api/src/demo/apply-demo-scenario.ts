import { eq } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import type { DrizzleDB } from "@esse-beauty/db";
import {
  activityLog,
  appointmentNotes,
  appointmentRescheduleRequests,
  appointments,
  availabilityBlocks,
  calendarSettings,
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
  inventoryReorderRequests,
  inventorySuppliers,
  loyaltyAdjustmentReasons,
  loyaltyEarningRules,
  loyaltyPoints,
  loyaltyRewardRedemptions,
  loyaltyRewards,
  loyaltySettings,
  loyaltyTiers,
  marketingCampaigns,
  notificationPreferences,
  notifications,
  purchaseVoucherMovements,
  purchaseVouchers,
  pwaBrandingSettings,
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
  salonModules,
  salonResources,
  salons,
  salonSettings,
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
  userCredentials,
  userInterfacePreferences,
  userPermissions,
  users,
  waitlistEntries,
} from "@esse-beauty/db/schema";

import { hashPassword } from "../routes/auth/local-auth.js";
import { DEMO_IDENTITY, type DemoScenario, type DemoTableRows } from "./scenario-types.js";

const TABLE_REFS: Record<keyof DemoTableRows, PgTable> = {
  activityLog,
  appointmentNotes,
  appointmentRescheduleRequests,
  appointments,
  availabilityBlocks,
  calendarSettings,
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
  inventoryReorderRequests,
  inventorySuppliers,
  loyaltyAdjustmentReasons,
  loyaltyEarningRules,
  loyaltyPoints,
  loyaltyRewardRedemptions,
  loyaltyRewards,
  loyaltySettings,
  loyaltyTiers,
  marketingCampaigns,
  notificationPreferences,
  notifications,
  purchaseVoucherMovements,
  purchaseVouchers,
  pwaBrandingSettings,
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
  salonModules,
  salonResources,
  salons,
  salonSettings,
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
};

/**
 * Dependency-ordered insertion sequence. Every foreign key in the schema must
 * point at a table that appears earlier in this list (verified by
 * assertCompleteInsertOrder below).
 */
const INSERT_ORDER: Array<keyof DemoTableRows> = [
  "salons",
  "salonModules",
  "salonLocations",
  "salonResources",
  "users",
  "salonSettings",
  "calendarSettings",
  "dataExchangeSettings",
  "integrationSettings",
  "pwaBrandingSettings",
  "salonClosures",
  "userPermissions",
  "userInterfacePreferences",
  "staff",
  "staffAvailabilityRequests",
  "availabilityBlocks",
  "serviceCategories",
  "services",
  "serviceStaff",
  "serviceResources",
  "customerTags",
  "customers",
  "consentTemplates",
  "customerConsents",
  "communicationProviderAccounts",
  "communicationConsents",
  "communicationConversations",
  "communicationMessages",
  "appointments",
  "appointmentNotes",
  "appointmentRescheduleRequests",
  "reminders",
  "reminderSettings",
  "reviewRequestSettings",
  "reviewInvitations",
  "reviewInvitationDeliveries",
  "reviews",
  "waitlistEntries",
  "notifications",
  "notificationPreferences",
  "savedViews",
  "activityLog",
  "loyaltyAdjustmentReasons",
  "loyaltySettings",
  "loyaltyTiers",
  "loyaltyRewards",
  "loyaltyEarningRules",
  "loyaltyRewardRedemptions",
  "loyaltyPoints",
  "campaignTemplates",
  "marketingCampaigns",
  "campaignRecipients",
  "servicePackages",
  "servicePackageItems",
  "customerServicePackages",
  "customerPackageItemBalances",
  "servicePackageUsages",
  "inventorySuppliers",
  "inventoryProducts",
  "inventoryReorderRequests",
  "inventoryDocuments",
  "inventoryDocumentLines",
  "cashMovements",
  "inventoryExpenses",
  "inventoryAssets",
  "inventoryMovements",
  "inventoryCounts",
  "inventoryCountLines",
  "purchaseVouchers",
  "sales",
  "saleItems",
  "salePayments",
  "purchaseVoucherMovements",
];

function assertCompleteInsertOrder(): void {
  const declared = new Set(INSERT_ORDER);
  const known = Object.keys(TABLE_REFS) as Array<keyof DemoTableRows>;
  const missing = known.filter((key) => !declared.has(key));
  const unknown = INSERT_ORDER.filter((key) => !known.includes(key));
  if (missing.length > 0 || unknown.length > 0) {
    throw new Error(
      `Demo insert order is out of sync with DemoTableRows. Missing: [${missing.join(", ")}]. Unknown: [${unknown.join(", ")}].`,
    );
  }
}

assertCompleteInsertOrder();

const INSERT_CHUNK_SIZE = 500;

async function insertChunked(
  executor: { insert: DrizzleDB["insert"] },
  table: PgTable,
  rows: ReadonlyArray<Record<string, unknown>>,
): Promise<void> {
  for (let index = 0; index < rows.length; index += INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(index, index + INSERT_CHUNK_SIZE);
    if (chunk.length === 0) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (executor.insert(table as any) as any).values(chunk);
  }
}

export interface DemoTenantCandidate {
  ownerMatch: { email: string; salonId: string; slug: string } | null;
  slugMatch: { id: string; slug: string } | null;
}

/**
 * Pure safety guard: given what the database currently has under the
 * reserved Demo slug and the reserved Demo owner email, decides whether it
 * is safe to delete-and-replace, safe to create fresh, or must abort.
 * Never touches the database itself.
 */
export function assertReplaceableDemoTenant(
  candidate: DemoTenantCandidate,
): { id: string } | null {
  const { ownerMatch, slugMatch } = candidate;

  if (!slugMatch && !ownerMatch) return null;

  if (slugMatch && ownerMatch && slugMatch.id === ownerMatch.salonId) {
    return { id: slugMatch.id };
  }

  if (slugMatch && !ownerMatch) {
    throw new Error(
      `Refusing to replace tenant: salon "${slugMatch.slug}" uses the reserved Demo slug but has no owner with the reserved Demo email. No database changes were made.`,
    );
  }

  if (!slugMatch && ownerMatch) {
    throw new Error(
      `Refusing to replace tenant: the reserved Demo owner email is registered under salon "${ownerMatch.slug}", which does not use the reserved Demo slug. No database changes were made.`,
    );
  }

  throw new Error(
    `Refusing to replace tenant: the reserved Demo slug and the reserved Demo owner email point to different salons ("${slugMatch!.slug}" vs "${ownerMatch!.slug}"). No database changes were made.`,
  );
}

async function resolveDemoTenantCandidate(db: DrizzleDB): Promise<DemoTenantCandidate> {
  const slugRows = await db
    .select({ id: salons.id, slug: salons.slug })
    .from(salons)
    .where(eq(salons.slug, DEMO_IDENTITY.salonSlug));
  if (slugRows.length > 1) {
    throw new Error(
      `Refusing to replace tenant: found ${slugRows.length} salons with the reserved Demo slug. No database changes were made.`,
    );
  }

  const ownerRows = await db
    .select({ email: users.email, salonId: users.salonId, slug: salons.slug })
    .from(users)
    .innerJoin(salons, eq(salons.id, users.salonId))
    .where(eq(users.email, DEMO_IDENTITY.ownerEmail));
  if (ownerRows.length > 1) {
    throw new Error(
      `Refusing to replace tenant: found ${ownerRows.length} users with the reserved Demo owner email. No database changes were made.`,
    );
  }

  return {
    ownerMatch: ownerRows[0] ? { email: ownerRows[0].email, salonId: ownerRows[0].salonId, slug: ownerRows[0].slug } : null,
    slugMatch: slugRows[0] ?? null,
  };
}

export interface ApplyDemoScenarioOptions {
  dryRun?: boolean;
  ownerPassword: string;
}

export interface DemoApplyReport {
  dryRun: boolean;
  replacedTenantId: string | null;
  rowCounts: Record<string, number>;
  tenantId: string;
}

function rowCountsOf(scenario: DemoScenario): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [key, rows] of Object.entries(scenario.rows)) {
    if (Array.isArray(rows)) counts[key] = rows.length;
  }
  return counts;
}

/**
 * Safely (re)creates the reserved Demo tenant from a deterministic scenario.
 * Verifies tenant identity before touching anything, replaces only the
 * reserved tenant inside a single transaction, and never dispatches any
 * external communication.
 */
export async function applyDemoScenario(
  db: DrizzleDB,
  scenario: DemoScenario,
  options: ApplyDemoScenarioOptions,
): Promise<DemoApplyReport> {
  const rowCounts = rowCountsOf(scenario);
  const candidate = await resolveDemoTenantCandidate(db);
  const existing = assertReplaceableDemoTenant(candidate);
  const tenantId = scenario.rows.salons[0]!.id!;

  if (options.dryRun) {
    return { dryRun: true, replacedTenantId: existing?.id ?? null, rowCounts, tenantId };
  }

  const passwordData = await hashPassword(options.ownerPassword);
  const ownerUserId = scenario.rows.users[0]!.id!;

  await db.transaction(async (tx) => {
    if (existing) {
      await tx.delete(salons).where(eq(salons.id, existing.id));
    }

    for (const key of INSERT_ORDER) {
      const rows = scenario.rows[key] as ReadonlyArray<Record<string, unknown>>;
      if (!rows || rows.length === 0) continue;

      // Warehouse documents are guarded by a trigger that only allows their
      // lines to be inserted while the parent document is still "draft".
      // Insert every document as a draft, attach its lines, then promote it
      // to its intended final status in one update (allowed by the same
      // trigger for the draft -> posted transition).
      if (key === "inventoryDocuments") {
        const draftRows = rows.map((row) => ({ ...row, postedAt: null, postedByUserId: null, status: "draft" }));
        await insertChunked(tx, TABLE_REFS.inventoryDocuments, draftRows);
        continue;
      }

      if (key === "inventoryDocumentLines") {
        await insertChunked(tx, TABLE_REFS.inventoryDocumentLines, rows);
        for (const document of scenario.rows.inventoryDocuments) {
          await tx
            .update(inventoryDocuments)
            .set({
              netTotalCents: document.netTotalCents,
              postedAt: document.postedAt ?? null,
              postedByUserId: document.postedByUserId ?? null,
              status: document.status ?? "posted",
              taxTotalCents: document.taxTotalCents,
              totalCents: document.totalCents,
            })
            .where(eq(inventoryDocuments.id, document.id!));
        }
        continue;
      }

      await insertChunked(tx, TABLE_REFS[key], rows);
    }

    await tx.insert(userCredentials).values({
      mustChangePassword: false,
      passwordHash: passwordData.hash,
      passwordSalt: passwordData.salt,
      userId: ownerUserId,
    });
  });

  return { dryRun: false, replacedTenantId: existing?.id ?? null, rowCounts, tenantId };
}
