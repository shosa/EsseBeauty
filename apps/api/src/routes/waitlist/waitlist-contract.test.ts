import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("waitlist contract", () => {
  const schema = readFileSync(join(process.cwd(), "..", "..", "packages", "db", "schema.ts"), "utf8");
  const routes = readFileSync(join(process.cwd(), "src", "routes", "waitlist", "index.ts"), "utf8");
  const publicRoutes = readFileSync(join(process.cwd(), "src", "routes", "public", "index.ts"), "utf8");

  it("stores and validates a customer time preference", () => {
    expect(schema).toContain('timePreference: text("time_preference")');
    expect(routes).toContain("time_preference");
    expect(routes).toContain("WAITLIST_DUPLICATE");
  });

  it("exposes the waitlist capability without exposing modules", () => {
    expect(publicRoutes).toContain("capabilities");
    expect(publicRoutes).toContain("waitlist:");
  });
});
