import { Queue } from "bullmq";

export const QUEUE_NAMES = {
  CAMPAIGNS: "marketing-campaigns",
  REMINDERS: "appointment-reminders",
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
