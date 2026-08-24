export const REVIEW_SESSION_COOKIE = "esse-review-session";
export const REVIEW_SESSION_MAX_AGE_SECONDS = 10 * 60;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sessionKey(secret: string): Promise<CryptoKey> {
  if (secret.length < 32) throw new TypeError("REVIEW_SESSION_SECRET must contain at least 32 characters");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptReviewSession(
  token: string,
  secret: string,
  issuedAt = Date.now(),
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify({ issuedAt, token }));
  const encrypted = await crypto.subtle.encrypt(
    { iv, name: "AES-GCM" },
    await sessionKey(secret),
    plaintext,
  );
  const payload = new Uint8Array(iv.length + encrypted.byteLength);
  payload.set(iv);
  payload.set(new Uint8Array(encrypted), iv.length);
  return base64UrlEncode(payload);
}

export async function decryptReviewSession(
  payload: string,
  secret: string,
  now = Date.now(),
): Promise<string | undefined> {
  try {
    const bytes = base64UrlDecode(payload);
    if (bytes.length <= 28) return undefined;
    const decrypted = await crypto.subtle.decrypt(
      { iv: bytes.slice(0, 12), name: "AES-GCM" },
      await sessionKey(secret),
      bytes.slice(12),
    );
    const parsed = JSON.parse(decoder.decode(decrypted)) as { issuedAt?: unknown; token?: unknown };
    if (
      typeof parsed.issuedAt !== "number" ||
      typeof parsed.token !== "string" ||
      parsed.issuedAt > now + 60_000 ||
      now - parsed.issuedAt > REVIEW_SESSION_MAX_AGE_SECONDS * 1_000
    ) return undefined;
    return parsed.token;
  } catch {
    return undefined;
  }
}
