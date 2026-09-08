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

  it("keeps the booking wizard forward action in a safe-area footer", () => {
    const source = readFileSync(join(process.cwd(), "app", "[slug]", "book", "page.tsx"), "utf8");
    expect(source).toContain("<footer");
    expect(source).toContain("bottom-[76px] z-40");
    expect(source).toContain("env(safe-area-inset-bottom)");
    expect(source).toContain("Avanti");
  });

  it("shows the waitlist action as a centered Oops state instead of a card", () => {
    const source = readFileSync(join(process.cwd(), "app", "[slug]", "book", "page.tsx"), "utf8");
    expect(source).toContain('/booking-oops-doodle.png');
    expect(source).toContain("min-h-[40dvh]");
    expect(source).toContain("Iscriviti alla lista d’attesa");
    expect(source).not.toContain("animate-reveal mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-5");
  });

  it("supports consecutive services with a dedicated staff step", () => {
    const source = readFileSync(join(process.cwd(), "app", "[slug]", "book", "page.tsx"), "utf8");
    expect(source).toContain("service_ids: serviceIds");
    expect(source).toContain("staff_ids: staffPreferences");
    expect(source).toContain("Puoi selezionare più trattamenti");
    expect(source).toContain("Passo 2 di 4");
    expect(source).toContain("Nessuna preferenza");
    expect(source).toContain("<Shuffle");
    expect(source).toContain("incompatibleServices.map");
    expect(source).not.toContain("durationMinutes} min");
  });

  it("keeps removable selected services above the forward action", () => {
    const source = readFileSync(join(process.cwd(), "app", "[slug]", "book", "page.tsx"), "utf8");
    expect(source).toContain('aria-label="Servizi selezionati"');
    expect(source).toContain("Rimuovi ${service.name}");
    expect(source.indexOf('aria-label="Servizi selezionati"')).toBeLessThan(source.indexOf('<motion.button\n              className="min-h-12'));
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

  it("shows an envelope icon in the registration email field", () => {
    const source = readFileSync(join(process.cwd(), "app", "[slug]", "_components", "CustomerAuthOverlay.tsx"), "utf8");
    expect(source).toContain("<Mail className");
    expect(source).toContain('name="email" required={requireEmail}');
  });

  it("lets customer notifications close back to the salon home", () => {
    const source = readFileSync(join(process.cwd(), "app", "[slug]", "messages", "[id]", "page.tsx"), "utf8");
    expect(source).toContain('aria-label="Chiudi notifica"');
    expect(source).toContain("router.push(`/${slug}`)");
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
    expect(source).toContain('lang: "it"');
    expect(source).toContain('dir: "ltr"');
    expect(source).not.toContain('name: "Esse Beauty"');
  });

  it("declares Italian metadata in the fallback manifest", () => {
    const manifest = JSON.parse(readFileSync(join(process.cwd(), "public", "manifest.json"), "utf8")) as Record<string, unknown>;
    expect(manifest.lang).toBe("it");
    expect(manifest.dir).toBe("ltr");
    expect(manifest.description).toBe("Prenota e gestisci i tuoi appuntamenti");
  });
});
