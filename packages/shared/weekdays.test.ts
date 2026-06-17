import { describe, expect, it } from "vitest";

import { WEEK_DAYS_IT, formatWeekdayIt } from "./index.js";

describe("Italian weekday helpers", () => {
  it("keeps weekdays in Italian from Monday to Sunday", () => {
    expect(WEEK_DAYS_IT.map((day) => day.key)).toEqual(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
    expect(WEEK_DAYS_IT.map((day) => day.shortLabel)).toEqual(["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"]);
  });

  it("formats a stored weekday key with its Italian label", () => {
    expect(formatWeekdayIt("thu")).toBe("GIO");
  });
});
