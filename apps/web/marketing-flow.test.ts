import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardRoot = join(process.cwd(), "app", "(dashboard)", "marketing");

function page(...segments: string[]) {
  return readFileSync(join(dashboardRoot, ...segments, "page.tsx"), "utf8");
}

describe("campaign operations", () => {
  it("requires an audience preview and keeps test delivery separate", () => {
    const source = page("new");
    expect(source).toContain("Anteprima destinatari");
    expect(source).toContain("Invia test");
    expect(source).toContain("Destinazioni escluse");
  });

  it("exposes truthful recovery and cancellation actions", () => {
    const source = page("[campaignId]");
    expect(source).toContain("Riprova falliti");
    expect(source).toContain("Annulla pianificazione");
    expect(source).toContain("Provider non configurato");
  });

  it("exposes reusable campaign templates", () => {
    expect(page("templates")).toContain("Nuovo modello");
  });
});
