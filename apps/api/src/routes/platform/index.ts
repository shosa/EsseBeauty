import { randomUUID } from "node:crypto";
import type {
  FastifyInstance,
  FastifyReply,
  preHandlerHookHandler,
} from "fastify";
import { and, asc, eq, sql } from "drizzle-orm";

import {
  appointments,
  authSessions,
  marketingCampaigns,
  platformAuditLog,
  platformAdmins,
  platformAdminSessions,
  platformModuleCatalog,
  platformPlans,
  platformSystemTemplates,
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
          onboarding_completed: sql<boolean>`${salons.onboardingCompletedAt} is not null`,
          onboarding_step: salons.onboardingStep,
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

  app.get(
    "/api/platform/overview",
    { preHandler: [authenticatePlatform] },
    async () => {
      const [salonRows, moduleRows, appointmentRows, campaignRows, sessionRows] =
        await Promise.all([
          app.db
            .select({
              active: sql<number>`count(*) filter (where ${salons.active} = true)::int`,
              churnRisk: sql<number>`count(*) filter (where ${salons.platformStatus} = 'churn_risk')::int`,
              suspended: sql<number>`count(*) filter (where ${salons.platformStatus} = 'suspended')::int`,
              total: sql<number>`count(*)::int`,
              trial: sql<number>`count(*) filter (where ${salons.platformStatus} = 'trial')::int`,
            })
            .from(salons),
          app.db
            .select({
              enabled: sql<number>`count(*) filter (where ${salonModules.enabled} = true)::int`,
              module_key: salonModules.moduleKey,
            })
            .from(salonModules)
            .groupBy(salonModules.moduleKey),
          app.db
            .select({ count: sql<number>`count(*)::int` })
            .from(appointments),
          app.db
            .select({ count: sql<number>`count(*)::int` })
            .from(marketingCampaigns),
          app.db
            .select({ count: sql<number>`count(*)::int` })
            .from(authSessions),
        ]);

      return {
        appointments: appointmentRows[0]?.count ?? 0,
        campaigns: campaignRows[0]?.count ?? 0,
        module_usage: moduleRows,
        salons: salonRows[0] ?? { active: 0, churnRisk: 0, suspended: 0, total: 0, trial: 0 },
        sessions: sessionRows[0]?.count ?? 0,
      };
    },
  );

  app.get(
    "/api/platform/plans",
    { preHandler: [authenticatePlatform] },
    async () => app.db.select().from(platformPlans).orderBy(asc(platformPlans.displayOrder), asc(platformPlans.name)),
  );

  app.post<{
    Body: { active?: boolean; code: string; description?: string; included_modules?: string[]; limits?: Record<string, unknown>; name: string };
  }>(
    "/api/platform/plans",
    { preHandler: [authenticatePlatform] },
    async (request, reply) => {
      if (!request.body.name?.trim() || !request.body.code?.trim()) {
        return reply.code(400).send({ error: "PLAN_REQUIRED" });
      }
      const rows = await app.db
        .insert(platformPlans)
        .values({
          active: request.body.active ?? true,
          code: request.body.code.trim(),
          description: request.body.description,
          includedModules: request.body.included_modules ?? [],
          limits: request.body.limits ?? {},
          name: request.body.name.trim(),
          updatedAt: new Date(),
        })
        .returning();
      return reply.code(201).send(rows[0]);
    },
  );

  app.get(
    "/api/platform/module-catalog",
    { preHandler: [authenticatePlatform] },
    async () => app.db.select().from(platformModuleCatalog).orderBy(asc(platformModuleCatalog.name)),
  );

  app.put<{
    Body: { default_enabled?: boolean; description?: string; globally_enabled?: boolean; module_key: string; name: string; schema?: Record<string, unknown> };
  }>(
    "/api/platform/module-catalog",
    { preHandler: [authenticatePlatform] },
    async (request, reply) => {
      if (!isModuleKey(request.body.module_key)) {
        return reply.code(400).send({ error: "INVALID_MODULE_KEY" });
      }
      const rows = await app.db
        .insert(platformModuleCatalog)
        .values({
          configurationSchema: request.body.schema ?? {},
          defaultEnabled: request.body.default_enabled ?? false,
          description: request.body.description,
          globallyEnabled: request.body.globally_enabled ?? true,
          moduleKey: request.body.module_key,
          name: request.body.name,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          set: {
            configurationSchema: request.body.schema ?? {},
            defaultEnabled: request.body.default_enabled ?? false,
            description: request.body.description,
            globallyEnabled: request.body.globally_enabled ?? true,
            name: request.body.name,
            updatedAt: new Date(),
          },
          target: platformModuleCatalog.moduleKey,
        })
        .returning();
      return rows[0];
    },
  );

  app.get(
    "/api/platform/audit-log",
    { preHandler: [authenticatePlatform] },
    async () =>
      app.db
        .select()
        .from(platformAuditLog)
        .orderBy(sql`${platformAuditLog.createdAt} desc`)
        .limit(250),
  );

  app.get(
    "/api/platform/system-templates",
    { preHandler: [authenticatePlatform] },
    async () => app.db.select().from(platformSystemTemplates).orderBy(asc(platformSystemTemplates.key)),
  );

  app.put<{
    Body: { active?: boolean; body: string; channel?: "in_app" | "email" | "sms" | "push"; key: string; subject?: string; variables?: string[] };
  }>(
    "/api/platform/system-templates",
    { preHandler: [authenticatePlatform] },
    async (request) => {
      const channel = request.body.channel ?? "email";
      const rows = await app.db
        .insert(platformSystemTemplates)
        .values({
          active: request.body.active ?? true,
          body: request.body.body,
          channel,
          key: request.body.key,
          subject: request.body.subject,
          updatedAt: new Date(),
          variables: request.body.variables ?? [],
        })
        .onConflictDoUpdate({
          set: {
            active: request.body.active ?? true,
            body: request.body.body,
            subject: request.body.subject,
            updatedAt: new Date(),
            variables: request.body.variables ?? [],
          },
          target: [platformSystemTemplates.key, platformSystemTemplates.channel],
        })
        .returning();
      return rows[0];
    },
  );

  app.post<{
    Body: {
      active?: boolean;
      locale?: string;
      name: string;
      owner: { email: string; full_name: string; password: string };
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
        !request.body.owner?.email?.trim() ||
        !request.body.owner?.full_name?.trim()
      ) {
        return reply.code(400).send({ error: "OWNER_REQUIRED" });
      }
      if (request.body.owner.password.length < 10) {
        return reply.code(400).send({ error: "PASSWORD_TOO_SHORT" });
      }

      const password = await hashPassword(request.body.owner.password);
      const salon = await app.db.transaction(async (tx) => {
        const salonRows = await tx
          .insert(salons)
          .values({
            active: request.body.active ?? true,
            locale: request.body.locale ?? "it-IT",
            name: request.body.name.trim(),
            slug: request.body.slug?.trim() || slugify(request.body.name),
            timezone: request.body.timezone ?? "Europe/Rome",
          })
          .returning();
        const createdSalon = salonRows[0]!;
        const userId = randomUUID();
        await tx.insert(users).values({
          email: request.body.owner.email.toLowerCase().trim(),
          fullName: request.body.owner.full_name.trim(),
          id: userId,
          role: "owner",
          salonId: createdSalon.id,
        });
        await tx.insert(userCredentials).values({
          mustChangePassword: true,
          passwordHash: password.hash,
          passwordSalt: password.salt,
          userId,
        });
        return createdSalon;
      });

      return reply.code(201).send(salon);
    },
  );

  app.patch<{
    Body: {
      active?: boolean;
      locale?: string;
      name?: string;
      plan_id?: string | null;
      platform_status?: "active" | "suspended" | "trial" | "churn_risk";
      slug?: string;
      trial_ends_at?: string | null;
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
        patch.planId = request.body.plan_id?.trim() || null;
      }
      if (typeof request.body.platform_status === "string") {
        patch.platformStatus = request.body.platform_status;
        patch.suspendedAt =
          request.body.platform_status === "suspended" ? new Date() : null;
      }
      if ("trial_ends_at" in request.body) {
        patch.trialEndsAt = request.body.trial_ends_at
          ? new Date(request.body.trial_ends_at)
          : null;
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

  app.get<{
    Params: { salonId: string };
  }>(
    "/api/platform/salons/:salonId/owner-access",
    { preHandler: [authenticatePlatform] },
    async (request, reply) => {
      const rows = await app.db
        .select({
          active: users.active,
          created_at: users.createdAt,
          email: users.email,
          full_name: users.fullName,
          id: users.id,
          last_login: sql<Date | null>`max(${authSessions.lastSeenAt})`,
          must_change_password: userCredentials.mustChangePassword,
          role: users.role,
        })
        .from(users)
        .innerJoin(userCredentials, eq(userCredentials.userId, users.id))
        .leftJoin(authSessions, eq(authSessions.userId, users.id))
        .where(
          and(
            eq(users.salonId, request.params.salonId),
            eq(users.role, "owner"),
          ),
        )
        .groupBy(users.id, userCredentials.mustChangePassword)
        .orderBy(asc(users.createdAt))
        .limit(1);
      return rows[0] ?? reply.code(404).send({ error: "OWNER_NOT_FOUND" });
    },
  );

  app.patch<{
    Body: { active: boolean; email: string; full_name: string };
    Params: { salonId: string };
  }>(
    "/api/platform/salons/:salonId/owner-access",
    { preHandler: [authenticatePlatform] },
    async (request, reply) => {
      if (!request.body.email?.trim() || !request.body.full_name?.trim()) {
        return reply.code(400).send({ error: "OWNER_REQUIRED" });
      }
      const ownerRows = await app.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.salonId, request.params.salonId), eq(users.role, "owner")))
        .orderBy(asc(users.createdAt))
        .limit(1);
      const owner = ownerRows[0];
      if (!owner) return reply.code(404).send({ error: "OWNER_NOT_FOUND" });

      const rows = await app.db
        .update(users)
        .set({
          active: request.body.active,
          email: request.body.email.toLowerCase().trim(),
          fullName: request.body.full_name.trim(),
        })
        .where(eq(users.id, owner.id))
        .returning({
          active: users.active,
          email: users.email,
          full_name: users.fullName,
          id: users.id,
          role: users.role,
        });
      return rows[0];
    },
  );

  app.post<{
    Body: { password: string };
    Params: { salonId: string };
  }>(
    "/api/platform/salons/:salonId/owner-access/reset-password",
    { preHandler: [authenticatePlatform] },
    async (request, reply) => {
      if (request.body.password.length < 10) {
        return reply.code(400).send({ error: "PASSWORD_TOO_SHORT" });
      }
      const ownerRows = await app.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.salonId, request.params.salonId), eq(users.role, "owner")))
        .orderBy(asc(users.createdAt))
        .limit(1);
      const owner = ownerRows[0];
      if (!owner) return reply.code(404).send({ error: "OWNER_NOT_FOUND" });

      const password = await hashPassword(request.body.password);
      await app.db
        .update(userCredentials)
        .set({
          mustChangePassword: true,
          passwordHash: password.hash,
          passwordSalt: password.salt,
          updatedAt: new Date(),
        })
        .where(eq(userCredentials.userId, owner.id));
      await app.db.delete(authSessions).where(eq(authSessions.userId, owner.id));
      return { reset: true };
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
