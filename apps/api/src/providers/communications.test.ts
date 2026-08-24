import { describe, expect, it } from "vitest";

import {
  ProviderNotConfiguredError,
  createCommunicationProviderRegistry,
  providerStatus,
} from "./communications.js";
import { ResendProvider } from "./resend-provider.js";
import { TwilioProvider } from "./twilio-provider.js";

describe("communication provider readiness", () => {
  it("reports both channels as not configured when provider credentials are absent", () => {
    expect(providerStatus({})).toEqual({
      email: "not_configured",
      sms: "not_configured",
    });
  });

  it("does not expose a partially configured provider as ready", () => {
    expect(providerStatus({ RESEND_API_KEY: "re_test" })).toEqual({
      email: "not_configured",
      sms: "not_configured",
    });
  });

  it("fails with a stable error before attempting an unavailable channel", async () => {
    const registry = createCommunicationProviderRegistry({});

    expect(() => registry.require("email")).toThrow(ProviderNotConfiguredError);
    await expect(
      registry.send({
        channel: "sms",
        idempotencyKey: "test-sms-1",
        text: "Promemoria",
        to: "+393331234567",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_NOT_CONFIGURED" });
  });
});

describe("provider adapters", () => {
  it("passes a native idempotency key to Resend and returns its provider message id", async () => {
    const calls: unknown[] = [];
    const provider = new ResendProvider(
      {
        emails: {
          async send(payload, options) {
            calls.push({ options, payload });
            return { data: { id: "resend-message-1" }, error: null };
          },
        },
      },
      "EsseBeauty <noreply@example.test>",
    );

    const receipt = await provider.send({
      channel: "email",
      html: "<p>Ciao</p>",
      idempotencyKey: "campaign-recipient-1",
      subject: "Novità",
      to: "cliente@example.test",
    });

    expect(calls).toEqual([
      {
        options: { idempotencyKey: "campaign-recipient-1" },
        payload: {
          from: "EsseBeauty <noreply@example.test>",
          html: "<p>Ciao</p>",
          subject: "Novità",
          to: "cliente@example.test",
        },
      },
    ]);
    expect(receipt).toMatchObject({
      provider: "resend",
      providerMessageId: "resend-message-1",
    });
  });

  it("returns the Twilio message id and preserves SMS content within the adapter boundary", async () => {
    const calls: unknown[] = [];
    const provider = new TwilioProvider(
      {
        messages: {
          async create(payload) {
            calls.push(payload);
            return { sid: "SM123" };
          },
        },
      },
      "+390212345678",
    );

    const receipt = await provider.send({
      channel: "sms",
      idempotencyKey: "campaign-recipient-2",
      text: "Promo di settembre",
      to: "+393331234567",
    });

    expect(calls).toEqual([
      {
        body: "Promo di settembre",
        from: "+390212345678",
        to: "+393331234567",
      },
    ]);
    expect(receipt).toMatchObject({
      provider: "twilio",
      providerMessageId: "SM123",
    });
  });
});
