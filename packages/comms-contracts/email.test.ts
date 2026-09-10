import { describe, expect, it } from "vitest";

import {
  ProviderNotConfiguredError,
  createCommunicationProviderRegistry,
  providerStatus,
} from "./email.js";

describe("communication provider readiness", () => {
  it("reports email as not configured when provider credentials are absent", () => {
    expect(providerStatus({})).toEqual({ email: "not_configured" });
  });

  it("does not expose legacy environment credentials as ready", () => {
    expect(providerStatus({})).toEqual({ email: "not_configured" });
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
