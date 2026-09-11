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

  it("protects tenant deletion with explicit slug confirmation and an audit event", () => {
    const platform = readFileSync(join(process.cwd(), "src", "routes", "platform", "index.ts"), "utf8");

    expect(platform).toContain('"/api/platform/salons/:salonId"');
    expect(platform).toContain("confirmation?: string");
    expect(platform).toContain("SALON_CONFIRMATION_MISMATCH");
    expect(platform).toContain('action: "salon.deleted"');
    expect(platform).toContain('action: "salon.created"');
    expect(platform).toContain('action: "salon.updated"');
    expect(platform).toContain('action: "module.updated"');
    expect(platform).toContain(".delete(salons)");
  });

  it("exposes tenant-manager endpoints for plans, module alignment and service status", () => {
    const platform = readFileSync(join(process.cwd(), "src", "routes", "platform", "index.ts"), "utf8");

    expect(platform).toContain('"/api/platform/salons/:salonId/plan-alignment"');
    expect(platform).toContain('"/api/platform/salons/:salonId/apply-plan"');
    expect(platform).toContain('"/api/platform/services/status"');
    expect(platform).toContain("included_modules");
    expect(platform).toContain('action: "salon.plan_aligned"');
  });
});
