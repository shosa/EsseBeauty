import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";

import {
  communicationProviderAccounts,
  communicationProviderSecrets,
} from "@esse-beauty/db/schema";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

import { encryptProviderSecret } from "../../lib/provider-credentials.js";
import { authenticate, requirePermission } from "../../middleware/auth.js";

type ProviderAccount = typeof communicationProviderAccounts.$inferSelect;
type ProviderSecretKind = "access_token" | "webhook_verify_token";

interface ProviderSettingsBody {
  access_token?: string;
  business_portfolio_id?: string | null;
  display_phone_number?: string | null;
  enabled?: boolean;
  graph_api_version?: string;
  phone_number_id?: string;
  token_expires_at?: string | null;
  waba_id?: string;
  webhook_verify_token?: string;
}

function assertSalon(
  request: { params: { id: string }; salonId: string },
  reply: { code(statusCode: number): { send(payload: unknown): unknown } },
) {
  if (request.params.id !== request.salonId) {
    return reply.code(403).send({ error: "FORBIDDEN" });
  }
  return undefined;
}

export function maskPhoneNumber(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  const country = value.trim().startsWith("+") && digits.length > 10
    ? `+${digits.slice(0, digits.length - 10)} `
    : "";
  return `${country}••• ••• ${digits.slice(-4)}`;
}

function providerDto(
  account: ProviderAccount | undefined,
  secretKinds: Set<ProviderSecretKind>,
) {
  if (!account) {
    return {
      business_portfolio_id: null,
      credential_present: false,
      display_phone_number_masked: null,
      enabled: false,
      graph_api_version: "v23.0",
      last_error_code: null,
      last_health_check_at: null,
      last_webhook_at: null,
      phone_number_id: null,
      provider: "meta_cloud_api",
      ready: false,
      status: "not_configured",
      token_expires_at: null,
      waba_id: null,
      webhook_credential_present: false,
      webhook_subscription_status: "not_subscribed",
    };
  }
  const credentialPresent = secretKinds.has("access_token");
  return {
    business_portfolio_id: account.businessPortfolioId,
    credential_present: credentialPresent,
    display_phone_number_masked: maskPhoneNumber(account.displayPhoneNumber),
    enabled: account.enabled,
    graph_api_version: account.graphApiVersion,
    last_error_code: account.lastErrorCode,
    last_health_check_at: account.lastHealthCheckAt?.toISOString() ?? null,
    last_webhook_at: account.lastWebhookAt?.toISOString() ?? null,
    phone_number_id: account.phoneNumberId,
    provider: account.provider,
    ready: account.enabled && credentialPresent && account.status === "ready",
    status: account.status,
    token_expires_at: account.tokenExpiresAt?.toISOString() ?? null,
    waba_id: account.wabaId,
    webhook_credential_present: secretKinds.has("webhook_verify_token"),
    webhook_subscription_status: account.webhookSubscriptionStatus,
  };
}

function cleanIdentifier(value: string | undefined, field: string): string {
  const cleaned = value?.trim() ?? "";
  if (!/^[a-zA-Z0-9._-]{3,128}$/.test(cleaned)) {
    throw new Error(`INVALID_${field}`);
  }
  return cleaned;
}

