import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("appointment event notifications", () => {
  it("does not notify internal appointment transitions made from the back office", () => {
    const source = readFileSync(join(process.cwd(), "src", "jobs", "appointment-events.ts"), "utf8");
    expect(source).not.toContain("notifyAppointmentTransition");
    expect(source).not.toContain("appointment_completed");
    expect(source).not.toContain("appointment_cancelled");
    expect(source).toContain('eq(notifications.type, "online_booking_received")');
  });
});
