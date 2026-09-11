import type { preHandlerHookHandler } from "fastify";
import { and, eq, gt } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import { authSessions, users } from "@esse-beauty/db/schema";
import {
  hasPermission,
  type PermissionKey,
  type UserRole,
} from "@esse-beauty/shared";
import {
  hashSessionToken,
  sessionCookieForClient,
} from "@esse-beauty/server-shared";

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  salon_id: string;
  sub: string;
}

// Every other service picks up the FastifyInstance.db / FastifyRequest.salonId
// augmentation as a side effect of importing @esse-beauty/feature-flags for
// module gating. Identity has no module-gated routes (login isn't
// salon-scoped the same way), so it declares the same augmentation directly
// instead of taking on an otherwise-unused dependency.
declare module "fastify" {
  interface FastifyInstance {
    db: DrizzleDB;
  }
  interface FastifyRequest {
    salonId: string;
    user: AuthenticatedUser;
  }
}

export const authenticate: preHandlerHookHandler = async (request, reply) => {
  const cookieName = sessionCookieForClient(request.headers?.["x-esse-client"] as string | undefined);
  const token = request.cookies[cookieName];
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
