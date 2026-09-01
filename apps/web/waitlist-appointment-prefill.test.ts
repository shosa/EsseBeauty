import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("waitlist appointment conversion", () => {
  const wizard = readFileSync(join(process.cwd(), "app", "(dashboard)", "calendar", "appointments", "new", "page.tsx"), "utf8");

  it("prefills the wizard and closes the waitlist request only after creation", () => {
    expect(wizard).toContain('searchParams.get("customerId")');
    expect(wizard).toContain('searchParams.get("serviceId")');
    expect(wizard).toContain('searchParams.get("waitlistId")');
    expect(wizard).toContain('status: "booked"');
    expect(wizard.indexOf('method: "POST"')).toBeLessThan(wizard.indexOf('status: "booked"'));
  });

  it("keeps the customer-request context and choices visible throughout the wizard", () => {
    expect(wizard).toContain("Da lista d’attesa");
    expect(wizard).toContain('role="tooltip"');
    expect(wizard).toContain('aria-describedby="waitlist-context-tooltip"');
    expect(wizard).toContain("sticky bottom-3");
    expect(wizard).toContain("Riepilogo richiesta cliente");
  });
});
