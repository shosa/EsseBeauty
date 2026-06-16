import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, {
  type preHandlerHookHandler,
} from "fastify";
import { eq } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import { salonModules } from "@esse-beauty/db/schema";
import { authenticate } from "./middleware/auth.js";
import { registerAppointmentEventHooks } from "./jobs/appointment-events.js";
import { registerAuthRoutes } from "./routes/auth/index.js";
import { registerAppointmentRoutes } from "./routes/appointments/index.js";
import { registerCustomerRoutes } from "./routes/customers/index.js";
import { registerEnterpriseModuleRoutes } from "./routes/enterprise/index.js";
import { registerInventoryRoutes } from "./routes/inventory/index.js";
import { registerLoyaltyRoutes } from "./routes/loyalty/index.js";
import { registerMarketingRoutes } from "./routes/marketing/index.js";
import { registerPlatformRoutes } from "./routes/platform/index.js";
import { registerPublicRoutes } from "./routes/public/index.js";
import { registerReminderRoutes } from "./routes/reminders/index.js";
import { registerReportRoutes } from "./routes/reports/index.js";
import { registerReviewRoutes } from "./routes/reviews/index.js";
import { registerServiceRoutes } from "./routes/services/index.js";
import { registerSettingsRoutes } from "./routes/settings/index.js";
import { registerShellRoutes } from "./routes/shell/index.js";
import { registerStaffRoutes } from "./routes/staff/index.js";
import { registerWaitlistRoutes } from "./routes/waitlist/index.js";

interface ApiEnvironment {
  API_CORS_ORIGIN: string;
}

interface CreateAppOptions {
  db: DrizzleDB;
  env: ApiEnvironment;
  logger?: boolean;
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

export function createApp({
  db,
  env,
  logger = false,
}: CreateAppOptions) {
  const app = Fastify({ logger });

  app.decorate("db", db);
  app.decorateRequest("salonId", "");
  app.decorateRequest("user");

  void app.register(cookie);
  void app.register(cors, {
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
    origin: parseOrigins(env.API_CORS_ORIGIN),
  });
  void app.register(helmet);

  void app.register(rateLimit, {
    keyGenerator: (request) => request.user?.sub ?? request.ip,
    max: (request) => (request.user?.sub ? 1_000 : 100),
    timeWindow: "1 minute",
  });

  registerAppointmentEventHooks(app);

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

  void registerAuthRoutes(app);
  void registerServiceRoutes(app);
  void registerStaffRoutes(app);
  void registerAppointmentRoutes(app);
  void registerCustomerRoutes(app);
  void registerEnterpriseModuleRoutes(app);
  void registerPublicRoutes(app);
  void registerReminderRoutes(app);
  void registerReviewRoutes(app);
  void registerWaitlistRoutes(app);
  void registerLoyaltyRoutes(app);
  void registerMarketingRoutes(app);
  void registerInventoryRoutes(app);
  void registerReportRoutes(app);
  void registerSettingsRoutes(app);
  void registerShellRoutes(app);
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
