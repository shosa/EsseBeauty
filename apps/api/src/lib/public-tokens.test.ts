import { describe, expect, it } from "vitest";

import { issuePublicToken, verifyPublicToken } from "./public-tokens.js";

describe("public tokens", () => {
  it("keeps the raw secret separate from the SHA-256 persistence value", () => {
    const token = issuePublicToken(
      "review",
      "entity-id",
      new Date("2026-08-25T12:00:00.000Z"),
    );

    expect(token.raw).not.toContain("entity-id");
    expect(token.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(token.tokenHash).not.toBe(token.raw);
    expect(verifyPublicToken(token.raw, "review")).toEqual({
      ok: true,
      tokenHash: token.tokenHash,
    });
  });

  it("rejects expired and wrong-purpose public tokens", () => {
    const expired = issuePublicToken(
      "review",
      "entity-id",
      new Date(Date.now() - 1),
    );
    const active = issuePublicToken(
      "review",
      "entity-id",
      new Date(Date.now() + 60_000),
    );

    expect(verifyPublicToken(expired.raw, "review")).toEqual({
      error: "TOKEN_INVALID",
      ok: false,
    });
    expect(verifyPublicToken(active.raw, "consent")).toEqual({
      error: "TOKEN_INVALID",
      ok: false,
    });
  });
});
