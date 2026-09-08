import nodemailer from "nodemailer";

import type {
  CommunicationMessage,
  CommunicationProvider,
  DeliveryReceipt,
} from "./communications.js";

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
