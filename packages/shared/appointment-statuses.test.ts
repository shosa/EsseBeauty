import { describe, expect, it } from "vitest";

import { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_PALETTE, appointmentStatusLabel, canTransitionAppointmentStatus, nextAppointmentStatuses } from "./index";

describe("appointmentStatusLabel", () => {
  it("provides one consistent Italian label for every appointment status", () => {
    expect(APPOINTMENT_STATUSES.map(appointmentStatusLabel)).toEqual([
      "In attesa",
      "Confermato",
      "Annullato",
      "No-show",
      "Completo",
    ]);
  });

  it("does not hide an unknown backend value", () => {
    expect(appointmentStatusLabel("unknown")).toBe("unknown");
  });

  it("assigns a solid pastel palette to every non-confirmed status", () => {
    expect(Object.keys(APPOINTMENT_STATUS_PALETTE).sort()).toEqual([
      "cancelled",
      "completed",
      "no_show",
      "pending",
    ]);
  });

  it("enforces the appointment workflow while allowing no-show and cancelled reactivation", () => {
    expect(nextAppointmentStatuses("pending")).toEqual(["confirmed", "cancelled"]);
    expect(nextAppointmentStatuses("confirmed")).toEqual(["no_show", "cancelled"]);
    expect(nextAppointmentStatuses("completed")).toEqual([]);
    expect(nextAppointmentStatuses("no_show")).toEqual(["pending", "confirmed"]);
    expect(nextAppointmentStatuses("cancelled")).toEqual(["pending", "confirmed"]);
    expect(canTransitionAppointmentStatus("confirmed", "completed")).toBe(false);
    expect(canTransitionAppointmentStatus("completed", "confirmed")).toBe(false);
    expect(canTransitionAppointmentStatus("cancelled", "confirmed")).toBe(true);
  });
});
