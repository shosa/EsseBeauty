import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type WorkingHours = Record<
  "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun",
  Array<{ from: string; to: string }>
>;

export const userRoleEnum = pgEnum("user_role", [
  "owner",
  "manager",
  "receptionist",
  "employee",
]);
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "pending",
  "confirmed",
  "cancelled",
  "no_show",
  "completed",
]);
export const appointmentSourceEnum = pgEnum("appointment_source", [
  "online",
  "manual",
  "walk_in",
]);
export const saleStatusEnum = pgEnum("sale_status", ["open", "paid", "void"]);
export const saleItemTypeEnum = pgEnum("sale_item_type", [
  "service",
  "product",
  "custom",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "card",
  "bank_transfer",
  "voucher",
  "other",
]);
// Historical SMS compatibility: retained so applied rows remain readable; runtime writes use WhatsApp.
export const reminderChannelEnum = pgEnum("reminder_channel", ["sms", "email", "whatsapp"]);
export const reminderStatusEnum = pgEnum("reminder_status", [
  "pending",
  "queued",
  "sent",
  "failed",
]);
export const reviewDeliveryChannelEnum = pgEnum("review_delivery_channel", [
  "email",
  // Historical SMS compatibility; no active delivery path writes this value.
  "sms",
  "whatsapp",
]);
export const reviewDeliveryStatusEnum = pgEnum("review_delivery_status", [
  "pending",
  "queued",
  "processing",
  "sent",
  "failed",
  "skipped",
  "exhausted",
]);
export const waitlistStatusEnum = pgEnum("waitlist_status", [
  "waiting",
  "notified",
  "booked",
  "expired",
]);
// Historical SMS compatibility: old campaigns remain queryable and are never sendable.
export const campaignChannelEnum = pgEnum("campaign_channel", ["email", "sms", "whatsapp"]);
export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "scheduled",
  "queued",
  "processing",
  "sent",
  "failed",
  "partial",
  "cancelled",
]);
export const platformSalonStatusEnum = pgEnum("platform_salon_status", [
  "active",
  "suspended",
  "trial",
  "churn_risk",
]);
export const notificationPriorityEnum = pgEnum("notification_priority", [
  "low",
  "normal",
  "high",
  "critical",
]);
export const notificationChannelEnum = pgEnum("notification_channel", [
  "in_app",
  "email",
  // Historical SMS compatibility; active notification contracts expose WhatsApp instead.
  "sms",
  "whatsapp",
  "push",
]);
export const consentSignatureStatusEnum = pgEnum("consent_signature_status", [
  "pending",
  "signed",
  "revoked",
  "expired",
]);
export const consentDeliveryChannelEnum = pgEnum("consent_delivery_channel", [
  "email",
  // Historical SMS compatibility for consent evidence.
  "sms",
  "whatsapp",
  "in_person",
]);
export const staffRequestStatusEnum = pgEnum("staff_request_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);
export const communicationProviderEnum = pgEnum("communication_provider", ["meta_cloud_api"]);
export const communicationProviderStatusEnum = pgEnum("communication_provider_status", [
  "not_configured",
  "pending_verification",
  "ready",
  "degraded",
  "revoked",
  "disabled",
]);
export const communicationSecretKindEnum = pgEnum("communication_secret_kind", [
  "access_token",
  "webhook_verify_token",
]);
// Historical SMS compatibility: tenant WhatsApp outbox is the only active non-email channel.
export const communicationChannelEnum = pgEnum("communication_channel", ["email", "sms", "whatsapp"]);
export const communicationConsentPurposeEnum = pgEnum("communication_consent_purpose", ["marketing", "transactional"]);
export const communicationConsentStatusEnum = pgEnum("communication_consent_status", ["granted", "revoked"]);
export const communicationConversationStatusEnum = pgEnum("communication_conversation_status", ["open", "closed", "archived"]);
export const communicationDirectionEnum = pgEnum("communication_direction", ["inbound", "outbound"]);
export const communicationMessageKindEnum = pgEnum("communication_message_kind", ["text", "template", "media", "system"]);
export const communicationMessageStatusEnum = pgEnum("communication_message_status", ["queued", "accepted", "sent", "delivered", "read", "failed"]);
export const communicationOutboxStatusEnum = pgEnum("communication_outbox_status", ["pending", "processing", "delivered", "failed", "exhausted"]);
export const whatsappTemplateApprovalStatusEnum = pgEnum("whatsapp_template_approval_status", ["pending", "approved", "rejected", "revoked"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
};

export const salons = pgTable("salons", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  timezone: text("timezone").notNull(),
  locale: text("locale").notNull(),
  openingHours: jsonb("opening_hours")
    .$type<WorkingHours>()
    .default({
      mon: [{ from: "09:00", to: "18:00" }],
      tue: [{ from: "09:00", to: "18:00" }],
      wed: [{ from: "09:00", to: "18:00" }],
      thu: [{ from: "09:00", to: "18:00" }],
      fri: [{ from: "09:00", to: "18:00" }],
      sat: [],
      sun: [],
    })
    .notNull(),
  cancellationPolicyHours: integer("cancellation_policy_hours")
    .default(24)
    .notNull(),
  onlineBookingEnabled: boolean("online_booking_enabled")
    .default(true)
    .notNull(),
  address: text("address"),
  city: text("city"),
  postalCode: text("postal_code"),
  province: text("province"),
  country: text("country").default("Italia"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  phone: text("phone"),
  email: text("email"),
  brandColor: text("brand_color"),
  bookingPolicyText: text("booking_policy_text"),
  cancellationPolicyText: text("cancellation_policy_text"),
  planId: text("plan_id"),
  platformStatus: platformSalonStatusEnum("platform_status")
    .default("active")
    .notNull(),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  churnRiskScore: integer("churn_risk_score").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  onboardingStep: integer("onboarding_step").default(1).notNull(),
  onboardingCompletedAt: timestamp("onboarding_completed_at", {
    withTimezone: true,
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  ...timestamps,
});

export const salonModules = pgTable(
  "salon_modules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    moduleKey: text("module_key").notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("salon_modules_salon_key_unique").on(
      table.salonId,
      table.moduleKey,
    ),
  ],
);

export const platformPlans = pgTable(
  "platform_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    description: text("description"),
    includedModules: jsonb("included_modules").$type<string[]>().default([]).notNull(),
    limits: jsonb("limits").$type<Record<string, unknown>>().default({}).notNull(),
    active: boolean("active").default(true).notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("platform_plans_code_unique").on(table.code)],
);

export const platformModuleCatalog = pgTable(
  "platform_module_catalog",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    moduleKey: text("module_key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    globallyEnabled: boolean("globally_enabled").default(true).notNull(),
    defaultEnabled: boolean("default_enabled").default(false).notNull(),
    configurationSchema: jsonb("configuration_schema")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("platform_module_catalog_key_unique").on(table.moduleKey)],
);

export const platformAdmins = pgTable("platform_admins", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  active: boolean("active").default(true).notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  ...timestamps,
});

export const platformAdminSessions = pgTable("platform_admin_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminId: uuid("admin_id")
    .notNull()
    .references(() => platformAdmins.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  ...timestamps,
});

