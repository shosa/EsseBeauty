import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("platform tier contract", () => {
  it("keeps module mutation in platform routes, not salon routes", () => {
    const app = readFileSync(join(process.cwd(), "src", "app.ts"), "utf8");
    const platform = readFileSync(join(process.cwd(), "src", "routes", "platform", "index.ts"), "utf8");

    expect(app).toContain("registerPlatformRoutes");
    expect(app).not.toContain('"/api/salons/:id/modules/:key"');
    expect(platform).toContain('"/api/platform/salons/:salonId/modules/:key"');
    expect(platform).toContain("authenticatePlatform");
  });
});
