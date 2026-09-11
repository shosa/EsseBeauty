import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyRequest } from "fastify";

import type { DrizzleDB } from "@esse-beauty/db";
import type { ReviewQueue } from "@esse-beauty/comms-contracts";

import { registerCommunicationSettingsRoutes } from "./routes/communications/settings.js";
import { registerCommunicationRoutes } from "./routes/communications/index.js";
import { registerReminderRoutes } from "./routes/reminders/index.js";
import { registerReviewRoutes } from "./routes/reviews/index.js";
import { registerWhatsAppWebhookRoutes } from "./routes/webhooks/whatsapp.js";

interface CommunicationsAppEnvironment {
  API_CORS_ORIGIN: string;
}

interface CreateAppOptions {
  db: DrizzleDB;
  env: CommunicationsAppEnvironment;
  logger?: boolean;
  loggerStream?: { write(message: string): void };
  reviewQueue?: ReviewQueue;
}

function parseOrigins(value: string): true | string[] {
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.includes("*") ? true : origins;
}

export function maskSensitiveRequestUrl(url: string): string {
  return url.replace(
    /(\/api\/public\/reviews\/(?:resolve|submit)\?)[^#]*/gi,
    "$1[REDACTED]",
  );
}

function requestLogSerializer(request: FastifyRequest) {
  return {
    host: request.headers.host,
    method: request.method,
    remoteAddress: request.ip,
    remotePort: request.socket.remotePort,
    url: maskSensitiveRequestUrl(request.url),
  };
}

export function createApp({
  db,
  env,
  logger = false,
  loggerStream,
  reviewQueue,
}: CreateAppOptions) {
  const app = Fastify({
    logger: logger
      ? {
          ...(loggerStream ? { stream: loggerStream } : {}),
          serializers: { req: requestLogSerializer },
        }
      : false,
  });

  app.decorate("db", db);
  app.decorateRequest("salonId", "");
  app.decorateRequest("user");

  void app.register(cookie);
  void app.register(cors, {
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    origin: parseOrigins(env.API_CORS_ORIGIN),
  });
  void app.register(helmet);

  void app.register(rateLimit, {
    keyGenerator: (request) => request.user?.sub ?? request.ip,
    max: (request) => (request.user?.sub ? 1_000 : 100),
    timeWindow: "1 minute",
  });

  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

  void registerCommunicationSettingsRoutes(app);
  registerCommunicationRoutes(app);
  registerWhatsAppWebhookRoutes(app);
  void registerReminderRoutes(app);
  void registerReviewRoutes(app, { reviewQueue });

  return app;
}
