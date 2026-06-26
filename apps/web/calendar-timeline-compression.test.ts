import { describe, expect, it } from "vitest";

import { buildTimelineCompression } from "./app/(dashboard)/calendar/timelineCompression";

describe("calendar timeline compression", () => {
  it("compresses global non-working gaps between shared working periods", () => {
    const timeline = buildTimelineCompression({
      compressedHeight: 60,
      hourHeight: 120,
      rangeEnd: 18 * 60,
      rangeStart: 9 * 60,
      workingPeriods: [
        { from: 9 * 60, to: 13 * 60 },
        { from: 16 * 60, to: 18 * 60 },
      ],
    });

    expect(timeline.gaps).toEqual([{ compressedHeight: 60, from: 13 * 60, to: 16 * 60 }]);
    expect(timeline.height).toBe(6 * 120 + 60);
    expect(timeline.timelineY(16 * 60)).toBe(4 * 120 + 60);
  });

  it("keeps occupied global gaps expanded", () => {
    const timeline = buildTimelineCompression({
      compressedHeight: 60,
      hourHeight: 120,
      occupiedPeriods: [{ from: 14 * 60, to: 15 * 60 }],
      rangeEnd: 18 * 60,
      rangeStart: 9 * 60,
      workingPeriods: [
        { from: 9 * 60, to: 13 * 60 },
        { from: 16 * 60, to: 18 * 60 },
      ],
    });

    expect(timeline.gaps).toEqual([]);
    expect(timeline.height).toBe(9 * 120);
  });
});
