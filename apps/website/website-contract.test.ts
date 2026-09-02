import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("EsseBeauty sales website", () => {
  it("centralizes the demo and subscriber destinations", () => {
    const config = source("app/site-config.ts");
    expect(config).toContain("NEXT_PUBLIC_ESSEBEAUTY_APP_URL");
    expect(config).toContain("NEXT_PUBLIC_ESSEBEAUTY_DEMO_EMAIL");
    expect(config).toContain("demoMailto");
  });

  it("presents the approved sales story and both conversion actions", () => {
    const page = source("app/page.tsx");
    expect(page).toContain("Il tuo centro estetico, finalmente tutto sotto controllo");
    expect(page).toContain("Richiedi una demo");
    expect(page).toContain("Accedi");
    expect(page).toContain("Funzionalità");
    expect(page).toContain("Come funziona");
    expect(page).toContain("Perché EsseBeauty");
  });

  it("includes accessible navigation and reduced-motion support", () => {
    expect(source("app/page.tsx")).toContain('id="main-content"');
    expect(source("app/_components/SiteHeader.tsx")).toContain("aria-expanded");
    expect(source("app/globals.css")).toContain("prefers-reduced-motion");
  });
});
