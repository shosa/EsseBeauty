import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  activityLog,
  appointmentRescheduleRequests,
  calendarSettings,
  campaignTemplates,
  consentTemplates,
  customerTags,
  customerConsents,
  customerServicePackages,
  dataExchangeSettings,
  integrationSettings,
  inventoryReorderRequests,
  loginActivity,
  loyaltyAdjustmentReasons,
  loyaltyRewardRedemptions,
  loyaltyTiers,
  notificationPreferences,
  notifications,
  passwordResetTokens,
  platformAuditLog,
  platformImpersonationSessions,
  platformModuleCatalog,
  platformPlans,
  platformSystemTemplates,
  pwaBrandingSettings,
  savedViews,
  salonClosures,
  salonLocations,
  salonResources,
  salonSettings,
  servicePackageUsages,
  servicePackages,
  serviceResources,
  serviceStaff,
  staffAvailabilityRequests,
  userInterfacePreferences,
  inventoryAssets,
  inventoryCountLines,
  inventoryCounts,
  inventoryDocumentLines,
  inventoryDocuments,
  inventoryExpenses,
  inventoryMovements,
  inventoryProducts,
  inventorySuppliers,
} from "./schema.js";

const plannedTables = [
  activityLog,
  appointmentRescheduleRequests,
  calendarSettings,
  campaignTemplates,
  consentTemplates,
  customerTags,
  customerConsents,
  customerServicePackages,
  dataExchangeSettings,
  integrationSettings,
  inventoryReorderRequests,
  loginActivity,
  loyaltyAdjustmentReasons,
  loyaltyRewardRedemptions,
  loyaltyTiers,
  notificationPreferences,
  notifications,
  passwordResetTokens,
  platformAuditLog,
  platformImpersonationSessions,
  platformModuleCatalog,
  platformPlans,
  platformSystemTemplates,
  pwaBrandingSettings,
  savedViews,
  salonClosures,
  salonLocations,
  salonResources,
  salonSettings,
  servicePackageUsages,
  servicePackages,
  serviceResources,
  serviceStaff,
  staffAvailabilityRequests,
  userInterfacePreferences,
];

if (plannedTables.length !== 37) {
  throw new Error("Schema remediation contract is incomplete.");
}

const warehouseTables = [
  inventorySuppliers,
  inventoryDocuments,
  inventoryDocumentLines,
  inventoryCounts,
  inventoryCountLines,
  inventoryExpenses,
  inventoryAssets,
];

if (warehouseTables.length !== 7 || warehouseTables.some((table) => !table)) {
  throw new Error("Warehouse schema contract is incomplete.");
}

const tenantScopedWarehouseRows = [
  inventoryDocumentLines.salonId,
  inventoryCountLines.salonId,
  inventoryExpenses.salonId,
  inventoryAssets.salonId,
  inventoryMovements.salonId,
];

if (tenantScopedWarehouseRows.some((column) => !column)) {
  throw new Error("Warehouse child rows must be salon scoped.");
}

const tenantScopedWarehouseParents = [
  inventorySuppliers.salonId,
  inventoryProducts.salonId,
  inventoryDocuments.salonId,
  inventoryCounts.salonId,
];

if (tenantScopedWarehouseParents.some((column) => !column)) {
  throw new Error("Warehouse parent rows must expose tenant scope.");
}

const migrationSource = readFileSync(
  join(process.cwd(), "migrations", "0034_complete_warehouse.sql"),
  "utf8",
);

for (const requirement of [
  "inventory_document_lines (",
  "inventory_count_lines (",
  "salon_id uuid NOT NULL",
  "inventory_document_lines_document_salon_id",
  "inventory_count_lines_count_salon_id",
  "inventory_movements_product_salon_id_fk",
  "inventory_suppliers_id_salon_unique",
  "warehouse_document_lines_draft_guard",
  "warehouse_documents_immutable_guard",
  "OLD.document_id <> NEW.document_id",
  "OLD.salon_id <> NEW.salon_id",
  "--> statement-breakpoint",
]) {
  if (!migrationSource.includes(requirement)) {
    throw new Error(`Warehouse migration is missing ${requirement}.`);
  }
}
