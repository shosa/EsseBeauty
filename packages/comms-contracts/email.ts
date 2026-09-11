import nodemailer from "nodemailer";

import type { DrizzleDB } from "@esse-beauty/db";
import { platformEmailSettings } from "@esse-beauty/db/schema";
import { decryptProviderSecret, type EncryptedSecret } from "@esse-beauty/server-shared";

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

export interface SmtpProviderConfig {
  from: string;
  host: string;
  password?: string | null;
  port: number;
  secure: boolean;
  username?: string | null;
}

function normalizeSmtpError(error: unknown): never {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const messageText = error instanceof Error ? error.message : "SMTP delivery failed";
  if (["EDNS", "ENOTFOUND", "EAI_AGAIN"].includes(code)) {
    throw new Error(`SMTP_DNS_LOOKUP_FAILED: ${messageText}`);
  }
  if (["EAUTH", "EENVELOPE", "ECONNECTION", "ETIMEDOUT", "ESOCKET"].includes(code)) {
    throw new Error(`SMTP_${code}: ${messageText}`);
  }
  if (error instanceof Error) throw error;
  throw new Error(messageText);
}

export class SmtpProvider implements CommunicationProvider {
  constructor(private readonly config: SmtpProviderConfig) {}

  private transporter() {
    return nodemailer.createTransport({
      auth: this.config.username
        ? { pass: this.config.password ?? "", user: this.config.username }
        : undefined,
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
    });
  }

  async verify(): Promise<void> {
    await this.transporter().verify().catch(normalizeSmtpError);
  }

  async send(message: CommunicationMessage): Promise<DeliveryReceipt> {
    if (message.channel !== "email") {
      throw new TypeError("SmtpProvider accepts email messages only");
    }
    const receipt = await this.transporter().sendMail({
      from: this.config.from,
      html: message.html,
      subject: message.subject,
      to: message.to,
    }).catch(normalizeSmtpError);

    return {
      acceptedAt: new Date(),
      provider: "smtp",
      providerMessageId: receipt.messageId || `${this.config.host}-${Date.now()}`,
    };
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  options: { idempotencyKey?: string } = {},
): Promise<DeliveryReceipt> {
  return createCommunicationProviderRegistry().send({
    channel: "email",
    html,
    idempotencyKey: options.idempotencyKey ?? `email-${crypto.randomUUID()}`,
    subject,
    to,
  });
}

function platformFromHeader(name: string, email: string): string {
  const cleanName = name.replace(/["<>]/g, "").trim();
  return cleanName ? `"${cleanName}" <${email}>` : email;
}

function normalizeSmtpHost(host: string): string {
  const value = host.trim();
  if (!value) return "";
  try {
    const parsed = new URL(value.includes("://") ? value : `smtp://${value}`);
    return parsed.hostname;
  } catch {
    return value.replace(/^smtps?:\/\//i, "").split("/")[0]?.split(":")[0]?.trim() ?? value;
  }
}

function parseEncryptedSecret(value: string | null): EncryptedSecret | string | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as EncryptedSecret;
  } catch {
    return value;
  }
}

function platformSmtpProvider(settings: typeof platformEmailSettings.$inferSelect): SmtpProvider {
  const host = normalizeSmtpHost(settings.host);
  if (!host || !settings.defaultFromEmail.trim()) {
    throw new Error("SMTP_PROVIDER_NOT_CONFIGURED");
  }
  const secret = parseEncryptedSecret(settings.passwordEncrypted);
  const password = typeof secret === "string"
    ? secret
    : secret
      ? decryptProviderSecret(secret, {
        accountId: settings.id,
        provider: "smtp",
        salonId: "platform",
      })
      : null;
  return new SmtpProvider({
    from: platformFromHeader(settings.defaultFromName, settings.defaultFromEmail),
    host,
    password,
    port: settings.port,
    secure: settings.secure,
    username: settings.username,
  });
}

export async function sendEmailFromDb(
  db: DrizzleDB,
  to: string,
  subject: string,
  html: string,
  options: { idempotencyKey?: string } = {},
): Promise<DeliveryReceipt> {
  const settings = (await db.select().from(platformEmailSettings).limit(1))[0];
  if (!settings?.enabled) return sendEmail(to, subject, html, options);
  const provider = platformSmtpProvider(settings);
  return provider.send({
    channel: "email",
    html,
    idempotencyKey: options.idempotencyKey ?? `email-${crypto.randomUUID()}`,
    subject,
    to,
  });
}

export async function testPlatformEmailConnection(db: DrizzleDB): Promise<void> {
  const settings = (await db.select().from(platformEmailSettings).limit(1))[0];
  if (!settings) throw new Error("SMTP_PROVIDER_NOT_CONFIGURED");
  await platformSmtpProvider(settings).verify();
}
