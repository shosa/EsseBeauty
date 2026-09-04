import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("client PWA experience", () => {
  it("uses an icon navigation with active route feedback", () => {
    const source = readFileSync(join(process.cwd(), "app", "[slug]", "_components", "SalonBottomNav.tsx"), "utf8");
    expect(source).toContain("usePathname");
    expect(source).toContain("CalendarPlus");
    expect(source).toContain('aria-current');
  });

  it("opens a dedicated reschedule wizard scoped to the selected appointment", () => {
    const source = readFileSync(join(process.cwd(), "app", "[slug]", "appointments", "page.tsx"), "utf8");
    expect(source).toContain("setRescheduleTarget(item)");
    expect(source).toContain("RescheduleWizard");
  });

  it("uses library icons instead of text glyph CTAs on the customer home", () => {
    const source = readFileSync(join(process.cwd(), "app", "[slug]", "page.tsx"), "utf8");
    expect(source).toContain("CalendarDays");
    expect(source).toContain("CalendarPlus");
    expect(source).not.toContain(">⌁<");
  });
});
