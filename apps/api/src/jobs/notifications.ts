import { Resend } from "resend";
import twilio from "twilio";
import type { FastifyInstance } from "fastify";

import { notifications } from "@esse-beauty/db/schema";

const SMS_LIMIT = 160;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function fitSms(message: string): string {
  return message.length <= SMS_LIMIT
    ? message
    : `${message.slice(0, SMS_LIMIT - 1).trimEnd()}…`;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const resend = new Resend(required("RESEND_API_KEY"));
  const result = await resend.emails.send({
    from: required("RESEND_FROM_EMAIL"),
    to,
    subject,
    html,
  });
  if (result.error) {
    throw new Error(result.error.message);
  }
}

export async function sendSms(to: string, body: string): Promise<void> {
  const client = twilio(
    required("TWILIO_ACCOUNT_SID"),
    required("TWILIO_AUTH_TOKEN"),
  );
  await client.messages.create({
    body: fitSms(body),
    from: required("TWILIO_PHONE_NUMBER"),
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
