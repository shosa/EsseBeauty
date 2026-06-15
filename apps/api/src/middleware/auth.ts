import type { preHandlerHookHandler } from "fastify";
import { eq } from "drizzle-orm";

import { users } from "@esse-beauty/db/schema";
import {
  hasPermission,
  type PermissionKey,
  type UserRole,
} from "@esse-beauty/shared";

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  salon_id: string;
  sub: string;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
    };
    user: AuthenticatedUser;
  }
}

export const authenticate: preHandlerHookHandler = async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch {
    await reply.code(401).send({ error: "UNAUTHORIZED" });
    return;
  }

  const userRows = await request.server.db
    .select({
      active: users.active,
      id: users.id,
      role: users.role,
      salonId: users.salonId,
    })
    .from(users)
    .where(eq(users.id, request.user.sub));
  const user = userRows[0];

  if (!user?.active) {
    await reply.code(401).send({ error: "UNAUTHORIZED" });
    return;
  }

  request.user = {
    id: user.id,
    role: user.role,
    salon_id: user.salonId,
    sub: user.id,
  };
  request.salonId = user.salonId;
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
