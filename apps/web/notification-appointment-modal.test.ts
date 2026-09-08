import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("appointment request notifications", () => {
  const page = readFileSync(join(process.cwd(), "app", "(dashboard)", "notifications", "page.tsx"), "utf8");
  const shell = readFileSync(join(process.cwd(), "app", "(dashboard)", "_components", "DashboardShell.tsx"), "utf8");
  const modal = readFileSync(join(process.cwd(), "app", "(dashboard)", "notifications", "_components", "AppointmentRequestModal.tsx"), "utf8");

  it("opens online appointment requests in a modal from both notification surfaces", () => {
    expect(page).toContain("setAppointmentRequestId(item.entity_id)");
    expect(shell).toContain('item.type === "online_booking_received"');
    expect(page).toContain("<AppointmentRequestModal");
    expect(shell).toContain("<AppointmentRequestModal");
  });

  it("shows the requested appointment inside a day-agenda preview", () => {
    expect(modal).toContain("Anteprima agenda");
    expect(modal).toContain("api/salons/${salon.id}/appointments?");
    expect(modal).toContain("item.id === appointmentId");
    expect(modal).toContain("item.staff_id !== target?.staff_id");
    expect(modal).not.toContain("AppointmentDetailPanel");
    expect(modal).toContain("Non confermare");
    expect(modal).toContain("Elimina definitivamente");
    expect(modal).toContain("DateTimeField");
    expect(modal).toContain('method: "DELETE"');
    expect(modal).toContain("/reminders/settings");
    expect(modal).toContain("Confermando, il cliente riceverà un promemoria tramite");
  });
});
