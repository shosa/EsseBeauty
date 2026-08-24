import { describe, expect, it } from "vitest";

import { sanitizeAuditPayload } from "./audit-log.js";

describe("audit log provider secret redaction", () => {
  it("redacts every WhatsApp credential field recursively", () => {
    const value = sanitizeAuditPayload({
      access_token: "meta-token",
      nested: {
        authentication_tag: "gcm-tag",
        ciphertext: "encrypted-secret",
        webhook_verify_token: "verify-token",
      },
      waba_id: "safe-account-id",
    });

    expect(value).toEqual({
      access_token: "[PROTETTO]",
      nested: {
        authentication_tag: "[PROTETTO]",
        ciphertext: "[PROTETTO]",
        webhook_verify_token: "[PROTETTO]",
      },
      waba_id: "safe-account-id",
    });
    expect(JSON.stringify(value)).not.toContain("meta-token");
    expect(JSON.stringify(value)).not.toContain("verify-token");
  });
});