export const platformAuditLog = pgTable("platform_audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorAdminId: uuid("actor_admin_id").references(() => platformAdmins.id, {
    onDelete: "set null",
  }),
  salonId: uuid("salon_id").references(() => salons.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  summary: text("summary").notNull(),
  diff: jsonb("diff").$type<Record<string, unknown>>().default({}).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  ...timestamps,
});

export const platformImpersonationSessions = pgTable("platform_impersonation_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminId: uuid("admin_id")
    .notNull()
    .references(() => platformAdmins.id, { onDelete: "cascade" }),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  reason: text("reason").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
});

export const platformSystemTemplates = pgTable(
  "platform_system_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull(),
    channel: notificationChannelEnum("channel").default("email").notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    variables: jsonb("variables").$type<string[]>().default([]).notNull(),
    active: boolean("active").default(true).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("platform_system_templates_key_channel_unique").on(table.key, table.channel)],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    role: userRoleEnum("role").notNull(),
    avatarUrl: text("avatar_url"),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_salon_email_unique").on(table.salonId, table.email),
  ],
);

export const userCredentials = pgTable("user_credentials", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  mustChangePassword: boolean("must_change_password").default(false).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const authSessions = pgTable("auth_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  ...timestamps,
});

export const salonLocations = pgTable(
  "salon_locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address"),
    phone: text("phone"),
    email: text("email"),
    timezone: text("timezone"),
    active: boolean("active").default(true).notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("salon_locations_salon_name_unique").on(table.salonId, table.name)],
);

export const salonResources = pgTable(
  "salon_resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").references(() => salonLocations.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    capacity: integer("capacity").default(1).notNull(),
    active: boolean("active").default(true).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("salon_resources_salon_name_unique").on(table.salonId, table.name)],
);

export const salonSettings = pgTable(
  "salon_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    settings: jsonb("settings").$type<Record<string, unknown>>().default({}).notNull(),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("salon_settings_salon_category_unique").on(table.salonId, table.category)],
);

export const calendarSettings = pgTable(
  "calendar_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    minSlotMinutes: integer("min_slot_minutes").default(15).notNull(),
    bufferMinutes: integer("buffer_minutes").default(0).notNull(),
    minBookingNoticeHours: integer("min_booking_notice_hours").default(2).notNull(),
    cancellationPolicyHours: integer("cancellation_policy_hours").default(24).notNull(),
    allowOverbooking: boolean("allow_overbooking").default(false).notNull(),
    overbookingLimit: integer("overbooking_limit").default(0).notNull(),
    defaultView: text("default_view").default("day").notNull(),
    enableResourceView: boolean("enable_resource_view").default(false).notNull(),
    printableFields: jsonb("printable_fields").$type<string[]>().default([]).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("calendar_settings_salon_unique").on(table.salonId)],
);

export const dataExchangeSettings = pgTable(
  "data_exchange_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    exportFormats: jsonb("export_formats").$type<string[]>().default(["csv"]).notNull(),
    importMapping: jsonb("import_mapping").$type<Record<string, string>>().default({}).notNull(),
    validationRules: jsonb("validation_rules").$type<Record<string, unknown>>().default({}).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("data_exchange_settings_salon_entity_unique").on(table.salonId, table.entityType)],
);

export const integrationSettings = pgTable(
  "integration_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    label: text("label").notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    config: jsonb("config").$type<Record<string, unknown>>().default({}).notNull(),
    secretRef: text("secret_ref"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("integration_settings_salon_provider_unique").on(table.salonId, table.provider)],
);

export const pwaBrandingSettings = pgTable(
  "pwa_branding_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    logoUrl: text("logo_url"),
    primaryColor: text("primary_color"),
    accentColor: text("accent_color"),
    heroTitle: text("hero_title"),
    heroSubtitle: text("hero_subtitle"),
    welcomeText: text("welcome_text"),
    bookingSuccessText: text("booking_success_text"),
    installPromptEnabled: boolean("install_prompt_enabled").default(true).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("pwa_branding_settings_salon_unique").on(table.salonId)],
);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  ...timestamps,
});

export const loginActivity = pgTable("login_activity", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id").references(() => salons.id, {
    onDelete: "cascade",
  }),
  userId: uuid("user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  email: text("email").notNull(),
  success: boolean("success").notNull(),
  failureReason: text("failure_reason"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  ...timestamps,
});

export const userPermissions = pgTable(
  "user_permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key").notNull(),
    granted: boolean("granted").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_permissions_user_key_unique").on(
      table.userId,
      table.permissionKey,
    ),
  ],
);

export const staff = pgTable("staff", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  specializations: text("specializations").array().default([]).notNull(),
  workingHours: jsonb("working_hours").$type<WorkingHours>().notNull(),
  color: text("color").notNull(),
  jobTitle: text("job_title"),
  phone: text("phone"),
  email: text("email"),
  locationId: uuid("location_id").references(() => salonLocations.id, {
    onDelete: "set null",
  }),
  active: boolean("active").default(true).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  ...timestamps,
});

export const serviceCategories = pgTable(
  "service_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    icon: text("icon").default("sparkles").notNull(),
    active: boolean("active").default(true).notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("service_categories_salon_name_unique").on(
      table.salonId,
      table.name,
    ),
  ],
);

export const services = pgTable("services", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  categoryId: uuid("category_id").references(() => serviceCategories.id, {
    onDelete: "set null",
  }),
  description: text("description"),
  durationMinutes: integer("duration_minutes").notNull(),
  priceCents: integer("price_cents").notNull(),
  onlineBookingEnabled: boolean("online_booking_enabled")
    .default(true)
    .notNull(),
  bufferBeforeMinutes: integer("buffer_before_minutes").default(0).notNull(),
  bufferAfterMinutes: integer("buffer_after_minutes").default(0).notNull(),
  color: text("color"),
  taxRateBasisPoints: integer("tax_rate_basis_points"),
  active: boolean("active").default(true).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  ...timestamps,
});

export const serviceStaff = pgTable(
  "service_staff",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("service_staff_service_staff_unique").on(
      table.serviceId,
      table.staffId,
    ),
  ],
);

export const serviceResources = pgTable(
  "service_resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => salonResources.id, { onDelete: "cascade" }),
    required: boolean("required").default(true).notNull(),
    quantity: integer("quantity").default(1).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("service_resources_service_resource_unique").on(
      table.serviceId,
      table.resourceId,
    ),
  ],
);

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  email: text("email"),
  phone: text("phone"),
  phoneNormalized: text("phone_normalized"),
  fullName: text("full_name").notNull(),
  notes: text("notes"),
  tags: text("tags").array().default([]).notNull(),
  blocked: boolean("blocked").default(false).notNull(),
  marketingEmailConsent: boolean("marketing_email_consent")
    .default(false)
    .notNull(),
  marketingSmsConsent: boolean("marketing_sms_consent")
    .default(false)
    .notNull(),
  marketingUnsubscribedAt: timestamp("marketing_unsubscribed_at", {
    withTimezone: true,
  }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  mergedIntoCustomerId: uuid("merged_into_customer_id").references(
    (): AnyPgColumn => customers.id,
    { onDelete: "set null" },
  ),
  anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  ...timestamps,
}, (table) => [
  index("customers_salon_phone_normalized_idx").on(table.salonId, table.phoneNormalized),
]);

