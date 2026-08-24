import type { FastifyInstance } from "fastify";

import { notifications } from "@esse-beauty/db/schema";

import { isInternalDashboardHref } from "../lib/internal-routes.js";
import {
  createCommunicationProviderRegistry,
  type DeliveryReceipt,
} from "../providers/communications.js";

const SMS_LIMIT = 160;

export function fitSms(message: string): string {
  return message.length <= SMS_LIMIT
    ? message
    : `${message.slice(0, SMS_LIMIT - 1).trimEnd()}…`;
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

export async function sendSms(
  to: string,
  body: string,
  options: { idempotencyKey?: string } = {},
): Promise<DeliveryReceipt> {
  return createCommunicationProviderRegistry().send({
    channel: "sms",
    idempotencyKey: options.idempotencyKey ?? `sms-${crypto.randomUUID()}`,
    text: fitSms(body),
    to,
  });
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
