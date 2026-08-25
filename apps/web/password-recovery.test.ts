import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("password recovery UI", () => {
  it("links login to the recovery request", () => {
    expect(source("app/login/page.tsx")).toContain('href="/forgot-password"');
  });

  it("provides accessible request and completion forms with honest states", () => {
    const request = source("app/forgot-password/page.tsx");
    const reset = source("app/reset-password/[token]/page.tsx");
    expect(request).toContain("Invia il link");
    expect(request).toContain('role="status"');
    expect(reset).toContain("Conferma nuova password");
    expect(reset).toContain('aria-live="polite"');
    expect(reset).toContain("/api/auth/password-reset/complete");
  });
});
