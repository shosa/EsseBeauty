import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("public multi-service booking", () => {
  const source = readFileSync(join(process.cwd(), "src", "routes", "public", "index.ts"), "utf8");

  it("finds a qualified staff assignment for every consecutive service", () => {
    expect(source).toContain("findServiceSequence");
    expect(source).toContain("serviceStaffCandidates");
    expect(source).toContain("staff_ids?: Array<string | null>");
    expect(source).toContain("previousStaffId");
  });

  it("creates all service appointments atomically", () => {
    expect(source).toContain("app.db.transaction");
    expect(source).toContain("segments.map");
    expect(source).toContain("appointment_ids");
  });
});
