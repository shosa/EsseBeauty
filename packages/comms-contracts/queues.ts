import { Queue } from "bullmq";

// Both apps/api and apps/communications share this one Redis-backed queue
// registry: their own domain queues, plus the two cross-service event
// queues (CAMPAIGN_STATUS_REFRESH, REVIEW_LOYALTY_AWARDS) that let one
// service trigger work owned by the other without a synchronous network
// call or a direct import across the process boundary.
export const QUEUE_NAMES = {
  APPOINTMENT_FOLLOWUPS: "appointment-followups",
  CAMPAIGNS: "marketing-campaigns",
  CAMPAIGN_STATUS_REFRESH: "campaign-status-refresh",
  COMMUNICATIONS: "whatsapp-communications",
  LOYALTY_BIRTHDAYS: "loyalty-birthdays",
  REMINDERS: "appointment-reminders",
  REVIEW_LOYALTY_AWARDS: "review-loyalty-awards",
  REVIEWS: "review-requests",
} as const;

const queues = new Map<string, Queue>();

export function redisConnection() {
  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.username && { username: decodeURIComponent(url.username) }),
    ...(url.password && { password: decodeURIComponent(url.password) }),
    maxRetriesPerRequest: null,
  };
}

export function getQueue(name: string): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, { connection: redisConnection() });
    queues.set(name, queue);
  }
  return queue;
}

export async function closeQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((queue) => queue.close()));
  queues.clear();
}
