import { describe, expect, it } from "vitest";

import { createDeterministicRandom } from "./deterministic.js";

describe("createDeterministicRandom", () => {
  it("repeats the same sequence for the same seed", () => {
    const left = createDeterministicRandom(20260902);
    const right = createDeterministicRandom(20260902);

    expect([
      left.float(),
      left.integer(2, 9),
      left.uuid("customer"),
      left.uuid("customer"),
    ]).toEqual([
      right.float(),
      right.integer(2, 9),
      right.uuid("customer"),
      right.uuid("customer"),
    ]);
  });

  it("keeps generated integers inside inclusive bounds", () => {
    const random = createDeterministicRandom(99);
    const values = Array.from({ length: 100 }, () => random.integer(4, 7));

    expect(Math.min(...values)).toBe(4);
    expect(Math.max(...values)).toBe(7);
  });

  it("rejects empty selections and invalid probabilities", () => {
    const random = createDeterministicRandom(1);

    expect(() => random.pick([])).toThrow("at least one item");
    expect(() => random.chance(-0.01)).toThrow("between 0 and 1");
    expect(() => random.chance(1.01)).toThrow("between 0 and 1");
  });
});
