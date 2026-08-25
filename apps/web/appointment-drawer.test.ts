import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("appointment checkout drawer", () => {
  it("anchors the appointment and checkout workspace to the shell edge", () => {
    const calendar = readFileSync(join(import.meta.dirname, "app", "(dashboard)", "calendar", "page.tsx"), "utf8");
    const styles = readFileSync(join(import.meta.dirname, "app", "globals.css"), "utf8");

    expect(calendar).toContain("items-stretch justify-end");
    expect(calendar).toContain("max-w-[1280px]");
    expect(calendar).toContain("md:rounded-l-2xl");
    expect(calendar).not.toContain("appointment-curtain mx-auto");
    expect(styles).toContain("@keyframes appointment-drawer-enter");
    expect(styles).toContain("translateX(100%)");
  });
});
