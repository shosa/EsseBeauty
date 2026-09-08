import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";

import { customerAppMessages, salons } from "@esse-beauty/db/schema";
import { resolveCustomerId } from "./customer-auth.js";

async function getSalon(app: FastifyInstance, slug: string) {
  const rows = await app.db.select().from(salons).where(and(eq(salons.slug, slug), eq(salons.active, true)));
  return rows[0];
}

export async function registerPublicMessageRoutes(app: FastifyInstance) {
  app.get<{ Params: { slug: string } }>(
    "/api/public/:slug/messages", async (request, reply) => {
      const salon = await getSalon(app, request.params.slug);
      if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });
      const customerId = await resolveCustomerId(app, request, salon.id);
      if (!customerId) return reply.code(401).send({ error: "UNAUTHORIZED" });

      const rows = await app.db.select({
        body: customerAppMessages.body,
        createdAt: customerAppMessages.createdAt,
        href: customerAppMessages.href,
        id: customerAppMessages.id,
        kind: customerAppMessages.kind,
        readAt: customerAppMessages.readAt,
        title: customerAppMessages.title,
      }).from(customerAppMessages).where(and(
        eq(customerAppMessages.salonId, salon.id),
        eq(customerAppMessages.customerId, customerId),
      )).orderBy(desc(customerAppMessages.createdAt)).limit(10);

      return rows.map((message) => ({
        body: message.body,
        created_at: message.createdAt.toISOString(),
        href: message.href,
        id: message.id,
        kind: message.kind,
        read_at: message.readAt?.toISOString() ?? null,
        title: message.title,
      }));
    },
  );

  app.get<{ Params: { id: string; slug: string } }>(
    "/api/public/:slug/messages/:id", async (request, reply) => {
      const salon = await getSalon(app, request.params.slug);
      if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });
      const customerId = await resolveCustomerId(app, request, salon.id);
      if (!customerId) return reply.code(401).send({ error: "UNAUTHORIZED" });

      const rows = await app.db.select().from(customerAppMessages).where(and(
        eq(customerAppMessages.id, request.params.id),
        eq(customerAppMessages.salonId, salon.id),
        eq(customerAppMessages.customerId, customerId),
      ));
      const message = rows[0];
      if (!message) return reply.code(404).send({ error: "MESSAGE_NOT_FOUND" });

      if (!message.readAt) {
        await app.db.update(customerAppMessages).set({ readAt: new Date() }).where(eq(customerAppMessages.id, message.id));
      }

      return {
        body: message.body,
        created_at: message.createdAt.toISOString(),
        href: message.href,
        id: message.id,
        kind: message.kind,
        title: message.title,
      };
    },
  );
}
