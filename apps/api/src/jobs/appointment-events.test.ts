import { describe, expect, it } from "vitest";

import * as appointmentEvents from "./appointment-events.js";

type CompletionDetector = (input: {
  body?: { status?: string };
  method: string;
  params?: { appointmentId?: string };
  routeUrl?: string;
}) => { appointmentId: string; nextStatus: "completed" | "cancelled" } | undefined;

describe("appointment completion event detection", () => {
  it("publishes the checkout completion that actually marks an appointment completed", () => {
    const detect = (appointmentEvents as unknown as { detectAppointmentTransition?: CompletionDetector }).detectAppointmentTransition;
    expect(detect).toBeTypeOf("function");
    if (!detect) return;
    expect(detect({
      method: "POST",
      params: { appointmentId: "appointment-1" },
      routeUrl: "/api/salons/:id/appointments/:appointmentId/checkout",
    })).toEqual({ appointmentId: "appointment-1", nextStatus: "completed" });
  });

  it("ignores unrelated POST requests and recognizes explicit status transitions", () => {
    const detect = (appointmentEvents as unknown as { detectAppointmentTransition?: CompletionDetector }).detectAppointmentTransition;
    expect(detect).toBeTypeOf("function");
    if (!detect) return;
    expect(detect({ method: "POST", params: { appointmentId: "appointment-1" }, routeUrl: "/unrelated" })).toBeUndefined();
    expect(detect({ body: { status: "cancelled" }, method: "PATCH", params: { appointmentId: "appointment-1" } }))
      .toEqual({ appointmentId: "appointment-1", nextStatus: "cancelled" });
  });
});