export const communicationProviderAccounts = pgTable(
  "communication_provider_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    provider: communicationProviderEnum("provider").default("meta_cloud_api").notNull(),
    wabaId: text("waba_id").notNull(),
    phoneNumberId: text("phone_number_id").notNull(),
    displayPhoneNumber: text("display_phone_number"),
    businessPortfolioId: text("business_portfolio_id"),
    graphApiVersion: text("graph_api_version").default("v23.0").notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    status: communicationProviderStatusEnum("status").default("not_configured").notNull(),
    webhookKey: uuid("webhook_key").defaultRandom().notNull(),
    webhookSubscriptionStatus: text("webhook_subscription_status").default("not_subscribed").notNull(),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    lastHealthCheckAt: timestamp("last_health_check_at", { withTimezone: true }),
    lastWebhookAt: timestamp("last_webhook_at", { withTimezone: true }),
    lastErrorCode: text("last_error_code"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("communication_provider_accounts_salon_provider_unique").on(table.salonId, table.provider),
    uniqueIndex("communication_provider_accounts_waba_unique").on(table.wabaId),
    uniqueIndex("communication_provider_accounts_phone_unique").on(table.phoneNumberId),
    uniqueIndex("communication_provider_accounts_webhook_key_unique").on(table.webhookKey),
  ],
);

export const communicationProviderSecrets = pgTable(
  "communication_provider_secrets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => communicationProviderAccounts.id, { onDelete: "cascade" }),
    kind: communicationSecretKindEnum("kind").notNull(),
    ciphertext: text("ciphertext").notNull(),
    initializationVector: text("initialization_vector").notNull(),
    authenticationTag: text("authentication_tag").notNull(),
    keyVersion: text("key_version").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("communication_provider_secrets_account_kind_unique").on(table.accountId, table.kind),
    index("communication_provider_secrets_salon_account_idx").on(table.salonId, table.accountId),
  ],
);

export const communicationConsents = pgTable(
  "communication_consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    channel: communicationChannelEnum("channel").notNull(),
    purpose: communicationConsentPurposeEnum("purpose").notNull(),
    status: communicationConsentStatusEnum("status").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    capturedSource: text("captured_source").notNull(),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().default({}).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("communication_consents_scope_unique").on(
      table.salonId,
      table.customerId,
      table.channel,
      table.purpose,
    ),
    index("communication_consents_marketing_lookup_idx").on(table.salonId, table.channel, table.purpose, table.status),
  ],
);

export const communicationConversations = pgTable(
  "communication_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => communicationProviderAccounts.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    participantPhone: text("participant_phone").notNull(),
    status: communicationConversationStatusEnum("status").default("open").notNull(),
    assignedUserId: uuid("assigned_user_id").references(() => users.id, { onDelete: "set null" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
    lastMessagePreview: text("last_message_preview"),
    unreadCount: integer("unread_count").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("communication_conversations_account_participant_unique").on(table.accountId, table.participantPhone),
    index("communication_conversations_salon_activity_idx").on(table.salonId, table.lastMessageAt),
    check("communication_conversations_unread_non_negative", sql`${table.unreadCount} >= 0`),
  ],
);

export const communicationMessages = pgTable(
  "communication_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => communicationProviderAccounts.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => communicationConversations.id, { onDelete: "cascade" }),
    direction: communicationDirectionEnum("direction").notNull(),
    kind: communicationMessageKindEnum("kind").notNull(),
    body: text("body"),
    templateName: text("template_name"),
    templateLocale: text("template_locale"),
    templateParameters: jsonb("template_parameters").$type<Array<Record<string, unknown>>>().default([]).notNull(),
    providerMessageId: text("provider_message_id"),
    clientIdempotencyKey: text("client_idempotency_key"),
    sourceType: text("source_type"),
    sourceId: uuid("source_id"),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    status: communicationMessageStatusEnum("status").default("queued").notNull(),
    providerTimestamp: timestamp("provider_timestamp", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    failureCode: text("failure_code"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("communication_messages_provider_id_unique").on(table.accountId, table.providerMessageId),
    uniqueIndex("communication_messages_idempotency_unique").on(table.accountId, table.clientIdempotencyKey),
    index("communication_messages_conversation_created_idx").on(table.conversationId, table.createdAt),
  ],
);

export const communicationOutbox = pgTable(
  "communication_outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    messageId: uuid("message_id")
      .notNull()
      .references(() => communicationMessages.id, { onDelete: "cascade" }),
    status: communicationOutboxStatusEnum("status").default("pending").notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(5).notNull(),
    lastErrorCode: text("last_error_code"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("communication_outbox_message_unique").on(table.messageId),
    index("communication_outbox_claim_idx").on(table.status, table.availableAt, table.leaseExpiresAt),
    check("communication_outbox_attempts_non_negative", sql`${table.attempts} >= 0`),
    check("communication_outbox_max_attempts_positive", sql`${table.maxAttempts} > 0`),
    check("communication_outbox_attempts_bounded", sql`${table.attempts} <= ${table.maxAttempts}`),
  ],
);

export const communicationWebhookEvents = pgTable(
  "communication_webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => communicationProviderAccounts.id, { onDelete: "cascade" }),
    externalEventId: text("external_event_id").notNull(),
    eventType: text("event_type").notNull(),
    status: text("status").default("pending").notNull(),
    redactedPayload: jsonb("redacted_payload").$type<Record<string, unknown>>().default({}).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("communication_webhook_events_dedupe_unique").on(table.accountId, table.externalEventId),
    index("communication_webhook_events_pending_idx").on(table.status, table.createdAt),
  ],
);

export const communicationUserState = pgTable(
  "communication_user_state",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => communicationConversations.id, { onDelete: "cascade" }),
    lastReadMessageId: uuid("last_read_message_id").references(() => communicationMessages.id, { onDelete: "set null" }),
    muted: boolean("muted").default(false).notNull(),
    archived: boolean("archived").default(false).notNull(),
    draft: text("draft").default("").notNull(),
    selected: boolean("selected").default(false).notNull(),
    lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("communication_user_state_scope_unique").on(table.salonId, table.userId, table.conversationId),
    index("communication_user_state_selected_idx").on(table.salonId, table.userId, table.selected),
  ],
);

export const customerTags = pgTable(
  "customer_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("customer_tags_salon_name_unique").on(
      table.salonId,
      table.name,
    ),
  ],
);

