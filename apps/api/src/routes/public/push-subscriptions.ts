import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";

import { customerPushSubscriptions, salons } from "@esse-beauty/db/schema";
import { resolveCustomerId } from "./customer-auth.js";

async function getSalon(app: FastifyInstance, slug: string) {
  const rows = await app.db.select().from(salons).where(and(eq(salons.slug, slug), eq(salons.active, true)));
  return rows[0];
}

export async function registerPublicPushSubscriptionRoutes(app: FastifyInstance) {
  app.post<{
    Body: { endpoint?: string; keys?: { auth?: string; p256dh?: string } };
    Params: { slug: string };
  }>("/api/public/:slug/push-subscriptions", async (request, reply) => {
    const salon = await getSalon(app, request.params.slug);
    if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });
    const customerId = await resolveCustomerId(app, request, salon.id);
    if (!customerId) return reply.code(401).send({ error: "UNAUTHORIZED" });

    const endpoint = request.body.endpoint?.trim();
    const p256dh = request.body.keys?.p256dh?.trim();
    const auth = request.body.keys?.auth?.trim();
    if (!endpoint || !p256dh || !auth) return reply.code(400).send({ error: "SUBSCRIPTION_INVALID" });

    const userAgent = request.headers["user-agent"];
    await app.db.insert(customerPushSubscriptions).values({
      auth,
      customerId,
      endpoint,
      lastSeenAt: new Date(),
      p256dh,
      salonId: salon.id,
      userAgent: typeof userAgent === "string" ? userAgent.slice(0, 500) : null,
    }).onConflictDoUpdate({
      set: {
        auth,
        customerId,
        lastSeenAt: new Date(),
        p256dh,
        salonId: salon.id,
        userAgent: typeof userAgent === "string" ? userAgent.slice(0, 500) : null,
      },
      target: customerPushSubscriptions.endpoint,
    });
    return reply.code(204).send();
  });

  app.delete<{ Body: { endpoint?: string }; Params: { slug: string } }>(
    "/api/public/:slug/push-subscriptions", async (request, reply) => {
      const salon = await getSalon(app, request.params.slug);
      if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });
      const customerId = await resolveCustomerId(app, request, salon.id);
      if (!customerId) return reply.code(401).send({ error: "UNAUTHORIZED" });
      const endpoint = request.body.endpoint?.trim();
      if (!endpoint) return reply.code(400).send({ error: "ENDPOINT_REQUIRED" });
      await app.db.delete(customerPushSubscriptions).where(and(
        eq(customerPushSubscriptions.endpoint, endpoint),
        eq(customerPushSubscriptions.customerId, customerId),
      ));
      return reply.code(204).send();
    },
  );
}
