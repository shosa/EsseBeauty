import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, {
  type FastifyRequest,
  type preHandlerHookHandler,
} from "fastify";
import { eq } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import { salonModules } from "@esse-beauty/db/schema";
import type { CommunicationProviderRegistry } from "@esse-beauty/comms-contracts";

import { authenticate } from "./middleware/auth.js";
import { registerAuditLogHooks } from "./jobs/audit-log.js";
import { registerCustomerRoutes } from "./routes/customers/index.js";
import { registerEnterpriseModuleRoutes } from "./routes/enterprise/index.js";
import { registerOnboardingRoutes } from "./routes/onboarding/index.js";
import { registerPlatformRoutes } from "./routes/platform/index.js";
import { registerPublicRoutes } from "./routes/public/index.js";
import { registerPublicCustomerAuthRoutes } from "./routes/public/customer-auth.js";
import { registerPublicMessageRoutes } from "./routes/public/messages.js";
import { registerPublicPushSubscriptionRoutes } from "./routes/public/push-subscriptions.js";
import { registerReportRoutes } from "./routes/reports/index.js";
import { registerServiceRoutes } from "./routes/services/index.js";
import { registerSettingsRoutes } from "./routes/settings/index.js";
import { registerShellRoutes } from "./routes/shell/index.js";
import { registerStaffAppRoutes } from "./routes/staff-app/index.js";
import { registerStaffRoutes } from "./routes/staff/index.js";

interface ApiEnvironment {
  API_CORS_ORIGIN: string;
}

interface CreateAppOptions {
  authProviders?: CommunicationProviderRegistry;
  db: DrizzleDB;
  env: ApiEnvironment;
  logger?: boolean;
  loggerStream?: { write(message: string): void };
}

interface SalonParams {
  id: string;
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
    /(\/api\/public\/(?:consents|reviews\/token)\/)[^/?#]+/gi,
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
  authProviders,
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

  registerAuditLogHooks(app);

  const bindSalon: preHandlerHookHandler = async (request, reply) => {
    const params = request.params as SalonParams;

    if (params.id !== request.salonId) {
      await reply.code(403).send({ error: "FORBIDDEN" });
    }
  };

  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

  void registerServiceRoutes(app);
  void registerStaffRoutes(app);
  void registerCustomerRoutes(app);
  void registerEnterpriseModuleRoutes(app);
  void registerPublicRoutes(app);
  void registerPublicCustomerAuthRoutes(app, { providers: authProviders });
  void registerPublicPushSubscriptionRoutes(app);
  void registerPublicMessageRoutes(app);
  void registerOnboardingRoutes(app);
  void registerReportRoutes(app);
  void registerSettingsRoutes(app);
  void registerShellRoutes(app);
  void registerStaffAppRoutes(app);
  void registerPlatformRoutes(app);

  app.get<{ Params: SalonParams }>(
    "/api/salons/:id/modules",
    { preHandler: [authenticate, bindSalon] },
    async (request) =>
      request.server.db
        .select({
          module_key: salonModules.moduleKey,
          enabled: salonModules.enabled,
        })
        .from(salonModules)
        .where(eq(salonModules.salonId, request.params.id)),
  );

  return app;
}
