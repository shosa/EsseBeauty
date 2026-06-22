import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  doublePrecision,
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
export const reminderChannelEnum = pgEnum("reminder_channel", ["sms", "email"]);
export const reminderStatusEnum = pgEnum("reminder_status", [
  "pending",
  "sent",
  "failed",
]);
export const waitlistStatusEnum = pgEnum("waitlist_status", [
  "waiting",
  "notified",
  "booked",
  "expired",
]);
export const campaignChannelEnum = pgEnum("campaign_channel", ["email", "sms"]);
export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "scheduled",
  "sent",
  "failed",
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
  "sms",
  "push",
]);
export const consentSignatureStatusEnum = pgEnum("consent_signature_status", [
  "pending",
  "signed",
  "revoked",
  "expired",
]);
export const staffRequestStatusEnum = pgEnum("staff_request_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

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
    defaultView: text("default_view").default("week").notNull(),
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
});

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
    smsEnabled: boolean("sms_enabled").default(false).notNull(),
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
  status: text("status").default("pending").notNull(),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
  notes: text("notes"),
  ...timestamps,
});

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
    ...timestamps,
  },
  (table) => [
    uniqueIndex("loyalty_points_appointment_unique").on(table.appointmentId),
    uniqueIndex("loyalty_points_sale_rule_unique").on(table.saleId, table.ruleKey),
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
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
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
    sentAt: timestamp("sent_at", { withTimezone: true }),
    error: text("error"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("campaign_recipients_campaign_destination_unique").on(
      table.campaignId,
      table.destination,
    ),
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
  allowNegativeStock: boolean("allow_negative_stock").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

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

export const inventoryMovements = pgTable("inventory_movements", {
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
  note: text("note"),
  ...timestamps,
});

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
    signedAt: timestamp("signed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
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
