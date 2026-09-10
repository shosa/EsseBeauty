import { and, eq, like } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import { customerAppMessages } from "@esse-beauty/db/schema";

import { sendCustomerPush } from "./customer-push.js";

export interface CustomerAppMessageInput {
  body: string;
  href?: string;
  kind: string;
  slug: string;
  title: string;
}

/**
 * Kinds with their own purpose-built landing page under /{slug}/notifications/{route},
 * styled and worded for that specific notification instead of the generic
 * "read this and dismiss" message view. Consent and review requests already point
 * straight at their own dedicated flow via `input.href`.
 */
const DEDICATED_NOTIFICATION_ROUTES: Record<string, string> = {
  campaign: "campaign",
  reminder: "reminder",
};

/**
 * Stores the full content behind a push notification and points the push at
 * whichever page best fits its kind, so tapping it opens the real destination
 * directly instead of a generic "read this" view that then forwards elsewhere.
 */
export async function sendCustomerAppMessage(
  db: DrizzleDB,
  salonId: string,
  customerId: string,
  input: CustomerAppMessageInput,
): Promise<void> {
  const inserted = await db.insert(customerAppMessages).values({
    body: input.body,
    customerId,
    href: input.href,
    kind: input.kind,
    salonId,
    title: input.title,
  }).returning({ id: customerAppMessages.id });
  const messageId = inserted[0]!.id;

  const dedicatedRoute = DEDICATED_NOTIFICATION_ROUTES[input.kind];
  const pushHref = dedicatedRoute
    ? `/${input.slug}/notifications/${dedicatedRoute}/${messageId}`
    : input.href ?? `/${input.slug}/messages/${messageId}`;

  await sendCustomerPush(db, salonId, customerId, {
    body: input.body,
    href: pushHref,
    tag: `message-${messageId}`,
    title: input.title,
  });
}

/**
 * Clears the app-inbox entry behind a notification once its underlying action is
 * done (a consent signed, a review submitted) so it stops showing as outstanding.
 * Matched by kind + a fragment unique to that notification's href (its one-time
 * token) rather than by id, since the caller only has the token, not the message row.
 */
export async function clearCustomerAppMessage(
  db: DrizzleDB,
  salonId: string,
  customerId: string,
  kind: string,
  hrefFragment: string,
): Promise<void> {
  await db.delete(customerAppMessages).where(and(
    eq(customerAppMessages.salonId, salonId),
    eq(customerAppMessages.customerId, customerId),
    eq(customerAppMessages.kind, kind),
    like(customerAppMessages.href, `%${hrefFragment}%`),
  ));
}
