import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { APP_REGISTRY, contextTabsForPath } from "./app/(dashboard)/_components/app-registry.js";
import { PERMISSION_KEYS } from "@esse-beauty/shared";

const packagesPage = readFileSync(join(process.cwd(), "app", "(dashboard)", "packages", "page.tsx"), "utf8");

describe("packages: catalog + assignments only", () => {
  it("owns exactly two topbar tabs: Catalogo and Assegnazioni", () => {
    const allPermissions = new Set(Object.values(PERMISSION_KEYS));

    expect(contextTabsForPath("/packages/assignments", allPermissions).map((tab) => [tab.label, tab.href])).toEqual([
      ["Catalogo", "/packages"],
      ["Assegnazioni", "/packages/assignments"],
    ]);
  });

  it("keeps the Pacchetti label and PACKAGES module gate", () => {
    const packages = APP_REGISTRY.find((app) => app.key === "packages");
    expect(packages?.label).toBe("Pacchetti");
    expect(packages?.tabs?.map((tab) => tab.href)).toEqual(["/packages", "/packages/assignments"]);
  });

  it("creates a package through a modal and lets it be deactivated from sale, no assignment flow", () => {
    expect(packagesPage).toContain("builderOpen");
    expect(packagesPage).toContain("servicesByCategory");
    expect(packagesPage).toContain("toggleActive");
    expect(packagesPage).toContain('method: "PATCH"');
    expect(packagesPage).not.toContain("setAssignPackage");
    expect(packagesPage).not.toContain("Assegna a cliente");
  });

  it("shows the read-only usage log on an assignment, with no way to register a new usage", () => {
    expect(packagesPage).toContain("drawerUsages");
    expect(packagesPage).toContain("Registro utilizzi");
    expect(packagesPage).not.toContain("submitUsage");
    expect(packagesPage).not.toContain("Registra utilizzo");
  });
});
