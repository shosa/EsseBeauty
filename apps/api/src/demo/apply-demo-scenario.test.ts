import { describe, expect, it } from "vitest";

import { assertReplaceableDemoTenant } from "./apply-demo-scenario.js";

describe("assertReplaceableDemoTenant", () => {
  it("allows a fresh install when nothing exists yet", () => {
    expect(assertReplaceableDemoTenant({ ownerMatch: null, slugMatch: null })).toBeNull();
  });

  it("allows replacement when slug and owner point to the same salon", () => {
    const result = assertReplaceableDemoTenant({
      ownerMatch: { email: "demo@demo.com", salonId: "salon-1", slug: "demo" },
      slugMatch: { id: "salon-1", slug: "demo" },
    });
    expect(result).toEqual({ id: "salon-1" });
  });

  it("aborts when the reserved slug belongs to a salon without the reserved owner", () => {
    expect(() =>
      assertReplaceableDemoTenant({
        ownerMatch: null,
        slugMatch: { id: "salon-1", slug: "demo" },
      }),
    ).toThrow(/no database changes were made/i);
  });

  it("aborts when the reserved owner email is registered under a different slug", () => {
    expect(() =>
      assertReplaceableDemoTenant({
        ownerMatch: { email: "demo@demo.com", salonId: "salon-2", slug: "not-demo" },
        slugMatch: null,
      }),
    ).toThrow(/no database changes were made/i);
  });

  it("aborts when the reserved slug and reserved owner point to different salons", () => {
    expect(() =>
      assertReplaceableDemoTenant({
        ownerMatch: { email: "demo@demo.com", salonId: "salon-2", slug: "demo" },
        slugMatch: { id: "salon-1", slug: "demo" },
      }),
    ).toThrow(/different salons/i);
  });
});
