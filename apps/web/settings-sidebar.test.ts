import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("settings workspace sidebar", () => {
  it("renders a persistent accordion settings sidebar beside page content", () => {
    const layout = readFileSync(join(import.meta.dirname, "app", "(dashboard)", "settings", "layout.tsx"), "utf8");

    expect(layout).toContain("<aside");
    expect(layout).toContain('aria-label="Navigazione impostazioni"');
    expect(layout).toContain('aria-label="Categorie impostazioni"');
    expect(layout).toContain("<details");
    expect(layout).toContain('lg:grid-cols-[300px_minmax(0,1fr)]');
    expect(layout).toContain('/settings/salon');
    expect(layout).toContain('/settings/address');
    expect(layout).toContain('/settings/closures');
    expect(layout).toContain('/settings/special-openings');
    expect(layout).not.toContain('lg:grid-cols-[220px_minmax(0,1fr)]');
    expect(layout).not.toContain("lg:grid-cols-[1.15fr_.85fr_1fr]");
  });

  it("keeps the settings index as main content rather than the navigation source", () => {
    const page = readFileSync(join(import.meta.dirname, "app", "(dashboard)", "settings", "page.tsx"), "utf8");

    expect(page).not.toContain('aria-label="Categorie impostazioni"');
    expect(page).not.toContain("<details");
    expect(page).toContain('/settings/salon');
    expect(page).toContain('/settings/locations');
  });
});
