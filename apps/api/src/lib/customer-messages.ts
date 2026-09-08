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
 * Stores the full content behind a push notification and points the push at
 * /{slug}/messages/{id}, so tapping it opens a full-screen "read this" view
 * instead of guessing which existing page best fits a reminder, a campaign, or
 * a review request.
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

  await sendCustomerPush(db, salonId, customerId, {
    body: input.body,
    href: `/${input.slug}/messages/${messageId}`,
    tag: `message-${messageId}`,
    title: input.title,
  });
}
