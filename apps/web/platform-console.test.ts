import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "app", "platform", "page.tsx"), "utf8");

describe("platform operations console", () => {
  it("loads the global platform overview", () => {
    expect(source).toContain('"/api/platform/overview"');
    expect(source).toContain("Panoramica piattaforma");
    expect(source).toContain('"/api/platform/plans"');
    expect(source).toContain('"/api/platform/module-catalog"');
    expect(source).toContain('"/api/platform/audit-log"');
    expect(source).toContain('"/api/platform/system-templates"');
  });

  it("offers a protected salon deletion workflow", () => {
    expect(source).toContain("Elimina definitivamente il salone");
    expect(source).toContain("deleteSalon");
    expect(source).toContain("confirmation:");
  });

  it("does not repeat decorative status pills in salon module cards", () => {
    expect(source).not.toContain('<StatusBadge status={enabled ? "active" : "inactive"}>');
  });
});
