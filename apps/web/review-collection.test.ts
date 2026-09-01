import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("review collection workspace", () => {
  const page = readFileSync(join(process.cwd(), "app", "(dashboard)", "reviews", "page.tsx"), "utf8");

  it("separates the overview from request management with accessible tabs", () => {
    expect(page).toContain('role="tablist"');
    expect(page).toContain('role="tab"');
    expect(page).toContain('aria-selected={activeTab === "overview"}');
    expect(page).toContain('aria-selected={activeTab === "requests"}');
    expect(page).toContain("Panoramica");
    expect(page).toContain("Richieste recensione");
  });

  it("keeps secondary configuration and delivery details collapsible", () => {
    expect(page).toContain("Modifica configurazione");
    expect(page).toContain("Dettagli invii");
    expect(page).toContain("<details");
  });

  it("configures automation and operates manual multi-channel requests", () => {
    expect(page).toContain("Raccolta recensioni");
    expect(page).toContain("Subito");
    expect(page).toContain("Dopo 1 ora");
    expect(page).toContain("Il giorno successivo");
    expect(page).toContain("Email");
    expect(page).toContain("WhatsApp");
    expect(page).toContain("Invia ora");
    expect(page).toContain("Reinvia");
    expect(page).toContain("Recensioni ricevute");
  });
});
