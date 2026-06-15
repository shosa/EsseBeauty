import type { preHandlerHookHandler } from "fastify";
import { and, eq, gt } from "drizzle-orm";

import { authSessions, users } from "@esse-beauty/db/schema";
import {
  hasPermission,
  type PermissionKey,
  type UserRole,
} from "@esse-beauty/shared";
import {
  hashSessionToken,
  SESSION_COOKIE,
} from "../routes/auth/local-auth.js";

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  salon_id: string;
  sub: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user: AuthenticatedUser;
  }
}

export const authenticate: preHandlerHookHandler = async (request, reply) => {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) {
    await reply.code(401).send({ error: "UNAUTHORIZED" });
    return;
  }
  const rows = await request.server.db
    .select({
      active: users.active,
      id: users.id,
      role: users.role,
      salonId: users.salonId,
      sessionId: authSessions.id,
    })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(
      and(
        eq(authSessions.tokenHash, hashSessionToken(token)),
        gt(authSessions.expiresAt, new Date()),
      ),
    );
  const session = rows[0];
  if (!session?.active) {
    await reply.code(401).send({ error: "UNAUTHORIZED" });
    return;
  }
  request.user = {
    id: session.id,
    role: session.role,
    salon_id: session.salonId,
    sub: session.id,
  };
  request.salonId = session.salonId;
  void request.server.db
    .update(authSessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(authSessions.id, session.sessionId));
};

export function requireRole(...roles: UserRole[]): preHandlerHookHandler {
  return async function roleGuard(request, reply): Promise<void> {
    if (!roles.includes(request.user.role)) {
      await reply.code(403).send({ error: "ROLE_DENIED" });
    }
  };
}

export function requirePermission(
  permission: PermissionKey,
): preHandlerHookHandler {
  return async function permissionGuard(request, reply): Promise<void> {
    const granted = await hasPermission(
      request.user.id,
      permission,
      request.server.db,
    );

    if (!granted) {
      await reply.code(403).send({
        error: "PERMISSION_DENIED",
        required: permission,
      });
    }
  };
}
