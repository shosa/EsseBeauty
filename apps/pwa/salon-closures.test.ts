import type { WorkingHours } from "@esse-beauty/shared";
import { describe, expect, it } from "vitest";

import { isDateClosed } from "./lib/salon-closures";

const openingHours: WorkingHours = {
  mon: [{ from: "09:00", to: "18:00" }],
  tue: [{ from: "09:00", to: "18:00" }],
  wed: [{ from: "09:00", to: "18:00" }],
  thu: [{ from: "09:00", to: "18:00" }],
  fri: [{ from: "09:00", to: "18:00" }],
  sat: [],
  sun: [],
};

describe("salon calendar availability", () => {
  it("marks weekly non-working days as closed", () => {
    expect(isDateClosed(new Date(2026, 8, 12), [], openingHours)).toBe(true);
    expect(isDateClosed(new Date(2026, 8, 14), [], openingHours)).toBe(false);
  });

  it("still marks exceptional closures as closed", () => {
    expect(isDateClosed(new Date(2026, 8, 14), [{ date: "2026-09-14", recurringYearly: false }], openingHours)).toBe(true);
  });
});
