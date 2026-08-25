import { Resend } from "resend";

import { ResendProvider } from "./resend-provider.js";

export type CommunicationChannel = "email";
export type CommunicationProviderReadiness = "ready" | "not_configured";

export type CommunicationMessage = {
  channel: "email";
  html: string;
  idempotencyKey: string;
  subject: string;
  to: string;
};

export interface DeliveryReceipt {
  acceptedAt: Date;
  provider: "resend";
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
