import { and, eq } from "drizzle-orm";
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";

import type { DrizzleDB } from "@esse-beauty/db";
import { salonModules } from "@esse-beauty/db/schema";

import type { ModuleKey } from "./keys.js";

declare module "fastify" {
  interface FastifyInstance {
    db: DrizzleDB;
  }

  interface FastifyRequest {
    salonId: string;
  }
}

const CACHE_TTL_MS = 60_000;
const moduleCache = new Map<string, { value: boolean; expires: number }>();

function cacheKey(salonId: string, moduleKey: ModuleKey): string {
  return `${salonId}:${moduleKey}`;
}

export async function isModuleEnabled(
  salonId: string,
  moduleKey: ModuleKey,
  db: DrizzleDB,
): Promise<boolean> {
  const key = cacheKey(salonId, moduleKey);
  const cached = moduleCache.get(key);

  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }

  const rows = await db
    .select({ enabled: salonModules.enabled })
    .from(salonModules)
    .where(
      and(
        eq(salonModules.salonId, salonId),
        eq(salonModules.moduleKey, moduleKey),
      ),
    );
  const value = rows[0]?.enabled ?? false;

  moduleCache.set(key, {
    value,
    expires: Date.now() + CACHE_TTL_MS,
  });

  return value;
}

export function invalidateModuleCache(
  salonId: string,
  moduleKey?: ModuleKey,
): void {
  if (moduleKey) {
    moduleCache.delete(cacheKey(salonId, moduleKey));
    return;
  }

  const prefix = `${salonId}:`;
  for (const key of moduleCache.keys()) {
    if (key.startsWith(prefix)) {
      moduleCache.delete(key);
    }
  }
}

export function clearModuleCache(): void {
  moduleCache.clear();
}

export function requireModule(moduleKey: ModuleKey): preHandlerHookHandler {
  return async function moduleGuard(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const enabled = await isModuleEnabled(
      request.salonId,
      moduleKey,
      request.server.db,
    );

    if (!enabled) {
      await reply.code(403).send({
        error: "MODULE_DISABLED",
        module: moduleKey,
      });
    }
  };
}
