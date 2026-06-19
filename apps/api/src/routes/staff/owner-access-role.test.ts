import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("staff access role preservation", () => {
  it("never demotes a linked owner when enabling staff PWA access", () => {
    const source = readFileSync(join(process.cwd(), "src", "routes", "staff", "index.ts"), "utf8");

    expect(source).not.toContain('role: "employee",\n      }).where');
    expect(source).toContain('linkedUser?.role === "owner" ? true');
    expect(source).toContain('role: linkedUser?.role ?? "employee"');
  });
});
