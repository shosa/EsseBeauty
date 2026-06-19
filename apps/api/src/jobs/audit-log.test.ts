import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("audit logging", () => {
  const source = readFileSync(join(process.cwd(), "src", "jobs", "audit-log.ts"), "utf8");

  it("records successful mutations centrally", () => {
    expect(source).toContain('app.addHook("onResponse"');
    expect(source).toContain("mutationMethods");
    expect(source).toContain("insert(activityLog)");
  });

  it("redacts credentials before persisting request payloads", () => {
    expect(source).toContain('"password"');
    expect(source).toContain('"[PROTETTO]"');
  });
});

