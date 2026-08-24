import { describe, expect, it, vi } from "vitest";

import {
  MetaWhatsAppCloudProvider,
  WhatsAppPolicyError,
} from "./whatsapp-cloud-provider.js";

describe("MetaWhatsAppCloudProvider", () => {
  it("rejects a free-form message when the service window is closed", async () => {
    const fetcher = vi.fn();
    const provider = new MetaWhatsAppCloudProvider({
      accessToken: "secret",
      fetcher,
      graphApiVersion: "v23.0",
      phoneNumberId: "123456",
    });

    await expect(provider.send({
      idempotencyKey: "reply-1",
      kind: "session",
      session: {
        lastInboundAt: new Date(Date.now() - 25 * 60 * 60_000),
        text: "Ciao",
      },
      to: "+393331234567",
    })).rejects.toMatchObject({ code: "TEMPLATE_REQUIRED" } satisfies Partial<WhatsAppPolicyError>);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("maps an approved template to the official Graph API without exposing provider bodies", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ messages: [{ id: "wamid.123" }] }), {
      headers: { "content-type": "application/json" },
      status: 200,
    }));
    const provider = new MetaWhatsAppCloudProvider({
      accessToken: "secret",
      fetcher,
      graphApiVersion: "v23.0",
      phoneNumberId: "123456",
    });

    const receipt = await provider.send({
      idempotencyKey: "template-1",
      kind: "template",
      template: { locale: "it", name: "promemoria_appuntamento", parameters: ["Mario", "10:30"] },
      to: "+39 333 123 4567",
    });

    expect(receipt).toMatchObject({ provider: "meta_cloud_api", providerMessageId: "wamid.123" });
    const [url, request] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toBe("https://graph.facebook.com/v23.0/123456/messages");
    expect(request.headers).toMatchObject({ Authorization: "Bearer secret" });
    expect(JSON.parse(String(request.body))).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      template: {
        components: [{ parameters: [{ text: "Mario", type: "text" }, { text: "10:30", type: "text" }], type: "body" }],
        language: { code: "it" },
        name: "promemoria_appuntamento",
      },
      to: "393331234567",
      type: "template",
    });
  });

  it("normalizes Meta failures to a safe code", async () => {
    const provider = new MetaWhatsAppCloudProvider({
      accessToken: "secret",
      fetcher: vi.fn(async () => new Response(JSON.stringify({ error: { message: "sensitive provider detail" } }), { status: 503 })),
      graphApiVersion: "v23.0",
      phoneNumberId: "123456",
    });

    await expect(provider.send({
      idempotencyKey: "template-2",
      kind: "template",
      template: { locale: "it", name: "test", parameters: [] },
      to: "393331234567",
    })).rejects.toMatchObject({ code: "META_UNAVAILABLE", retryable: true });
    await provider.send({
      idempotencyKey: "template-3",
      kind: "template",
      template: { locale: "it", name: "test", parameters: [] },
      to: "393331234567",
    }).catch((error: Error) => expect(error.message).not.toContain("sensitive provider detail"));
  });
});
