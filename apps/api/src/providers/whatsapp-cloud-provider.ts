export interface WhatsAppTemplate {
  locale: string;
  name: string;
  parameters: string[];
}

export type WhatsAppSendRequest = {
  idempotencyKey: string;
  kind: "template";
  template: WhatsAppTemplate;
  to: string;
} | {
  idempotencyKey: string;
  kind: "session";
  session: { lastInboundAt: Date; text: string };
  to: string;
};

export interface WhatsAppDeliveryReceipt {
  acceptedAt: Date;
  provider: "meta_cloud_api";
  providerMessageId: string;
}

export class WhatsAppPolicyError extends Error {
  readonly retryable = false;

  constructor(readonly code: "INVALID_DESTINATION" | "TEMPLATE_REQUIRED") {
    super(code);
    this.name = "WhatsAppPolicyError";
  }
}

export class MetaDeliveryError extends Error {
  constructor(readonly code: string, readonly retryable: boolean) {
    super(code);
    this.name = "MetaDeliveryError";
  }
}

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

interface ProviderOptions {
  accessToken: string;
  fetcher?: Fetcher;
  graphApiVersion: string;
  phoneNumberId: string;
}

export type TenantWhatsAppSendRequest = WhatsAppSendRequest & { salonId: string };

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) throw new WhatsAppPolicyError("INVALID_DESTINATION");
  return digits;
}

function safeGraphVersion(value: string): string {
  return /^v\d{1,2}\.\d{1,2}$/.test(value) ? value : "v23.0";
}

export class MetaWhatsAppCloudProvider {
  private readonly fetcher: Fetcher;

  constructor(private readonly options: ProviderOptions) {
    this.fetcher = options.fetcher ?? fetch;
  }

  async send(message: WhatsAppSendRequest): Promise<WhatsAppDeliveryReceipt> {
    if (message.kind === "session" && Date.now() - message.session.lastInboundAt.getTime() >= 24 * 60 * 60_000) {
      throw new WhatsAppPolicyError("TEMPLATE_REQUIRED");
    }

    const payload = message.kind === "template"
      ? {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          template: {
            components: message.template.parameters.length
              ? [{
                  parameters: message.template.parameters.map((text) => ({ text, type: "text" })),
                  type: "body",
                }]
              : [],
            language: { code: message.template.locale },
            name: message.template.name,
          },
          to: normalizePhone(message.to),
          type: "template",
        }
      : {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          text: { body: message.session.text, preview_url: false },
          to: normalizePhone(message.to),
          type: "text",
        };

    let response: Response;
    try {
      response = await this.fetcher(
        `https://graph.facebook.com/${safeGraphVersion(this.options.graphApiVersion)}/${encodeURIComponent(this.options.phoneNumberId)}/messages`,
        {
          body: JSON.stringify(payload),
          headers: {
            Authorization: `Bearer ${this.options.accessToken}`,
            "Content-Type": "application/json",
            "X-Idempotency-Key": message.idempotencyKey,
          },
          method: "POST",
        },
      );
    } catch {
      throw new MetaDeliveryError("META_UNAVAILABLE", true);
    }

    if (!response.ok) {
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      throw new MetaDeliveryError(
        retryable ? "META_UNAVAILABLE" : response.status === 401 || response.status === 403 ? "META_AUTH_FAILED" : "META_REJECTED",
        retryable,
      );
    }

    let providerMessageId: string | undefined;
    try {
      const body = await response.json() as { messages?: Array<{ id?: string }> };
      providerMessageId = body.messages?.[0]?.id;
    } catch {
      throw new MetaDeliveryError("META_INVALID_RESPONSE", true);
    }
    if (!providerMessageId) throw new MetaDeliveryError("META_INVALID_RESPONSE", true);
    return { acceptedAt: new Date(), provider: "meta_cloud_api", providerMessageId };
  }
}

export async function sendWhatsApp(
  db: DrizzleDB,
  message: TenantWhatsAppSendRequest,
  dependencies: { fetcher?: Fetcher } = {},
): Promise<WhatsAppDeliveryReceipt> {
  const rows = await db
    .select({
      account: communicationProviderAccounts,
      secret: communicationProviderSecrets,
    })
    .from(communicationProviderAccounts)
    .innerJoin(
      communicationProviderSecrets,
      and(
        eq(communicationProviderSecrets.accountId, communicationProviderAccounts.id),
        eq(communicationProviderSecrets.salonId, communicationProviderAccounts.salonId),
        eq(communicationProviderSecrets.kind, "access_token"),
      ),
    )
    .where(and(
      eq(communicationProviderAccounts.salonId, message.salonId),
      eq(communicationProviderAccounts.provider, "meta_cloud_api"),
    ));
  const configured = rows[0];
  if (!configured || !configured.account.enabled || configured.account.status !== "ready") {
    throw new MetaDeliveryError("PROVIDER_NOT_CONFIGURED", false);
  }
  const accessToken = decryptProviderSecret(configured.secret, {
    accountId: configured.account.id,
    provider: configured.account.provider,
    salonId: message.salonId,
  });
  return new MetaWhatsAppCloudProvider({
    accessToken,
    fetcher: dependencies.fetcher,
    graphApiVersion: configured.account.graphApiVersion,
    phoneNumberId: configured.account.phoneNumberId,
  }).send(message);
}
import { and, eq } from "drizzle-orm";

import type { DrizzleDB } from "@esse-beauty/db";
import { communicationProviderAccounts, communicationProviderSecrets } from "@esse-beauty/db/schema";

import { decryptProviderSecret } from "../lib/provider-credentials.js";
