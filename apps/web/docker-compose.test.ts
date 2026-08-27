import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function renderedCompose() {
  const output = execFileSync("docker", ["compose", "config", "--format", "json"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      API_CORS_ORIGIN: "",
      REVIEW_SESSION_SECRET: "compose-contract-test-session",
      REVIEW_TOKEN_SECRET: "compose-contract-test-token",
    },
  });

  return JSON.parse(output) as {
    services: Record<string, {
      build?: { dockerfile?: string };
      environment?: Record<string, string>;
      ports?: Array<{ published?: string; target?: number }>;
    }>;
  };
}

describe("production Docker topology", () => {
  it("publishes the staff PWA on port 3003 and allows it through the API CORS policy", () => {
    const compose = renderedCompose();
    const staffPwa = compose.services["staff-pwa"];

    expect(staffPwa).toBeDefined();
    expect(staffPwa?.build?.dockerfile).toBe("apps/staff-pwa/Dockerfile");
    expect(staffPwa?.ports).toContainEqual(expect.objectContaining({ published: "3003", target: 3003 }));
    expect(compose.services.api?.environment?.API_CORS_ORIGIN).toContain("http://localhost:3003");
  });
});
