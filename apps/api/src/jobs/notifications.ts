import { Resend } from "resend";
import twilio from "twilio";

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
