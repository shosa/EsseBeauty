import { describe, expect, it, vi } from "vitest";

import { hasAppointmentConflict } from "./index.js";

function databaseWith(results: unknown[][]) {
  const where = vi.fn();
  for (const result of results) where.mockResolvedValueOnce(result);
  return {
    select: () => ({
      from: () => ({ where }),
    }),
  };
}

describe("appointment conflicts", () => {
  it("detects an already-booked slot so the route can return 409", async () => {
    const db = databaseWith([[{ id: "existing" }], []]);
    await expect(hasAppointmentConflict(
      db,
      "salon",
      "staff",
      new Date("2026-06-15T08:00:00Z"),
      new Date("2026-06-15T08:30:00Z"),
      undefined,
      { allowOverbooking: false, bufferMinutes: 0, overbookingLimit: 0 },
    )).resolves.toBe(true);
  });

  it("allows a free slot", async () => {
    const db = databaseWith([[], []]);
    await expect(hasAppointmentConflict(
      db,
      "salon",
      "staff",
      new Date("2026-06-15T08:00:00Z"),
      new Date("2026-06-15T08:30:00Z"),
      undefined,
      { allowOverbooking: false, bufferMinutes: 0, overbookingLimit: 0 },
    )).resolves.toBe(false);
  });

  it("allows controlled overbooking within the configured limit", async () => {
    const db = databaseWith([[{ id: "existing" }], []]);
    await expect(hasAppointmentConflict(
      db,
      "salon",
      "staff",
      new Date("2026-06-15T08:00:00Z"),
      new Date("2026-06-15T08:30:00Z"),
      undefined,
      { allowOverbooking: true, bufferMinutes: 10, overbookingLimit: 1 },
    )).resolves.toBe(false);
  });

  it("keeps availability blocks authoritative even when overbooking is enabled", async () => {
    const db = databaseWith([[{ id: "existing" }], [{ id: "block" }]]);
    await expect(hasAppointmentConflict(
      db,
      "salon",
      "staff",
      new Date("2026-06-15T08:00:00Z"),
      new Date("2026-06-15T08:30:00Z"),
      undefined,
      { allowOverbooking: true, bufferMinutes: 10, overbookingLimit: 5 },
    )).resolves.toBe(true);
  });
});
