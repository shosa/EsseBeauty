import type { FastifyInstance } from "fastify";
import { and, desc, eq, gte, lte } from "drizzle-orm";

import {
  appointments,
  customers,
  reminderSettings,
  reminders,
} from "@esse-beauty/db/schema";
import { MODULE_KEYS, requireModule } from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { authenticate, requirePermission } from "../../middleware/auth.js";

const guard = [
  authenticate,
  requireModule(MODULE_KEYS.REMINDERS),
  requirePermission(PERMISSION_KEYS.SETTINGS_SALON),
];

export async function registerReminderRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/reminders/settings",
    { preHandler: guard },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
      const rows = await app.db
        .insert(reminderSettings)
        .values({ salonId: request.salonId })
        .onConflictDoNothing()
        .returning();
      if (rows[0]) return rows[0];
      const existing = await app.db
        .select()
        .from(reminderSettings)
        .where(eq(reminderSettings.salonId, request.salonId));
      return existing[0];
    },
  );

  app.patch<{
    Params: { id: string };
    Body: {
      sms_enabled: boolean;
      email_enabled: boolean;
      hours_before: number[];
    };
  }>(
    "/api/salons/:id/reminders/settings",
    { preHandler: guard },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
      const hours = [...new Set(request.body.hours_before)]
        .filter((value) => Number.isInteger(value) && value > 0)
        .sort((a, b) => b - a);
      if (hours.length === 0) {
        return reply.code(400).send({ error: "INVALID_HOURS_BEFORE" });
      }
      const rows = await app.db
        .insert(reminderSettings)
        .values({
          salonId: request.salonId,
          smsEnabled: request.body.sms_enabled,
          emailEnabled: request.body.email_enabled,
          hoursBefore: hours,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: reminderSettings.salonId,
          set: {
            smsEnabled: request.body.sms_enabled,
            emailEnabled: request.body.email_enabled,
            hoursBefore: hours,
            updatedAt: new Date(),
          },
        })
        .returning();
      return rows[0];
    },
  );

  app.get<{
    Params: { id: string };
    Querystring: { from?: string; to?: string };
  }>(
    "/api/salons/:id/reminders",
    { preHandler: guard },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
      return app.db
        .select({
          id: reminders.id,
          customer_name: customers.fullName,
          channel: reminders.channel,
          scheduled_at: reminders.scheduledAt,
          sent_at: reminders.sentAt,
          status: reminders.status,
        })
        .from(reminders)
        .innerJoin(appointments, eq(appointments.id, reminders.appointmentId))
        .innerJoin(customers, eq(customers.id, appointments.customerId))
        .where(
          and(
            eq(reminders.salonId, request.salonId),
            ...(request.query.from
              ? [gte(reminders.scheduledAt, new Date(request.query.from))]
              : []),
            ...(request.query.to
              ? [lte(reminders.scheduledAt, new Date(request.query.to))]
              : []),
          ),
        )
        .orderBy(desc(reminders.scheduledAt));
    },
  );
}
