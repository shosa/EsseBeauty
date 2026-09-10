import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

export {
  hashSessionToken,
  SESSION_COOKIE,
  SESSION_DURATION_MS,
  sessionCookieForClient,
  STAFF_SESSION_COOKIE,
  WEB_SESSION_COOKIE,
} from "@esse-beauty/server-shared";

const scrypt = promisify(scryptCallback);

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
