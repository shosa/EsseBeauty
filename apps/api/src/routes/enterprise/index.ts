import type { FastifyInstance } from "fastify";
import { and, desc, eq, sql } from "drizzle-orm";

import {
  activityLog,
  appointmentNotes,
  consentTemplates,
  customerConsents,
  customerServicePackages,
  servicePackageUsages,
  servicePackages,
  staffAvailabilityRequests,
  users,
} from "@esse-beauty/db/schema";
import { MODULE_KEYS, requireModule } from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { authenticate, requirePermission } from "../../middleware/auth.js";

function ensureSalon(request: { params: { id: string }; salonId: string }, reply: { code(statusCode: number): { send(payload: unknown): unknown } }) {
  if (request.params.id !== request.salonId) {
    return reply.code(403).send({ error: "FORBIDDEN" });
  }
  return undefined;
}

export async function registerEnterpriseModuleRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/consent-templates",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_SALON),
        requireModule(MODULE_KEYS.DOCUMENTS),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      return app.db
        .select()
        .from(consentTemplates)
        .where(eq(consentTemplates.salonId, request.salonId))
        .orderBy(desc(consentTemplates.createdAt));
    },
  );

  app.post<{
    Body: { active?: boolean; body: string; name: string; required_for_services?: string[]; type: string; version?: number };
    Params: { id: string };
  }>(
    "/api/salons/:id/consent-templates",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_SALON),
        requireModule(MODULE_KEYS.DOCUMENTS),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      if (!request.body.name?.trim() || !request.body.body?.trim()) {
        return reply.code(400).send({ error: "CONSENT_TEMPLATE_REQUIRED" });
      }
      const rows = await app.db
        .insert(consentTemplates)
        .values({
          active: request.body.active ?? true,
          body: request.body.body,
          name: request.body.name.trim(),
          requiredForServices: request.body.required_for_services ?? [],
          salonId: request.salonId,
          type: request.body.type,
          version: request.body.version ?? 1,
        })
        .returning();
      return reply.code(201).send(rows[0]);
    },
  );

  app.get<{ Params: { id: string }; Querystring: { customer_id?: string; appointment_id?: string } }>(
    "/api/salons/:id/customer-consents",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.CLIENTS_VIEW),
        requireModule(MODULE_KEYS.DOCUMENTS),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      const filters = [eq(customerConsents.salonId, request.salonId)];
      if (request.query.customer_id) filters.push(eq(customerConsents.customerId, request.query.customer_id));
      if (request.query.appointment_id) filters.push(eq(customerConsents.appointmentId, request.query.appointment_id));
      return app.db.select().from(customerConsents).where(and(...filters)).orderBy(desc(customerConsents.createdAt));
    },
  );

  app.post<{
    Body: { appointment_id?: string; customer_id: string; signature_data?: Record<string, unknown>; status?: "pending" | "signed" | "revoked" | "expired"; template_id: string };
    Params: { id: string };
  }>(
    "/api/salons/:id/customer-consents",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.CLIENTS_EDIT),
        requireModule(MODULE_KEYS.DOCUMENTS),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      const rows = await app.db
        .insert(customerConsents)
        .values({
          appointmentId: request.body.appointment_id,
          customerId: request.body.customer_id,
          signatureData: request.body.signature_data ?? {},
          signedAt: request.body.status === "signed" ? new Date() : undefined,
          salonId: request.salonId,
          status: request.body.status ?? "pending",
          templateId: request.body.template_id,
        })
        .returning();
      return reply.code(201).send(rows[0]);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/service-packages",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.CLIENTS_VIEW),
        requireModule(MODULE_KEYS.PACKAGES),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      return app.db.select().from(servicePackages).where(eq(servicePackages.salonId, request.salonId)).orderBy(desc(servicePackages.createdAt));
    },
  );

  app.post<{
    Body: { active?: boolean; description?: string; included_sessions: number; name: string; service_id?: string; validity_days?: number };
    Params: { id: string };
  }>(
    "/api/salons/:id/service-packages",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_SERVICES),
        requireModule(MODULE_KEYS.PACKAGES),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      if (!request.body.name?.trim() || request.body.included_sessions <= 0) {
        return reply.code(400).send({ error: "SERVICE_PACKAGE_REQUIRED" });
      }
      const rows = await app.db
        .insert(servicePackages)
        .values({
          active: request.body.active ?? true,
          description: request.body.description,
          includedSessions: request.body.included_sessions,
          name: request.body.name.trim(),
          salonId: request.salonId,
          serviceId: request.body.service_id,
          validityDays: request.body.validity_days,
        })
        .returning();
      return reply.code(201).send(rows[0]);
    },
  );

  app.post<{
    Body: { customer_id: string; expires_at?: string; notes?: string; package_id: string; total_sessions: number };
    Params: { id: string };
  }>(
    "/api/salons/:id/customer-service-packages",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.CLIENTS_EDIT),
        requireModule(MODULE_KEYS.PACKAGES),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      const rows = await app.db
        .insert(customerServicePackages)
        .values({
          customerId: request.body.customer_id,
          expiresAt: request.body.expires_at ? new Date(request.body.expires_at) : undefined,
          notes: request.body.notes,
          packageId: request.body.package_id,
          salonId: request.salonId,
          totalSessions: request.body.total_sessions,
        })
        .returning();
      return reply.code(201).send(rows[0]);
    },
  );

  app.post<{
    Body: { appointment_id?: string; note?: string; sessions_used?: number };
    Params: { customerPackageId: string; id: string };
  }>(
    "/api/salons/:id/customer-service-packages/:customerPackageId/usages",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.CALENDAR_MANAGE_OWN),
        requireModule(MODULE_KEYS.PACKAGES),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      const sessionsUsed = request.body.sessions_used ?? 1;
      const rows = await app.db
        .insert(servicePackageUsages)
        .values({
          appointmentId: request.body.appointment_id,
          createdByUserId: request.user.id,
          customerPackageId: request.params.customerPackageId,
          note: request.body.note,
          salonId: request.salonId,
          sessionsUsed,
        })
        .returning();
      await app.db
        .update(customerServicePackages)
        .set({ usedSessions: sql`${customerServicePackages.usedSessions} + ${sessionsUsed}` })
        .where(eq(customerServicePackages.id, request.params.customerPackageId));
      return reply.code(201).send(rows[0]);
    },
  );

  app.post<{
    Body: { ends_at: string; reason?: string; starts_at: string };
    Params: { id: string; staffId: string };
  }>(
    "/api/salons/:id/staff/:staffId/availability-requests",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.CALENDAR_MANAGE_OWN),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      const rows = await app.db
        .insert(staffAvailabilityRequests)
        .values({
          endsAt: new Date(request.body.ends_at),
          reason: request.body.reason,
          salonId: request.salonId,
          staffId: request.params.staffId,
          startsAt: new Date(request.body.starts_at),
        })
        .returning();
      return reply.code(201).send(rows[0]);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/audit-log",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_USERS),
        requireModule(MODULE_KEYS.AUDIT_COMPLIANCE),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      return app.db
        .select({
          action: activityLog.action,
          actorAvatarUrl: users.avatarUrl,
          actorName: users.fullName,
          actorRole: users.role,
          actorUserId: activityLog.actorUserId,
          createdAt: activityLog.createdAt,
          diff: activityLog.diff,
          entityId: activityLog.entityId,
          entityType: activityLog.entityType,
          id: activityLog.id,
          payload: activityLog.payload,
          summary: activityLog.summary,
        })
        .from(activityLog)
        .leftJoin(users, eq(users.id, activityLog.actorUserId))
        .where(eq(activityLog.salonId, request.salonId))
        .orderBy(desc(activityLog.createdAt))
        .limit(200);
    },
  );

  app.post<{
    Body: { appointment_id: string; body: string };
    Params: { id: string };
  }>(
    "/api/salons/:id/appointment-private-notes",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.CALENDAR_MANAGE_OWN),
      ],
    },
    async (request, reply) => {
      const denied = ensureSalon(request, reply);
      if (denied) return denied;
      const rows = await app.db
        .insert(appointmentNotes)
        .values({
          appointmentId: request.body.appointment_id,
          authorUserId: request.user.id,
          body: request.body.body,
          salonId: request.salonId,
        })
        .returning();
      return reply.code(201).send(rows[0]);
    },
  );
}
