import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "app", "(dashboard)");

describe("operational home", () => {
  it("composes focused daily work components", () => {
    const page = readFileSync(join(root, "page.tsx"), "utf8");
    expect(page).toContain("TodayTimeline");
    expect(page).toContain("OperationalInbox");
    expect(page).toContain("esse:open-notifications");
  });

  it("leaves app navigation to the rail instead of duplicating orphan shortcuts", () => {
    const page = readFileSync(join(root, "page.tsx"), "utf8");
    const rail = readFileSync(join(root, "_components", "AppRail.tsx"), "utf8");
    const workspaces = ["_components/TodayTimeline.tsx", "_components/OperationalInbox.tsx"]
      .map((file) => readFileSync(join(root, file), "utf8")).join("\n");
    expect(workspaces).toContain("Oggi nel salone");
    expect(workspaces).toContain("Da gestire");
    expect(page).not.toContain('aria-label="Azioni rapide"');
    expect(rail).toContain('new Set(["home", "calendar", "sales"])');
  });
});
