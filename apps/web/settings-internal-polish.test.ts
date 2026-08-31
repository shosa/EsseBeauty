import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const settingsRoot = join(import.meta.dirname, "app", "(dashboard)", "settings");
const source = (route: string) => readFileSync(join(settingsRoot, route, "page.tsx"), "utf8");
const ui = readFileSync(join(import.meta.dirname, "..", "..", "packages", "ui", "index.tsx"), "utf8");

describe("internal settings HIG polish", () => {
  it("shares the animated save action used by the refined settings views", () => {
    expect(ui).toContain("export function SaveActionButton");
    expect(ui).toContain('busy ? "Salvataggio…" : saved ? "Salvato" : idleLabel');
    for (const route of ["pwa", "locations", "communications", "documents", join("documents", "[templateId]")]) {
      expect(source(route)).toContain("<SaveActionButton");
    }
  });

  it("gives user management responsive content and accessible status feedback", () => {
    const users = source("users");

    expect(users).toContain("aria-live=\"polite\"");
    expect(users).toContain("md:hidden");
    expect(users).toContain("Nessun utente configurato");
    expect(users).toContain("Aggiornamento stato");
  });

  it("labels App Clienti switches and keeps save actions inside editable cards", () => {
    const pwa = source("pwa");

    expect(pwa).toContain('aria-label="Prenotazioni online attive"');
    expect(pwa).toContain('aria-label="Cancellazione autonoma"');
    expect(pwa).toContain('aria-label="Invito a installare l’app"');
    expect(pwa).not.toContain('aria-label="Azioni App Clienti"');
    expect(pwa).toContain('idleLabel="Salva prenotazioni"');
    expect(pwa).toContain('idleLabel="Salva autonomia"');
    expect(pwa).toContain('idleLabel="Salva aspetto"');
    expect(pwa).toContain("NEXT_PUBLIC_PWA_URL");
    expect(pwa).toContain("salon.slug");
    expect(pwa).toContain('title={`Anteprima App Clienti di ${salon?.name ?? "salone"}`}');
    expect(pwa).toContain("setPreviewRevision");
    expect(pwa).toContain('aria-label="Apri anteprima App Clienti in una nuova scheda"');
    expect(pwa).not.toContain('<SectionCard className="xl:col-span-2" title="Comportamento scelto"');
    expect(pwa).toContain('xl:grid-cols-[minmax(280px,360px)_360px]');
    expect(pwa).toContain('max-w-[360px] xl:justify-self-end');
    expect(pwa).not.toContain('type="number"');
    expect(pwa).toContain("bookingNoticeOptions");
    expect(pwa).toContain("bookingWindowOptions");
    expect(pwa).toContain("cancellationOptions");
    expect(pwa).toContain("ore — valore attuale");
    expect(pwa).toContain("giorni — valore attuale");
  });

  it("uses consistent feedback and selection semantics for locations", () => {
    const locations = source("locations");

    expect(locations).toContain("<SaveToast");
    expect(locations).toContain("aria-pressed={locationId === location.id}");
    expect(locations).toContain('aria-label="Aggiungi sede"');
  });

  it("communicates WhatsApp setup state with text as well as color", () => {
    const communications = source("communications");

    expect(communications).toContain('complete ? "Completato" : "Da completare"');
    expect(communications).toContain('aria-label="Abilita il provider WhatsApp"');
    expect(communications).toContain('aria-live="polite"');
  });

  it("handles reminder loading, errors, empty history and save feedback", () => {
    const reminders = source("reminders");

    expect(reminders).toContain("setLoading");
    expect(reminders).toContain("<InlineError");
    expect(reminders).toContain("<SaveToast");
    expect(reminders).toContain("<EmptyState");
    expect(reminders).toContain('aria-label={`Promemoria ${label as string}`}');
    expect(reminders).toContain("Salvataggio automatico…");
    expect(reminders).not.toContain("<SaveActionButton");
  });

  it("marks settings data regions and dynamic audit feedback semantically", () => {
    const documents = source("documents");
    const audit = source("audit");

    expect(documents).toContain('aria-label="Archivio documenti"');
    expect(audit).toContain('aria-live="polite"');
    expect(audit).toContain('aria-label="Filtri registro attività"');
  });
});
