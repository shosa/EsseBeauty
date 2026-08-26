import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";

import {
  authSessions,
  loginActivity,
  passwordResetTokens,
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
import { parseBody, type SafeParseSchema } from "../../lib/http-validation.js";
import { inspectPublicToken, issuePublicToken } from "../../lib/public-tokens.js";
import {
  createCommunicationProviderRegistry,
  type CommunicationProviderRegistry,
} from "../../providers/communications.js";
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  sessionCookieForClient,
  SESSION_DURATION_MS,
  verifyPassword,
} from "./local-auth.js";

const userRoleSet = new Set<string>(USER_ROLES);
const PASSWORD_RESET_DURATION_MS = 30 * 60_000;
const resetRequestResponse = {
  accepted: true,
  message: "Se l'indirizzo è registrato, riceverai un link per reimpostare la password.",
} as const;

interface AuthRouteDependencies {
  providers?: CommunicationProviderRegistry;
}

class ResetTokenUnavailableError extends Error {}

function isUserRole(value: string): value is UserRole {
  return userRoleSet.has(value);
}

const loginBodySchema: SafeParseSchema<{ email: string; password: string }> = {
  safeParse(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {
        error: { fieldErrors: { body: ["Corpo della richiesta non valido"] } },
        success: false as const,
      };
    }

    const body = value as { email?: unknown; password?: unknown };
    const fields: Record<string, string[]> = {};
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email) {
      fields.email = ["Email obbligatoria"];
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fields.email = ["Email non valida"];
    }
    if (typeof body.password !== "string" || !body.password) {
      fields.password = ["Password obbligatoria"];
    }

    return Object.keys(fields).length > 0
      ? { error: { fieldErrors: fields }, success: false as const }
      : {
          data: { email, password: body.password as string },
          success: true as const,
        };
  },
};

const resetRequestBodySchema: SafeParseSchema<{ email: string }> = {
  safeParse(value) {
    const email = value && typeof value === "object" && !Array.isArray(value)
      ? String((value as { email?: unknown }).email ?? "").trim().toLowerCase()
      : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { error: { fieldErrors: { email: ["Email non valida"] } }, success: false as const };
    }
    return { data: { email }, success: true as const };
  },
};

const resetCompleteBodySchema: SafeParseSchema<{ new_password: string; token: string }> = {
  safeParse(value) {
    const body = value && typeof value === "object" && !Array.isArray(value)
      ? value as { new_password?: unknown; token?: unknown }
      : {};
    const fields: Record<string, string[]> = {};
    const password = typeof body.new_password === "string" ? body.new_password : "";
    const token = typeof body.token === "string" ? body.token : "";
    if (password.length < 10) fields.new_password = ["La password deve contenere almeno 10 caratteri"];
    if (!token) fields.token = ["Token obbligatorio"];
    return Object.keys(fields).length > 0
      ? { error: { fieldErrors: fields }, success: false as const }
      : { data: { new_password: password, token }, success: true as const };
  },
};

