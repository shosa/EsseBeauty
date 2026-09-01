import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const components = join(import.meta.dirname, "app", "(dashboard)", "_components");

describe("hybrid app workspace shell", () => {
  it("composes focused app-oriented navigation components", () => {
    const shell = readFileSync(join(components, "DashboardShell.tsx"), "utf8");
    for (const component of ["AppRail", "WorkspaceTopbar", "MobileAppNavigation"]) {
      expect(shell).toContain(component);
    }
    expect(shell).not.toContain("<AppLauncher");
  });

  it("exposes accessible app directory navigation, global search and mobile destinations", () => {
    const rail = readFileSync(join(components, "AppRail.tsx"), "utf8");
    const topbar = readFileSync(join(components, "WorkspaceTopbar.tsx"), "utf8");
    const mobile = readFileSync(join(components, "MobileAppNavigation.tsx"), "utf8");

    expect(`${rail}${topbar}${mobile}`).toContain("Apri tutte le app");
    expect(`${rail}${topbar}${mobile}`).toContain("onAppsOpen");
    expect(`${rail}${topbar}${mobile}`).not.toContain('href="/apps"');
    expect(topbar).toContain("Ctrl+K");
    expect(mobile).toContain('label: "Home"');
    expect(mobile).toContain('label: "Agenda"');
    expect(mobile).toContain('label: "Cassa"');
    expect(mobile).toContain("<span>Altro</span>");
  });

  it("keeps the mobile topbar actions right-aligned and uses the Lucide search icon", () => {
    const topbar = readFileSync(join(components, "WorkspaceTopbar.tsx"), "utf8");

    expect(topbar).toContain('import { Search } from "lucide-react"');
    expect(topbar).toContain('aria-label="Azioni rapide"');
    expect(topbar).toContain('className="ml-auto flex shrink-0 items-center gap-2"');
    expect(topbar).toContain('<Search aria-hidden="true" className="size-5" />');
    expect(topbar).not.toContain(">⌕</button>");
  });
});
