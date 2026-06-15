import type { FastifyInstance } from "fastify";
import { and, desc, eq, gte, lte } from "drizzle-orm";

import {
  appointments,
  customers,
  reviews,
  salons,
  services,
} from "@esse-beauty/db/schema";
import {
  isModuleEnabled,
  MODULE_KEYS,
  requireModule,
} from "@esse-beauty/feature-flags";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { authenticate, requirePermission } from "../../middleware/auth.js";

export async function registerReviewRoutes(app: FastifyInstance) {
  app.get<{ Params: { appointmentId: string } }>(
    "/api/public/reviews/:appointmentId",
    async (request, reply) => {
      const rows = await app.db
        .select({
          appointment_id: appointments.id,
          salon_id: appointments.salonId,
          salon_name: salons.name,
          service_name: services.name,
          starts_at: appointments.startsAt,
          customer_name: customers.fullName,
        })
        .from(appointments)
        .innerJoin(salons, eq(salons.id, appointments.salonId))
        .innerJoin(services, eq(services.id, appointments.serviceId))
        .innerJoin(customers, eq(customers.id, appointments.customerId))
        .where(eq(appointments.id, request.params.appointmentId));
      const item = rows[0];
      if (
        !item ||
        !(await isModuleEnabled(item.salon_id, MODULE_KEYS.REVIEWS, app.db))
      ) {
        return reply.code(404).send({ error: "NOT_FOUND" });
      }
      return item;
    },
  );

  app.post<{
    Params: { appointmentId: string };
    Body: { rating: number; comment?: string };
  }>("/api/public/reviews/:appointmentId", async (request, reply) => {
    if (
      !Number.isInteger(request.body.rating) ||
      request.body.rating < 1 ||
      request.body.rating > 5
    ) {
      return reply.code(400).send({ error: "INVALID_RATING" });
    }
    const appointmentsRows = await app.db
      .select()
      .from(appointments)
      .where(eq(appointments.id, request.params.appointmentId));
    const appointment = appointmentsRows[0];
    if (
      !appointment ||
      appointment.status !== "completed" ||
      !(await isModuleEnabled(
        appointment.salonId,
        MODULE_KEYS.REVIEWS,
        app.db,
      ))
    ) {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }
    const existing = await app.db
      .select({ id: reviews.id })
      .from(reviews)
      .where(eq(reviews.appointmentId, appointment.id));
    if (existing[0]) {
      return reply.code(409).send({ error: "ALREADY_REVIEWED" });
    }
    const rows = await app.db
      .insert(reviews)
      .values({
        salonId: appointment.salonId,
        appointmentId: appointment.id,
        customerId: appointment.customerId,
        rating: request.body.rating,
        comment: request.body.comment,
      })
      .returning();
    return reply.code(201).send(rows[0]);
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
