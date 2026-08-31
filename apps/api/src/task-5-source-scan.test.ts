import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(process.cwd(), "..", "..");
const sourceRoot = resolve(process.cwd(), "src");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) return [];
    return [path];
  });
}

describe("Task 5 production SMS/Twilio guard", () => {
  it("keeps Twilio and SMS delivery out of runtime source and deployment config", () => {
    const runtimeSources = sourceFiles(sourceRoot)
      .filter((path) => !path.endsWith("lib/consent-evidence.ts"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    const schema = readFileSync(resolve(repositoryRoot, "packages", "db", "schema.ts"), "utf8");
    const config = [
      readFileSync(resolve(repositoryRoot, "apps", "api", "package.json"), "utf8"),
      readFileSync(resolve(repositoryRoot, "pnpm-lock.yaml"), "utf8"),
      readFileSync(resolve(repositoryRoot, ".env.example"), "utf8"),
      readFileSync(resolve(repositoryRoot, "compose.yaml"), "utf8"),
    ].join("\n");

    expect(runtimeSources).not.toMatch(/twilio|TWILIO|sendSms/i);
    expect(runtimeSources).not.toMatch(/channel\s*:\s*["']sms["']/i);
    expect(schema).toMatch(/Historical SMS compatibility/i);
    expect(config).not.toMatch(/twilio|TWILIO|sendSms/i);
  });
});