export const appointments = pgTable("appointments", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
  staffId: uuid("staff_id")
    .notNull()
    .references(() => staff.id),
  serviceId: uuid("service_id")
    .notNull()
    .references(() => services.id),
  locationId: uuid("location_id").references(() => salonLocations.id, {
    onDelete: "set null",
  }),
  resourceId: uuid("resource_id").references(() => salonResources.id, {
    onDelete: "set null",
  }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  status: appointmentStatusEnum("status").notNull(),
  internalNotes: text("internal_notes"),
  source: appointmentSourceEnum("source").notNull(),
  paidExternally: boolean("paid_externally").default(false).notNull(),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelledByUserId: uuid("cancelled_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  cancellationReason: text("cancellation_reason"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  ...timestamps,
});

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id")
      .references(() => appointments.id, { onDelete: "set null" }),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    staffId: uuid("staff_id").references(() => staff.id, {
      onDelete: "set null",
    }),
    status: saleStatusEnum("status").default("open").notNull(),
    subtotalCents: integer("subtotal_cents").default(0).notNull(),
    discountCents: integer("discount_cents").default(0).notNull(),
    totalCents: integer("total_cents").default(0).notNull(),
    notes: text("notes"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedByUserId: uuid("closed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("sales_appointment_unique").on(table.appointmentId),
    check("sales_subtotal_non_negative", sql`${table.subtotalCents} >= 0`),
    check("sales_discount_non_negative", sql`${table.discountCents} >= 0`),
    check("sales_total_non_negative", sql`${table.totalCents} >= 0`),
  ],
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    itemType: saleItemTypeEnum("item_type").notNull(),
    serviceId: uuid("service_id").references(() => services.id, {
      onDelete: "set null",
    }),
    productId: uuid("product_id").references(() => inventoryProducts.id, {
      onDelete: "set null",
    }),
    staffId: uuid("staff_id").references(() => staff.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull(),
    quantity: integer("quantity").default(1).notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    discountCents: integer("discount_cents").default(0).notNull(),
    totalCents: integer("total_cents").notNull(),
    ...timestamps,
  },
  (table) => [
    check("sale_items_quantity_positive", sql`${table.quantity} > 0`),
    check("sale_items_unit_price_non_negative", sql`${table.unitPriceCents} >= 0`),
    check("sale_items_discount_non_negative", sql`${table.discountCents} >= 0`),
    check("sale_items_total_non_negative", sql`${table.totalCents} >= 0`),
  ],
);

export const salePayments = pgTable(
  "sale_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    method: paymentMethodEnum("method").notNull(),
    amountCents: integer("amount_cents").notNull(),
    reference: text("reference"),
    voucherId: uuid("voucher_id").references(
      (): AnyPgColumn => purchaseVouchers.id,
      {
      onDelete: "set null",
      },
    ),
    paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    check("sale_payments_amount_positive", sql`${table.amountCents} > 0`),
  ],
);

export const purchaseVouchers = pgTable(
  "purchase_vouchers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    purchaserCustomerId: uuid("purchaser_customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    issuedSaleId: uuid("issued_sale_id").references(() => sales.id, {
      onDelete: "set null",
    }),
    originalAmountCents: integer("original_amount_cents").notNull(),
    balanceCents: integer("balance_cents").notNull(),
    status: text("status").default("active").notNull(),
    message: text("message"),
    issuedByUserId: uuid("issued_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    exhaustedAt: timestamp("exhausted_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("purchase_vouchers_salon_code_unique").on(table.salonId, table.code),
    check("purchase_vouchers_original_positive", sql`${table.originalAmountCents} > 0`),
    check("purchase_vouchers_balance_non_negative", sql`${table.balanceCents} >= 0`),
  ],
);

export const purchaseVoucherMovements = pgTable("purchase_voucher_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  voucherId: uuid("voucher_id")
    .notNull()
    .references(() => purchaseVouchers.id, { onDelete: "cascade" }),
  saleId: uuid("sale_id").references(() => sales.id, { onDelete: "set null" }),
  deltaCents: integer("delta_cents").notNull(),
  balanceAfterCents: integer("balance_after_cents").notNull(),
  reason: text("reason").notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  ...timestamps,
});

export const appointmentNotes = pgTable("appointment_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  appointmentId: uuid("appointment_id")
    .notNull()
    .references(() => appointments.id, { onDelete: "cascade" }),
  authorUserId: uuid("author_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  body: text("body").notNull(),
  ...timestamps,
});

export const appointmentRescheduleRequests = pgTable("appointment_reschedule_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  appointmentId: uuid("appointment_id")
    .notNull()
    .references(() => appointments.id, { onDelete: "cascade" }),
  requestedStartsAt: timestamp("requested_starts_at", { withTimezone: true }).notNull(),
  reason: text("reason"),
  status: text("status").default("pending").notNull(),
  resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  ...timestamps,
});

export const availabilityBlocks = pgTable("availability_blocks", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  staffId: uuid("staff_id")
    .notNull()
    .references(() => staff.id, { onDelete: "cascade" }),
  locationId: uuid("location_id").references(() => salonLocations.id, {
    onDelete: "set null",
  }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  reason: text("reason"),
  recurring: boolean("recurring").default(false).notNull(),
  recurrenceRule: text("recurrence_rule"),
});

export const staffAvailabilityRequests = pgTable("staff_availability_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  staffId: uuid("staff_id")
    .notNull()
    .references(() => staff.id, { onDelete: "cascade" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  reason: text("reason"),
  status: staffRequestStatusEnum("status").default("pending").notNull(),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNote: text("review_note"),
  ...timestamps,
});

export const reminders = pgTable("reminders", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  appointmentId: uuid("appointment_id")
    .notNull()
    .references(() => appointments.id, { onDelete: "cascade" }),
  channel: reminderChannelEnum("channel").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  status: reminderStatusEnum("status").default("pending").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
});

export const reminderSettings = pgTable(
  "reminder_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    whatsappEnabled: boolean("whatsapp_enabled").default(false).notNull(),
    emailEnabled: boolean("email_enabled").default(true).notNull(),
    hoursBefore: jsonb("hours_before").$type<number[]>().default([24]).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("reminder_settings_salon_unique").on(table.salonId),
  ],
);

