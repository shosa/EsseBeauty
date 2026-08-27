import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "app", "(dashboard)", "clients");

describe("CRM operational UI", () => {
  it("uses shared expandable actions for primary customer operations", () => {
    const detail = readFileSync(join(root, "[customerId]", "page.tsx"), "utf8");
    const list = readFileSync(join(root, "page.tsx"), "utf8");
    expect(detail).toContain("ExpandableAction");
    expect(detail).toContain('tone="rose"');
    expect(detail).toContain('tone="emerald"');
    expect(list).toContain("ExpandableAction");
  });

  it("does not render a redundant active package pill", () => {
    const detail = readFileSync(join(root, "[customerId]", "page.tsx"), "utf8");
    expect(detail).not.toContain('<StatusBadge status="active">In corso</StatusBadge>');
  });
});
