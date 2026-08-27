import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const staffDetail = readFileSync(
  join(import.meta.dirname, "app", "(dashboard)", "settings", "staff", "[staffId]", "page.tsx"),
  "utf8",
);
const staffDirectory = readFileSync(join(import.meta.dirname, "app", "(dashboard)", "settings", "staff", "page.tsx"), "utf8");
const staffPermissions = readFileSync(join(import.meta.dirname, "app", "(dashboard)", "settings", "permissions", "page.tsx"), "utf8");
const newStaff = readFileSync(join(import.meta.dirname, "app", "(dashboard)", "settings", "staff", "new", "page.tsx"), "utf8");
const sharedUi = readFileSync(join(import.meta.dirname, "..", "..", "packages", "ui", "index.tsx"), "utf8");

describe("staff detail operational layout", () => {
  it("uses the campaign-style twelve-column workspace with paired operational panels", () => {
    expect(staffDetail).toContain("Breadcrumbs");
    expect(staffDetail).toContain('grid gap-4 xl:grid-cols-12');
    expect(staffDetail).toContain('className="xl:col-span-5" title={<span');
    expect(staffDetail).toContain('className="xl:col-span-7" title={<span');
    expect(staffDetail).toContain('className="xl:col-span-8" title={<span');
    expect(staffDetail).toContain('className="xl:col-span-4" title={<span');
  });

  it("keeps each staff operation explicit and independently saveable", () => {
    expect(staffDetail).toContain("Salva profilo");
    expect(staffDetail).toContain("Salva accesso App Staff");
    expect(staffDetail).toContain("Salva orari");
    expect(staffDetail).toContain("Salva sede e competenze");
  });

  it("uses accessible icon controls for compact secondary staff actions", () => {
    expect(staffDirectory).toContain('aria-label={`Configura ${member.displayName}`}');
    expect(staffDirectory).toContain('aria-label={`${staffStatusAction(member.active).label} ${member.displayName}`}');
    expect(staffDirectory).toContain("Settings2");
    expect(staffDirectory).toContain("PowerOff");
    expect(staffDirectory).toContain("Power");
    expect(staffPermissions).toContain('aria-label={`Elimina permesso di ${item.staff_name}`}');
    expect(staffPermissions).toContain("Trash2");
    expect(newStaff).toContain('aria-label="Annulla creazione collaboratore"');
    expect(newStaff).toContain("X");
  });

  it("uses a Lucide icon to remove working-hour intervals", () => {
    const scheduleEditor = sharedUi.slice(sharedUi.indexOf("export function ScheduleEditor"), sharedUi.indexOf("export function Breadcrumbs"));

    expect(scheduleEditor).toContain("<Trash2");
    expect(scheduleEditor).toContain("aria-label={`Rimuovi fascia");
    expect(scheduleEditor).not.toContain(">\n                      Rimuovi\n");
  });
});
