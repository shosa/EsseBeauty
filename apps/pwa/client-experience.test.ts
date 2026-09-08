import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("client PWA experience", () => {
  it("uses an icon navigation with active route feedback", () => {
    const source = readFileSync(join(process.cwd(), "app", "[slug]", "_components", "SalonBottomNav.tsx"), "utf8");
    expect(source).toContain("usePathname");
    expect(source).toContain("CalendarPlus");
    expect(source).toContain('aria-current');
  });

  it("opens a dedicated reschedule wizard scoped to the selected appointment", () => {
    const source = readFileSync(join(process.cwd(), "app", "[slug]", "appointments", "page.tsx"), "utf8");
    expect(source).toContain("setRescheduleTarget(item)");
    expect(source).toContain("RescheduleWizard");
  });

  it("uses library icons instead of text glyph CTAs on the customer home", () => {
    const source = readFileSync(join(process.cwd(), "app", "[slug]", "page.tsx"), "utf8");
    expect(source).toContain("CalendarDays");
    expect(source).toContain("CalendarPlus");
    expect(source).toContain("Bell");
    expect(source).not.toContain(">⌁<");
  });

  it("keeps the customer home light with notifications and compact booking actions", () => {
    const source = readFileSync(join(process.cwd(), "app", "[slug]", "page.tsx"), "utf8");
    expect(source).toContain("/api/public/${slug}/messages");
    expect(source).toContain('aria-label="Apri notifiche"');
    expect(source).toContain("Nessuna notifica ricevuta.");
    expect(source).not.toContain(">Prenota ora</Link>");
    expect(source).not.toContain("Consulta le prenotazioni già effettuate.");
    expect(source).not.toContain("Trova il trattamento e l’orario giusto.");
  });

  it("shows a salon overview with a public reviews tab", () => {
    const source = readFileSync(join(process.cwd(), "app", "[slug]", "page.tsx"), "utf8");
    expect(source).toContain('activeTab === "overview"');
    expect(source).toContain('activeTab === "reviews"');
    expect(source).toContain("/api/public/${slug}/reviews");
    expect(source).toContain("Recensioni clienti");
  });

  it("keeps the iOS install instructions visible in the viewport", () => {
    const source = readFileSync(join(process.cwd(), "app", "[slug]", "_components", "InstallAppButton.tsx"), "utf8");
    expect(source).toContain("place-items-center");
    expect(source).toContain("max-h-[calc(100dvh-2rem)]");
    expect(source).not.toContain("place-items-end");
    expect(source).not.toContain("rounded-t-[2.2rem]");
  });

  it("uses the salon name in the per-salon install manifest", () => {
    const source = readFileSync(join(process.cwd(), "app", "[slug]", "manifest.webmanifest", "route.ts"), "utf8");
    expect(source).toContain("salonName");
    expect(source).toContain("name: salonName");
    expect(source).toContain("short_name: salonName");
    expect(source).not.toContain('name: "Esse Beauty"');
  });
});
