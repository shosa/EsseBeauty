import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("settings personalization", () => {
  const settingsRoot = join(import.meta.dirname, "app", "(dashboard)", "settings");
  const personalization = readFileSync(join(settingsRoot, "personalization", "page.tsx"), "utf8");
  const shell = readFileSync(join(import.meta.dirname, "app", "(dashboard)", "_components", "DashboardShell.tsx"), "utf8");
  const appDrawer = readFileSync(join(import.meta.dirname, "app", "(dashboard)", "_components", "AppDrawerOverlay.tsx"), "utf8");
  const appRail = readFileSync(join(import.meta.dirname, "app", "(dashboard)", "_components", "AppRail.tsx"), "utf8");
  const topbar = readFileSync(join(import.meta.dirname, "app", "(dashboard)", "_components", "WorkspaceTopbar.tsx"), "utf8");
  const calendarPage = readFileSync(join(import.meta.dirname, "app", "(dashboard)", "calendar", "page.tsx"), "utf8");
  const calendarPanel = readFileSync(join(import.meta.dirname, "app", "(dashboard)", "calendar", "_components", "AppointmentDetailPanel.tsx"), "utf8");
  const dayAgendaPreview = readFileSync(join(import.meta.dirname, "app", "(dashboard)", "calendar", "_components", "DayAgendaPreview.tsx"), "utf8");
  const avatar = readFileSync(join(import.meta.dirname, "lib", "customer-avatar.tsx"), "utf8");
  const api = readFileSync(join(import.meta.dirname, "..", "api", "src", "routes", "settings", "index.ts"), "utf8");
  const ui = readFileSync(join(import.meta.dirname, "..", "..", "packages", "ui", "index.tsx"), "utf8");

  it("adds a dedicated personalization page for palette and DiceBear options", () => {
    expect(personalization).toContain('title="Personalizzazione"');
    expect(personalization).toContain("primaryColor");
    expect(personalization).toContain('primaryColor: "#543147"');
    expect(personalization).toContain('accentColor: "#b85888"');
    expect(personalization).toContain("diceBearEnabled");
    expect(personalization).toContain("diceBearStyle");
    expect(personalization).toContain("/settings/categories/ui");
    expect(personalization).toContain("preference={preferences}");
    expect(personalization).toContain("fallback={defaults.accentColor}");
  });

  it("applies saved palette variables to the dashboard shell", () => {
    expect(shell).toContain("--esse-mulberry");
    expect(shell).toContain("--esse-berry");
    expect(shell).toContain("--esse-petal");
    expect(shell).toContain("--esse-rail");
    expect(shell).toContain("--esse-drawer-start");
    expect(shell).toContain("--esse-line");
    expect(shell).toContain("applyUiPreferences(defaultUiPreferences)");
    expect(shell).toContain("/settings/categories/ui");
    expect(ui).toContain("var(--esse-mulberry)");
    expect(ui).toContain("var(--esse-berry)");
    expect(ui).toContain("checked ? \"border-[var(--esse-mulberry,#543147)] bg-[var(--esse-mulberry,#543147)]\"");
    expect(ui).toContain("border-[var(--esse-mulberry,#543147)] text-[var(--esse-mulberry,#543147)]");
    expect(appDrawer).toContain("var(--esse-drawer-start");
    expect(appRail).toContain("var(--esse-rail");
    expect(topbar).toContain("text-[var(--esse-mulberry,#543147)]");
  });

  it("keeps calendar chrome and date pickers on the customizable palette", () => {
    expect(calendarPage).toContain("var(--esse-mulberry,#543147)");
    expect(calendarPage).toContain("var(--esse-berry,#b85888)");
    expect(calendarPage).toContain("var(--esse-petal,#f2e1eb)");
    expect(calendarPanel).toContain("var(--esse-mulberry,#543147)");
    expect(dayAgendaPreview).toContain("var(--esse-mulberry,#543147)");
    expect(ui).toContain("focus-visible:ring-[var(--esse-berry,#b85888)]/20");
    for (const source of [calendarPage, calendarPanel, dayAgendaPreview]) {
      expect(source).not.toContain("#792f59");
      expect(source).not.toContain("#faf3f7");
      expect(source).not.toContain("#f3e2eb");
      expect(source).not.toContain("#fffafd");
    }
  });

  it("centralizes customer avatars behind the DiceBear preference", () => {
    expect(avatar).toContain("@dicebear/styles/initial-face.json");
    expect(avatar).toContain("@dicebear/styles/lorelei.json");
    expect(avatar).toContain("diceBearEnabled");
    expect(avatar).toContain("preference");
    expect(avatar).toContain("CustomerAvatar");
    expect(avatar).toContain("customerInitials");
  });

  it("exposes a readable settings category endpoint for UI preferences", () => {
    expect(api).toContain('"/api/salons/:id/settings/categories/:category"');
    expect(api).toContain("categoryRows[0]?.settings ?? {}");
  });
});
