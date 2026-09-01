import type { FastifyInstance, FastifyReply } from "fastify";
import { and, desc, eq, gte, lte } from "drizzle-orm";

import {
  appointments,
  customers,
  reviewInvitationDeliveries,
  reviewInvitations,
  reviewRequestSettings,
  reviews,
  salonModules,
  salons,
  services,
} from "@esse-beauty/db/schema";
import {
  MODULE_KEYS,
  requireModule,
} from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { authenticate, requirePermission } from "../../middleware/auth.js";
import { inspectPublicToken } from "../../lib/public-tokens.js";
import { retryReviewInvitation, scheduleReviewRequest, type ReviewQueue } from "../../jobs/reviews.js";

type ReviewTokenError = "TOKEN_CONSUMED" | "TOKEN_EXPIRED" | "TOKEN_INVALID" | "TOKEN_REVOKED";

function tokenErrorReply(reply: FastifyReply, error: ReviewTokenError) {
  const status = error === "TOKEN_INVALID" ? 404 : error === "TOKEN_CONSUMED" ? 409 : 410;
  return reply.code(status).send({ error });
}

function invitationError(
  invitation: { consumedAt: Date | null; expiresAt: Date; revokedAt: Date | null },
  tokenExpired: boolean,
): ReviewTokenError | undefined {
  if (invitation.revokedAt) return "TOKEN_REVOKED";
  if (invitation.consumedAt) return "TOKEN_CONSUMED";
  if (tokenExpired || invitation.expiresAt <= new Date()) return "TOKEN_EXPIRED";
  return undefined;
}

interface RegisterReviewRouteOptions {
  reviewQueue?: ReviewQueue;
}

function inspectBodyToken(token: unknown) {
  return typeof token === "string"
    ? inspectPublicToken(token, "review")
    : { ok: false as const };
}

