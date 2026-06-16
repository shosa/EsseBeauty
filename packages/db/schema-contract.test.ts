import {
  activityLog,
  campaignTemplates,
  customerTags,
  inventoryReorderRequests,
  loginActivity,
  loyaltyAdjustmentReasons,
  loyaltyRewardRedemptions,
  loyaltyTiers,
  notifications,
  passwordResetTokens,
  savedViews,
  serviceStaff,
} from "./schema.js";

const plannedTables = [
  activityLog,
  campaignTemplates,
  customerTags,
  inventoryReorderRequests,
  loginActivity,
  loyaltyAdjustmentReasons,
  loyaltyRewardRedemptions,
  loyaltyTiers,
  notifications,
  passwordResetTokens,
  savedViews,
  serviceStaff,
];

if (plannedTables.length !== 12) {
  throw new Error("Schema remediation contract is incomplete.");
}
