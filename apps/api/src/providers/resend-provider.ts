import type {
  CommunicationMessage,
  CommunicationProvider,
  DeliveryReceipt,
} from "./communications.js";

interface ResendClient {
  emails: {
    send(
      payload: { from: string; html: string; subject: string; to: string },
      options?: { idempotencyKey?: string },
    ): Promise<{
      data: { id: string } | null;
      error: { message: string } | null;
    }>;
  };
}

export class ResendProvider implements CommunicationProvider {
  constructor(
    private readonly client: ResendClient,
    private readonly from: string,
  ) {}

  async send(message: CommunicationMessage): Promise<DeliveryReceipt> {
    if (message.channel !== "email") {
      throw new TypeError("ResendProvider accepts email messages only");
    }
    const result = await this.client.emails.send(
      {
        from: this.from,
        html: message.html,
        subject: message.subject,
        to: message.to,
      },
      { idempotencyKey: message.idempotencyKey },
    );
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.id) throw new Error("PROVIDER_RECEIPT_MISSING");
    return {
      acceptedAt: new Date(),
      provider: "resend",
      providerMessageId: result.data.id,
    };
  }
}
