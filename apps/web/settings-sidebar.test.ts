import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("settings workspace sidebar", () => {
  it("renders grouped settings navigation beside the page content", () => {
    const layout = readFileSync(join(import.meta.dirname, "app", "(dashboard)", "settings", "layout.tsx"), "utf8");

    expect(layout).toContain("<aside");
    expect(layout).toContain("lg:grid-cols-[210px_minmax(0,1fr)]");
    expect(layout).toContain("lg:sticky");
    expect(layout).toContain('aria-label="Navigazione impostazioni"');
    expect(layout).not.toContain("lg:grid-cols-[1.15fr_.85fr_1fr]");
    expect(layout).toContain('/settings/locations');
  });
});
