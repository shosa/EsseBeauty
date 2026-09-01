import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("review collection workspace", () => {
  const page = readFileSync(join(process.cwd(), "app", "(dashboard)", "reviews", "page.tsx"), "utf8");
  const appRegistry = readFileSync(join(process.cwd(), "app", "(dashboard)", "_components", "app-registry.ts"), "utf8");

  it("keeps review sections in the workspace topbar tabs", () => {
    expect(page).not.toContain('role="tablist"');
    expect(page).toContain('pathname.startsWith("/reviews/requests")');
    expect(appRegistry).toContain('{ href: "/reviews", label: "Panoramica" }');
    expect(appRegistry).toContain('{ href: "/reviews/requests", label: "Richieste recensione" }');
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
