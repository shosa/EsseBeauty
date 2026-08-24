import type { FastifyInstance, FastifyReply } from "fastify";
import { and, desc, eq, gte, lte } from "drizzle-orm";

import {
  appointments,
  customers,
  reviewInvitations,
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

export async function registerReviewRoutes(app: FastifyInstance) {
  app.get<{ Params: { token: string } }>(
    "/api/public/reviews/token/:token",
    async (request, reply) => {
      const inspected = inspectPublicToken(request.params.token, "review");
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
    Params: { token: string };
    Body: { rating?: unknown; comment?: unknown };
  }>("/api/public/reviews/token/:token", async (request, reply) => {
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
    const inspected = inspectPublicToken(request.params.token, "review");
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
