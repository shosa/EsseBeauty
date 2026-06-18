import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("salon onboarding security contract", () => {
  it("does not expose public salon bootstrap routes", () => {
    const auth = readFileSync(
      join(process.cwd(), "src", "routes", "auth", "index.ts"),
      "utf8",
    );

    expect(auth).not.toContain('"/api/auth/bootstrap"');
    expect(auth).not.toContain('"/api/auth/bootstrap/status"');
  });

  it("allows onboarding only after authenticated owner access", () => {
    const onboarding = readFileSync(
      join(process.cwd(), "src", "routes", "onboarding", "index.ts"),
      "utf8",
    );

    expect(onboarding).toContain('requireRole("owner")');
    expect(onboarding).toContain("authenticate");
  });

  it("requires the platform administrator to create owner credentials", () => {
    const platform = readFileSync(
      join(process.cwd(), "src", "routes", "platform", "index.ts"),
      "utf8",
    );

    expect(platform).toContain('error: "OWNER_REQUIRED"');
    expect(platform).toContain("mustChangePassword: true");
  });
});
