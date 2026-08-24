import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

describe("local Redis development configuration", () => {
  it("uses a dedicated host port so CoreServices Redis cannot intercept API jobs", () => {
    const environmentExample = readFileSync(
      resolve(repositoryRoot, ".env.example"),
      "utf8",
    );
    const compose = readFileSync(resolve(repositoryRoot, "compose.yaml"), "utf8");

    expect(environmentExample).toContain("REDIS_URL=redis://localhost:6380");
    expect(compose).toContain('${REDIS_PORT:-6380}:6379');
  });
});
