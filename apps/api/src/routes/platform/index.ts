import { randomUUID } from "node:crypto";
import type {
  FastifyInstance,
  FastifyReply,
  preHandlerHookHandler,
} from "fastify";
import { and, asc, eq, sql } from "drizzle-orm";

import {
  platformAdmins,
  platformAdminSessions,
  salonModules,
  salons,
  userCredentials,
  users,
} from "@esse-beauty/db/schema";
import {
  invalidateModuleCache,
  isModuleKey,
  type ModuleKey,
} from "@esse-beauty/feature-flags";

import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  SESSION_DURATION_MS,
  verifyPassword,
} from "../auth/local-auth.js";

const PLATFORM_SESSION_COOKIE = "esse-platform-session";

interface PlatformAdminContext {
  email: string;
  fullName: string;
  id: string;
  sub: string;
}

declare module "fastify" {
  interface FastifyRequest {
    platformAdmin: PlatformAdminContext;
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function setPlatformSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(PLATFORM_SESSION_COOKIE, token, {
    httpOnly: true,
    maxAge: SESSION_DURATION_MS / 1000,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

async function createPlatformSession(
  app: FastifyInstance,
  adminId: string,
  reply: FastifyReply,
): Promise<void> {
  const token = createSessionToken();
  await app.db.insert(platformAdminSessions).values({
    adminId,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
  });
  setPlatformSessionCookie(reply, token);
}

export const authenticatePlatform: preHandlerHookHandler = async (
  request,
  reply,
) => {
  const token = request.cookies[PLATFORM_SESSION_COOKIE];
  if (!token) {
    await reply.code(401).send({ error: "UNAUTHENTICATED" });
    return;
  }

  const rows = await request.server.db
    .select({
      active: platformAdmins.active,
      adminId: platformAdmins.id,
      email: platformAdmins.email,
      expiresAt: platformAdminSessions.expiresAt,
      fullName: platformAdmins.fullName,
      sessionId: platformAdminSessions.id,
    })
    .from(platformAdminSessions)
    .innerJoin(
      platformAdmins,
      eq(platformAdmins.id, platformAdminSessions.adminId),
    )
    .where(
      and(
        eq(platformAdminSessions.tokenHash, hashSessionToken(token)),
        sql`${platformAdminSessions.revokedAt} is null`,
      ),
    );

  const session = rows[0];
  if (!session?.active || session.expiresAt.getTime() <= Date.now()) {
    await reply.code(401).send({ error: "UNAUTHENTICATED" });
    return;
  }

  request.platformAdmin = {
    email: session.email,
    fullName: session.fullName,
    id: session.adminId,
    sub: session.adminId,
  };

  await request.server.db
    .update(platformAdminSessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(platformAdminSessions.id, session.sessionId));
};

export async function registerPlatformRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.decorateRequest("platformAdmin");

  app.get("/api/platform/auth/bootstrap/status", async () => {
    const rows = await app.db
      .select({ count: sql<number>`count(*)` })
      .from(platformAdmins);
    return { required: Number(rows[0]?.count ?? 0) === 0 };
  });

  app.post<{
    Body: { email: string; full_name: string; password: string };
  }>("/api/platform/auth/bootstrap", async (request, reply) => {
    const counts = await app.db
      .select({ count: sql<number>`count(*)` })
      .from(platformAdmins);
    if (Number(counts[0]?.count ?? 0) > 0) {
      return reply.code(409).send({ error: "BOOTSTRAP_ALREADY_COMPLETED" });
    }
    if (request.body.password.length < 10) {
      return reply.code(400).send({ error: "PASSWORD_TOO_SHORT" });
    }

    const password = await hashPassword(request.body.password);
    const rows = await app.db
      .insert(platformAdmins)
      .values({
        email: request.body.email.toLowerCase(),
        fullName: request.body.full_name,
        passwordHash: password.hash,
        passwordSalt: password.salt,
      })
      .returning();
    const admin = rows[0]!;
    await createPlatformSession(app, admin.id, reply);

    return reply.code(201).send({
      admin: {
        email: admin.email,
        full_name: admin.fullName,
        id: admin.id,
      },
      created: true,
    });
  });

  app.post<{ Body: { email: string; password: string } }>(
    "/api/platform/auth/login",
    async (request, reply) => {
      const rows = await app.db
        .select()
        .from(platformAdmins)
        .where(eq(platformAdmins.email, request.body.email.toLowerCase()));
      const admin = rows[0];

      if (
        !admin?.active ||
        !(await verifyPassword(
          request.body.password,
          admin.passwordSalt,
          admin.passwordHash,
        ))
      ) {
        return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
      }

      await app.db
        .update(platformAdmins)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(platformAdmins.id, admin.id));
      await createPlatformSession(app, admin.id, reply);

      return { authenticated: true };
    },
  );

  app.post("/api/platform/auth/logout", async (request, reply) => {
    const token = request.cookies[PLATFORM_SESSION_COOKIE];
    if (token) {
      await app.db
        .delete(platformAdminSessions)
        .where(
          eq(platformAdminSessions.tokenHash, hashSessionToken(token)),
        );
    }
    reply.clearCookie(PLATFORM_SESSION_COOKIE, { path: "/" });
    return { authenticated: false };
  });

  app.get(
    "/api/platform/auth/me",
    { preHandler: [authenticatePlatform] },
    async (request) => ({
      admin: {
        email: request.platformAdmin.email,
        full_name: request.platformAdmin.fullName,
        id: request.platformAdmin.id,
      },
    }),
  );

  app.get(
    "/api/platform/salons",
    { preHandler: [authenticatePlatform] },
    async () =>
      app.db
        .select({
          active: salons.active,
          created_at: salons.createdAt,
          id: salons.id,
          locale: salons.locale,
          modules_enabled: sql<number>`count(${salonModules.id}) filter (where ${salonModules.enabled} = true)::int`,
          name: salons.name,
          plan_id: salons.planId,
          slug: salons.slug,
          timezone: salons.timezone,
          updated_at: salons.updatedAt,
        })
        .from(salons)
        .leftJoin(salonModules, eq(salonModules.salonId, salons.id))
        .groupBy(salons.id)
        .orderBy(asc(salons.name)),
  );

  app.post<{
    Body: {
      active?: boolean;
      locale?: string;
      name: string;
      owner?: { email: string; full_name: string; password: string };
      slug?: string;
      timezone?: string;
    };
  }>(
    "/api/platform/salons",
    { preHandler: [authenticatePlatform] },
    async (request, reply) => {
      if (!request.body.name?.trim()) {
        return reply.code(400).send({ error: "NAME_REQUIRED" });
      }
      if (
        request.body.owner &&
        request.body.owner.password.length < 10
      ) {
        return reply.code(400).send({ error: "PASSWORD_TOO_SHORT" });
      }

      const salonRows = await app.db
        .insert(salons)
        .values({
          active: request.body.active ?? true,
          locale: request.body.locale ?? "it-IT",
          name: request.body.name.trim(),
          slug: request.body.slug?.trim() || slugify(request.body.name),
          timezone: request.body.timezone ?? "Europe/Rome",
        })
        .returning();
      const salon = salonRows[0]!;

      if (request.body.owner) {
        const password = await hashPassword(request.body.owner.password);
        const userId = randomUUID();
        await app.db.insert(users).values({
          email: request.body.owner.email.toLowerCase(),
          fullName: request.body.owner.full_name,
          id: userId,
          role: "owner",
          salonId: salon.id,
        });
        await app.db.insert(userCredentials).values({
          passwordHash: password.hash,
          passwordSalt: password.salt,
          userId,
        });
      }

      return reply.code(201).send(salon);
    },
  );

  app.patch<{
    Body: {
      active?: boolean;
      locale?: string;
      name?: string;
      plan_id?: string | null;
      slug?: string;
      timezone?: string;
    };
    Params: { salonId: string };
  }>(
    "/api/platform/salons/:salonId",
    { preHandler: [authenticatePlatform] },
    async (request, reply) => {
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof request.body.active === "boolean") {
        patch.active = request.body.active;
      }
      if (typeof request.body.name === "string") {
        patch.name = request.body.name.trim();
      }
      if (typeof request.body.slug === "string") {
        patch.slug = request.body.slug.trim();
      }
      if (typeof request.body.timezone === "string") {
        patch.timezone = request.body.timezone.trim();
      }
      if (typeof request.body.locale === "string") {
        patch.locale = request.body.locale.trim();
      }
      if ("plan_id" in request.body) {
        patch.planId = request.body.plan_id;
      }

      const rows = await app.db
        .update(salons)
        .set(patch)
        .where(eq(salons.id, request.params.salonId))
        .returning();
      const salon = rows[0];
      if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });

      return salon;
    },
  );

  app.get<{ Params: { salonId: string } }>(
    "/api/platform/salons/:salonId/modules",
    { preHandler: [authenticatePlatform] },
    async (request) =>
      app.db
        .select({
          enabled: salonModules.enabled,
          module_key: salonModules.moduleKey,
          updated_at: salonModules.updatedAt,
        })
        .from(salonModules)
        .where(eq(salonModules.salonId, request.params.salonId)),
  );

  app.patch<{
    Body: { enabled: boolean };
    Params: { key: string; salonId: string };
  }>(
    "/api/platform/salons/:salonId/modules/:key",
    {
      preHandler: [authenticatePlatform],
      schema: {
        body: {
          additionalProperties: false,
          properties: {
            enabled: { type: "boolean" },
          },
          required: ["enabled"],
          type: "object",
        },
      },
    },
    async (request, reply) => {
      if (!isModuleKey(request.params.key)) {
        return reply.code(400).send({ error: "INVALID_MODULE_KEY" });
      }

      const salonRows = await app.db
        .select({ id: salons.id })
        .from(salons)
        .where(eq(salons.id, request.params.salonId));
      if (!salonRows[0]) {
        return reply.code(404).send({ error: "SALON_NOT_FOUND" });
      }

      const moduleKey: ModuleKey = request.params.key;
      await app.db
        .insert(salonModules)
        .values({
          enabled: request.body.enabled,
          moduleKey,
          salonId: request.params.salonId,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          set: {
            enabled: request.body.enabled,
            updatedAt: new Date(),
          },
          target: [salonModules.salonId, salonModules.moduleKey],
        });

      invalidateModuleCache(request.params.salonId, moduleKey);

      return {
        enabled: request.body.enabled,
        module_key: moduleKey,
      };
    },
  );
}
