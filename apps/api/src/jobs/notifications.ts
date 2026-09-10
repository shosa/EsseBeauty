import type { FastifyInstance } from "fastify";

import { notifications } from "@esse-beauty/db/schema";

import { isInternalDashboardHref } from "../lib/internal-routes.js";

export async function createNotification(
  app: FastifyInstance,
  input: {
    body?: string;
    category: string;
    entityId?: string;
    entityType?: string;
    href?: string;
    priority?: "low" | "normal" | "high" | "critical";
    salonId: string;
    targetRole?: "owner" | "manager" | "receptionist" | "employee";
    title: string;
    type: string;
    userId?: string;
  },
): Promise<void> {
  if (input.href && !isInternalDashboardHref(input.href)) {
    throw new TypeError("Invalid internal dashboard href.");
  }

  await app.db.insert(notifications).values({
    body: input.body,
    category: input.category,
    entityId: input.entityId,
    entityType: input.entityType,
    payload: { href: input.href },
    priority: input.priority ?? "normal",
    salonId: input.salonId,
    targetRole: input.targetRole,
    title: input.title,
    type: input.type,
    userId: input.userId,
  });
}
