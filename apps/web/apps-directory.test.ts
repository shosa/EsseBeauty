import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const dashboard = join(import.meta.dirname, "app", "(dashboard)");
const components = join(dashboard, "_components");

describe("apps directory navigation", () => {
  it("provides a dedicated dashboard page for the permitted app directory", () => {
    const pagePath = join(dashboard, "apps", "page.tsx");

    expect(existsSync(pagePath)).toBe(true);
    if (!existsSync(pagePath)) return;

    const page = readFileSync(pagePath, "utf8");
    expect(page).toContain("visibleApps");
    expect(page).toContain("APP_DOMAINS");
    expect(page).toContain("Cerca app");
    expect(page).toContain('data-ui="app-drawer"');
    expect(page).toContain("aspect-square");
    expect(page).toContain("ESSENTIAL_APP_KEYS");
    expect(page).toContain("!ESSENTIAL_APP_KEYS.has(app.key)");
  });

  it("navigates every Apps control to /apps without modal state", () => {
    const shell = readFileSync(join(components, "DashboardShell.tsx"), "utf8");
    const rail = readFileSync(join(components, "AppRail.tsx"), "utf8");
    const topbar = readFileSync(join(components, "WorkspaceTopbar.tsx"), "utf8");
    const mobile = readFileSync(join(components, "MobileAppNavigation.tsx"), "utf8");

    expect(`${rail}${topbar}${mobile}`).toContain('href="/apps"');
    expect(shell).not.toContain("launcherOpen");
    expect(shell).not.toContain("<AppLauncher");
    expect(`${rail}${topbar}${mobile}`).not.toContain("onLauncherOpen");
  });

  it("centers exactly the three essential pinned apps in the desktop rail", () => {
    const rail = readFileSync(join(components, "AppRail.tsx"), "utf8");

    expect(rail).toContain('new Set(["home", "calendar", "sales"])');
    expect(rail).toContain("flex-1 flex-col items-center justify-center");
    expect(rail).not.toContain("current && !pinnedKeys.has");
    expect(rail).toContain("function FourDotsIcon");
    expect(rail).toContain("grid-cols-2");
    expect(rail).toContain("rounded-full bg-current");
    expect(rail).not.toContain("<ModuleIcon");
  });
});