export const reviewInvitations = pgTable(
  "review_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash"),
    channel: reviewDeliveryChannelEnum("channel").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    deliveryStatus: reviewDeliveryStatusEnum("delivery_status")
      .default("pending")
      .notNull(),
    deliveryAttempts: integer("delivery_attempts").default(0).notNull(),
    deliveryGeneration: integer("delivery_generation").default(0).notNull(),
    deliveryClaimId: uuid("delivery_claim_id"),
    deliveryLeaseExpiresAt: timestamp("delivery_lease_expires_at", { withTimezone: true }),
    lastDeliveryAttemptAt: timestamp("last_delivery_attempt_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    deliveryFailure: text("delivery_failure"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("review_invitations_appointment_unique").on(table.appointmentId),
    uniqueIndex("review_invitations_token_hash_unique").on(table.tokenHash),
    index("review_invitations_recovery_idx").on(
      table.deliveryStatus,
      table.deliveryLeaseExpiresAt,
      table.expiresAt,
    ),
    check(
      "review_invitations_token_hash_format",
      sql`${table.tokenHash} is null or ${table.tokenHash} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "review_invitations_delivery_attempts_non_negative",
      sql`${table.deliveryAttempts} >= 0`,
    ),
    check(
      "review_invitations_delivery_generation_non_negative",
      sql`${table.deliveryGeneration} >= 0`,
    ),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    reply: text("reply"),
    published: boolean("published").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    check("reviews_rating_check", sql`${table.rating} between 1 and 5`),
    uniqueIndex("reviews_appointment_unique").on(table.appointmentId),
  ],
);

export const waitlistEntries = pgTable("waitlist_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id")
    .notNull()
    .references(() => services.id),
  staffId: uuid("staff_id").references(() => staff.id),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
  requestedDate: timestamp("requested_date", { withTimezone: true }).notNull(),
  status: waitlistStatusEnum("status").default("waiting").notNull(),
  ...timestamps,
});

export const activityLog = pgTable("activity_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  actorUserId: uuid("actor_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  action: text("action").notNull(),
  summary: text("summary").notNull(),
  diff: jsonb("diff").$type<Record<string, unknown>>().default({}).notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
  undoPayload: jsonb("undo_payload").$type<Record<string, unknown>>(),
  undoExpiresAt: timestamp("undo_expires_at", { withTimezone: true }),
  undoneAt: timestamp("undone_at", { withTimezone: true }),
  ...timestamps,
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    targetRole: userRoleEnum("target_role"),
    type: text("type").notNull(),
    category: text("category").default("general").notNull(),
    priority: notificationPriorityEnum("priority").default("normal").notNull(),
    channel: notificationChannelEnum("channel").default("in_app").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    readAt: timestamp("read_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("notifications_entity_role_type_unique").on(
      table.salonId,
      table.entityId,
      table.targetRole,
      table.type,
    ),
  ],
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    role: userRoleEnum("role").notNull(),
    category: text("category").notNull(),
    channel: notificationChannelEnum("channel").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    quietHours: jsonb("quiet_hours").$type<Record<string, unknown>>().default({}).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("notification_preferences_salon_role_category_channel_unique").on(
      table.salonId,
      table.role,
      table.category,
      table.channel,
    ),
  ],
);

export const salonClosures = pgTable(
  "salon_closures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    reason: text("reason"),
    recurringYearly: boolean("recurring_yearly").default(false).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("salon_closures_salon_date_unique").on(table.salonId, table.date)],
);

export const userInterfacePreferences = pgTable(
  "user_interface_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    navigationCollapsed: boolean("navigation_collapsed")
      .default(false)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("user_interface_preferences_user_salon_unique").on(
      table.userId,
      table.salonId,
    ),
  ],
);

export const savedViews = pgTable(
  "saved_views",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    name: text("name").notNull(),
    filters: jsonb("filters").$type<Record<string, unknown>>().default({}).notNull(),
    columns: jsonb("columns").$type<string[]>(),
    sort: jsonb("sort").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("saved_views_user_entity_name_unique").on(
      table.userId,
      table.entityType,
      table.name,
    ),
  ],
);

export const loyaltyAdjustmentReasons = pgTable(
  "loyalty_adjustment_reasons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    label: text("label").notNull(),
    requiresNote: boolean("requires_note").default(false).notNull(),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("loyalty_adjustment_reasons_salon_code_unique").on(
      table.salonId,
      table.code,
    ),
  ],
);

export const loyaltySettings = pgTable(
  "loyalty_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    pointsPerAppointment: integer("points_per_appointment")
      .default(10)
      .notNull(),
    pointsExpireAfterDays: integer("points_expire_after_days"),
    allowNegativeBalance: boolean("allow_negative_balance")
      .default(false)
      .notNull(),
    redemptionRequiresApproval: boolean("redemption_requires_approval")
      .default(true)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("loyalty_settings_salon_unique").on(table.salonId),
  ],
);

export const loyaltyTiers = pgTable(
  "loyalty_tiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    minPoints: integer("min_points").default(0).notNull(),
    benefits: jsonb("benefits").$type<Record<string, unknown>>().default({}).notNull(),
    active: boolean("active").default(true).notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("loyalty_tiers_salon_name_unique").on(
      table.salonId,
      table.name,
    ),
    uniqueIndex("loyalty_tiers_salon_threshold_unique").on(
      table.salonId,
      table.minPoints,
    ),
    check("loyalty_tiers_min_points_non_negative", sql`${table.minPoints} >= 0`),
  ],
);

export const loyaltyRewards = pgTable("loyalty_rewards", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  pointsRequired: integer("points_required").notNull(),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
});

export const loyaltyEarningRules = pgTable(
  "loyalty_earning_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    points: integer("points").default(0).notNull(),
    active: boolean("active").default(false).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("loyalty_earning_rules_salon_action_unique").on(
      table.salonId,
      table.action,
    ),
    check("loyalty_earning_rules_points_non_negative", sql`${table.points} >= 0`),
  ],
);

export const loyaltyRewardRedemptions = pgTable("loyalty_reward_redemptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  rewardId: uuid("reward_id")
    .notNull()
    .references(() => loyaltyRewards.id, { onDelete: "restrict" }),
  pointsSpent: integer("points_spent").notNull(),
  idempotencyKey: text("idempotency_key"),
  status: text("status").default("pending").notNull(),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
  notes: text("notes"),
  ...timestamps,
}, (table) => [
  uniqueIndex("loyalty_redemptions_salon_idempotency_unique").on(
    table.salonId,
    table.idempotencyKey,
  ),
  check("loyalty_redemptions_points_positive", sql`${table.pointsSpent} > 0`),
]);
export const loyaltyPoints = pgTable(
  "loyalty_points",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    appointmentId: uuid("appointment_id").references(() => appointments.id, {
      onDelete: "set null",
    }),
    saleId: uuid("sale_id").references(() => sales.id, {
      onDelete: "set null",
    }),
    ruleKey: text("rule_key"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    adjustmentReasonId: uuid("adjustment_reason_id").references(
      () => loyaltyAdjustmentReasons.id,
      { onDelete: "set null" },
    ),
    redemptionId: uuid("redemption_id").references(
      () => loyaltyRewardRedemptions.id,
      { onDelete: "set null" },
    ),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("loyalty_points_appointment_unique").on(table.appointmentId),
    uniqueIndex("loyalty_points_sale_rule_unique").on(table.saleId, table.ruleKey),
    uniqueIndex("loyalty_points_redemption_unique").on(table.redemptionId),
  ],
);

export const campaignTemplates = pgTable("campaign_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  channel: campaignChannelEnum("channel").notNull(),
  content: text("content").notNull(),
  variables: jsonb("variables").$type<string[]>().default([]).notNull(),
  whatsappTemplateName: text("whatsapp_template_name"),
  whatsappTemplateLocale: text("whatsapp_template_locale"),
  whatsappApprovalStatus: whatsappTemplateApprovalStatusEnum("whatsapp_approval_status"),
  whatsappApprovalSource: text("whatsapp_approval_source"),
  whatsappApprovedAt: timestamp("whatsapp_approved_at", { withTimezone: true }),
  active: boolean("active").default(true).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  ...timestamps,
});

export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  templateId: uuid("template_id").references(() => campaignTemplates.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  channel: campaignChannelEnum("channel").notNull(),
  targetSegment: jsonb("target_segment")
    .$type<Record<string, unknown>>()
    .notNull(),
  content: text("content").notNull(),
  whatsappTemplateName: text("whatsapp_template_name"),
  whatsappTemplateLocale: text("whatsapp_template_locale"),
  whatsappTemplateParameters: jsonb("whatsapp_template_parameters").$type<string[]>().default([]).notNull(),
  whatsappTemplateApprovalStatus: whatsappTemplateApprovalStatusEnum("whatsapp_template_approval_status"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  processingStartedAt: timestamp("processing_started_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  recipientPreview: jsonb("recipient_preview")
    .$type<Array<Record<string, unknown>>>()
    .default([])
    .notNull(),
  status: campaignStatusEnum("status").default("draft").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  ...timestamps,
});

export const campaignRecipients = pgTable(
  "campaign_recipients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => marketingCampaigns.id, { onDelete: "cascade" }),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    destination: text("destination").notNull(),
    status: text("status").default("pending").notNull(),
    providerName: text("provider_name"),
    providerMessageId: text("provider_message_id"),
    deliveryAttempts: integer("delivery_attempts").default(0).notNull(),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    error: text("error"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("campaign_recipients_campaign_destination_unique").on(
      table.campaignId,
      table.destination,
    ),
    index("campaign_recipients_campaign_status_idx").on(
      table.campaignId,
      table.status,
    ),
    check(
      "campaign_recipients_delivery_attempts_non_negative",
      sql`${table.deliveryAttempts} >= 0`,
    ),
    check(
      "campaign_recipients_status_valid",
      sql`${table.status} in ('pending', 'queued', 'processing', 'sent', 'failed', 'cancelled')`,
    ),
  ],
);

export const WAREHOUSE_DOCUMENT_KINDS = [
  "opening",
  "purchase",
  "supplier_invoice",
  "internal_use",
  "waste",
  "supplier_return",
  "adjustment",
  "count",
  "credit_note",
  "equipment_purchase",
  "expense",
] as const;

export const WAREHOUSE_DOCUMENT_STATUSES = [
  "draft",
  "posted",
  "cancelled",
  "reversed",
] as const;

export const inventorySuppliers = pgTable(
  "inventory_suppliers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    vatNumber: text("vat_number"),
    taxCode: text("tax_code"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    city: text("city"),
    postalCode: text("postal_code"),
    country: text("country"),
    paymentTerms: text("payment_terms"),
    notes: text("notes"),
    active: boolean("active").default(true).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("inventory_suppliers_salon_name_unique").on(table.salonId, table.name),
    index("inventory_suppliers_salon_active_idx").on(table.salonId, table.active),
  ],
);

export const inventoryProducts = pgTable("inventory_products", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category"),
  sku: text("sku"),
  barcode: text("barcode"),
  stockQuantity: integer("stock_quantity").default(0).notNull(),
  lowStockThreshold: integer("low_stock_threshold").default(0).notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  costCents: integer("cost_cents"),
  reorderQuantity: integer("reorder_quantity").default(0).notNull(),
  supplier: text("supplier"),
  preferredSupplier: text("preferred_supplier"),
  itemType: text("item_type").default("resale").notNull(),
  unit: text("unit").default("pz").notNull(),
  unitScale: integer("unit_scale").default(1).notNull(),
  trackStock: boolean("track_stock").default(true).notNull(),
  sellable: boolean("sellable").default(true).notNull(),
  internallyConsumable: boolean("internally_consumable").default(false).notNull(),
  averageCostCents: integer("average_cost_cents").default(0).notNull(),
  lastCostCents: integer("last_cost_cents").default(0).notNull(),
  preferredSupplierId: uuid("preferred_supplier_id").references(
    () => inventorySuppliers.id,
    { onDelete: "set null" },
  ),
  allowNegativeStock: boolean("allow_negative_stock").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  uniqueIndex("inventory_products_id_salon_unique").on(table.id, table.salonId),
  foreignKey({
    columns: [table.preferredSupplierId, table.salonId],
    foreignColumns: [inventorySuppliers.id, inventorySuppliers.salonId],
    name: "inventory_products_preferred_supplier_salon_id_fk",
  }),
  check("inventory_products_item_type_valid", sql`${table.itemType} in ('resale', 'consumable', 'equipment', 'expense')`),
  check("inventory_products_unit_scale_positive", sql`${table.unitScale} > 0`),
]);

export const inventoryReorderRequests = pgTable("inventory_reorder_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => inventoryProducts.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  status: text("status").default("open").notNull(),
  supplier: text("supplier"),
  notes: text("notes"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  ...timestamps,
});

export const inventoryDocuments = pgTable(
  "inventory_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    internalNumber: text("internal_number").notNull(),
    kind: text("kind").notNull(),
    status: text("status").default("draft").notNull(),
    supplierId: uuid("supplier_id").references(() => inventorySuppliers.id, {
      onDelete: "set null",
    }),
    externalReference: text("external_reference"),
    documentDate: timestamp("document_date", { withTimezone: true }).defaultNow().notNull(),
    competenceDate: timestamp("competence_date", { withTimezone: true }),
    notes: text("notes"),
    attachmentUrl: text("attachment_url"),
    netTotalCents: integer("net_total_cents").default(0).notNull(),
    taxTotalCents: integer("tax_total_cents").default(0).notNull(),
    totalCents: integer("total_cents").default(0).notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    postedByUserId: uuid("posted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    reversalOfDocumentId: uuid("reversal_of_document_id").references(
      (): AnyPgColumn => inventoryDocuments.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("inventory_documents_salon_internal_number_unique").on(
      table.salonId,
      table.internalNumber,
    ),
    uniqueIndex("inventory_documents_id_salon_unique").on(table.id, table.salonId),
    index("inventory_documents_salon_status_date_idx").on(
      table.salonId,
      table.status,
      table.documentDate,
    ),
    check(
      "inventory_documents_kind_valid",
      sql`${table.kind} in ('opening', 'purchase', 'supplier_invoice', 'internal_use', 'waste', 'supplier_return', 'adjustment', 'count', 'credit_note', 'equipment_purchase', 'expense')`,
    ),
    check(
      "inventory_documents_status_valid",
      sql`${table.status} in ('draft', 'posted', 'cancelled', 'reversed')`,
    ),
    check("inventory_documents_net_total_non_negative", sql`${table.netTotalCents} >= 0`),
    check("inventory_documents_tax_total_non_negative", sql`${table.taxTotalCents} >= 0`),
    check("inventory_documents_total_non_negative", sql`${table.totalCents} >= 0`),
    foreignKey({
      columns: [table.supplierId, table.salonId],
      foreignColumns: [inventorySuppliers.id, inventorySuppliers.salonId],
      name: "inventory_documents_supplier_salon_id_fk",
    }),
    foreignKey({
      columns: [table.reversalOfDocumentId, table.salonId],
      foreignColumns: [table.id, table.salonId],
      name: "inventory_documents_reversal_salon_id_fk",
    }),
  ],
);

export const inventoryDocumentLines = pgTable(
  "inventory_document_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => inventoryDocuments.id, { onDelete: "restrict" }),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => inventoryProducts.id, {
      onDelete: "set null",
    }),
    supplierId: uuid("supplier_id").references(() => inventorySuppliers.id, {
      onDelete: "set null",
    }),
    lineNumber: integer("line_number").notNull(),
    description: text("description").notNull(),
    itemType: text("item_type").default("resale").notNull(),
    quantity: integer("quantity").notNull(),
    unit: text("unit").default("pz").notNull(),
    unitScale: integer("unit_scale").default(1).notNull(),
    stockDelta: integer("stock_delta").default(0).notNull(),
    unitCostCents: integer("unit_cost_cents").default(0).notNull(),
    discountCents: integer("discount_cents").default(0).notNull(),
    taxRateBasisPoints: integer("tax_rate_basis_points").default(0).notNull(),
    netCents: integer("net_cents").default(0).notNull(),
    taxCents: integer("tax_cents").default(0).notNull(),
    totalCents: integer("total_cents").default(0).notNull(),
    destination: text("destination"),
    note: text("note"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("inventory_document_lines_document_line_unique").on(
      table.documentId,
      table.lineNumber,
    ),
    uniqueIndex("inventory_document_lines_id_salon_unique").on(table.id, table.salonId),
    index("inventory_document_lines_product_idx").on(table.productId),
    check("inventory_document_lines_item_type_valid", sql`${table.itemType} in ('resale', 'consumable', 'equipment', 'expense')`),
    check("inventory_document_lines_unit_scale_positive", sql`${table.unitScale} > 0`),
    check("inventory_document_lines_unit_cost_non_negative", sql`${table.unitCostCents} >= 0`),
    check("inventory_document_lines_discount_non_negative", sql`${table.discountCents} >= 0`),
    check("inventory_document_lines_net_non_negative", sql`${table.netCents} >= 0`),
    check("inventory_document_lines_tax_non_negative", sql`${table.taxCents} >= 0`),
    check("inventory_document_lines_total_non_negative", sql`${table.totalCents} >= 0`),
    foreignKey({
      columns: [table.documentId, table.salonId],
      foreignColumns: [inventoryDocuments.id, inventoryDocuments.salonId],
      name: "inventory_document_lines_document_salon_id_fk",
    }),
    foreignKey({
      columns: [table.productId, table.salonId],
      foreignColumns: [inventoryProducts.id, inventoryProducts.salonId],
      name: "inventory_document_lines_product_salon_id_fk",
    }),
    foreignKey({
      columns: [table.supplierId, table.salonId],
      foreignColumns: [inventorySuppliers.id, inventorySuppliers.salonId],
      name: "inventory_document_lines_supplier_salon_id_fk",
    }),
  ],
);

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => inventoryProducts.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  appointmentId: uuid("appointment_id").references(() => appointments.id, {
    onDelete: "set null",
  }),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  stockAfter: integer("stock_after"),
  documentId: uuid("document_id").references(() => inventoryDocuments.id, {
    onDelete: "set null",
  }),
  documentLineId: uuid("document_line_id").references(() => inventoryDocumentLines.id, {
    onDelete: "set null",
  }),
  movementType: text("movement_type"),
  stockBefore: integer("stock_before"),
  unitCostCents: integer("unit_cost_cents"),
  valueCents: integer("value_cents"),
  reversesMovementId: uuid("reverses_movement_id").references(
    (): AnyPgColumn => inventoryMovements.id,
    { onDelete: "set null" },
  ),
  note: text("note"),
  ...timestamps,
  },
  (table) => [
    uniqueIndex("inventory_movements_id_salon_unique").on(table.id, table.salonId),
    index("inventory_movements_salon_product_date_idx").on(table.salonId, table.productId, table.createdAt),
    foreignKey({
      columns: [table.documentId, table.salonId],
      foreignColumns: [inventoryDocuments.id, inventoryDocuments.salonId],
      name: "inventory_movements_document_salon_id_fk",
    }),
    foreignKey({
      columns: [table.documentLineId, table.salonId],
      foreignColumns: [inventoryDocumentLines.id, inventoryDocumentLines.salonId],
      name: "inventory_movements_document_line_salon_id_fk",
    }),
    foreignKey({
      columns: [table.reversesMovementId, table.salonId],
      foreignColumns: [table.id, table.salonId],
      name: "inventory_movements_reversal_salon_id_fk",
    }),
  ],
);

export const inventoryCounts = pgTable(
  "inventory_counts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => inventoryDocuments.id, {
      onDelete: "set null",
    }),
    status: text("status").default("draft").notNull(),
    category: text("category"),
    openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    postedByUserId: uuid("posted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("inventory_counts_salon_status_date_idx").on(table.salonId, table.status, table.openedAt),
    uniqueIndex("inventory_counts_id_salon_unique").on(table.id, table.salonId),
    check("inventory_counts_status_valid", sql`${table.status} in ('draft', 'counting', 'posted', 'cancelled')`),
    foreignKey({
      columns: [table.documentId, table.salonId],
      foreignColumns: [inventoryDocuments.id, inventoryDocuments.salonId],
      name: "inventory_counts_document_salon_id_fk",
    }),
  ],
);

export const inventoryCountLines = pgTable(
  "inventory_count_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    countId: uuid("count_id")
      .notNull()
      .references(() => inventoryCounts.id, { onDelete: "restrict" }),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => inventoryProducts.id, { onDelete: "restrict" }),
    theoreticalQuantity: integer("theoretical_quantity").notNull(),
    countedQuantity: integer("counted_quantity"),
    differenceQuantity: integer("difference_quantity"),
    differenceValueCents: integer("difference_value_cents").default(0).notNull(),
    note: text("note"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("inventory_count_lines_count_product_unique").on(table.countId, table.productId),
    uniqueIndex("inventory_count_lines_id_salon_unique").on(table.id, table.salonId),
    index("inventory_count_lines_product_idx").on(table.productId),
    foreignKey({
      columns: [table.countId, table.salonId],
      foreignColumns: [inventoryCounts.id, inventoryCounts.salonId],
      name: "inventory_count_lines_count_salon_id_fk",
    }),
    foreignKey({
      columns: [table.productId, table.salonId],
      foreignColumns: [inventoryProducts.id, inventoryProducts.salonId],
      name: "inventory_count_lines_product_salon_id_fk",
    }),
  ],
);

export const inventoryExpenses = pgTable(
  "inventory_expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => inventoryDocuments.id, { onDelete: "restrict" }),
    documentLineId: uuid("document_line_id").references(() => inventoryDocumentLines.id, {
      onDelete: "set null",
    }),
    supplierId: uuid("supplier_id").references(() => inventorySuppliers.id, {
      onDelete: "set null",
    }),
    category: text("category").notNull(),
    competenceDate: timestamp("competence_date", { withTimezone: true }).notNull(),
    description: text("description").notNull(),
    netCents: integer("net_cents").default(0).notNull(),
    taxCents: integer("tax_cents").default(0).notNull(),
    totalCents: integer("total_cents").default(0).notNull(),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("inventory_expenses_salon_competence_date_idx").on(table.salonId, table.competenceDate),
    check("inventory_expenses_net_non_negative", sql`${table.netCents} >= 0`),
    check("inventory_expenses_tax_non_negative", sql`${table.taxCents} >= 0`),
    check("inventory_expenses_total_non_negative", sql`${table.totalCents} >= 0`),
    foreignKey({
      columns: [table.documentId, table.salonId],
      foreignColumns: [inventoryDocuments.id, inventoryDocuments.salonId],
      name: "inventory_expenses_document_salon_id_fk",
    }),
    foreignKey({
      columns: [table.documentLineId, table.salonId],
      foreignColumns: [inventoryDocumentLines.id, inventoryDocumentLines.salonId],
      name: "inventory_expenses_document_line_salon_id_fk",
    }),
    foreignKey({
      columns: [table.supplierId, table.salonId],
      foreignColumns: [inventorySuppliers.id, inventorySuppliers.salonId],
      name: "inventory_expenses_supplier_salon_id_fk",
    }),
  ],
);

export const inventoryAssets = pgTable(
  "inventory_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => inventoryDocuments.id, { onDelete: "restrict" }),
    documentLineId: uuid("document_line_id").references(() => inventoryDocumentLines.id, {
      onDelete: "set null",
    }),
    supplierId: uuid("supplier_id").references(() => inventorySuppliers.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull(),
    serialNumber: text("serial_number"),
    purchaseDate: timestamp("purchase_date", { withTimezone: true }).notNull(),
    purchaseCostCents: integer("purchase_cost_cents").default(0).notNull(),
    warrantyExpiresAt: timestamp("warranty_expires_at", { withTimezone: true }),
    status: text("status").default("active").notNull(),
    disposedAt: timestamp("disposed_at", { withTimezone: true }),
    disposalNotes: text("disposal_notes"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("inventory_assets_salon_purchase_date_idx").on(table.salonId, table.purchaseDate),
    check("inventory_assets_status_valid", sql`${table.status} in ('active', 'disposed')`),
    check("inventory_assets_purchase_cost_non_negative", sql`${table.purchaseCostCents} >= 0`),
    foreignKey({
      columns: [table.documentId, table.salonId],
      foreignColumns: [inventoryDocuments.id, inventoryDocuments.salonId],
      name: "inventory_assets_document_salon_id_fk",
    }),
    foreignKey({
      columns: [table.documentLineId, table.salonId],
      foreignColumns: [inventoryDocumentLines.id, inventoryDocumentLines.salonId],
      name: "inventory_assets_document_line_salon_id_fk",
    }),
    foreignKey({
      columns: [table.supplierId, table.salonId],
      foreignColumns: [inventorySuppliers.id, inventorySuppliers.salonId],
      name: "inventory_assets_supplier_salon_id_fk",
    }),
  ],
);

export const consentTemplates = pgTable(
  "consent_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    version: integer("version").default(1).notNull(),
    body: text("body").notNull(),
    requiredForServices: jsonb("required_for_services").$type<string[]>().default([]).notNull(),
    active: boolean("active").default(true).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("consent_templates_salon_name_version_unique").on(
      table.salonId,
      table.name,
      table.version,
    ),
  ],
);

export const customerConsents = pgTable(
  "customer_consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id").references(() => appointments.id, {
      onDelete: "set null",
    }),
    templateId: uuid("template_id")
      .notNull()
      .references(() => consentTemplates.id, { onDelete: "restrict" }),
    status: consentSignatureStatusEnum("status").default("pending").notNull(),
    tokenHash: text("token_hash"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    deliveryChannel: consentDeliveryChannelEnum("delivery_channel"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    signerName: text("signer_name"),
    documentHash: text("document_hash"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByUserId: uuid("revoked_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    revocationReason: text("revocation_reason"),
    signatureData: jsonb("signature_data").$type<Record<string, unknown>>().default({}).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("customer_consents_customer_template_appointment_unique").on(
      table.customerId,
      table.templateId,
      table.appointmentId,
    ),
    uniqueIndex("customer_consents_salon_token_hash_unique").on(
      table.salonId,
      table.tokenHash,
    ),
    check(
      "customer_consents_token_hash_format",
      sql`${table.tokenHash} is null or ${table.tokenHash} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "customer_consents_document_hash_format",
      sql`${table.documentHash} is null or ${table.documentHash} ~ '^[a-f0-9]{64}$'`,
    ),
  ],
);

