import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = join(process.cwd(), "..", "admin", "app");
const consoleSource = readFileSync(join(adminRoot, "_components", "PlatformConsole.tsx"), "utf8");

describe("admin tenant-manager console", () => {
  it("uses an operational navigation with service status, not a decorative overview", () => {
    expect(existsSync(join(adminRoot, "services", "page.tsx"))).toBe(true);
    expect(consoleSource).toContain('label: "Stato servizi"');
    expect(consoleSource).toContain('view: "services"');
    expect(consoleSource).not.toContain("Ogni salone sotto controllo");
    expect(consoleSource).not.toContain("Beauty Management Platform");
  });

  it("lets tenant managers compare and apply plan modules per salon", () => {
    expect(consoleSource).toContain("PlanAlignmentPanel");
    expect(consoleSource).toContain("/api/platform/salons/${selected.id}/plan-alignment");
    expect(consoleSource).toContain("/api/platform/salons/${selected.id}/apply-plan");
    expect(consoleSource).toContain("Moduli inclusi nel piano");
    expect(consoleSource).toContain("Override manuali");
  });

  it("treats plans as module packages with selectable module lists", () => {
    expect(consoleSource).toContain("PlanEditorModal");
    expect(consoleSource).toContain("included_modules");
    expect(consoleSource).toContain("Limiti operativi");
    expect(consoleSource).toContain("type=\"checkbox\"");
  });

  it("renders service health with explicit backend status badges", () => {
    expect(consoleSource).toContain("ServicesStatus");
    expect(consoleSource).toContain("/api/platform/services/status");
    expect(consoleSource).toContain("operational");
    expect(consoleSource).toContain("degraded");
    expect(consoleSource).toContain("offline");
  });
});
