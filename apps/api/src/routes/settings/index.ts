import type { FastifyInstance } from "fastify";
import { and, asc, eq } from "drizzle-orm";

import {
  calendarSettings,
  dataExchangeSettings,
  integrationSettings,
  notificationPreferences,
  pwaBrandingSettings,
  salonLocations,
  salonResources,
  salons,
  salonSettings,
  type WorkingHours,
} from "@esse-beauty/db/schema";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { authenticate, requirePermission } from "../../middleware/auth.js";

export async function registerSettingsRoutes(app: FastifyInstance) {
  function assertSalon(request: { params: { id: string }; salonId: string }, reply: { code(statusCode: number): { send(payload: unknown): unknown } }) {
    if (request.params.id !== request.salonId) {
      return reply.code(403).send({ error: "FORBIDDEN" });
    }
    return undefined;
  }

  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/settings",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_SALON),
      ],
    },
    async (request, reply) => {
      const denied = assertSalon(request, reply);
      if (denied) return denied;
      const rows = await app.db
        .select()
        .from(salons)
        .where(eq(salons.id, request.salonId));
      return rows[0] ?? reply.code(404).send({ error: "SALON_NOT_FOUND" });
    },
  );

  app.patch<{
    Params: { id: string };
    Body: Partial<{
      name: string;
      timezone: string;
      locale: string;
      opening_hours: WorkingHours;
      cancellation_policy_hours: number;
      online_booking_enabled: boolean;
    }>;
  }>(
    "/api/salons/:id/settings",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_SALON),
      ],
    },
    async (request, reply) => {
      const denied = assertSalon(request, reply);
      if (denied) return denied;
      const rows = await app.db
        .update(salons)
        .set({
          ...(request.body.name !== undefined && { name: request.body.name }),
          ...(request.body.timezone !== undefined && {
            timezone: request.body.timezone,
          }),
          ...(request.body.locale !== undefined && {
            locale: request.body.locale,
          }),
          ...(request.body.opening_hours !== undefined && {
            openingHours: request.body.opening_hours,
          }),
          ...(request.body.cancellation_policy_hours !== undefined && {
            cancellationPolicyHours:
              request.body.cancellation_policy_hours,
          }),
          ...(request.body.online_booking_enabled !== undefined && {
            onlineBookingEnabled: request.body.online_booking_enabled,
          }),
        })
        .where(eq(salons.id, request.salonId))
        .returning();
      return rows[0];
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/settings/control-center",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_SALON),
      ],
    },
    async (request, reply) => {
      const denied = assertSalon(request, reply);
      if (denied) return denied;
      const [
        categories,
        calendar,
        notificationRows,
        exchangeRows,
        integrationRows,
        brandingRows,
        locationRows,
        resourceRows,
      ] = await Promise.all([
        app.db.select().from(salonSettings).where(eq(salonSettings.salonId, request.salonId)),
        app.db.select().from(calendarSettings).where(eq(calendarSettings.salonId, request.salonId)),
        app.db.select().from(notificationPreferences).where(eq(notificationPreferences.salonId, request.salonId)),
        app.db.select().from(dataExchangeSettings).where(eq(dataExchangeSettings.salonId, request.salonId)),
        app.db.select().from(integrationSettings).where(eq(integrationSettings.salonId, request.salonId)),
        app.db.select().from(pwaBrandingSettings).where(eq(pwaBrandingSettings.salonId, request.salonId)),
        app.db.select().from(salonLocations).where(eq(salonLocations.salonId, request.salonId)).orderBy(asc(salonLocations.displayOrder), asc(salonLocations.name)),
        app.db.select().from(salonResources).where(eq(salonResources.salonId, request.salonId)).orderBy(asc(salonResources.name)),
      ]);

      return {
        branding: brandingRows[0] ?? null,
        calendar: calendar[0] ?? null,
        categories,
        data_exchange: exchangeRows,
        integrations: integrationRows,
        locations: locationRows,
        notification_preferences: notificationRows,
        resources: resourceRows,
      };
    },
  );

  app.patch<{
    Body: { settings: Record<string, unknown> };
    Params: { category: string; id: string };
  }>(
    "/api/salons/:id/settings/categories/:category",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_SALON),
      ],
    },
    async (request, reply) => {
      const denied = assertSalon(request, reply);
      if (denied) return denied;
      const rows = await app.db
        .insert(salonSettings)
        .values({
          category: request.params.category,
          salonId: request.salonId,
          settings: request.body.settings ?? {},
          updatedByUserId: request.user.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          set: {
            settings: request.body.settings ?? {},
            updatedByUserId: request.user.id,
            updatedAt: new Date(),
          },
          target: [salonSettings.salonId, salonSettings.category],
        })
        .returning();
      return rows[0];
    },
  );

  app.patch<{
    Body: Partial<{
      allow_overbooking: boolean;
      buffer_minutes: number;
      cancellation_policy_hours: number;
      default_view: string;
      enable_resource_view: boolean;
      min_booking_notice_hours: number;
      min_slot_minutes: number;
      overbooking_limit: number;
      printable_fields: string[];
    }>;
    Params: { id: string };
  }>(
    "/api/salons/:id/settings/calendar",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_SALON),
      ],
    },
    async (request, reply) => {
      const denied = assertSalon(request, reply);
      if (denied) return denied;
      const values = {
        ...(request.body.allow_overbooking !== undefined && { allowOverbooking: request.body.allow_overbooking }),
        ...(request.body.buffer_minutes !== undefined && { bufferMinutes: request.body.buffer_minutes }),
        ...(request.body.cancellation_policy_hours !== undefined && { cancellationPolicyHours: request.body.cancellation_policy_hours }),
        ...(request.body.default_view !== undefined && { defaultView: request.body.default_view }),
        ...(request.body.enable_resource_view !== undefined && { enableResourceView: request.body.enable_resource_view }),
        ...(request.body.min_booking_notice_hours !== undefined && { minBookingNoticeHours: request.body.min_booking_notice_hours }),
        ...(request.body.min_slot_minutes !== undefined && { minSlotMinutes: request.body.min_slot_minutes }),
        ...(request.body.overbooking_limit !== undefined && { overbookingLimit: request.body.overbooking_limit }),
        ...(request.body.printable_fields !== undefined && { printableFields: request.body.printable_fields }),
        updatedAt: new Date(),
      };
      const rows = await app.db
        .insert(calendarSettings)
        .values({ salonId: request.salonId, ...values })
        .onConflictDoUpdate({
          set: values,
          target: calendarSettings.salonId,
        })
        .returning();
      return rows[0];
    },
  );

  app.put<{
    Body: {
      category: string;
      channel: "in_app" | "email" | "sms" | "push";
      enabled: boolean;
      quiet_hours?: Record<string, unknown>;
      role: "owner" | "manager" | "receptionist" | "employee";
    };
    Params: { id: string };
  }>(
    "/api/salons/:id/settings/notification-preferences",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_USERS),
      ],
    },
    async (request, reply) => {
      const denied = assertSalon(request, reply);
      if (denied) return denied;
      const rows = await app.db
        .insert(notificationPreferences)
        .values({
          category: request.body.category,
          channel: request.body.channel,
          enabled: request.body.enabled,
          quietHours: request.body.quiet_hours ?? {},
          role: request.body.role,
          salonId: request.salonId,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          set: {
            enabled: request.body.enabled,
            quietHours: request.body.quiet_hours ?? {},
            updatedAt: new Date(),
          },
          target: [
            notificationPreferences.salonId,
            notificationPreferences.role,
            notificationPreferences.category,
            notificationPreferences.channel,
          ],
        })
        .returning();
      return rows[0];
    },
  );

  app.put<{
    Body: {
      entity_type: string;
      export_formats: string[];
      import_mapping?: Record<string, string>;
      validation_rules?: Record<string, unknown>;
    };
    Params: { id: string };
  }>(
    "/api/salons/:id/settings/data-exchange",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_SALON),
      ],
    },
    async (request, reply) => {
      const denied = assertSalon(request, reply);
      if (denied) return denied;
      const rows = await app.db
        .insert(dataExchangeSettings)
        .values({
          entityType: request.body.entity_type,
          exportFormats: request.body.export_formats,
          importMapping: request.body.import_mapping ?? {},
          salonId: request.salonId,
          updatedAt: new Date(),
          validationRules: request.body.validation_rules ?? {},
        })
        .onConflictDoUpdate({
          set: {
            exportFormats: request.body.export_formats,
            importMapping: request.body.import_mapping ?? {},
            updatedAt: new Date(),
            validationRules: request.body.validation_rules ?? {},
          },
          target: [dataExchangeSettings.salonId, dataExchangeSettings.entityType],
        })
        .returning();
      return rows[0];
    },
  );

  app.post<{
    Body: { address?: string; email?: string; name: string; phone?: string; timezone?: string };
    Params: { id: string };
  }>(
    "/api/salons/:id/settings/locations",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_SALON),
      ],
    },
    async (request, reply) => {
      const denied = assertSalon(request, reply);
      if (denied) return denied;
      const rows = await app.db
        .insert(salonLocations)
        .values({
          address: request.body.address,
          email: request.body.email,
          name: request.body.name,
          phone: request.body.phone,
          salonId: request.salonId,
          timezone: request.body.timezone,
        })
        .returning();
      return reply.code(201).send(rows[0]);
    },
  );

  app.post<{
    Body: { capacity?: number; location_id?: string; metadata?: Record<string, unknown>; name: string; type: string };
    Params: { id: string };
  }>(
    "/api/salons/:id/settings/resources",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_SALON),
      ],
    },
    async (request, reply) => {
      const denied = assertSalon(request, reply);
      if (denied) return denied;
      const rows = await app.db
        .insert(salonResources)
        .values({
          capacity: request.body.capacity ?? 1,
          locationId: request.body.location_id,
          metadata: request.body.metadata ?? {},
          name: request.body.name,
          salonId: request.salonId,
          type: request.body.type,
        })
        .returning();
      return reply.code(201).send(rows[0]);
    },
  );

  app.put<{
    Body: { accent_color?: string; booking_success_text?: string; hero_subtitle?: string; hero_title?: string; install_prompt_enabled?: boolean; logo_url?: string; primary_color?: string; welcome_text?: string };
    Params: { id: string };
  }>(
    "/api/salons/:id/settings/pwa-branding",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_SALON),
      ],
    },
    async (request, reply) => {
      const denied = assertSalon(request, reply);
      if (denied) return denied;
      const values = {
        accentColor: request.body.accent_color,
        bookingSuccessText: request.body.booking_success_text,
        heroSubtitle: request.body.hero_subtitle,
        heroTitle: request.body.hero_title,
        installPromptEnabled: request.body.install_prompt_enabled ?? true,
        logoUrl: request.body.logo_url,
        primaryColor: request.body.primary_color,
        welcomeText: request.body.welcome_text,
        updatedAt: new Date(),
      };
      const rows = await app.db
        .insert(pwaBrandingSettings)
        .values({ salonId: request.salonId, ...values })
        .onConflictDoUpdate({
          set: values,
          target: pwaBrandingSettings.salonId,
        })
        .returning();
      return rows[0];
    },
  );
}
