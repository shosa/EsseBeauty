import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("public customer messages routes", () => {
  const source = readFileSync(join(process.cwd(), "src", "routes", "public", "messages.ts"), "utf8");

  it("lists authenticated customer messages before opening a single message", () => {
    expect(source).toContain('"/api/public/:slug/messages"');
    expect(source).toContain("resolveCustomerId");
    expect(source).toContain("orderBy(desc(customerAppMessages.createdAt))");
    expect(source).toContain("read_at");
  });
});
