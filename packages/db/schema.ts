import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
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
  phone: text("phone"),
  email: text("email"),
  brandColor: text("brand_color"),
  bookingPolicyText: text("booking_policy_text"),
  cancellationPolicyText: text("cancellation_policy_text"),
  planId: uuid("plan_id"),
  active: boolean("active").default(true).notNull(),
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
  active: boolean("active").default(true).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  ...timestamps,
});

export const services = pgTable("services", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
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
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  status: appointmentStatusEnum("status").notNull(),
  internalNotes: text("internal_notes"),
  source: appointmentSourceEnum("source").notNull(),
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

export const availabilityBlocks = pgTable("availability_blocks", {
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
  recurring: boolean("recurring").default(false).notNull(),
  recurrenceRule: text("recurrence_rule"),
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

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  targetRole: userRoleEnum("target_role"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  readAt: timestamp("read_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
});

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
