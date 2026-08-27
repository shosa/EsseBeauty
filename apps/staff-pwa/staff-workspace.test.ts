import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "app", "page.tsx"), "utf8");

describe("staff mobile workspace", () => {
  it("supports internal appointment note editing", () => {
    expect(source).toContain("saveAppointmentNotes");
    expect(source).toContain("appointmentNotes");
    expect(source).toContain("Salva note");
  });

  it("allows a pending availability request to be withdrawn", () => {
    expect(source).toContain("withdrawAvailabilityRequest");
    expect(source).toContain("Ritira richiesta");
  });

  it("uses icon CTAs for appointment state transitions", () => {
    expect(source).toContain("UserCheck");
    expect(source).toContain("CircleCheckBig");
    expect(source).toContain("UserX");
  });
});
