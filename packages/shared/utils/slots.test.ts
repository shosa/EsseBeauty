import { describe, expect, it } from "vitest";

import type { WorkingHours } from "../types.js";
import { computeAvailableSlots } from "./slots.js";

const closedWeek: WorkingHours = {
  mon: [],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
  sun: [],
};

describe("computeAvailableSlots", () => {
  it("returns no slots outside configured working hours", () => {
    expect(
      computeAvailableSlots({
        date: "2026-06-14",
        timezone: "Europe/Rome",
        workingHours: closedWeek,
        durationMinutes: 30,
      }),
    ).toEqual([]);
  });

  it("emits UTC slots from salon-local working hours", () => {
    const slots = computeAvailableSlots({
      date: "2026-06-15",
      timezone: "Europe/Rome",
      workingHours: {
        ...closedWeek,
        mon: [{ from: "09:00", to: "10:00" }],
      },
      durationMinutes: 30,
      intervalMinutes: 30,
    });

    expect(slots).toEqual([
      {
        starts_at: "2026-06-15T07:00:00.000Z",
        ends_at: "2026-06-15T07:30:00.000Z",
        available: true,
      },
      {
        starts_at: "2026-06-15T07:30:00.000Z",
        ends_at: "2026-06-15T08:00:00.000Z",
        available: true,
      },
    ]);
  });

  it("marks overlapping appointments and blocks unavailable", () => {
    const slots = computeAvailableSlots({
      date: "2026-06-15",
      timezone: "Europe/Rome",
      workingHours: {
        ...closedWeek,
        mon: [{ from: "09:00", to: "11:00" }],
      },
      durationMinutes: 30,
      intervalMinutes: 30,
      appointments: [
        {
          startsAt: "2026-06-15T07:30:00.000Z",
          endsAt: "2026-06-15T08:00:00.000Z",
        },
      ],
      blocks: [
        {
          startsAt: "2026-06-15T08:30:00.000Z",
          endsAt: "2026-06-15T09:00:00.000Z",
        },
      ],
    });

    expect(slots.map((slot) => slot.available)).toEqual([
      true,
      false,
      true,
      false,
    ]);
  });
});

