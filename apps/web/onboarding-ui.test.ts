import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(join(import.meta.dirname, "app", "onboarding", "page.tsx"), "utf8");

describe("onboarding UI", () => {
  it("derives navigation from the server manifest", () => {
    expect(source).toContain("data.steps");
    expect(source).toContain("OnboardingProgress");
    expect(source).not.toContain("const labels =");
  });

  it("configures locations, cabins and real service assignments", () => {
    expect(source).toContain("Sedi e orari");
    expect(source).toContain("Cabine e risorse");
    expect(source).toContain("Assegna servizi allo staff");
    expect(source).toContain("Seleziona tutto");
  });

  it("announces save and validation feedback", () => {
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("Correggi");
  });

  it("links only the first staff profile to the owner account", () => {
    expect(source).toContain("index === 0 && <label");
  });

  it("keeps the service catalogue in a separate responsive table below the editor", () => {
    expect(source).toContain("Catalogo servizi");
    expect(source).toContain("overflow-x-auto");
    expect(source).toContain("<table");
    expect(source).toContain("Servizio");
    expect(source).toContain("Categoria");
    expect(source).toContain("Durata");
    expect(source).toContain("Prezzo");
    expect(source).not.toContain("activeServices.map");
  });

  it("lets the owner log out of onboarding and return to login", () => {
    expect(source).toContain("async function logout()");
    expect(source).toContain("/api/auth/logout");
    expect(source).toContain('router.replace("/login")');
    expect(source).toContain('aria-label="Esci dall\'account"');
  });

  it("uses the primary CTA colour behind the onboarding logo", () => {
    expect(source).toContain('className="grid size-11 place-items-center rounded-[14px] bg-[#792f59]"');
  });
});
