import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";

import {
  decryptProviderSecret,
  encryptProviderSecret,
  type ProviderSecretContext,
} from "./provider-credentials.js";

const context: ProviderSecretContext = {
  accountId: "81aa8e9f-27a7-4de9-bf5e-c3c8eaed7c6d",
  provider: "meta_cloud_api",
  salonId: "fb09b198-5c2e-482a-8185-4fa9b4bbf9af",
};

describe("provider credentials", () => {
  it("round-trips an AES-256-GCM secret without exposing plaintext", () => {
    process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    process.env.PROVIDER_CREDENTIAL_KEY_VERSION = "v1";

    const encrypted = encryptProviderSecret("meta-access-token", context);

    expect(decryptProviderSecret(encrypted, context)).toBe("meta-access-token");
    expect(JSON.stringify(encrypted)).not.toContain("meta-access-token");
    expect(encrypted.keyVersion).toBe("v1");
  });

  it("rejects a ciphertext replayed for another tenant or account", () => {
    process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    process.env.PROVIDER_CREDENTIAL_KEY_VERSION = "v2";
    const encrypted = encryptProviderSecret("tenant-bound-token", context);

    expect(() => decryptProviderSecret(encrypted, { ...context, salonId: "other-salon" })).toThrow(
      "Provider credential authentication failed",
    );
    expect(() => decryptProviderSecret(encrypted, { ...context, accountId: "other-account" })).toThrow(
      "Provider credential authentication failed",
    );
  });

  it("rejects malformed deployment keys before encrypting", () => {
    process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY = "not-a-32-byte-key";
    process.env.PROVIDER_CREDENTIAL_KEY_VERSION = "v1";

    expect(() => encryptProviderSecret("token", context)).toThrow(
      "PROVIDER_CREDENTIAL_ENCRYPTION_KEY must decode to 32 bytes",
    );
  });
});
