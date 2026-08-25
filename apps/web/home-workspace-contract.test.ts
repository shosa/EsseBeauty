import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "app", "(dashboard)");

describe("operational home", () => {
  it("composes focused daily work components", () => {
    const page = readFileSync(join(root, "page.tsx"), "utf8");
    expect(page).toContain("HomeKpiStrip");
    expect(page).toContain("TodayTimeline");
    expect(page).toContain("OperationalInbox");
    expect(page).toContain("esse:open-notifications");
  });

  it("keeps primary destinations one click away", () => {
    const sources = ["page.tsx", "_components/TodayTimeline.tsx", "_components/OperationalInbox.tsx"]
      .map((file) => readFileSync(join(root, file), "utf8")).join("\n");
    expect(sources).toContain("Oggi nel salone");
    expect(sources).toContain("Da gestire");
    expect(sources).toContain('href="/calendar"');
    expect(sources).toContain('href="/sales"');
    expect(sources).toContain('href="/clients"');
  });
});
