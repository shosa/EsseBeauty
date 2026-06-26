import { describe, expect, it } from "vitest";

import { buildWorkingHourAvailabilityBlocks } from "./index";

const workingHours = {
  mon: [{ from: "09:00", to: "13:00" }],
  tue: [{ from: "09:00", to: "13:00" }],
  wed: [{ from: "09:00", to: "13:00" }],
  thu: [{ from: "09:00", to: "13:00" }],
  fri: [{ from: "09:00", to: "13:00" }],
  sat: [],
  sun: [],
};

describe("availability blocks from working hours", () => {
  it("splits a multi-day permission into staff working-hour blocks", () => {
    const blocks = buildWorkingHourAvailabilityBlocks(
      workingHours,
      new Date(2026, 7, 4, 9, 0),
      new Date(2026, 7, 5, 17, 0),
    );

    expect(blocks).toHaveLength(2);
    expect(blocks.map((block) => [block.startsAt.getHours(), block.endsAt.getHours()])).toEqual([
      [9, 13],
      [9, 13],
    ]);
    expect(blocks.map((block) => block.startsAt.getDate())).toEqual([4, 5]);
  });

  it("clips first and last day to the requested interval", () => {
    const blocks = buildWorkingHourAvailabilityBlocks(
      workingHours,
      new Date(2026, 7, 4, 10, 30),
      new Date(2026, 7, 5, 11, 0),
    );

    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.startsAt.getHours()).toBe(10);
    expect(blocks[0]?.startsAt.getMinutes()).toBe(30);
    expect(blocks[0]?.endsAt.getHours()).toBe(13);
    expect(blocks[1]?.startsAt.getHours()).toBe(9);
    expect(blocks[1]?.endsAt.getHours()).toBe(11);
  });

  it("skips days without configured working hours", () => {
    const blocks = buildWorkingHourAvailabilityBlocks(
      workingHours,
      new Date(2026, 7, 8, 9, 0),
      new Date(2026, 7, 9, 17, 0),
    );

    expect(blocks).toEqual([]);
  });
});