function requestMetadata(request: { headers: Record<string, unknown>; ip: string }) {
  const userAgent = request.headers["user-agent"];
  return {
    ipAddress: request.ip.slice(0, 128),
    userAgent: typeof userAgent === "string" ? userAgent.slice(0, 500) : null,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
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
    secure: process.env.COOKIE_SECURE !== "false",
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

export async function registerAuthRoutes(
  app: FastifyInstance,
  dependencies: AuthRouteDependencies = {},
): Promise<void> {
  const providers = dependencies.providers ?? createCommunicationProviderRegistry();
  app.post<{ Body: { email: string; password: string } }>(
    "/api/auth/login",
    async (request, reply) => {
      const body = parseBody(loginBodySchema, request, reply);
      if (!body) return;
      const rows = await app.db
        .select({
          active: users.active,
          id: users.id,
          salonId: users.salonId,
          passwordHash: userCredentials.passwordHash,
          passwordSalt: userCredentials.passwordSalt,
        })
        .from(users)
        .innerJoin(userCredentials, eq(userCredentials.userId, users.id))
        .where(eq(users.email, body.email.toLowerCase()));
      const user = rows[0];
      const passwordMatches = user
        ? await verifyPassword(
          body.password,
          user.passwordSalt,
          user.passwordHash,
        )
        : false;
      if (!user?.active || !passwordMatches) {
        await app.db.insert(loginActivity).values({
          email: body.email.toLowerCase(),
          failureReason: user && !user.active ? "USER_INACTIVE" : "INVALID_CREDENTIALS",
          ...requestMetadata(request),
          salonId: user?.salonId,
          success: false,
          userId: user?.id,
        });
        return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
      }
      await createSession(app, user.id, reply, sessionCookieForClient(request.headers["x-esse-client"] as string | undefined));
      await app.db.insert(loginActivity).values({
        email: body.email.toLowerCase(),
        ...requestMetadata(request),
        salonId: user.salonId,
        success: true,
        userId: user.id,
      });
      return { authenticated: true };
    },
  );

  app.post<{ Body: { email: string } }>(
    "/api/auth/password-reset/request",
    async (request, reply) => {
      const body = parseBody(resetRequestBodySchema, request, reply);
      if (!body) return;

      // Provider readiness is checked before account lookup so this response cannot
      // disclose whether an address belongs to an active account.
      if (providers.status().email !== "ready") {
        return reply.code(503).send({ error: "PROVIDER_NOT_CONFIGURED" });
      }

      const user = (await app.db
        .select({ active: users.active, id: users.id, salonId: users.salonId })
        .from(users)
        .where(eq(users.email, body.email)))[0];

      if (user?.active) {
        const expiresAt = new Date(Date.now() + PASSWORD_RESET_DURATION_MS);
        const token = issuePublicToken("password_reset", user.id, expiresAt);
        const tokenId = randomUUID();
        await app.db.transaction(async (tx) => {
          await tx.update(passwordResetTokens)
            .set({ usedAt: new Date() })
            .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));
          await tx.insert(passwordResetTokens).values({
            expiresAt,
            id: tokenId,
            salonId: user.salonId,
            tokenHash: token.tokenHash,
            userId: user.id,
          });
        });

        const baseUrl = (process.env.WEB_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
        const resetUrl = `${baseUrl}/reset-password/${token.raw}`;
        try {
          await providers.send({
            channel: "email",
            html: `<p>Hai richiesto di reimpostare la password EsseBeauty.</p><p><a href="${escapeHtml(resetUrl)}">Scegli una nuova password</a></p><p>Il link scade tra 30 minuti e può essere utilizzato una sola volta.</p>`,
            idempotencyKey: `password-reset:${tokenId}`,
            subject: "Reimposta la password EsseBeauty",
            to: body.email,
          });
        } catch (error) {
          await app.db.update(passwordResetTokens)
            .set({ usedAt: new Date() })
            .where(eq(passwordResetTokens.id, tokenId));
          request.log.warn({ error: error instanceof Error ? error.name : "ProviderError", tokenId }, "Password reset delivery failed");
        }
      }

      return reply.code(202).send(resetRequestResponse);
    },
  );

  app.post<{ Body: { new_password: string; token: string } }>(
    "/api/auth/password-reset/complete",
    async (request, reply) => {
      const body = parseBody(resetCompleteBodySchema, request, reply);
      if (!body) return;
      const inspected = inspectPublicToken(body.token, "password_reset");
      if (!inspected.ok || inspected.expired) {
        return reply.code(410).send({ error: "RESET_TOKEN_INVALID_OR_EXPIRED" });
      }
      const password = await hashPassword(body.new_password);
      try {
        await app.db.transaction(async (tx) => {
          const consumed = await tx.update(passwordResetTokens)
            .set({ usedAt: new Date() })
            .where(and(
              eq(passwordResetTokens.tokenHash, inspected.tokenHash),
              isNull(passwordResetTokens.usedAt),
              gt(passwordResetTokens.expiresAt, new Date()),
            ))
            .returning({ salonId: passwordResetTokens.salonId, userId: passwordResetTokens.userId });
          const reset = consumed[0];
          if (!reset) throw new ResetTokenUnavailableError();
          await tx.update(userCredentials).set({
            mustChangePassword: false,
            passwordHash: password.hash,
            passwordSalt: password.salt,
            updatedAt: new Date(),
          }).where(eq(userCredentials.userId, reset.userId));
          await tx.delete(authSessions).where(eq(authSessions.userId, reset.userId));
          const account = (await tx.select({ email: users.email }).from(users).where(eq(users.id, reset.userId)))[0];
          if (!account) throw new ResetTokenUnavailableError();
          await tx.insert(loginActivity).values({
            email: account.email,
            ...requestMetadata(request),
            salonId: reset.salonId,
            success: true,
            userId: reset.userId,
          });
        });
      } catch (error) {
        if (error instanceof ResetTokenUnavailableError) {
          return reply.code(410).send({ error: "RESET_TOKEN_INVALID_OR_EXPIRED" });
        }
        throw error;
      }
      return { changed: true };
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
