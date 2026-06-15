import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";

import {
  salons,
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
import type { SupabaseAdmin } from "./supabase-admin.js";

interface InviteBody {
  email: string;
  full_name: string;
  role: UserRole;
}

interface UserParams {
  userId: string;
}

interface PermissionBody {
  granted: boolean;
  permission_key: string;
}

interface ActiveBody {
  active: boolean;
}

const userRoleSet = new Set<string>(USER_ROLES);

function isUserRole(value: string): value is UserRole {
  return userRoleSet.has(value);
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  supabaseAdmin: SupabaseAdmin,
): Promise<void> {
  app.post<{ Body: InviteBody }>(
    "/api/auth/invite",
    {
      preHandler: [authenticate, requireRole("owner")],
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["email", "full_name", "role"],
          properties: {
            email: { type: "string", format: "email" },
            full_name: { type: "string", minLength: 1 },
            role: { type: "string", enum: [...USER_ROLES] },
          },
        },
      },
    },
    async (request, reply) => {
      if (!isUserRole(request.body.role)) {
        return reply.code(400).send({ error: "INVALID_ROLE" });
      }

      const invitedUser = await supabaseAdmin.inviteUser(request.body.email);

      try {
        await request.server.db.insert(users).values({
          id: invitedUser.id,
          salonId: request.user.salon_id,
          email: request.body.email,
          fullName: request.body.full_name,
          role: request.body.role,
          active: true,
        });
      } catch (error: unknown) {
        await supabaseAdmin.deleteUser(invitedUser.id);
        throw error;
      }

      return reply.code(201).send({
        id: invitedUser.id,
        email: request.body.email,
        full_name: request.body.full_name,
        role: request.body.role,
      });
    },
  );

  app.get(
    "/api/auth/me",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userRows = await request.server.db
        .select({
          active: users.active,
          email: users.email,
          fullName: users.fullName,
          id: users.id,
          role: users.role,
          salonId: users.salonId,
        })
        .from(users)
        .where(eq(users.id, request.user.id));
      const user = userRows[0];
      if (!user) {
        return reply.code(404).send({ error: "USER_NOT_FOUND" });
      }

      const salonRows = await request.server.db
        .select({
          id: salons.id,
          name: salons.name,
          slug: salons.slug,
        })
        .from(salons)
        .where(eq(salons.id, request.user.salon_id));
      const salon = salonRows[0];
      if (!salon) {
        return reply.code(404).send({ error: "SALON_NOT_FOUND" });
      }

      const permissions = await resolvePermissions(
        user.id,
        user.role,
        request.server.db,
      );

      return {
        user: {
          active: user.active,
          email: user.email,
          full_name: user.fullName,
          id: user.id,
          role: user.role,
          salon_id: user.salonId,
        },
        salon,
        permissions,
      };
    },
  );

  app.patch<{ Body: PermissionBody; Params: UserParams }>(
    "/api/auth/users/:userId/permissions",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_USERS),
      ],
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["permission_key", "granted"],
          properties: {
            permission_key: { type: "string" },
            granted: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      if (!isPermissionKey(request.body.permission_key)) {
        return reply.code(400).send({ error: "INVALID_PERMISSION_KEY" });
      }

      const targetUsers = await request.server.db
        .select({ salonId: users.salonId })
        .from(users)
        .where(eq(users.id, request.params.userId));
      const targetUser = targetUsers[0];
      if (!targetUser || targetUser.salonId !== request.user.salon_id) {
        return reply.code(404).send({ error: "USER_NOT_FOUND" });
      }

      await request.server.db
        .insert(userPermissions)
        .values({
          userId: request.params.userId,
          salonId: request.user.salon_id,
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

      return {
        permission_key: request.body.permission_key,
        granted: request.body.granted,
      };
    },
  );

  app.get(
    "/api/auth/users",
    {
      preHandler: [
        authenticate,
        requireRole("owner", "manager"),
      ],
    },
    async (request) => {
      const salonUsers = await request.server.db
        .select({
          active: users.active,
          email: users.email,
          fullName: users.fullName,
          id: users.id,
          role: users.role,
        })
        .from(users)
        .where(eq(users.salonId, request.user.salon_id));
      const overrides = await request.server.db
        .select({
          granted: userPermissions.granted,
          permissionKey: userPermissions.permissionKey,
          userId: userPermissions.userId,
        })
        .from(userPermissions)
        .where(eq(userPermissions.salonId, request.user.salon_id));
      const authUsers = await supabaseAdmin.getUsers();
      const loginById = new Map(
        authUsers.map((user) => [user.id, user.last_sign_in_at ?? null]),
      );

      return salonUsers.map((user) => ({
        active: user.active,
        email: user.email,
        full_name: user.fullName,
        id: user.id,
        last_login: loginById.get(user.id) ?? null,
        permission_overrides: overrides
          .filter((override) => override.userId === user.id)
          .map((override) => ({
            granted: override.granted,
            permission_key: override.permissionKey,
          })),
        role: user.role,
      }));
    },
  );

  app.patch<{ Body: ActiveBody; Params: UserParams }>(
    "/api/auth/users/:userId",
    {
      preHandler: [
        authenticate,
        requirePermission(PERMISSION_KEYS.SETTINGS_USERS),
      ],
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["active"],
          properties: {
            active: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      if (
        request.params.userId === request.user.id &&
        !request.body.active
      ) {
        return reply
          .code(400)
          .send({ error: "SELF_DEACTIVATION_FORBIDDEN" });
      }

      const targetUsers = await request.server.db
        .select({ salonId: users.salonId })
        .from(users)
        .where(eq(users.id, request.params.userId));
      const targetUser = targetUsers[0];
      if (!targetUser || targetUser.salonId !== request.user.salon_id) {
        return reply.code(404).send({ error: "USER_NOT_FOUND" });
      }

      await request.server.db
        .update(users)
        .set({ active: request.body.active })
        .where(eq(users.id, request.params.userId));

      return {
        active: request.body.active,
        id: request.params.userId,
      };
    },
  );
}
