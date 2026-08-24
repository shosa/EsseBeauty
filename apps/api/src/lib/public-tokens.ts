import { createHash, createHmac, randomBytes } from "node:crypto";

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

export type InspectedPublicToken =
  | {
      expired: boolean;
      expiresAt: Date;
      ok: true;
      tokenHash: string;
    }
  | { error: "TOKEN_INVALID"; ok: false };

const purposePattern = /^[a-z][a-z0-9_-]{0,63}$/;
const invalidToken = { error: "TOKEN_INVALID", ok: false } as const;

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

export function issueStablePublicToken(
  purpose: string,
  entityId: string,
  expiresAt: Date,
  secret: string,
): IssuedPublicToken {
  if (secret.length < 32) {
    throw new TypeError("Stable public tokens require a secret of at least 32 characters.");
  }
  if (!purposePattern.test(purpose)) {
    throw new TypeError("Public token purpose must be a lowercase identifier.");
  }
  if (!entityId) {
    throw new TypeError("Public tokens require an entity identifier.");
  }
  if (!Number.isFinite(expiresAt.getTime())) {
    throw new TypeError("Public tokens require a valid expiry.");
  }
  const entropy = createHmac("sha256", secret)
    .update(`${purpose}\0${entityId}\0${expiresAt.getTime()}`)
    .digest("base64url");
  const raw = ["v1", purpose, expiresAt.getTime().toString(36), entropy].join(".");
  return { entityId, expiresAt, purpose, raw, tokenHash: hashToken(raw) };
}

export function verifyPublicToken(raw: string, purpose: string): VerifiedPublicToken {
  const inspected = inspectPublicToken(raw, purpose);
  if (!inspected.ok || inspected.expired) return invalidToken;
  return { ok: true, tokenHash: inspected.tokenHash };
}

export function inspectPublicToken(raw: string, purpose: string): InspectedPublicToken {
  const match = /^v1\.([a-z][a-z0-9_-]{0,63})\.([a-z0-9]+)\.([A-Za-z0-9_-]{43})$/.exec(raw);
  if (!match || !purposePattern.test(purpose)) return invalidToken;

  const tokenPurpose = match[1];
  const expiry = match[2];
  if (!tokenPurpose || !expiry) return invalidToken;
  const expiresAt = Number.parseInt(expiry, 36);
  if (
    tokenPurpose !== purpose ||
    !Number.isSafeInteger(expiresAt)
  ) {
    return invalidToken;
  }

  return {
    expired: expiresAt <= Date.now(),
    expiresAt: new Date(expiresAt),
    ok: true,
    tokenHash: hashToken(raw),
  };
}
