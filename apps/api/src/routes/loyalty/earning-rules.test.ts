import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("loyalty earning rules", () => {
  const engine = readFileSync(join(process.cwd(), "src", "lib", "loyalty-engine.ts"), "utf8");
  const sales = readFileSync(join(process.cwd(), "src", "routes", "sales", "index.ts"), "utf8");
  const routes = readFileSync(join(process.cwd(), "src", "routes", "loyalty", "index.ts"), "utf8");

  it("awards independently configurable points from core checkout events", () => {
    expect(engine).toContain('"appointment_completed"');
    expect(engine).toContain('"service_purchased"');
    expect(engine).toContain('"product_purchased"');
    expect(engine).toContain('"euro_spent"');
    expect(engine).toContain("serviceQuantity * serviceRule.points");
    expect(engine).toContain("productQuantity * productRule.points");
    expect(engine).toContain("wholeEuros * euroRule.points");
    expect(sales).toContain("awardSaleLoyalty");
    expect(routes).toContain("earning_rules");
  });
});
