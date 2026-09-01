import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("review collection workspace", () => {
  const page = readFileSync(join(process.cwd(), "app", "(dashboard)", "reviews", "page.tsx"), "utf8");

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
