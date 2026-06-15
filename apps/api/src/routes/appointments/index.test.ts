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
    )).resolves.toBe(false);
  });
});

