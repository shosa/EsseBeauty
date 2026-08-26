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
    expect(page).toContain("drawerApps(apps)");
  });

  it("opens every Apps control in the global animated overlay", () => {
    const shell = readFileSync(join(components, "DashboardShell.tsx"), "utf8");
    const overlay = readFileSync(join(components, "AppDrawerOverlay.tsx"), "utf8");
    const rail = readFileSync(join(components, "AppRail.tsx"), "utf8");
    const topbar = readFileSync(join(components, "WorkspaceTopbar.tsx"), "utf8");
    const mobile = readFileSync(join(components, "MobileAppNavigation.tsx"), "utf8");

    expect(shell).toContain("launcherOpen");
    expect(shell).toContain("<AppDrawerOverlay");
    expect(`${rail}${topbar}${mobile}`).toContain("onAppsOpen");
    expect(`${rail}${topbar}${mobile}`).not.toContain('href="/apps"');
    expect(overlay).toContain("APP_DOMAINS");
    expect(overlay).toContain("drawerApps(apps)");
    expect(overlay).toContain("esse-app-drawer-item");
    expect(overlay).toContain("grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7");
    expect(overlay).toContain('role="dialog"');
    expect(overlay).toContain("md:left-[76px]");
    expect(overlay).toContain("absolute inset-y-0 left-0 w-full");
    expect(overlay).toContain("md:w-[min(1120px,calc(100vw-76px))]");
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
