import type { FastifyInstance } from "fastify";

import type { DrizzleDB } from "@esse-beauty/db";
import { notifications, platformEmailSettings } from "@esse-beauty/db/schema";

import { isInternalDashboardHref } from "../lib/internal-routes.js";
import { decryptProviderSecret, type EncryptedSecret } from "../lib/provider-credentials.js";
import {
  createCommunicationProviderRegistry,
  type DeliveryReceipt,
} from "../providers/communications.js";
import { SmtpProvider } from "../providers/smtp-provider.js";

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

export async function testPlatformEmailConnection(db: DrizzleDB): Promise<void> {
  const settings = (await db.select().from(platformEmailSettings).limit(1))[0];
  if (!settings) throw new Error("SMTP_PROVIDER_NOT_CONFIGURED");
  await platformSmtpProvider(settings).verify();
}

export async function createNotification(
  app: FastifyInstance,
  input: {
    body?: string;
    category: string;
    entityId?: string;
    entityType?: string;
    href?: string;
    priority?: "low" | "normal" | "high" | "critical";
    salonId: string;
    targetRole?: "owner" | "manager" | "receptionist" | "employee";
    title: string;
    type: string;
    userId?: string;
  },
): Promise<void> {
  if (input.href && !isInternalDashboardHref(input.href)) {
    throw new TypeError("Invalid internal dashboard href.");
  }

  await app.db.insert(notifications).values({
    body: input.body,
    category: input.category,
    entityId: input.entityId,
    entityType: input.entityType,
    payload: { href: input.href },
    priority: input.priority ?? "normal",
    salonId: input.salonId,
    targetRole: input.targetRole,
    title: input.title,
    type: input.type,
    userId: input.userId,
  });
}
