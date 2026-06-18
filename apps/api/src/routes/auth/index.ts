import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import { and, desc, eq, sql } from "drizzle-orm";

import {
  authSessions,
  salons,
  userCredentials,
  userPermissions,
  users,
} from "@esse-beauty/db/schema";
import {
  invalidatePermissionCache,
  isPermissionKey,
  PERMISSION_KEYS,
  resolvePermissions,
  USER_ROLES,
  type UserRole,
} from "@esse-beauty/shared";

import {
  authenticate,
  requirePermission,
  requireRole,
} from "../../middleware/auth.js";
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  sessionCookieForClient,
  SESSION_DURATION_MS,
  verifyPassword,
} from "./local-auth.js";

const userRoleSet = new Set<string>(USER_ROLES);

function isUserRole(value: string): value is UserRole {
  return userRoleSet.has(value);
}

function setSessionCookie(
  reply: FastifyReply,
  token: string,
  cookieName: string,
) {
  reply.setCookie(cookieName, token, {
    httpOnly: true,
    maxAge: SESSION_DURATION_MS / 1000,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

async function createSession(
  app: FastifyInstance,
  userId: string,
  reply: FastifyReply,
  cookieName: string,
) {
  const token = createSessionToken();
  await app.db.insert(authSessions).values({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
  });
  setSessionCookie(reply, token, cookieName);
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { email: string; password: string } }>(
    "/api/auth/login",
    async (request, reply) => {
      const rows = await app.db
        .select({
          active: users.active,
          id: users.id,
          passwordHash: userCredentials.passwordHash,
          passwordSalt: userCredentials.passwordSalt,
        })
        .from(users)
        .innerJoin(userCredentials, eq(userCredentials.userId, users.id))
        .where(eq(users.email, request.body.email.toLowerCase()));
      const user = rows[0];
      if (
        !user?.active ||
        !(await verifyPassword(
          request.body.password,
          user.passwordSalt,
          user.passwordHash,
        ))
      ) {
        return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
      }
      await createSession(app, user.id, reply, sessionCookieForClient(request.headers["x-esse-client"] as string | undefined));
      return { authenticated: true };
    },
  );

  app.post("/api/auth/logout", async (request, reply) => {
    const cookieName = sessionCookieForClient(request.headers["x-esse-client"] as string | undefined);
    const token = request.cookies[cookieName];
    if (token) {
      await app.db
        .delete(authSessions)
        .where(eq(authSessions.tokenHash, hashSessionToken(token)));
    }
    reply.clearCookie(cookieName, { path: "/" });
    return { authenticated: false };
  });

  app.get(
    "/api/auth/me",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userRows = await app.db
        .select()
        .from(users)
        .where(eq(users.id, request.user.id));
      const user = userRows[0];
      if (!user) return reply.code(404).send({ error: "USER_NOT_FOUND" });
      const salonRows = await app.db
        .select()
        .from(salons)
        .where(eq(salons.id, user.salonId));
      const salon = salonRows[0];
      if (!salon) return reply.code(404).send({ error: "SALON_NOT_FOUND" });
      return {
        user: {
          active: user.active,
          email: user.email,
          full_name: user.fullName,
          id: user.id,
          role: user.role,
          salon_id: user.salonId,
        },
        salon: {
          id: salon.id,
          name: salon.name,
          onboarding_completed: Boolean(salon.onboardingCompletedAt),
          onboarding_step: salon.onboardingStep,
          slug: salon.slug,
        },
        permissions: await resolvePermissions(user.id, user.role, app.db),
      };
    },
  );

  app.post<{ Body: { current_password: string; new_password: string } }>(
    "/api/auth/change-password",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (request.body.new_password.length < 10) {
        return reply.code(400).send({ error: "PASSWORD_TOO_SHORT" });
      }
      const rows = await app.db
        .select()
        .from(userCredentials)
        .where(eq(userCredentials.userId, request.user.id));
      const current = rows[0];
      if (
        !current ||
        !(await verifyPassword(
          request.body.current_password,
          current.passwordSalt,
          current.passwordHash,
        ))
      ) {
        return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
      }
      const password = await hashPassword(request.body.new_password);
      await app.db
        .update(userCredentials)
        .set({
          passwordHash: password.hash,
          passwordSalt: password.salt,
          mustChangePassword: false,
          updatedAt: new Date(),
        })
        .where(eq(userCredentials.userId, request.user.id));
      return { changed: true };
    },
  );

  app.post<{
    Body: {
      email: string;
      full_name: string;
      role: UserRole;
      password?: string;
    };
  }>(
    "/api/auth/invite",
    { preHandler: [authenticate, requireRole("owner")] },
    async (request, reply) => {
      if (!isUserRole(request.body.role)) {
        return reply.code(400).send({ error: "INVALID_ROLE" });
      }
      const temporaryPassword =
        request.body.password ?? createSessionToken().slice(0, 16);
      const password = await hashPassword(temporaryPassword);
      const userId = randomUUID();
      await app.db.insert(users).values({
        id: userId,
        salonId: request.salonId,
        email: request.body.email.toLowerCase(),
        fullName: request.body.full_name,
        role: request.body.role,
      });
      await app.db.insert(userCredentials).values({
        userId,
        passwordHash: password.hash,
        passwordSalt: password.salt,
        mustChangePassword: !request.body.password,
      });
      return reply.code(201).send({
        id: userId,
        email: request.body.email,
        full_name: request.body.full_name,
        role: request.body.role,
        ...(request.body.password ? {} : { temporary_password: temporaryPassword }),
      });
    },
  );

  app.get(
    "/api/auth/users",
    { preHandler: [authenticate, requireRole("owner", "manager")] },
    async (request) => {
      const salonUsers = await app.db
        .select({
          active: users.active,
          email: users.email,
          full_name: users.fullName,
          id: users.id,
          role: users.role,
          last_login: sql<Date | null>`max(${authSessions.lastSeenAt})`,
        })
        .from(users)
        .leftJoin(authSessions, eq(authSessions.userId, users.id))
        .where(eq(users.salonId, request.salonId))
        .groupBy(users.id)
        .orderBy(users.fullName);
      const overrides = await app.db
        .select()
        .from(userPermissions)
        .where(eq(userPermissions.salonId, request.salonId));
      return salonUsers.map((user) => ({
        ...user,
        permission_overrides: overrides
          .filter((override) => override.userId === user.id)
          .map((override) => ({
            granted: override.granted,
            permission_key: override.permissionKey,
          })),
      }));
    },
  );

  app.patch<{
    Body: { granted: boolean; permission_key: string };
    Params: { userId: string };
  }>(
    "/api/auth/users/:userId/permissions",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_USERS),
      ],
    },
    async (request, reply) => {
      if (!isPermissionKey(request.body.permission_key)) {
        return reply.code(400).send({ error: "INVALID_PERMISSION_KEY" });
      }
      await app.db
        .insert(userPermissions)
        .values({
          userId: request.params.userId,
          salonId: request.salonId,
          permissionKey: request.body.permission_key,
          granted: request.body.granted,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            userPermissions.userId,
            userPermissions.permissionKey,
          ],
          set: {
            granted: request.body.granted,
            updatedAt: new Date(),
          },
        });
      invalidatePermissionCache(request.params.userId);
      return request.body;
    },
  );

  app.patch<{ Body: { active: boolean }; Params: { userId: string } }>(
    "/api/auth/users/:userId",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_USERS),
      ],
    },
    async (request, reply) => {
      if (request.params.userId === request.user.id && !request.body.active) {
        return reply
          .code(400)
          .send({ error: "SELF_DEACTIVATION_FORBIDDEN" });
      }
      const rows = await app.db
        .update(users)
        .set({ active: request.body.active })
        .where(
          and(
            eq(users.id, request.params.userId),
            eq(users.salonId, request.salonId),
          ),
        )
        .returning();
      if (!rows[0]) return reply.code(404).send({ error: "USER_NOT_FOUND" });
      if (!request.body.active) {
        await app.db
          .delete(authSessions)
          .where(eq(authSessions.userId, request.params.userId));
      }
      return { active: request.body.active, id: request.params.userId };
    },
  );
}
