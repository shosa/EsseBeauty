import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("EsseBeauty sales website", () => {
  it("centralizes the demo and subscriber destinations", () => {
    const config = source("app/site-config.ts");
    expect(config).toContain("NEXT_PUBLIC_WEB_URL");
    expect(config).toContain("NEXT_PUBLIC_BUSINESS_EMAIL");
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

  it("covers the real product without fabricated proof", () => {
    const features = source("app/_components/FeatureShowcase.tsx");
    expect(features).toContain("Agenda e lista d’attesa");
    expect(features).toContain("Clienti e fidelizzazione");
    expect(features).toContain("Cassa e magazzino");
    expect(features).toContain("Marketing e recensioni");
    expect(features).not.toContain("oltre 1.000");
    expect(features).not.toContain("5 stelle");
    expect(features).not.toContain("risultati garantiti");
  });

  it("defines complete social sharing metadata", () => {
    const layout = source("app/layout.tsx");
    expect(layout).toContain("NEXT_PUBLIC_SITE_URL");
    expect(layout).toContain("openGraph");
    expect(layout).toContain("twitter");
    expect(layout).toContain("EsseBeauty");
    expect(layout).toContain("/og.png");
  });

  it("connects module discovery and the shared demo flow across the site", () => {
    const header = source("app/_components/SiteHeader.tsx");
    const page = source("app/page.tsx");
    const finalCta = source("app/_components/FinalCta.tsx");
    const footer = source("app/_components/SiteFooter.tsx");
    for (const consumer of [header, page, finalCta]) {
      expect(consumer).toContain("DemoContactButton");
      expect(consumer).not.toContain("SITE_CONFIG.demoMailto");
    }
    expect(header).toContain('href: "/moduli"');
    expect(footer).toContain('href="/moduli"');
    expect(page).toContain("Esplora tutti i moduli");
    expect(header).toContain("SITE_CONFIG.appUrl");
    expect(page).toContain("SITE_CONFIG.appUrl");
    expect(finalCta).toContain("SITE_CONFIG.appUrl");
  });

  it("keeps the contact dialog scrollable without showing a scrollbar", () => {
    const styles = source("app/globals.css");
    expect(styles).toContain("scrollbar-width: none");
    expect(styles).toContain(".demo-dialog::-webkit-scrollbar");
    expect(styles).toContain("display: none");
  });

  it("keeps the primary topbar fused at the top and separates it after scrolling", () => {
    const header = source("app/_components/SiteHeader.tsx");
    const styles = source("app/globals.css");
    expect(styles).toContain(".site-header { position: sticky; top: 0;");
    expect(header).toContain("window.scrollY > 8");
    expect(header).toContain("data-scrolled={scrolled}");
    expect(styles).toContain("border-bottom: 1px solid transparent");
    expect(styles).toContain('.site-header[data-scrolled="true"]');
    expect(styles).toContain("backdrop-filter: blur(16px)");
  });
});
