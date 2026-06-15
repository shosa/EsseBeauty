import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export const SESSION_COOKIE = "esse-session";
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60_000;

export async function hashPassword(
  password: string,
  salt = randomBytes(16).toString("hex"),
): Promise<{ hash: string; salt: string }> {
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return { hash: derived.toString("hex"), salt };
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHash, "hex");
  return (
    derived.length === expected.length && timingSafeEqual(derived, expected)
  );
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
