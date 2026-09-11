import { createHash } from "node:crypto";

export const WEB_SESSION_COOKIE = "esse-session";
export const STAFF_SESSION_COOKIE = "esse-staff-session";
export const SESSION_COOKIE = WEB_SESSION_COOKIE;
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60_000;

export function sessionCookieForClient(client?: string): string {
  return client === "staff" ? STAFF_SESSION_COOKIE : WEB_SESSION_COOKIE;
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
