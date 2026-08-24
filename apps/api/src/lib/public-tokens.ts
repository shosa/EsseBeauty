import { createHash, randomBytes } from "node:crypto";

export interface IssuedPublicToken {
  entityId: string;
  expiresAt: Date;
  purpose: string;
  raw: string;
  tokenHash: string;
}

export type VerifiedPublicToken =
  | { ok: true; tokenHash: string }
  | { error: "TOKEN_INVALID"; ok: false };

const purposePattern = /^[a-z][a-z0-9_-]{0,63}$/;
const invalidToken: VerifiedPublicToken = { error: "TOKEN_INVALID", ok: false };

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function issuePublicToken(
  purpose: string,
  entityId: string,
  expiresAt: Date,
): IssuedPublicToken {
  if (!purposePattern.test(purpose)) {
    throw new TypeError("Public token purpose must be a lowercase identifier.");
  }
  if (!entityId) {
    throw new TypeError("Public tokens require an entity identifier.");
  }
  if (!Number.isFinite(expiresAt.getTime())) {
    throw new TypeError("Public tokens require a valid expiry.");
  }

  const raw = [
    "v1",
    purpose,
    expiresAt.getTime().toString(36),
    randomBytes(32).toString("base64url"),
  ].join(".");

  return { entityId, expiresAt, purpose, raw, tokenHash: hashToken(raw) };
}

export function verifyPublicToken(raw: string, purpose: string): VerifiedPublicToken {
  const match = /^v1\.([a-z][a-z0-9_-]{0,63})\.([a-z0-9]+)\.([A-Za-z0-9_-]{43})$/.exec(raw);
  if (!match || !purposePattern.test(purpose)) return invalidToken;

  const tokenPurpose = match[1];
  const expiry = match[2];
  if (!tokenPurpose || !expiry) return invalidToken;
  const expiresAt = Number.parseInt(expiry, 36);
  if (
    tokenPurpose !== purpose ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Date.now()
  ) {
    return invalidToken;
  }

  return { ok: true, tokenHash: hashToken(raw) };
}
