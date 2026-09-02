# Advertising Demo Salon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, apply, and verify a regenerative, data-rich public Demo salon with login `demo@demo.com` / `demo123456` and a rolling twelve-month appointment horizon.

**Architecture:** A deterministic scenario builder produces typed tenant data from one date anchor and PRNG seed. A separate transactional applicator verifies the reserved tenant identity, replaces only that tenant, hashes the owner password through the production helper, inserts dependency-ordered rows, and validates relational and aggregate invariants before commit.

**Tech Stack:** Node.js 22, TypeScript, `tsx`, Drizzle ORM, PostgreSQL, Vitest, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-02-advertising-demo-salon-design.md`

## Global Constraints

- Reserved salon slug is exactly `demo` and owner login is exactly `demo@demo.com`.
- The configured password is `demo123456`; it must be hashed by the existing production password helper and never stored in plaintext.
- Regeneration may delete only a tenant whose slug and existing owner identity both match the reserved Demo identity; any mismatch aborts.
- All time-relative data derives from one explicit date anchor in the `Europe/Rome` business timezone.
- Future appointments cover twelve months from the anchor.
- Generation is deterministic for a fixed seed and anchor.
- No external communications, webhooks, marketing messages, or payments are dispatched.
- Platform-wide plans and module catalogs are reused, never reset.
- Implementation and verification must preserve all non-Demo tenants.

---

### Task 1: Deterministic scenario primitives and contract

**Files:**
- Create: `apps/api/src/demo/scenario-types.ts`
- Create: `apps/api/src/demo/deterministic.ts`
- Create: `apps/api/src/demo/deterministic.test.ts`

**Interfaces:**
- Produces: `createDeterministicRandom(seed: number): DemoRandom`.
- Produces: `DemoSeedOptions`, `DemoScenario`, `DemoTableRows`, and `DEMO_IDENTITY`.
- `DemoRandom` exposes `float()`, `integer(min, max)`, `pick(items)`, `chance(probability)`, and `uuid(namespace)`.

- [ ] **Step 1: Write a failing deterministic PRNG test**

```ts
import { describe, expect, it } from "vitest";
import { createDeterministicRandom } from "./deterministic.js";

