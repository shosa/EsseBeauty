import { Resend } from "resend";
import twilio from "twilio";

import { ResendProvider } from "./resend-provider.js";
import { TwilioProvider } from "./twilio-provider.js";

export type CommunicationChannel = "email" | "sms";
export type CommunicationProviderReadiness = "ready" | "not_configured";

export type CommunicationMessage =
  | {
      channel: "email";
      html: string;
      idempotencyKey: string;
      subject: string;
      to: string;
    }
  | {
      channel: "sms";
      idempotencyKey: string;
      text: string;
      to: string;
    };

export interface DeliveryReceipt {
  acceptedAt: Date;
  provider: "meta_cloud_api" | "resend" | "twilio";
  providerMessageId: string;
}

export interface CommunicationProvider {
  send(message: CommunicationMessage): Promise<DeliveryReceipt>;
}

export interface CommunicationProviderRegistry {
  require(channel: CommunicationChannel): CommunicationProvider;
  send(message: CommunicationMessage): Promise<DeliveryReceipt>;
  status(): Record<CommunicationChannel, CommunicationProviderReadiness>;
}

export interface CommunicationEnvironment {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
}

export class ProviderNotConfiguredError extends Error {
  readonly code = "PROVIDER_NOT_CONFIGURED";

  constructor(readonly channel: CommunicationChannel) {
    super(`Communication provider for ${channel} is not configured`);
    this.name = "ProviderNotConfiguredError";
  }
}

function present(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function providerStatus(
  env: CommunicationEnvironment,
): Record<CommunicationChannel, CommunicationProviderReadiness> {
  return {
    email:
      present(env.RESEND_API_KEY) && present(env.RESEND_FROM_EMAIL)
        ? "ready"
        : "not_configured",
    sms:
      present(env.TWILIO_ACCOUNT_SID) &&
      present(env.TWILIO_AUTH_TOKEN) &&
      present(env.TWILIO_PHONE_NUMBER)
        ? "ready"
        : "not_configured",
  };
}

export function createCommunicationProviderRegistry(
  env: CommunicationEnvironment = process.env,
): CommunicationProviderRegistry {
  const readiness = providerStatus(env);
  const providers: Partial<Record<CommunicationChannel, CommunicationProvider>> = {};

  if (readiness.email === "ready") {
    providers.email = new ResendProvider(
      new Resend(env.RESEND_API_KEY!),
      env.RESEND_FROM_EMAIL!,
    );
  }
  if (readiness.sms === "ready") {
    providers.sms = new TwilioProvider(
      twilio(env.TWILIO_ACCOUNT_SID!, env.TWILIO_AUTH_TOKEN!),
      env.TWILIO_PHONE_NUMBER!,
    );
  }

  return {
    require(channel) {
      const provider = providers[channel];
      if (!provider) throw new ProviderNotConfiguredError(channel);
      return provider;
    },
    async send(message) {
      return this.require(message.channel).send(message);
    },
    status() {
      return { ...readiness };
    },
  };
}
