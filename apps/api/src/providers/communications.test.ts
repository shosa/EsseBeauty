import { describe, expect, it } from "vitest";

import {
  ProviderNotConfiguredError,
  createCommunicationProviderRegistry,
  providerStatus,
} from "./communications.js";
import { ResendProvider } from "./resend-provider.js";

describe("communication provider readiness", () => {
  it("reports email as not configured when provider credentials are absent", () => {
    expect(providerStatus({})).toEqual({ email: "not_configured" });
  });

  it("does not expose a partially configured provider as ready", () => {
    expect(providerStatus({ RESEND_API_KEY: "re_test" })).toEqual({
      email: "not_configured",
    });
  });

  it("fails with a stable error before attempting an unavailable channel", async () => {
    const registry = createCommunicationProviderRegistry({});

    expect(() => registry.require("email")).toThrow(ProviderNotConfiguredError);
    await expect(registry.send({
      channel: "email",
      html: "<p>Promemoria</p>",
      idempotencyKey: "test-email-1",
      subject: "Promemoria",
      to: "cliente@example.test",
    })).rejects.toMatchObject({ code: "PROVIDER_NOT_CONFIGURED" });
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

});
