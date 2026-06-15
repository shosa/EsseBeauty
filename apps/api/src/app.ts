import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import Fastify, {
  type preHandlerHookHandler,
} from "fastify";
import { eq } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import { salonModules } from "@esse-beauty/db/schema";
import {
  invalidateModuleCache,
  isModuleKey,
  type ModuleKey,
} from "@esse-beauty/feature-flags";
import { authenticate, requireRole } from "./middleware/auth.js";
import { registerAuthRoutes } from "./routes/auth/index.js";
import { registerAppointmentRoutes } from "./routes/appointments/index.js";
import { registerPublicRoutes } from "./routes/public/index.js";
import { registerServiceRoutes } from "./routes/services/index.js";
import { registerStaffRoutes } from "./routes/staff/index.js";
import type { SupabaseAdmin } from "./routes/auth/supabase-admin.js";

interface ApiEnvironment {
  API_CORS_ORIGIN: string;
  SUPABASE_JWT_SECRET: string;
}

interface CreateAppOptions {
  db: DrizzleDB;
  env: ApiEnvironment;
  logger?: boolean;
  supabaseAdmin?: SupabaseAdmin;
}

interface SalonParams {
  id: string;
}

interface ModuleParams extends SalonParams {
  key: string;
}

interface ToggleModuleBody {
  enabled: boolean;
}

function parseOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const unavailableSupabaseAdmin: SupabaseAdmin = {
  async deleteUser() {
    throw new Error("Supabase admin is not configured");
  },
  async getUsers() {
    throw new Error("Supabase admin is not configured");
  },
  async inviteUser() {
    throw new Error("Supabase admin is not configured");
  },
};

export function createApp({
  db,
  env,
  logger = false,
  supabaseAdmin = unavailableSupabaseAdmin,
}: CreateAppOptions) {
  const app = Fastify({ logger });

  app.decorate("db", db);
  app.decorateRequest("salonId", "");

  void app.register(cookie);
  void app.register(jwt, {
    cookie: {
      cookieName: "sb-access-token",
      signed: false,
    },
    secret: env.SUPABASE_JWT_SECRET,
  });
  void app.register(cors, {
    origin: parseOrigins(env.API_CORS_ORIGIN),
  });
  void app.register(helmet);

  app.addHook("onRequest", async (request) => {
    if (
      request.headers.authorization ||
      request.cookies["sb-access-token"]
    ) {
      try {
        await request.jwtVerify();
      } catch {
        // Protected routes produce the authentication response in preHandler.
      }
    }
  });

  void app.register(rateLimit, {
    keyGenerator: (request) => request.user?.sub ?? request.ip,
    max: (request) => (request.user?.sub ? 1_000 : 100),
    timeWindow: "1 minute",
  });

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

  void registerAuthRoutes(app, supabaseAdmin);
  void registerServiceRoutes(app);
  void registerStaffRoutes(app);
  void registerAppointmentRoutes(app);
  void registerPublicRoutes(app);

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

  app.patch<{ Body: ToggleModuleBody; Params: ModuleParams }>(
    "/api/salons/:id/modules/:key",
    {
      preHandler: [authenticate, bindSalon, requireRole("owner")],
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["enabled"],
          properties: {
            enabled: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      if (!isModuleKey(request.params.key)) {
        return reply.code(400).send({ error: "INVALID_MODULE_KEY" });
      }

      const moduleKey: ModuleKey = request.params.key;
      await request.server.db
        .insert(salonModules)
        .values({
          salonId: request.params.id,
          moduleKey,
          enabled: request.body.enabled,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [salonModules.salonId, salonModules.moduleKey],
          set: {
            enabled: request.body.enabled,
            updatedAt: new Date(),
          },
        });

      invalidateModuleCache(request.params.id, moduleKey);

      return {
        module_key: moduleKey,
        enabled: request.body.enabled,
      };
    },
  );

  return app;
}
