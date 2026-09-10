import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(...segments: string[]) {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

const homePage = read("app", "page.tsx");
const agendaPage = read("app", "agenda", "page.tsx");
const appointmentDetailPage = read("app", "agenda", "[appointmentId]", "page.tsx");
const requestsPage = read("app", "requests", "page.tsx");
const profilePage = read("app", "profile", "page.tsx");
const layout = read("app", "layout.tsx");
const staffShell = read("app", "_components", "StaffShell.tsx");

describe("staff workspace", () => {
  it("is a real multi-route app, not a single conditional-render page", () => {
    expect(homePage).not.toContain("tab === ");
    expect(homePage).not.toContain('"today" | "agenda" | "requests" | "profile"');
    expect(layout).toContain("StaffAuthProvider");
    expect(layout).toContain("StaffShell");
    expect(staffShell).toContain("StaffTopNav");
    expect(staffShell).toContain("StaffBottomNav");
  });

  it("supports internal appointment note editing from the appointment detail route", () => {
    expect(appointmentDetailPage).toContain("saveNotes");
    expect(appointmentDetailPage).toContain("Salva note");
  });

  it("allows a pending availability request to be withdrawn from the requests route", () => {
    expect(requestsPage).toContain("withdrawAvailabilityRequest");
    expect(requestsPage).toContain("Ritira richiesta");
    expect(requestsPage).toContain("requestModalOpen");
  });

  it("uses icon CTAs for appointment state transitions, with no manual complete action", () => {
    expect(appointmentDetailPage).toContain("UserCheck");
    expect(appointmentDetailPage).toContain("UserX");
    expect(appointmentDetailPage).toContain("Undo2");
    expect(appointmentDetailPage).not.toContain("CircleCheckBig");
  });

  it("shows the personal agenda as a real route with day and week navigation", () => {
    expect(agendaPage).toContain("weekRange");
    expect(agendaPage).toContain("DayTimeline");
  });

  it("exposes staff performance metrics and account security on the profile route", () => {
    expect(profilePage).toContain("REPORTS_VIEW_OWN");
    expect(profilePage).toContain("change-password");
    expect(profilePage).toContain("logout");
  });
});
