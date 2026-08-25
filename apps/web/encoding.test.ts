import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

import { describe, expect, it } from "vitest";

const workspaceRoot = resolve(__dirname, "../..");

function readWorkspaceFile(path: string): string {
  return readFileSync(resolve(workspaceRoot, path), "utf8");
}

function userFacingFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      return [".next", ".turbo", "build", "coverage", "dist", "generated", "node_modules", "vendor"].includes(entry.name)
        ? []
        : userFacingFiles(path);
    }
    return /\.(?:ts|tsx|md)$/.test(entry.name) && !/\.test\.(?:ts|tsx)$/.test(entry.name)
      ? [path]
      : [];
  });
}

describe("Italian-first source encoding", () => {
  it("uses Italian document language for dashboard and PWA roots", () => {
    expect(readWorkspaceFile("apps/web/app/layout.tsx")).toContain('lang="it"');
    expect(readWorkspaceFile("apps/pwa/app/layout.tsx")).toContain('lang="it"');
  });

  it("does not contain common mojibake markers in user-facing app sources", () => {
    const files = userFacingFiles(resolve(workspaceRoot, "apps"));

    for (const file of files) {
      expect(readFileSync(file, "utf8"), relative(workspaceRoot, file).split(sep).join("/")).not.toMatch(/[ÃÂ�]|â(?!€)/);
    }
  });
});