function cleanOptional(value: string | null | undefined, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined;
  const cleaned = value?.trim() ?? "";
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function parseExpiry(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("INVALID_TOKEN_EXPIRES_AT");
  return parsed;
}

async function accountSecretKinds(app: FastifyInstance, salonId: string, accountId: string) {
  const rows = await app.db
    .select({ kind: communicationProviderSecrets.kind })
    .from(communicationProviderSecrets)
    .where(and(
      eq(communicationProviderSecrets.salonId, salonId),
      eq(communicationProviderSecrets.accountId, accountId),
    ));
  return new Set(rows.map((row) => row.kind));
}

export async function registerCommunicationSettingsRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    "/api/salons/:id/communications/provider",
    { preHandler: [authenticate, requirePermission(PERMISSION_KEYS.COMMUNICATIONS_VIEW)] },
    async (request, reply) => {
      const denied = assertSalon(request, reply);
      if (denied) return denied;
      const account = (await app.db
        .select()
        .from(communicationProviderAccounts)
        .where(and(
          eq(communicationProviderAccounts.salonId, request.salonId),
          eq(communicationProviderAccounts.provider, "meta_cloud_api"),
        )))[0];
      const kinds = account
        ? await accountSecretKinds(app, request.salonId, account.id)
        : new Set<ProviderSecretKind>();
      return providerDto(account, kinds);
    },
  );

  app.put<{ Body: ProviderSettingsBody; Params: { id: string } }>(
    "/api/salons/:id/communications/provider",
    { preHandler: [authenticate, requirePermission(PERMISSION_KEYS.COMMUNICATIONS_MANAGE_PROVIDER)] },
    async (request, reply) => {
      const denied = assertSalon(request, reply);
      if (denied) return denied;

      let wabaId: string;
      let phoneNumberId: string;
      let tokenExpiresAt: Date | null | undefined;
      try {
        wabaId = cleanIdentifier(request.body.waba_id, "WABA_ID");
        phoneNumberId = cleanIdentifier(request.body.phone_number_id, "PHONE_NUMBER_ID");
        tokenExpiresAt = parseExpiry(request.body.token_expires_at);
      } catch (error) {
        return reply.code(400).send({ error: error instanceof Error ? error.message : "INVALID_PROVIDER_SETTINGS" });
      }

      const existing = (await app.db
        .select()
        .from(communicationProviderAccounts)
        .where(and(
          eq(communicationProviderAccounts.salonId, request.salonId),
          eq(communicationProviderAccounts.provider, "meta_cloud_api"),
        )))[0];
      const accountId = existing?.id ?? randomUUID();
      const existingKinds = existing
        ? await accountSecretKinds(app, request.salonId, existing.id)
        : new Set<ProviderSecretKind>();
      const accessToken = request.body.access_token?.trim();
      const webhookVerifyToken = request.body.webhook_verify_token?.trim();
      const credentialPresent = Boolean(accessToken) || existingKinds.has("access_token");
      const enabled = request.body.enabled ?? existing?.enabled ?? false;
      const status = !enabled
        ? "disabled" as const
        : credentialPresent
          ? "pending_verification" as const
          : "not_configured" as const;

      try {
        const account = await app.db.transaction(async (tx) => {
          const saved = (await tx
            .insert(communicationProviderAccounts)
            .values({
              businessPortfolioId: cleanOptional(request.body.business_portfolio_id, 128),
              displayPhoneNumber: cleanOptional(request.body.display_phone_number, 40),
              enabled,
              graphApiVersion: request.body.graph_api_version?.trim() || existing?.graphApiVersion || "v23.0",
              id: accountId,
              lastErrorCode: null,
              phoneNumberId,
              provider: "meta_cloud_api",
              salonId: request.salonId,
              status,
              tokenExpiresAt,
              updatedAt: new Date(),
              wabaId,
            })
            .onConflictDoUpdate({
              target: [communicationProviderAccounts.salonId, communicationProviderAccounts.provider],
              set: {
                businessPortfolioId: cleanOptional(request.body.business_portfolio_id, 128),
                displayPhoneNumber: cleanOptional(request.body.display_phone_number, 40),
                enabled,
                graphApiVersion: request.body.graph_api_version?.trim() || existing?.graphApiVersion || "v23.0",
                lastErrorCode: null,
                phoneNumberId,
                status,
                tokenExpiresAt,
                updatedAt: new Date(),
                wabaId,
              },
            })
            .returning())[0]!;

          const secrets: Array<{ kind: ProviderSecretKind; value: string }> = [];
          if (accessToken) secrets.push({ kind: "access_token", value: accessToken });
          if (webhookVerifyToken) secrets.push({ kind: "webhook_verify_token", value: webhookVerifyToken });
          for (const secret of secrets) {
            const encrypted = encryptProviderSecret(secret.value, {
              accountId: saved.id,
              provider: saved.provider,
              salonId: request.salonId,
            });
            await tx
              .insert(communicationProviderSecrets)
              .values({ accountId: saved.id, kind: secret.kind, salonId: request.salonId, ...encrypted, updatedAt: new Date() })
              .onConflictDoUpdate({
                target: [communicationProviderSecrets.accountId, communicationProviderSecrets.kind],
                set: { ...encrypted, salonId: request.salonId, updatedAt: new Date() },
              });
          }
          return saved;
        });
        return providerDto(account, await accountSecretKinds(app, request.salonId, account.id));
      } catch (error) {
        request.log.warn({ code: "PROVIDER_SETTINGS_WRITE_FAILED" }, "provider settings write failed");
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
        return reply.code(code === "23505" ? 409 : 500).send({
          error: code === "23505" ? "PROVIDER_IDENTIFIERS_ALREADY_IN_USE" : "PROVIDER_SETTINGS_WRITE_FAILED",
        });
      }
    },
  );
}
