import { describe, expect, it } from "vitest";

import { normalizePhoneE164 } from "./phone-normalization.js";

describe("E.164 phone normalization", () => {
  it.each([
    ["333 123 4567", "+393331234567"],
    ["+39 333 123 4567", "+393331234567"],
    ["0039 333 123 4567", "+393331234567"],
    ["02 1234 5678", "+390212345678"],
    ["+44 7700 900123", "+447700900123"],
    ["0044 7700 900123", "+447700900123"],
  ])("normalizes %s as %s", (input, expected) => {
    expect(normalizePhoneE164(input, "39")).toBe(expected);
  });

  it("returns null for values that cannot be valid international destinations", () => {
    expect(normalizePhoneE164("123", "39")).toBeNull();
  });
});
