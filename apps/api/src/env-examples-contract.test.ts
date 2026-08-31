import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

function readRootFile(path: string) {
  return readFileSync(resolve(repositoryRoot, path), "utf8");
}

describe("contratto degli esempi ambiente", () => {
  it("documenta le variabili di sviluppo host separatamente dagli interni Docker", () => {
    const envExample = readRootFile(".env.example");

    expect(envExample).toContain("DATABASE_URL=postgresql://postgres:postgres@localhost:5432/esse_beauty");
    expect(envExample).toContain("REDIS_URL=redis://localhost:6380");
    expect(envExample).toContain("NEXT_PUBLIC_API_URL=http://localhost:3001");
    expect(envExample).toContain("NEXT_PUBLIC_PWA_URL=http://localhost:3002");
    expect(envExample).toContain("PROVIDER_CREDENTIAL_ENCRYPTION_KEY=");
  });

  it("mantiene esplicite e fail-fast le impostazioni Docker di produzione", () => {
    const envExample = readRootFile(".env.example");
    const compose = readRootFile("compose.yaml");
    const dockerGuide = readRootFile("DOCKER.md");

    expect(envExample).toContain("POSTGRES_MAINTENANCE_DB=postgres");
    expect(envExample).toContain("POSTGRES_PASSWORD=cambia-questa-password-in-produzione");
    expect(envExample).toContain("REVIEW_TOKEN_SECRET=");
    expect(envExample).toContain("REVIEW_SESSION_SECRET=");
    expect(envExample).toContain("COOKIE_SECURE=false");
    expect(compose).toContain("127.0.0.1:${POSTGRES_PORT:-5432}:5432");
    expect(compose).toContain("127.0.0.1:${REDIS_PORT:-6380}:6379");
    expect(compose).toContain("POSTGRES_MAINTENANCE_DB: ${POSTGRES_MAINTENANCE_DB:-postgres}");
    expect(compose).toContain("NEXT_PUBLIC_PWA_URL: ${NEXT_PUBLIC_PWA_URL:-http://localhost:3002}");
    expect(compose).toContain("REVIEW_TOKEN_SECRET: ${REVIEW_TOKEN_SECRET:?REVIEW_TOKEN_SECRET is required}");
    expect(dockerGuide).toContain("variabile `POSTGRES_DB` crea il database solo al primo bootstrap del volume");
    expect(dockerGuide).toContain("NEXT_PUBLIC_API_URL");
  });
});
