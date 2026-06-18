import { describe, expect, it } from "vitest";

import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  sessionCookieForClient,
  STAFF_SESSION_COOKIE,
  WEB_SESSION_COOKIE,
  verifyPassword,
} from "./local-auth.js";

describe("local auth", () => {
  it("hashes and verifies passwords", async () => {
    const password = await hashPassword("a-secure-password");
    expect(
      await verifyPassword(
        "a-secure-password",
        password.salt,
        password.hash,
      ),
    ).toBe(true);
    expect(
      await verifyPassword("wrong-password", password.salt, password.hash),
    ).toBe(false);
  });

  it("creates opaque session tokens and stable hashes", () => {
    const token = createSessionToken();
    expect(token.length).toBeGreaterThan(30);
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).not.toBe(token);
  });

  it("keeps web and staff sessions in separate cookies", () => {
    expect(sessionCookieForClient(undefined)).toBe(WEB_SESSION_COOKIE);
    expect(sessionCookieForClient("web")).toBe(WEB_SESSION_COOKIE);
    expect(sessionCookieForClient("staff")).toBe(STAFF_SESSION_COOKIE);
    expect(STAFF_SESSION_COOKIE).not.toBe(WEB_SESSION_COOKIE);
  });
});
