import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("calendar mobile layout", () => {
  const source = readFileSync(join(process.cwd(), "app", "(dashboard)", "calendar", "page.tsx"), "utf8");

  it("uses the dynamic viewport and collapses the staff timeline to one column", () => {
    expect(source).toContain("100dvh");
    expect(source).toContain('window.matchMedia("(max-width: 1023px)")');
    expect(source).toContain("staffOptions.slice(selectedMobileStaffIndex, selectedMobileStaffIndex + 1)");
    expect(source).toContain("min-w-0 lg:min-w-[980px]");
  });

  it("keeps only useful calendar modes in the mobile toolbar", () => {
    expect(source).toContain('!isMobile || item.key === "day" || item.key === "agenda"');
    expect(source).toContain("order-first flex w-full items-center justify-between lg:contents");
  });

  it("lets mobile users move between staff agendas", () => {
    expect(source).toContain('aria-label="Staff precedente"');
    expect(source).toContain('aria-label="Staff successivo"');
    expect(source).toContain("moveMobileStaff(-1)");
    expect(source).toContain("moveMobileStaff(1)");
  });
});
