import { describe, expect, it, vi } from "vitest";

import { inspectAppointmentConflicts } from "./index.js";

function databaseWith(results: unknown[][]) {
  const where = vi.fn();
  for (const result of results) where.mockResolvedValueOnce(result);
  const query = {
    innerJoin: () => query,
    where,
  };
  return {
    select: () => ({
      from: () => query,
    }),
  };
}

describe("appointment conflicts", () => {
  it("returns overlapping appointments as a confirmable side-by-side warning", async () => {
    const db = databaseWith([[{ id: "existing" }], []]);
    await expect(inspectAppointmentConflicts(
      db,
      "salon",
      "staff",
      new Date("2026-06-15T08:00:00Z"),
      new Date("2026-06-15T08:30:00Z"),
      undefined,
      { allowOverbooking: true, bufferMinutes: 0, overbookingLimit: 1 },
    )).resolves.toEqual({
      appointmentRows: [{ id: "existing" }],
      canConfirmOverlap: true,
      hasAvailabilityBlock: false,
    });
  });

  it("allows a free slot", async () => {
    const db = databaseWith([[], []]);
    await expect(inspectAppointmentConflicts(
      db,
      "salon",
      "staff",
      new Date("2026-06-15T08:00:00Z"),
      new Date("2026-06-15T08:30:00Z"),
      undefined,
      { allowOverbooking: false, bufferMinutes: 0, overbookingLimit: 0 },
    )).resolves.toEqual({
      appointmentRows: [],
      canConfirmOverlap: false,
      hasAvailabilityBlock: false,
    });
  });

  it("does not make overlaps confirmable when overbooking is disabled", async () => {
    const db = databaseWith([[{ id: "existing" }], []]);
    await expect(inspectAppointmentConflicts(
      db,
      "salon",
      "staff",
      new Date("2026-06-15T08:00:00Z"),
      new Date("2026-06-15T08:30:00Z"),
      undefined,
      { allowOverbooking: false, bufferMinutes: 10, overbookingLimit: 1 },
    )).resolves.toMatchObject({ canConfirmOverlap: false });
  });

  it("keeps availability blocks authoritative even when overbooking is enabled", async () => {
    const db = databaseWith([[{ id: "existing" }], [{ id: "block" }]]);
    await expect(inspectAppointmentConflicts(
      db,
      "salon",
      "staff",
      new Date("2026-06-15T08:00:00Z"),
      new Date("2026-06-15T08:30:00Z"),
      undefined,
      { allowOverbooking: true, bufferMinutes: 10, overbookingLimit: 5 },
    )).resolves.toMatchObject({
      canConfirmOverlap: false,
      hasAvailabilityBlock: true,
    });
  });
});
