import type {
  CommunicationMessage,
  CommunicationProvider,
  DeliveryReceipt,
} from "./communications.js";

interface TwilioClient {
  messages: {
    create(payload: {
      body: string;
      from: string;
      to: string;
    }): Promise<{ sid: string }>;
  };
}

export class TwilioProvider implements CommunicationProvider {
  constructor(
    private readonly client: TwilioClient,
    private readonly from: string,
  ) {}

  async send(message: CommunicationMessage): Promise<DeliveryReceipt> {
    if (message.channel !== "sms") {
      throw new TypeError("TwilioProvider accepts SMS messages only");
    }
    const result = await this.client.messages.create({
      body: message.text,
      from: this.from,
      to: message.to,
    });
    if (!result.sid) throw new Error("PROVIDER_RECEIPT_MISSING");
    return {
      acceptedAt: new Date(),
      provider: "twilio",
      providerMessageId: result.sid,
    };
  }
}
