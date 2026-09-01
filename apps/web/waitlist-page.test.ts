import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("operational waitlist page", () => {
  const page = readFileSync(join(process.cwd(), "app", "(dashboard)", "waitlist", "page.tsx"), "utf8");

  it("provides summaries, filters, contacts and responsive records", () => {
    expect(page).toContain("In attesa");
    expect(page).toContain("time_preference");
    expect(page).toContain('type="date"');
    expect(page).toContain("customer_phone");
    expect(page).toContain("md:hidden");
    expect(page).toContain("ConfirmDialog");
    expect(page).toContain("Crea appuntamento");
    expect(page).toContain("/calendar/appointments/new?");
    expect(page).not.toContain(">Notifica</Button>");
    expect(page).not.toContain(">Ripristina</Button>");
  });
});
