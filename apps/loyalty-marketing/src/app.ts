import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyRequest } from "fastify";

import type { DrizzleDB } from "@esse-beauty/db";
import type { CommunicationProviderRegistry } from "@esse-beauty/comms-contracts";

import { registerLoyaltyRoutes } from "./routes/loyalty/index.js";
import { registerMarketingRoutes } from "./routes/marketing/index.js";
import type { CampaignQueue } from "./jobs/marketing.js";

interface LoyaltyMarketingAppEnvironment {
  API_CORS_ORIGIN: string;
}

interface CreateAppOptions {
  campaignProviders?: CommunicationProviderRegistry;
  campaignQueue?: CampaignQueue;
  db: DrizzleDB;
  env: LoyaltyMarketingAppEnvironment;
  logger?: boolean;
  loggerStream?: { write(message: string): void };
}

function parseOrigins(value: string): true | string[] {
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.includes("*") ? true : origins;
}

function requestLogSerializer(request: FastifyRequest) {
  return {
    host: request.headers.host,
    method: request.method,
    remoteAddress: request.ip,
    remotePort: request.socket.remotePort,
    url: request.url,
  };
}

export function createApp({
  campaignProviders,
  campaignQueue,
  db,
  env,
  logger = false,
  loggerStream,
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

  void registerLoyaltyRoutes(app);
  void registerMarketingRoutes(app, {
    campaignQueue,
    providers: campaignProviders,
  });

  return app;
}
