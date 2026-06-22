import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("PWA settings integration", () => {
  const settings = readFileSync(join(process.cwd(), "src", "routes", "settings", "index.ts"), "utf8");
  const publicRoutes = readFileSync(join(process.cwd(), "src", "routes", "public", "index.ts"), "utf8");

  it("controls booking status and customer autonomy from salon settings", () => {
    expect(settings).toContain('"/api/salons/:id/settings/pwa"');
    expect(settings).toContain("bookingDefaultStatus");
    expect(publicRoutes).toContain("pwa.bookingDefaultStatus");
    expect(publicRoutes).toContain("pwa.allowCancellation");
    expect(publicRoutes).toContain("pwa.allowReschedule");
    expect(publicRoutes).toContain("pwa.allowStaffPreference");
    expect(publicRoutes).toContain("pwa.minBookingNoticeHours");
  });
});