export const servicePackages = pgTable(
  "service_packages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    serviceId: uuid("service_id").references(() => services.id, {
      onDelete: "set null",
    }),
    includedSessions: integer("included_sessions").notNull(),
    priceCents: integer("price_cents").default(0).notNull(),
    validityDays: integer("validity_days"),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("service_packages_salon_name_unique").on(table.salonId, table.name)],
);

export const servicePackageItems = pgTable(
  "service_package_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    packageId: uuid("package_id")
      .notNull()
      .references(() => servicePackages.id, { onDelete: "cascade" }),
    itemType: saleItemTypeEnum("item_type").notNull(),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "restrict" }),
    productId: uuid("product_id").references(() => inventoryProducts.id, { onDelete: "restrict" }),
    quantity: integer("quantity").default(1).notNull(),
    ...timestamps,
  },
  (table) => [
    check("service_package_items_quantity_positive", sql`${table.quantity} > 0`),
  ],
);

export const customerServicePackages = pgTable("customer_service_packages", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  packageId: uuid("package_id")
    .notNull()
    .references(() => servicePackages.id, { onDelete: "restrict" }),
  totalSessions: integer("total_sessions").notNull(),
  usedSessions: integer("used_sessions").default(0).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  active: boolean("active").default(true).notNull(),
  notes: text("notes"),
  purchaseSaleId: uuid("purchase_sale_id").references(() => sales.id, {
    onDelete: "set null",
  }),
  ...timestamps,
});

