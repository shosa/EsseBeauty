import { and, eq, gt } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import { customerSessions } from "@esse-beauty/db/schema";

import { hashSessionToken } from "./auth-session.js";

export const CUSTOMER_SESSION_COOKIE = "esse-customer-session";

/**
 * Portable counterpart to apps/api's own resolveCustomerId (routes/public/customer-auth.ts):
 * that one stays Fastify-shaped for its many in-process callers, this one takes
 * plain db + cookies so any service can resolve the PWA customer session against
 * the same shared customerSessions table without depending on apps/api.
 */
export async function resolveCustomerIdFromSession(
  db: DrizzleDB,
  cookies: Record<string, string | undefined>,
  salonId: string,
): Promise<string | undefined> {
  const token = cookies[CUSTOMER_SESSION_COOKIE];
  if (!token) return undefined;
  const rows = await db
    .select({ customerId: customerSessions.customerId, id: customerSessions.id, salonId: customerSessions.salonId })
    .from(customerSessions)
    .where(and(eq(customerSessions.tokenHash, hashSessionToken(token)), gt(customerSessions.expiresAt, new Date())));
  const session = rows[0];
  if (!session || session.salonId !== salonId) return undefined;
  void db.update(customerSessions).set({ lastSeenAt: new Date() }).where(eq(customerSessions.id, session.id));
  return session.customerId;
}
