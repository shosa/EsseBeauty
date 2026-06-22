import type { FastifyInstance } from "fastify";
import { and, asc, eq } from "drizzle-orm";

import {
  calendarSettings,
  dataExchangeSettings,
  integrationSettings,
  notificationPreferences,
  pwaBrandingSettings,
  salonClosures,
  salonLocations,
  salonResources,
  serviceResources,
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
      address: string | null;
      city: string | null;
      country: string | null;
      latitude: number | null;
      longitude: number | null;
      postal_code: string | null;
      province: string | null;
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
          ...(request.body.address !== undefined && { address: request.body.address?.trim() || null }),
          ...(request.body.city !== undefined && { city: request.body.city?.trim() || null }),
          ...(request.body.country !== undefined && { country: request.body.country?.trim() || null }),
          ...(request.body.latitude !== undefined && { latitude: request.body.latitude }),
          ...(request.body.longitude !== undefined && { longitude: request.body.longitude }),
          ...(request.body.postal_code !== undefined && { postalCode: request.body.postal_code?.trim() || null }),
          ...(request.body.province !== undefined && { province: request.body.province?.trim() || null }),
        })
        .where(eq(salons.id, request.salonId))
        .returning();
      return rows[0];
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/settings/pwa",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_SALON),
      ],
    },
    async (request, reply) => {
      const denied = assertSalon(request, reply);
      if (denied) return denied;
      const [salonRows, calendarRows, brandingRows, categoryRows] = await Promise.all([
        app.db.select().from(salons).where(eq(salons.id, request.salonId)),
        app.db.select().from(calendarSettings).where(eq(calendarSettings.salonId, request.salonId)),
        app.db.select().from(pwaBrandingSettings).where(eq(pwaBrandingSettings.salonId, request.salonId)),
        app.db.select().from(salonSettings).where(and(
          eq(salonSettings.salonId, request.salonId),
          eq(salonSettings.category, "pwa"),
        )),
      ]);
      const salon = salonRows[0];
      const calendar = calendarRows[0];
      const options = categoryRows[0]?.settings ?? {};
      return {
        allowCancellation: options.allowCancellation ?? true,
        allowReschedule: options.allowReschedule ?? true,
        allowStaffPreference: options.allowStaffPreference ?? true,
        bookingDefaultStatus: options.bookingDefaultStatus ?? "pending",
        branding: brandingRows[0] ?? null,
        cancellationPolicyHours: calendar?.cancellationPolicyHours ?? salon?.cancellationPolicyHours ?? 24,
        maxAdvanceDays: options.maxAdvanceDays ?? 90,
        minBookingNoticeHours: calendar?.minBookingNoticeHours ?? 2,
        onlineBookingEnabled: salon?.onlineBookingEnabled ?? false,
        requireEmail: options.requireEmail ?? true,
        requirePhone: options.requirePhone ?? false,
      };
    },
  );

  app.put<{
    Body: {
      accent_color?: string;
      allow_cancellation: boolean;
      allow_reschedule: boolean;
      allow_staff_preference: boolean;
      booking_default_status: "confirmed" | "pending";
      booking_success_text?: string;
      cancellation_policy_hours: number;
      hero_subtitle?: string;
      hero_title?: string;
      install_prompt_enabled: boolean;
      logo_url?: string;
      max_advance_days: number;
      min_booking_notice_hours: number;
      online_booking_enabled: boolean;
      primary_color?: string;
      require_email: boolean;
      require_phone: boolean;
      welcome_text?: string;
    };
    Params: { id: string };
  }>(
    "/api/salons/:id/settings/pwa",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_SALON),
      ],
    },
    async (request, reply) => {
      const denied = assertSalon(request, reply);
      if (denied) return denied;
      if (
        !["pending", "confirmed"].includes(request.body.booking_default_status) ||
        request.body.min_booking_notice_hours < 0 ||
        request.body.cancellation_policy_hours < 0 ||
        request.body.max_advance_days < 1
      ) return reply.code(400).send({ error: "INVALID_PWA_SETTINGS" });
      await app.db.transaction(async (tx) => {
        await tx.update(salons).set({
          cancellationPolicyHours: request.body.cancellation_policy_hours,
          onlineBookingEnabled: request.body.online_booking_enabled,
        }).where(eq(salons.id, request.salonId));
        await tx.insert(calendarSettings).values({
          cancellationPolicyHours: request.body.cancellation_policy_hours,
          minBookingNoticeHours: request.body.min_booking_notice_hours,
          salonId: request.salonId,
        }).onConflictDoUpdate({
          target: calendarSettings.salonId,
          set: {
            cancellationPolicyHours: request.body.cancellation_policy_hours,
            minBookingNoticeHours: request.body.min_booking_notice_hours,
            updatedAt: new Date(),
          },
        });
        await tx.insert(pwaBrandingSettings).values({
          accentColor: request.body.accent_color,
          bookingSuccessText: request.body.booking_success_text,
          heroSubtitle: request.body.hero_subtitle,
          heroTitle: request.body.hero_title,
          installPromptEnabled: request.body.install_prompt_enabled,
          logoUrl: request.body.logo_url,
          primaryColor: request.body.primary_color,
          salonId: request.salonId,
          welcomeText: request.body.welcome_text,
        }).onConflictDoUpdate({
          target: pwaBrandingSettings.salonId,
          set: {
            accentColor: request.body.accent_color,
            bookingSuccessText: request.body.booking_success_text,
            heroSubtitle: request.body.hero_subtitle,
            heroTitle: request.body.hero_title,
            installPromptEnabled: request.body.install_prompt_enabled,
            logoUrl: request.body.logo_url,
            primaryColor: request.body.primary_color,
            updatedAt: new Date(),
            welcomeText: request.body.welcome_text,
          },
        });
        await tx.insert(salonSettings).values({
          category: "pwa",
          salonId: request.salonId,
          settings: {
            allowCancellation: request.body.allow_cancellation,
            allowReschedule: request.body.allow_reschedule,
            allowStaffPreference: request.body.allow_staff_preference,
            bookingDefaultStatus: request.body.booking_default_status,
            maxAdvanceDays: request.body.max_advance_days,
            requireEmail: request.body.require_email,
            requirePhone: request.body.require_phone,
          },
          updatedByUserId: request.user.id,
        }).onConflictDoUpdate({
          target: [salonSettings.salonId, salonSettings.category],
          set: {
            settings: {
              allowCancellation: request.body.allow_cancellation,
              allowReschedule: request.body.allow_reschedule,
              allowStaffPreference: request.body.allow_staff_preference,
              bookingDefaultStatus: request.body.booking_default_status,
              maxAdvanceDays: request.body.max_advance_days,
              requireEmail: request.body.require_email,
              requirePhone: request.body.require_phone,
            },
            updatedAt: new Date(),
            updatedByUserId: request.user.id,
          },
        });
      });
      return { ok: true };
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

  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/settings/locations",
    { preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_SALON)] },
    async (request, reply) => {
      const denied = assertSalon(request, reply);
      if (denied) return denied;
      return app.db.select().from(salonLocations)
        .where(eq(salonLocations.salonId, request.salonId))
        .orderBy(asc(salonLocations.displayOrder), asc(salonLocations.name));
    },
  );

  app.patch<{
    Body: { active?: boolean; address?: string; email?: string; name?: string; phone?: string; timezone?: string };
    Params: { id: string; locationId: string };
  }>(
    "/api/salons/:id/settings/locations/:locationId",
    { preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_SALON)] },
    async (request, reply) => {
      const denied = assertSalon(request, reply);
      if (denied) return denied;
      const rows = await app.db.update(salonLocations).set({
        ...(request.body.active !== undefined && { active: request.body.active }),
        ...(request.body.address !== undefined && { address: request.body.address }),
        ...(request.body.email !== undefined && { email: request.body.email }),
        ...(request.body.name !== undefined && { name: request.body.name }),
        ...(request.body.phone !== undefined && { phone: request.body.phone }),
        ...(request.body.timezone !== undefined && { timezone: request.body.timezone }),
      }).where(and(
        eq(salonLocations.id, request.params.locationId),
        eq(salonLocations.salonId, request.salonId),
      )).returning();
      return rows[0] ?? reply.code(404).send({ error: "LOCATION_NOT_FOUND" });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/settings/closures",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_SALON),
      ],
    },
    async (request, reply) => {
      const denied = assertSalon(request, reply);
      if (denied) return denied;
      return app.db
        .select()
        .from(salonClosures)
        .where(eq(salonClosures.salonId, request.salonId))
        .orderBy(asc(salonClosures.date));
    },
  );

  app.post<{
    Body: { date: string; reason?: string; recurring_yearly?: boolean };
    Params: { id: string };
  }>(
    "/api/salons/:id/settings/closures",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_SALON),
      ],
    },
    async (request, reply) => {
      const denied = assertSalon(request, reply);
      if (denied) return denied;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(request.body.date)) {
        return reply.code(400).send({ error: "INVALID_DATE" });
      }
      const rows = await app.db
        .insert(salonClosures)
        .values({
          date: request.body.date,
          reason: request.body.reason,
          recurringYearly: request.body.recurring_yearly ?? false,
          salonId: request.salonId,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          set: {
            reason: request.body.reason,
            recurringYearly: request.body.recurring_yearly ?? false,
            updatedAt: new Date(),
          },
          target: [salonClosures.salonId, salonClosures.date],
        })
        .returning();
      return reply.code(201).send(rows[0]);
    },
  );

  app.get<{ Params: { id: string }; Querystring: { locationId?: string } }>(
    "/api/salons/:id/settings/resources",
    { preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_SALON)] },
    async (request, reply) => {
      const denied = assertSalon(request, reply);
      if (denied) return denied;
      return app.db.select().from(salonResources).where(and(
        eq(salonResources.salonId, request.salonId),
        ...(request.query.locationId ? [eq(salonResources.locationId, request.query.locationId)] : []),
      )).orderBy(asc(salonResources.name));
    },
  );

  app.patch<{
    Body: { active?: boolean; capacity?: number; location_id?: string | null; metadata?: Record<string, unknown>; name?: string; type?: string };
    Params: { id: string; resourceId: string };
  }>(
    "/api/salons/:id/settings/resources/:resourceId",
    { preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_SALON)] },
    async (request, reply) => {
      const denied = assertSalon(request, reply);
      if (denied) return denied;
      const rows = await app.db.update(salonResources).set({
        ...(request.body.active !== undefined && { active: request.body.active }),
        ...(request.body.capacity !== undefined && { capacity: request.body.capacity }),
        ...(request.body.location_id !== undefined && { locationId: request.body.location_id }),
        ...(request.body.metadata !== undefined && { metadata: request.body.metadata }),
        ...(request.body.name !== undefined && { name: request.body.name }),
        ...(request.body.type !== undefined && { type: request.body.type }),
      }).where(and(
        eq(salonResources.id, request.params.resourceId),
        eq(salonResources.salonId, request.salonId),
      )).returning();
      return rows[0] ?? reply.code(404).send({ error: "RESOURCE_NOT_FOUND" });
    },
  );

  app.get<{ Params: { id: string; resourceId: string } }>(
    "/api/salons/:id/settings/resources/:resourceId/services",
    { preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_SALON)] },
    async (request, reply) => {
      const denied = assertSalon(request, reply);
      if (denied) return denied;
      return app.db.select({ service_id: serviceResources.serviceId }).from(serviceResources).where(and(
        eq(serviceResources.salonId, request.salonId),
        eq(serviceResources.resourceId, request.params.resourceId),
      ));
    },
  );

  app.put<{
    Body: { service_ids: string[] };
    Params: { id: string; resourceId: string };
  }>(
    "/api/salons/:id/settings/resources/:resourceId/services",
    { preHandler: [authenticate, requirePermission(PERMISSION_KEYS.SETTINGS_SALON)] },
    async (request, reply) => {
      const denied = assertSalon(request, reply);
      if (denied) return denied;
      await app.db.transaction(async (tx) => {
        await tx.delete(serviceResources).where(and(
          eq(serviceResources.salonId, request.salonId),
          eq(serviceResources.resourceId, request.params.resourceId),
        ));
        if (request.body.service_ids.length > 0) {
          await tx.insert(serviceResources).values(request.body.service_ids.map((serviceId) => ({
            resourceId: request.params.resourceId,
            salonId: request.salonId,
            serviceId,
          })));
        }
      });
      return { ok: true };
    },
  );

  app.delete<{ Params: { closureId: string; id: string } }>(
    "/api/salons/:id/settings/closures/:closureId",
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
        .delete(salonClosures)
        .where(and(eq(salonClosures.id, request.params.closureId), eq(salonClosures.salonId, request.salonId)))
        .returning();
      return rows[0] ?? reply.code(404).send({ error: "CLOSURE_NOT_FOUND" });
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
