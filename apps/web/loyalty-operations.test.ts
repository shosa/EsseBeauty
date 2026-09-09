import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardRoot = join(process.cwd(), "app", "(dashboard)");
const dashboardSource = readFileSync(join(dashboardRoot, "loyalty", "page.tsx"), "utf8");
const customersSource = readFileSync(join(dashboardRoot, "loyalty", "customers", "page.tsx"), "utf8");
const tiersSource = readFileSync(join(dashboardRoot, "loyalty", "tiers", "page.tsx"), "utf8");
const rewardsSource = readFileSync(join(dashboardRoot, "loyalty", "rewards", "page.tsx"), "utf8");
const settingsSource = readFileSync(join(dashboardRoot, "loyalty", "settings", "page.tsx"), "utf8");

describe("loyalty operations dashboard", () => {
  it("surfaces real program metrics and operational history on the overview tab", () => {
    for (const label of ["Membri", "Saldo in circolo", "Punti guadagnati", "Punti riscattati", "Movimenti recenti", "Riscatti recenti"]) {
      expect(dashboardSource).toContain(label);
    }
  });

  it("supports customer search, manual adjustment and confirmed reward redemption on the customers tab", () => {
    expect(customersSource).toContain("Cerca cliente");
    expect(customersSource).toContain("Riscatta premio");
    expect(customersSource).toContain("Conferma riscatto");
    expect(customersSource).toContain("Correggi saldo");
    expect(customersSource).toContain("Motivo obbligatorio");
    expect(customersSource).toContain("idempotency_key");
  });

  it("manages tiers, rewards and earning rules across their own dedicated tabs", () => {
    expect(tiersSource).toContain("Livelli e progressione");
    expect(tiersSource).toContain("Salva livelli");
    expect(rewardsSource).toContain("Catalogo premi");
    expect(settingsSource).toContain("Regole di accumulo");
  });

  it("exposes loyalty as a top-level app with topbar tab navigation instead of a single settings page", () => {
    const registry = readFileSync(join(dashboardRoot, "_components", "app-registry.ts"), "utf8");
    const loyaltyEntry = registry.slice(registry.indexOf('key: "loyalty"') - 200, registry.indexOf('key: "loyalty"') + 600);
    expect(loyaltyEntry).toContain('href: "/loyalty"');
    expect(loyaltyEntry).toContain('href: "/loyalty/customers"');
    expect(loyaltyEntry).toContain('href: "/loyalty/rewards"');
    expect(loyaltyEntry).toContain('href: "/loyalty/tiers"');
    expect(loyaltyEntry).toContain('href: "/loyalty/settings"');
  });
});
