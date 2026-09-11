import { describe, expect, it } from "vitest";

import { detectAppointmentTransition } from "./appointment-events.js";

describe("appointment cancellation event detection", () => {
  it("recognizes a PATCH cancellation transition", () => {
    expect(detectAppointmentTransition({
      body: { status: "cancelled" },
      method: "PATCH",
      params: { appointmentId: "appointment-1" },
    })).toEqual({ appointmentId: "appointment-1", nextStatus: "cancelled" });
  });

  it("ignores unrelated methods and statuses", () => {
    expect(detectAppointmentTransition({ method: "POST", params: { appointmentId: "appointment-1" } })).toBeUndefined();
    expect(detectAppointmentTransition({
      body: { status: "confirmed" },
      method: "PATCH",
      params: { appointmentId: "appointment-1" },
    })).toBeUndefined();
    expect(detectAppointmentTransition({
      body: { status: "completed" },
      method: "PATCH",
      params: { appointmentId: "appointment-1" },
    })).toBeUndefined();
  });
});