export const customerPackageItemBalances = pgTable(
  "customer_package_item_balances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    customerPackageId: uuid("customer_package_id")
      .notNull()
      .references(() => customerServicePackages.id, { onDelete: "cascade" }),
    packageItemId: uuid("package_item_id")
      .notNull()
      .references(() => servicePackageItems.id, { onDelete: "restrict" }),
    totalQuantity: integer("total_quantity").notNull(),
    usedQuantity: integer("used_quantity").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("customer_package_item_balances_package_item_unique").on(
      table.customerPackageId,
      table.packageItemId,
    ),
    check("customer_package_item_balances_total_positive", sql`${table.totalQuantity} > 0`),
    check("customer_package_item_balances_used_non_negative", sql`${table.usedQuantity} >= 0`),
  ],
);

export const servicePackageUsages = pgTable("service_package_usages", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  customerPackageId: uuid("customer_package_id")
    .notNull()
    .references(() => customerServicePackages.id, { onDelete: "cascade" }),
  appointmentId: uuid("appointment_id").references(() => appointments.id, {
    onDelete: "set null",
  }),
  saleId: uuid("sale_id").references(() => sales.id, { onDelete: "set null" }),
  saleItemId: uuid("sale_item_id").references(() => saleItems.id, { onDelete: "set null" }),
  packageItemId: uuid("package_item_id").references(() => servicePackageItems.id, {
    onDelete: "restrict",
  }),
  quantityUsed: integer("quantity_used").default(1).notNull(),
  sessionsUsed: integer("sessions_used").default(1).notNull(),
  note: text("note"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  ...timestamps,
});
