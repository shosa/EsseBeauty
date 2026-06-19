import { describe, expect, it } from "vitest";

import { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_PALETTE, appointmentStatusLabel } from "./index";

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
});
