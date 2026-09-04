import webpush from "web-push";
import { and, eq } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import { customerPushSubscriptions } from "@esse-beauty/db/schema";

export interface CustomerPushPayload {
  body: string;
  href?: string;
  tag?: string;
  title: string;
}

let vapidConfigured = false;
let vapidMissingWarned = false;

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.PUSH_VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    if (!vapidMissingWarned) {
      vapidMissingWarned = true;
      console.warn("[customer-push] PUSH_VAPID_PUBLIC_KEY/PUSH_VAPID_PRIVATE_KEY not set — customer push notifications are disabled.");
    }
    return false;
  }
  webpush.setVapidDetails(
    process.env.PUSH_VAPID_SUBJECT ?? "mailto:support@essebeauty.app",
    publicKey,
    privateKey,
  );
  vapidConfigured = true;
  return true;
}

export function pushPublicKey(): string | null {
  return process.env.PUSH_VAPID_PUBLIC_KEY ?? null;
}

/**
 * Fires a Web Push notification to every device a customer has subscribed on. Stale
 * subscriptions (the browser unsubscribed or the endpoint expired) are pruned as they're
 * discovered instead of retried, since resending to a gone endpoint just errors again.
 */
export async function sendCustomerPush(
  db: DrizzleDB,
  salonId: string,
  customerId: string,
  payload: CustomerPushPayload,
): Promise<void> {
  if (!ensureVapidConfigured()) return;

  const subscriptions = await db.select().from(customerPushSubscriptions).where(and(
    eq(customerPushSubscriptions.salonId, salonId),
    eq(customerPushSubscriptions.customerId, customerId),
  ));
  if (subscriptions.length === 0) return;

  const body = JSON.stringify(payload);
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { auth: subscription.auth, p256dh: subscription.p256dh },
      }, body);
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await db.delete(customerPushSubscriptions).where(eq(customerPushSubscriptions.id, subscription.id));
      } else {
        console.error(`[customer-push] Failed to deliver push to subscription ${subscription.id}:`, error);
      }
    }
  }));
}
