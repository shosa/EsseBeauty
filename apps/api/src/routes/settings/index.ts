import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";

import { salons, type WorkingHours } from "@esse-beauty/db/schema";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { authenticate, requirePermission } from "../../middleware/auth.js";

export async function registerSettingsRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/settings",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_SALON),
      ],
    },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
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
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
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
}