export async function registerReviewRoutes(
  app: FastifyInstance,
  options: RegisterReviewRouteOptions = {},
) {
  const managementGuard = [authenticate, requireModule(MODULE_KEYS.REVIEWS), requirePermission(PERMISSION_KEYS.REVIEWS_REPLY)];
  app.post<{ Body: { token?: unknown } }>(
    "/api/public/reviews/resolve",
    async (request, reply) => {
      const inspected = inspectBodyToken(request.body?.token);
      if (!inspected.ok) return tokenErrorReply(reply, "TOKEN_INVALID");
      const rows = await app.db
        .select({
          consumedAt: reviewInvitations.consumedAt,
          expiresAt: reviewInvitations.expiresAt,
          revokedAt: reviewInvitations.revokedAt,
          salon_name: salons.name,
          service_name: services.name,
          starts_at: appointments.startsAt,
        })
        .from(reviewInvitations)
        .innerJoin(appointments, eq(appointments.id, reviewInvitations.appointmentId))
        .innerJoin(salons, eq(salons.id, reviewInvitations.salonId))
        .innerJoin(services, eq(services.id, appointments.serviceId))
        .innerJoin(salonModules, and(
          eq(salonModules.salonId, reviewInvitations.salonId),
          eq(salonModules.moduleKey, MODULE_KEYS.REVIEWS),
          eq(salonModules.enabled, true),
        ))
        .where(eq(reviewInvitations.tokenHash, inspected.tokenHash));
      const invitation = rows[0];
      if (!invitation) return tokenErrorReply(reply, "TOKEN_INVALID");
      const error = invitationError(invitation, inspected.expired);
      if (error) return tokenErrorReply(reply, error);
      return {
        salon_name: invitation.salon_name,
        service_name: invitation.service_name,
        starts_at: invitation.starts_at,
      };
    },
  );

  app.post<{
    Body: { token?: unknown; rating?: unknown; comment?: unknown };
  }>("/api/public/reviews/submit", async (request, reply) => {
    const body = request.body ?? {};
    if (
      body.comment !== undefined &&
      (typeof body.comment !== "string" || body.comment.length > 5_000)
    ) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        fields: { comment: ["Commento non valido"] },
      });
    }
    if (
      !Number.isInteger(body.rating) ||
      Number(body.rating) < 1 ||
      Number(body.rating) > 5
    ) {
      return reply.code(400).send({ error: "INVALID_RATING" });
    }
    const inspected = inspectBodyToken(body.token);
    if (!inspected.ok) return tokenErrorReply(reply, "TOKEN_INVALID");

    const result = await app.db.transaction(async (tx) => {
      const invitationRows = await tx
        .select({
          appointmentId: reviewInvitations.appointmentId,
          consumedAt: reviewInvitations.consumedAt,
          expiresAt: reviewInvitations.expiresAt,
          id: reviewInvitations.id,
          revokedAt: reviewInvitations.revokedAt,
          salonId: reviewInvitations.salonId,
        })
        .from(reviewInvitations)
        .where(eq(reviewInvitations.tokenHash, inspected.tokenHash))
        .for("update");
      const invitation = invitationRows[0];
      if (!invitation) return { error: "TOKEN_INVALID" as const };
      const error = invitationError(invitation, inspected.expired);
      if (error) return { error: error as ReviewTokenError };

      const appointmentRows = await tx
        .select({ customerId: appointments.customerId, status: appointments.status })
        .from(appointments)
        .innerJoin(salonModules, and(
          eq(salonModules.salonId, appointments.salonId),
          eq(salonModules.moduleKey, MODULE_KEYS.REVIEWS),
          eq(salonModules.enabled, true),
        ))
        .where(and(
          eq(appointments.id, invitation.appointmentId),
          eq(appointments.salonId, invitation.salonId),
        ));
      const appointment = appointmentRows[0];
      if (!appointment || appointment.status !== "completed") {
        return { error: "TOKEN_INVALID" as const };
      }

      await tx.insert(reviews).values({
        appointmentId: invitation.appointmentId,
        comment: typeof body.comment === "string" ? body.comment.trim() || null : null,
        customerId: appointment.customerId,
        rating: Number(body.rating),
        salonId: invitation.salonId,
      });
      await tx.update(reviewInvitations).set({ consumedAt: new Date(), updatedAt: new Date() })
        .where(eq(reviewInvitations.id, invitation.id));
      return { submitted: true as const };
    });
    if ("error" in result && result.error) return tokenErrorReply(reply, result.error);
    return reply.code(201).send(result);
  });

  app.post<{ Params: { id: string; invitationId: string } }>(
    "/api/salons/:id/review-invitations/:invitationId/retry",
    {
      preHandler: [
        authenticate,
        requireModule(MODULE_KEYS.REVIEWS),
        requirePermission(PERMISSION_KEYS.REVIEWS_REPLY),
      ],
    },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
      const invitation = await retryReviewInvitation(
        app.db,
        request.salonId,
        request.params.invitationId,
        options.reviewQueue,
      );
      if (!invitation) {
        return reply.code(409).send({ error: "REVIEW_INVITATION_NOT_RETRYABLE" });
      }
      return reply.code(202).send({ queued: true });
    },
  );

  app.get<{ Params: { id: string } }>("/api/salons/:id/reviews/request-settings", { preHandler: managementGuard }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    return (await app.db.select().from(reviewRequestSettings).where(eq(reviewRequestSettings.salonId, request.salonId)))[0] ?? { automaticEnabled: false, channels: ["email"], delayPreset: "one_hour" };
  });

  app.patch<{ Params: { id: string }; Body: { automaticEnabled: boolean; channels: Array<"email" | "whatsapp">; delayPreset: "immediate" | "one_hour" | "three_hours" | "next_day" | "two_days" } }>("/api/salons/:id/reviews/request-settings", { preHandler: managementGuard }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    const presets = ["immediate", "one_hour", "three_hours", "next_day", "two_days"];
    const channels = [...new Set(request.body.channels ?? [])];
    if (!presets.includes(request.body.delayPreset) || channels.length === 0 || channels.some((channel) => !["email", "whatsapp"].includes(channel))) return reply.code(400).send({ error: "INVALID_REVIEW_SETTINGS" });
    return (await app.db.insert(reviewRequestSettings).values({ automaticEnabled: request.body.automaticEnabled, channels, delayPreset: request.body.delayPreset, salonId: request.salonId, updatedByUserId: request.user.id }).onConflictDoUpdate({ target: reviewRequestSettings.salonId, set: { automaticEnabled: request.body.automaticEnabled, channels, delayPreset: request.body.delayPreset, updatedAt: new Date(), updatedByUserId: request.user.id } }).returning())[0];
  });

  app.get<{ Params: { id: string } }>("/api/salons/:id/reviews/collection", { preHandler: managementGuard }, async (request, reply) => {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    const rows = await app.db.select({ appointment_id: appointments.id, appointment_date: appointments.startsAt, customer_email: customers.email, customer_name: customers.fullName, customer_phone: customers.phone, invitation_consumed_at: reviewInvitations.consumedAt, invitation_id: reviewInvitations.id, review_id: reviews.id, service_name: services.name }).from(appointments).innerJoin(customers, eq(customers.id, appointments.customerId)).innerJoin(services, eq(services.id, appointments.serviceId)).leftJoin(reviewInvitations, eq(reviewInvitations.appointmentId, appointments.id)).leftJoin(reviews, eq(reviews.appointmentId, appointments.id)).where(and(eq(appointments.salonId, request.salonId), eq(appointments.status, "completed"))).orderBy(desc(appointments.startsAt)).limit(100);
    const deliveries = await app.db.select().from(reviewInvitationDeliveries).where(eq(reviewInvitationDeliveries.salonId, request.salonId));
    return rows.map((row) => ({ ...row, deliveries: deliveries.filter((delivery) => delivery.invitationId === row.invitation_id).map((delivery) => ({ channel: delivery.channel, delivered_at: delivery.deliveredAt, failure_reason: delivery.failureReason, generation: delivery.generation, scheduled_at: delivery.scheduledAt, status: delivery.status })) }));
  });

  async function sendCollectionRequest(request: any, reply: FastifyReply, resend: boolean) {
    if (request.params.id !== request.salonId) return reply.code(403).send({ error: "FORBIDDEN" });
    if (resend && request.body?.confirm !== true) return reply.code(400).send({ error: "RESEND_CONFIRMATION_REQUIRED" });
    const channels = [...new Set(request.body?.channels ?? [])] as Array<"email" | "whatsapp">;
    if (channels.length === 0 || channels.some((channel) => !["email", "whatsapp"].includes(channel))) return reply.code(400).send({ error: "INVALID_CHANNELS" });
    const appointment = (await app.db.select({ email: customers.email, phone: customers.phone, status: appointments.status }).from(appointments).innerJoin(customers, eq(customers.id, appointments.customerId)).where(and(eq(appointments.id, request.params.appointmentId), eq(appointments.salonId, request.salonId))))[0];
    if (!appointment || appointment.status !== "completed") return reply.code(409).send({ error: "REVIEW_APPOINTMENT_NOT_COMPLETED" });
    if (channels.includes("email") && !appointment.email || channels.includes("whatsapp") && !appointment.phone) return reply.code(400).send({ error: "REVIEW_CONTACT_UNAVAILABLE" });
    try {
      const result = await scheduleReviewRequest(app.db, request.params.appointmentId, { channels, resend, scheduledAt: new Date() }, options.reviewQueue);
      return reply.code(202).send({ deliveries: result.deliveries.map((item) => ({ channel: item.channel, scheduled_at: item.scheduledAt, status: item.status })), invitation_id: result.invitation.id });
    } catch { return reply.code(409).send({ error: "REVIEW_INVITATION_NOT_SENDABLE" }); }
  }

  app.post<{ Params: { id: string; appointmentId: string }; Body: { channels: Array<"email" | "whatsapp"> } }>("/api/salons/:id/reviews/collection/:appointmentId/send", { preHandler: managementGuard }, async (request, reply) => sendCollectionRequest(request, reply, false));
  app.post<{ Params: { id: string; appointmentId: string }; Body: { channels: Array<"email" | "whatsapp">; confirm: boolean } }>("/api/salons/:id/reviews/collection/:appointmentId/resend", { preHandler: managementGuard }, async (request, reply) => sendCollectionRequest(request, reply, true));

  app.get<{
    Params: { id: string };
    Querystring: {
      published?: string;
      rating?: string;
      from?: string;
      to?: string;
    };
  }>(
    "/api/salons/:id/reviews",
    {
      preHandler: [
        authenticate,
        requireModule(MODULE_KEYS.REVIEWS),
        requirePermission(PERMISSION_KEYS.REVIEWS_REPLY),
      ],
    },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
      return app.db
        .select({
          id: reviews.id,
          rating: reviews.rating,
          comment: reviews.comment,
          reply: reviews.reply,
          published: reviews.published,
          created_at: reviews.createdAt,
          customer_name: customers.fullName,
        })
        .from(reviews)
        .innerJoin(customers, eq(customers.id, reviews.customerId))
        .where(
          and(
            eq(reviews.salonId, request.salonId),
            ...(request.query.published !== undefined
              ? [eq(reviews.published, request.query.published === "true")]
              : []),
            ...(request.query.rating
              ? [eq(reviews.rating, Number(request.query.rating))]
              : []),
            ...(request.query.from
              ? [gte(reviews.createdAt, new Date(request.query.from))]
              : []),
            ...(request.query.to
              ? [lte(reviews.createdAt, new Date(request.query.to))]
              : []),
          ),
        )
        .orderBy(desc(reviews.createdAt));
    },
  );

  app.patch<{
    Params: { id: string; reviewId: string };
    Body: { reply: string };
  }>(
    "/api/salons/:id/reviews/:reviewId/reply",
    {
      preHandler: [
        authenticate,
        requireModule(MODULE_KEYS.REVIEWS),
        requirePermission(PERMISSION_KEYS.REVIEWS_REPLY),
      ],
    },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
      const rows = await app.db
        .update(reviews)
        .set({ reply: request.body.reply })
        .where(
          and(
            eq(reviews.id, request.params.reviewId),
            eq(reviews.salonId, request.salonId),
          ),
        )
        .returning();
      return rows[0] ?? reply.code(404).send({ error: "REVIEW_NOT_FOUND" });
    },
  );

  app.patch<{
    Params: { id: string; reviewId: string };
    Body: { published: boolean };
  }>(
    "/api/salons/:id/reviews/:reviewId/publish",
    {
      preHandler: [
        authenticate,
        requireModule(MODULE_KEYS.REVIEWS),
        requirePermission(PERMISSION_KEYS.SETTINGS_SALON),
      ],
    },
    async (request, reply) => {
      if (request.params.id !== request.salonId) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }
      const rows = await app.db
        .update(reviews)
        .set({ published: request.body.published })
        .where(
          and(
            eq(reviews.id, request.params.reviewId),
            eq(reviews.salonId, request.salonId),
          ),
        )
        .returning();
      return rows[0] ?? reply.code(404).send({ error: "REVIEW_NOT_FOUND" });
    },
  );
}