describe("createDeterministicRandom", () => {
  it("repeats values and UUIDs for the same seed", () => {
    const left = createDeterministicRandom(20260902);
    const right = createDeterministicRandom(20260902);
    expect([left.float(), left.integer(2, 9), left.uuid("customer")])
      .toEqual([right.float(), right.integer(2, 9), right.uuid("customer")]);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run: `pnpm --filter @esse-beauty/api test -- src/demo/deterministic.test.ts`

Expected: FAIL because `deterministic.ts` does not exist.

- [ ] **Step 3: Implement a seedable PRNG and stable UUID derivation**

Implement `createDeterministicRandom` with a compact integer PRNG and derive UUID-shaped IDs from the seed, namespace, and a per-namespace counter. Validate inclusive integer bounds and non-empty `pick` input.

```ts
export interface DemoRandom {
  float(): number;
  integer(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  chance(probability: number): boolean;
  uuid(namespace: string): string;
}
```

Define `DEMO_IDENTITY` as `{ salonName: "Demo", salonSlug: "demo", ownerEmail: "demo@demo.com" }` and make `DemoTableRows` use the Drizzle `$inferInsert` types for each tenant table it contains.

- [ ] **Step 4: Run the focused test**

Run: `pnpm --filter @esse-beauty/api test -- src/demo/deterministic.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the primitive layer**

```bash
git add apps/api/src/demo
git commit -m "test: add deterministic demo scenario primitives"
```

### Task 2: Organization, modules, staff, services, and customers

**Files:**
- Create: `apps/api/src/demo/build-demo-scenario.ts`
- Create: `apps/api/src/demo/build-demo-scenario.test.ts`
- Modify: `apps/api/src/demo/scenario-types.ts`

**Interfaces:**
- Consumes: `createDeterministicRandom` and `DemoSeedOptions`.
- Produces: `buildDemoScenario(options: DemoSeedOptions): DemoScenario`.
- `DemoScenario` contains dependency-ordered row arrays keyed by schema table name plus `anchorDate`, `seed`, and expected volume metadata.

- [ ] **Step 1: Write failing structural tests**

For anchor `2026-09-02T10:00:00+02:00` and seed `20260902`, assert:

```ts
expect(scenario.rows.salons).toHaveLength(1);
expect(scenario.rows.salonLocations.length).toBeGreaterThanOrEqual(3);
expect(scenario.rows.salonResources.length).toBeGreaterThanOrEqual(10);
expect(scenario.rows.staff.length).toBeGreaterThanOrEqual(12);
expect(scenario.rows.services.length).toBeGreaterThanOrEqual(40);
expect(scenario.rows.customers.length).toBeGreaterThanOrEqual(300);
expect(new Set(scenario.rows.salonModules.map(row => row.moduleKey)))
  .toEqual(new Set(options.moduleKeys));
```

Also assert every service has at least one `serviceStaff` row and every resource-required service has a valid `serviceResources` row in the same salon.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `pnpm --filter @esse-beauty/api test -- src/demo/build-demo-scenario.test.ts`

Expected: FAIL because the scenario builder does not exist.

- [ ] **Step 3: Implement core scenario generation**

Build coherent Italian demo data for:

- salon, all supplied module keys, three locations, settings, closures, cabins/resources;
- owner plus manager, receptionists, beauticians, nail artists, massage/facial specialists;
- working hours and permissions;
- categories, at least forty services, service/staff assignments, and resource assignments;
- at least three hundred fictional customers, tags, consents, preferences, and varied CRM metrics.

Use reserved documentation-only contact ranges and `.invalid` emails. Centralize minimum counts in `DEMO_VOLUME_PROFILE`; do not scatter numeric thresholds across builders.

- [ ] **Step 4: Verify determinism and cross-references**

Run: `pnpm --filter @esse-beauty/api test -- src/demo/build-demo-scenario.test.ts`

Expected: PASS, including equality of two scenarios built with the same anchor and seed.

- [ ] **Step 5: Commit the core catalog**

```bash
git add apps/api/src/demo
git commit -m "feat: generate demo organization and catalog"
```

### Task 3: Rolling calendar and customer engagement history

**Files:**
- Modify: `apps/api/src/demo/build-demo-scenario.ts`
- Modify: `apps/api/src/demo/build-demo-scenario.test.ts`
- Modify: `apps/api/src/demo/scenario-types.ts`

**Interfaces:**
- Extends `DemoTableRows` with appointments, notes, reschedule requests, availability, reminders, reviews, waitlist, loyalty, packages, communications, campaigns, notifications, and activity.

- [ ] **Step 1: Add failing timeline and compatibility tests**

Assert at least 1,500 appointments, the newest appointment is no more than twelve months after the anchor, each appointment references a staff member assigned to its service, required resources are compatible, and intervals do not overlap for a staff member or resource. Assert a distribution of `completed`, `confirmed`, `pending`, `cancelled`, and `no_show` states.

- [ ] **Step 2: Run the focused test and confirm the missing-domain failures**

Run: `pnpm --filter @esse-beauty/api test -- src/demo/build-demo-scenario.test.ts`

Expected: FAIL on timeline and engagement volume assertions.

- [ ] **Step 3: Generate the rolling calendar and related histories**

Use opening hours, durations, qualification maps, location/resource compatibility, and deterministic weighted distributions. Generate history before the anchor and future bookings through twelve months after it. Connect completed appointments to notes, reminders, review invitations/reviews, points, package usage, and activity; create separate waitlist and availability examples.

- [ ] **Step 4: Generate engagement domains without dispatch side effects**

Add loyalty configuration and ledgers, service packages and balances, communication consents/conversations/messages, campaign templates/campaign recipients, notification preferences, saved views, and notifications. Provider and outbox records must remain disabled, terminal, or synthetic so executing the seed cannot cause delivery.

- [ ] **Step 5: Run timeline tests and commit**

Run: `pnpm --filter @esse-beauty/api test -- src/demo/build-demo-scenario.test.ts`

Expected: PASS.

```bash
git add apps/api/src/demo
git commit -m "feat: add rolling demo calendar and engagement data"
```

### Task 4: Sales, vouchers, stock, documents, and accounting data

**Files:**
- Modify: `apps/api/src/demo/build-demo-scenario.ts`
- Modify: `apps/api/src/demo/build-demo-scenario.test.ts`
- Modify: `apps/api/src/demo/scenario-types.ts`

**Interfaces:**
- Extends `DemoTableRows` with suppliers, products, sales, sale items/payments, vouchers, inventory documents/lines/movements/counts/reorders/expenses/assets, and cash movements.

- [ ] **Step 1: Add failing reconciliation tests**

Assert at least 100 products and 500 sales; each sale total equals its item totals and each completed sale's payments reconcile. For every product, calculate stock from inventory movements and assert it matches the generated expected balance. Assert examples of healthy, low, zero, and reordered stock.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `pnpm --filter @esse-beauty/api test -- src/demo/build-demo-scenario.test.ts`

Expected: FAIL on commerce and warehouse minimums.

- [ ] **Step 3: Generate reconciled commerce history**

Create mixed service, product, package, and voucher sales; connect completed appointments where appropriate; calculate VAT, discounts, totals, payment splits, voucher balances, and cash movements with integer minor-unit or schema-compatible decimal arithmetic.

- [ ] **Step 4: Generate reconciled warehouse history**

Create suppliers, products, inbound documents, adjustments, appointment/product consumption, sales outflows, stock counts, reorder requests, expenses, and assets. Derive displayed stock from the movement ledger rather than selecting unrelated random balances.

- [ ] **Step 5: Run reconciliation tests and commit**

Run: `pnpm --filter @esse-beauty/api test -- src/demo/build-demo-scenario.test.ts`

Expected: PASS.

```bash
git add apps/api/src/demo
git commit -m "feat: populate reconciled demo commerce and warehouse"
```

### Task 5: Transactional applicator and tenant safety guard

**Files:**
- Create: `apps/api/src/demo/apply-demo-scenario.ts`
- Create: `apps/api/src/demo/apply-demo-scenario.test.ts`
- Create: `apps/api/src/demo/apply-demo-scenario.postgres.test.ts`

**Interfaces:**
- Consumes: `DemoScenario`, Drizzle `DrizzleDB`, and `hashPassword` from `routes/auth/local-auth.ts`.
- Produces: `assertReplaceableDemoTenant(existing): void`.
- Produces: `applyDemoScenario(db, scenario, options): Promise<DemoApplyReport>` where options include `dryRun` and plaintext password supplied only at runtime.

- [ ] **Step 1: Write failing safety-guard unit tests**

Cover: no existing tenant; exact slug/email match; matching slug with a different owner aborts; matching email attached to another slug aborts; multiple ambiguous owners abort. Error messages must state that no database changes occurred.

- [ ] **Step 2: Run the unit test and confirm failure**

Run: `pnpm --filter @esse-beauty/api test -- src/demo/apply-demo-scenario.test.ts`

Expected: FAIL because the guard does not exist.

- [ ] **Step 3: Implement the guard and transactional insert order**

Query by both reserved slug and email before opening the replacement transaction. In the transaction, lock the matched salon row, recheck identity, delete exactly that salon, create the owner with `hashPassword`, then insert scenario rows in foreign-key order using bounded batches. Roll back on any insert or validation failure.

- [ ] **Step 4: Add a PostgreSQL isolation test**

Create a non-Demo sentinel salon, apply Demo twice, and assert the sentinel row and its child rows are byte-for-byte unchanged while Demo row counts are stable after the second application. Skip only when the repository PostgreSQL test helper reports no configured database.

- [ ] **Step 5: Run unit and PostgreSQL tests and commit**

Run: `pnpm --filter @esse-beauty/api test -- src/demo/apply-demo-scenario.test.ts src/demo/apply-demo-scenario.postgres.test.ts`

Expected: PASS or explicit PostgreSQL skip when no test database is configured.

```bash
git add apps/api/src/demo
git commit -m "feat: safely regenerate the reserved demo tenant"
```

### Task 6: CLI, validation report, package command, and operator documentation

**Files:**
- Create: `apps/api/scripts/seed-demo.ts`
- Create: `apps/api/src/demo/validate-demo-scenario.ts`
- Create: `apps/api/src/demo/validate-demo-scenario.test.ts`
- Modify: `apps/api/package.json`
- Modify: `package.json`
- Create: `docs/demo-salon.md`

**Interfaces:**
- Produces CLI flags `--dry-run`, `--anchor YYYY-MM-DD`, and `--seed INTEGER`.
- Produces `validateDemoScenario(scenario): DemoValidationReport` with errors, warnings, and per-table counts.
- Root command: `pnpm demo:seed`; dry-run command: `pnpm demo:seed -- --dry-run`.

- [ ] **Step 1: Write failing validation and CLI contract tests**

Assert validation reports no errors for the canonical scenario and catches a deliberately broken foreign key, overlap, sale total, and stock balance. Add a source contract assertion that the CLI requires `DATABASE_URL`, defaults anchor to the current Rome date, and never logs the plaintext password.

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm --filter @esse-beauty/api test -- src/demo/validate-demo-scenario.test.ts`

Expected: FAIL because validation and CLI files do not exist.

- [ ] **Step 3: Implement validation and CLI orchestration**

The CLI loads `DATABASE_URL`, reads current module keys from `platform_module_catalog` plus known feature-flag module keys, builds and validates the scenario, prints a concise count report, exits on validation errors, and calls the applicator unless `--dry-run` is set. Ensure the PostgreSQL client is closed in `finally` by exposing or using a connection-closing database wrapper rather than forcing process exit.

- [ ] **Step 4: Add commands and documentation**

Add `"demo:seed": "tsx scripts/seed-demo.ts"` to the API package and a root forwarding command. Document identity safeguards, rolling dates, data domains, dry-run usage, database prerequisite, expected login, and the fact that regeneration replaces only Demo.

- [ ] **Step 5: Verify dry-run and commit**

Run: `pnpm demo:seed -- --dry-run --anchor 2026-09-02 --seed 20260902`

Expected: exit 0, no database writes, validation errors 0, and per-domain counts shown.

```bash
git add apps/api/scripts apps/api/src/demo apps/api/package.json package.json docs/demo-salon.md
git commit -m "feat: add repeatable advertising demo seed command"
```

### Task 7: Full verification, configured database application, and delivery

**Files:**
- Modify only files required by failures uncovered during verification.

**Interfaces:**
- Consumes the complete seed command and repository verification suite.
- Produces an applied Demo tenant, evidence report, and pushed `main` branch.

- [ ] **Step 1: Run focused and repository checks**

Run:

```bash
pnpm --filter @esse-beauty/api test -- src/demo
pnpm typecheck
pnpm test
git diff --check
```

Expected: all commands pass; PostgreSQL tests may skip only if the established test helper reports no configured database.

- [ ] **Step 2: Inspect the exact database target without printing credentials**

Resolve `DATABASE_URL` using the repository's established environment loading behavior and print only host, port, and database name. Abort if the database name cannot be resolved or appears to be a production target without explicit authorization.

- [ ] **Step 3: Apply the Demo seed twice and validate idempotence**

Run `pnpm demo:seed` twice. Expected: both executions pass; the second report has the same canonical tenant identity and deterministic table counts for the same date anchor, while all validation errors remain zero.

- [ ] **Step 4: Verify authentication and representative reads**

Use the existing production password verifier against the stored Demo credential. Start or query the configured API and verify populated reads for calendar, customers, staff, services, sales, warehouse, marketing, reviews, packages, loyalty, and dashboard endpoints.

- [ ] **Step 5: Apply verification-before-completion and request code review**

Use `superpowers:verification-before-completion`, then `superpowers:requesting-code-review`. Resolve every blocking review finding and rerun the focused checks.

- [ ] **Step 6: Commit final corrections, merge, and push**

If corrections exist, commit them with a scoped message. Confirm the current branch and clean working tree. If work is already on `main`, no merge commit is needed; otherwise use `superpowers:finishing-a-development-branch` to integrate. Push `main` to its configured upstream and report the final commit hash plus verification evidence.
