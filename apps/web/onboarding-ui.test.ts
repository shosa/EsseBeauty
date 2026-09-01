import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(join(import.meta.dirname, "app", "onboarding", "page.tsx"), "utf8");

describe("onboarding UI", () => {
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
