import type { FastifyInstance, FastifyRequest } from "fastify";

import { activityLog } from "@esse-beauty/db/schema";

const mutationMethods = new Set(["DELETE", "PATCH", "POST", "PUT"]);
const sensitiveKeys = new Set([
  "access_token",
  "authorization",
  "current_password",
  "new_password",
  "password",
  "password_hash",
  "password_salt",
  "refresh_token",
  "token",
]);

function sanitizedValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizedValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    sensitiveKeys.has(key.toLowerCase()) ? "[PROTETTO]" : sanitizedValue(item),
  ]));
}

function routeEntity(request: FastifyRequest) {
  const route = request.routeOptions.url ?? request.url;
  const parts = route.split("/").filter((part) => part && part !== "api" && part !== "salons" && !part.startsWith(":"));
  return parts.at(-1)?.replaceAll("-", "_") ?? "sistema";
}

function entityId(request: FastifyRequest) {
  const params = request.params as Record<string, unknown>;
  const value = ["appointmentId", "customerId", "staffId", "serviceId", "productId", "userId", "id"]
    .map((key) => params[key])
    .find((item) => typeof item === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(item));
  return typeof value === "string" ? value : null;
}

export function registerAuditLogHooks(app: FastifyInstance) {
  app.addHook("onResponse", async (request, reply) => {
    if (
      !mutationMethods.has(request.method) ||
      reply.statusCode < 200 ||
      reply.statusCode >= 300 ||
      !request.user?.id ||
      !request.salonId
    ) return;

    const entityType = routeEntity(request);
    const route = request.routeOptions.url ?? request.url;
    await request.server.db.insert(activityLog).values({
      action: `${request.method.toLowerCase()}_${entityType}`,
      actorUserId: request.user.id,
      entityId: entityId(request),
      entityType,
      payload: {
        body: sanitizedValue(request.body),
        method: request.method,
        route,
        statusCode: reply.statusCode,
      },
      salonId: request.salonId,
      summary: `${request.method} ${route}`,
    }).catch((error: unknown) => {
      request.log.error({ error }, "audit log write failed");
    });
  });
}
