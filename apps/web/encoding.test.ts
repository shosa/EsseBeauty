import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const workspaceRoot = resolve(__dirname, "../..");

function readWorkspaceFile(path: string): string {
  return readFileSync(resolve(workspaceRoot, path), "utf8");
}

describe("Italian-first source encoding", () => {
  it("uses Italian document language for dashboard and PWA roots", () => {
    expect(readWorkspaceFile("apps/web/app/layout.tsx")).toContain('lang="it"');
    expect(readWorkspaceFile("apps/pwa/app/layout.tsx")).toContain('lang="it"');
  });

  it("does not contain common mojibake markers in user-facing app sources", () => {
    const files = [
      "apps/web/app/layout.tsx",
      "apps/pwa/app/layout.tsx",
      "apps/web/app/(dashboard)/page.tsx",
      "apps/pwa/app/[slug]/book/page.tsx",
    ];

    for (const file of files) {
      expect(readWorkspaceFile(file), file).not.toMatch(/[ÃÂ�]|â(?!€)/);
    }
  });
});
