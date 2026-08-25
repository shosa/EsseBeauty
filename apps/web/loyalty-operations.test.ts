import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "app", "(dashboard)", "settings", "loyalty", "page.tsx"), "utf8");

describe("loyalty operations dashboard", () => {
  it("surfaces real program metrics and operational history", () => {
    for (const label of ["Membri", "Saldo in circolo", "Punti guadagnati", "Punti riscattati", "Movimenti recenti", "Riscatti recenti"]) {
      expect(source).toContain(label);
    }
  });

  it("supports customer search, manual adjustment and confirmed reward redemption", () => {
    expect(source).toContain("Cerca cliente");
    expect(source).toContain("Riscatta premio");
    expect(source).toContain("Conferma riscatto");
    expect(source).toContain("Correggi saldo");
    expect(source).toContain("Motivo obbligatorio");
    expect(source).toContain("idempotency_key");
  });

  it("manages tiers, rewards and earning rules from one concrete overview", () => {
    expect(source).toContain("Livelli e progressione");
    expect(source).toContain("Salva livelli");
    expect(source).toContain("Catalogo premi");
    expect(source).toContain("Regole di accumulo");
  });
});
