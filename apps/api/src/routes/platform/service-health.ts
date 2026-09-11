export type PlatformServiceKey =
  | "api"
  | "booking"
  | "commerce"
  | "communications"
  | "identity"
  | "loyalty-marketing";

export type PlatformServiceStatus = "degraded" | "offline" | "operational";

export interface PlatformServiceDefinition {
  healthUrl: string;
  key: PlatformServiceKey;
  name: string;
  owner: string;
}

export interface PlatformServiceHealth extends PlatformServiceDefinition {
  checkedAt: string;
  error?: string;
  latencyMs: number;
  status: PlatformServiceStatus;
}

type HealthFetcher = (input: string, init?: RequestInit) => Promise<Response>;

export const platformServices: PlatformServiceDefinition[] = [
  {
    healthUrl: `http://127.0.0.1:${process.env.API_UPSTREAM_PORT ?? "3011"}/health`,
    key: "api",
    name: "API core",
    owner: "Tenant, auth e orchestrazione",
  },
  {
    healthUrl: `http://127.0.0.1:${process.env.COMMUNICATIONS_UPSTREAM_PORT ?? "3013"}/health`,
    key: "communications",
    name: "Communications",
    owner: "Email, WhatsApp e notifiche",
  },
  {
    healthUrl: `http://127.0.0.1:${process.env.LOYALTY_MARKETING_UPSTREAM_PORT ?? "3016"}/health`,
    key: "loyalty-marketing",
    name: "Loyalty & marketing",
    owner: "Campagne, punti e segmenti",
  },
  {
    healthUrl: `http://127.0.0.1:${process.env.BOOKING_UPSTREAM_PORT ?? "3017"}/health`,
    key: "booking",
    name: "Booking",
    owner: "Agenda e disponibilita",
  },
  {
    healthUrl: `http://127.0.0.1:${process.env.COMMERCE_UPSTREAM_PORT ?? "3018"}/health`,
    key: "commerce",
    name: "Commerce",
    owner: "Vendite, pacchetti e magazzino",
  },
  {
    healthUrl: `http://127.0.0.1:${process.env.IDENTITY_UPSTREAM_PORT ?? "3019"}/health`,
    key: "identity",
    name: "Identity",
    owner: "Accessi e sessioni",
  },
];

export async function checkServiceHealth({
  fetcher = fetch as HealthFetcher,
  now = Date.now,
  slowAfterMs = 750,
  timeoutMs = 2_500,
}: {
  fetcher?: HealthFetcher;
  now?: () => number;
  slowAfterMs?: number;
  timeoutMs?: number;
} = {}): Promise<PlatformServiceHealth[]> {
  const checks: PlatformServiceHealth[] = [];
  for (const service of platformServices) {
      const startedAt = now();
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

      try {
        const response = await fetcher(service.healthUrl, controller ? { signal: controller.signal } : undefined);
        const latencyMs = Math.max(0, now() - startedAt);
        if (!response.ok) {
          checks.push({
            ...service,
            checkedAt: new Date(startedAt).toISOString(),
            error: `HTTP ${response.status}`,
            latencyMs,
            status: "offline",
          });
          continue;
        }
        checks.push({
          ...service,
          checkedAt: new Date(startedAt).toISOString(),
          latencyMs,
          status: latencyMs > slowAfterMs ? "degraded" : "operational",
        });
      } catch (error) {
        const latencyMs = Math.max(0, now() - startedAt);
        checks.push({
          ...service,
          checkedAt: new Date(startedAt).toISOString(),
          error: error instanceof Error ? error.message : "Health check failed",
          latencyMs,
          status: "offline",
        });
      } finally {
        if (timeout) clearTimeout(timeout);
      }
  }
  return checks;
}
