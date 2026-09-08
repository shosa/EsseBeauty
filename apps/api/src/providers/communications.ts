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
  provider: "smtp";
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
}

export class ProviderNotConfiguredError extends Error {
  readonly code = "PROVIDER_NOT_CONFIGURED";

  constructor(readonly channel: CommunicationChannel) {
    super(`Communication provider for ${channel} is not configured`);
    this.name = "ProviderNotConfiguredError";
  }
}

export function providerStatus(
  _env: CommunicationEnvironment,
): Record<CommunicationChannel, CommunicationProviderReadiness> {
  return {
    email: "not_configured",
  };
}

export function createCommunicationProviderRegistry(
  env: CommunicationEnvironment = process.env,
): CommunicationProviderRegistry {
  const readiness = providerStatus(env);
  const providers: Partial<Record<CommunicationChannel, CommunicationProvider>> = {};

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
