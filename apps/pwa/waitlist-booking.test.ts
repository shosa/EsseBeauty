import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("customer waitlist booking flow", () => {
  const page = readFileSync(join(process.cwd(), "app", "[slug]", "book", "page.tsx"), "utf8");

  it("offers a waitlist request when a day is full", () => {
    expect(page).toContain("Iscriviti alla lista d’attesa");
    expect(page).toContain("time_preference");
    expect(page).toContain("Qualsiasi orario");
    expect(page).toContain("Richiesta in lista d’attesa");
  });

  it("locks authenticated customer data in the waitlist form", () => {
    expect(page).toContain('customerAuthStatus === "authenticated" && customer');
    expect(page).toContain("readOnly={accountValue !== undefined}");
    expect(page).toContain("aria-readonly={accountValue !== undefined}");
  });
});
