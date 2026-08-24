import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const components = join(import.meta.dirname, "app", "(dashboard)", "_components");

describe("hybrid app workspace shell", () => {
  it("composes focused app-oriented navigation components", () => {
    const shell = readFileSync(join(components, "DashboardShell.tsx"), "utf8");
    for (const component of ["AppRail", "AppLauncher", "WorkspaceTopbar", "MobileAppNavigation"]) {
      expect(shell).toContain(component);
    }
  });

  it("exposes accessible launcher, global search and mobile destinations", () => {
    const rail = readFileSync(join(components, "AppRail.tsx"), "utf8");
    const launcher = readFileSync(join(components, "AppLauncher.tsx"), "utf8");
    const topbar = readFileSync(join(components, "WorkspaceTopbar.tsx"), "utf8");
    const mobile = readFileSync(join(components, "MobileAppNavigation.tsx"), "utf8");

    expect(`${rail}${launcher}${mobile}`).toContain("Apri tutte le app");
    expect(topbar).toContain("Ctrl+K");
    expect(mobile).toContain('label: "Home"');
    expect(mobile).toContain('label: "Agenda"');
    expect(mobile).toContain('label: "Cassa"');
    expect(mobile).toContain('label: "Altro"');
  });
});
