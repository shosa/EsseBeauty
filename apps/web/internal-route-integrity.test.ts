import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

const webRoot = process.cwd();
const workspaceRoot = join(webRoot, "../..");
const apiRoot = join(workspaceRoot, "apps", "api", "src");
const dashboardRoot = join(webRoot, "app", "(dashboard)");

function filesBelow(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

function nextRoutes(): Set<string> {
  return new Set(
    filesBelow(join(webRoot, "app"))
      .filter((file) => file.endsWith(`${sep}page.tsx`))
      .map((file) => {
        const segments = relative(join(webRoot, "app"), file)
          .split(sep)
          .slice(0, -1)
          .filter((segment) => !segment.startsWith("("))
          .map((segment) => segment.replace(/^\[.+\]$/, ":id"));
        return `/${segments.join("/")}`.replace(/\/$/, "") || "/";
      }),
  );
}

function apiInternalHrefs(): string[] {
  return filesBelow(apiRoot)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return [...source.matchAll(/href:\s*[`\"'](\/[^`\"']*)[`\"']/g)]
        .map((match) => match[1]?.replace(/\$\{[^}]+\}/g, ":id"))
        .filter((href): href is string => Boolean(href));
    });
}

describe("internal route integrity", () => {
  it("maps every API-generated dashboard href to a Next page or documented redirect", () => {
    const internalHrefs = apiInternalHrefs();
    const documentedRedirects = new Set<string>();
    const validTargets = new Set([...nextRoutes(), ...documentedRedirects]);

    expect(internalHrefs).not.toContain("/services/:id");
    expect(internalHrefs).not.toContain("/staff/:id");
    expect(internalHrefs.filter((href) => !validTargets.has(href))).toEqual([]);
  });

  it("renders home notifications without href as inbox tasks instead of links", () => {
    const page = readFileSync(join(dashboardRoot, "page.tsx"), "utf8");

    expect(page).toContain("InboxItem");
    expect(page).toContain("item.href ? (");
    expect(page).not.toContain('href={item.href ?? "#"}');
  });
});
