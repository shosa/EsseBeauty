import { createDatabase } from "@esse-beauty/db";
import { MODULE_KEYS } from "@esse-beauty/feature-flags";

import { applyDemoScenario } from "../src/demo/apply-demo-scenario.js";
import { buildDemoScenario } from "../src/demo/build-demo-scenario.js";
import { DEMO_IDENTITY } from "../src/demo/scenario-types.js";
import { validateDemoScenario } from "../src/demo/validate-demo-scenario.js";
import { testDatabaseUrl } from "../src/test/postgres.js";

interface CliOptions {
  anchorDate: string;
  dryRun: boolean;
  seed: number;
}

function todayInRome(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { anchorDate: todayInRome(), dryRun: false, seed: 0 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--anchor") {
      const value = argv[index + 1];
      if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error("--anchor requires a value in YYYY-MM-DD format");
      }
      options.anchorDate = value;
      index += 1;
      continue;
    }
    if (arg === "--seed") {
      const value = argv[index + 1];
      const parsed = Number(value);
      if (!value || !Number.isInteger(parsed)) {
        throw new Error("--seed requires an integer value");
      }
      options.seed = parsed;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (options.seed === 0) {
    options.seed = Number(options.anchorDate.replaceAll("-", ""));
  }
  return options;
}

function sanitizedDatabaseTarget(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    return `${url.hostname}:${url.port || "5432"}${url.pathname}`;
  } catch {
    return "(unparsable DATABASE_URL)";
  }
}

function isLocalDatabaseTarget(databaseUrl: string): boolean {
  try {
    const url = new URL(databaseUrl);
    return ["localhost", "127.0.0.1", "::1", "esse-beauty-db", "db", "postgres"].includes(url.hostname);
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const databaseUrl = testDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required (set it in the environment or in the repository .env file)");
  }

  console.log(`Demo seed target: ${sanitizedDatabaseTarget(databaseUrl)}`);
  if (!isLocalDatabaseTarget(databaseUrl) && !process.env.ALLOW_DEMO_SEED_ANY_HOST) {
    throw new Error(
      "Refusing to seed a database host that does not look like a local/dev target. " +
        "Set ALLOW_DEMO_SEED_ANY_HOST=1 to override once you have confirmed this is not production.",
    );
  }

  const anchor = new Date(`${options.anchorDate}T10:00:00Z`);
  if (Number.isNaN(anchor.getTime())) {
    throw new Error(`Invalid --anchor date: ${options.anchorDate}`);
  }

  const db = createDatabase(databaseUrl);
  try {
    const scenario = buildDemoScenario({
      anchor,
      moduleKeys: Object.values(MODULE_KEYS),
      seed: options.seed,
    });

    const validation = validateDemoScenario(scenario);
    console.log(`Scenario anchor: ${anchor.toISOString()} (seed ${options.seed})`);
    console.log("Row counts:");
    for (const [table, count] of Object.entries(validation.tableCounts).sort(([a], [b]) => a.localeCompare(b))) {
      console.log(`  ${table}: ${count}`);
    }
    if (validation.warnings.length > 0) {
      console.log("Warnings:");
      for (const warning of validation.warnings) console.log(`  - ${warning}`);
    }
    if (validation.errors.length > 0) {
      console.error("Validation errors:");
      for (const error of validation.errors) console.error(`  - ${error}`);
      process.exitCode = 1;
      return;
    }
    console.log("Validation: 0 errors");

    if (options.dryRun) {
      console.log("Dry run: no database changes were made.");
      return;
    }

    const report = await applyDemoScenario(db, scenario, { ownerPassword: "demo123456" });
    console.log(
      report.replacedTenantId
        ? `Replaced existing Demo tenant ${report.replacedTenantId}.`
        : "Created a new Demo tenant.",
    );
    console.log(`Demo tenant id: ${report.tenantId}`);
    console.log(`Login: ${DEMO_IDENTITY.ownerEmail} / (see docs/demo-salon.md for the password)`);
  } finally {
    await db.$client.end();
  }
}

await main();
