import type {
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
} from "@esse-beauty/db/schema";

type Insert<T extends { $inferInsert: unknown }> = T["$inferInsert"];

export const DEMO_IDENTITY = {
  ownerEmail: "demo@demo.com",
  salonName: "Demo",
  salonSlug: "demo",
} as const;

export const DEMO_VOLUME_PROFILE = {
  appointments: 1_650,
  customers: 420,
  locations: 3,
  products: 120,
  sales: 600,
  services: 48,
  staff: 14,
} as const;

export interface DemoSeedOptions {
  anchor: Date;
  moduleKeys: readonly string[];
  seed: number;
}

export interface DemoTableRows {
  salons: Insert<typeof salons>[];
  salonModules: Insert<typeof salonModules>[];
  salonLocations: Insert<typeof salonLocations>[];
  salonResources: Insert<typeof salonResources>[];
  salonSettings: Insert<typeof salonSettings>[];
  calendarSettings: Insert<typeof calendarSettings>[];
  dataExchangeSettings: Insert<typeof dataExchangeSettings>[];
  integrationSettings: Insert<typeof integrationSettings>[];
  pwaBrandingSettings: Insert<typeof pwaBrandingSettings>[];
  salonClosures: Insert<typeof salonClosures>[];
  users: Insert<typeof users>[];
  userPermissions: Insert<typeof userPermissions>[];
  userInterfacePreferences: Insert<typeof userInterfacePreferences>[];
  staff: Insert<typeof staff>[];
  staffAvailabilityRequests: Insert<typeof staffAvailabilityRequests>[];
  availabilityBlocks: Insert<typeof availabilityBlocks>[];
  serviceCategories: Insert<typeof serviceCategories>[];
  services: Insert<typeof services>[];
  serviceStaff: Insert<typeof serviceStaff>[];
  serviceResources: Insert<typeof serviceResources>[];
  customerTags: Insert<typeof customerTags>[];
  customers: Insert<typeof customers>[];
  consentTemplates: Insert<typeof consentTemplates>[];
  customerConsents: Insert<typeof customerConsents>[];
  communicationProviderAccounts: Insert<typeof communicationProviderAccounts>[];
  communicationConsents: Insert<typeof communicationConsents>[];
  communicationConversations: Insert<typeof communicationConversations>[];
  communicationMessages: Insert<typeof communicationMessages>[];
  appointments: Insert<typeof appointments>[];
  appointmentNotes: Insert<typeof appointmentNotes>[];
  appointmentRescheduleRequests: Insert<typeof appointmentRescheduleRequests>[];
  reminders: Insert<typeof reminders>[];
  reminderSettings: Insert<typeof reminderSettings>[];
  reviewRequestSettings: Insert<typeof reviewRequestSettings>[];
  reviewInvitations: Insert<typeof reviewInvitations>[];
  reviewInvitationDeliveries: Insert<typeof reviewInvitationDeliveries>[];
  reviews: Insert<typeof reviews>[];
  waitlistEntries: Insert<typeof waitlistEntries>[];
  notifications: Insert<typeof notifications>[];
  notificationPreferences: Insert<typeof notificationPreferences>[];
  savedViews: Insert<typeof savedViews>[];
  activityLog: Insert<typeof activityLog>[];
  loyaltyAdjustmentReasons: Insert<typeof loyaltyAdjustmentReasons>[];
  loyaltySettings: Insert<typeof loyaltySettings>[];
  loyaltyTiers: Insert<typeof loyaltyTiers>[];
  loyaltyRewards: Insert<typeof loyaltyRewards>[];
  loyaltyEarningRules: Insert<typeof loyaltyEarningRules>[];
  loyaltyRewardRedemptions: Insert<typeof loyaltyRewardRedemptions>[];
  loyaltyPoints: Insert<typeof loyaltyPoints>[];
  campaignTemplates: Insert<typeof campaignTemplates>[];
  marketingCampaigns: Insert<typeof marketingCampaigns>[];
  campaignRecipients: Insert<typeof campaignRecipients>[];
  servicePackages: Insert<typeof servicePackages>[];
  servicePackageItems: Insert<typeof servicePackageItems>[];
  customerServicePackages: Insert<typeof customerServicePackages>[];
  customerPackageItemBalances: Insert<typeof customerPackageItemBalances>[];
  servicePackageUsages: Insert<typeof servicePackageUsages>[];
  inventorySuppliers: Insert<typeof inventorySuppliers>[];
  inventoryProducts: Insert<typeof inventoryProducts>[];
  inventoryReorderRequests: Insert<typeof inventoryReorderRequests>[];
  inventoryDocuments: Insert<typeof inventoryDocuments>[];
  inventoryDocumentLines: Insert<typeof inventoryDocumentLines>[];
  inventoryMovements: Insert<typeof inventoryMovements>[];
  inventoryCounts: Insert<typeof inventoryCounts>[];
  inventoryCountLines: Insert<typeof inventoryCountLines>[];
  inventoryExpenses: Insert<typeof inventoryExpenses>[];
  inventoryAssets: Insert<typeof inventoryAssets>[];
  cashMovements: Insert<typeof cashMovements>[];
  sales: Insert<typeof sales>[];
  saleItems: Insert<typeof saleItems>[];
  salePayments: Insert<typeof salePayments>[];
  purchaseVouchers: Insert<typeof purchaseVouchers>[];
  purchaseVoucherMovements: Insert<typeof purchaseVoucherMovements>[];
}

export interface DemoScenario {
  anchor: Date;
  rows: DemoTableRows;
  seed: number;
}
