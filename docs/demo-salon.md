# Demo salon

A regenerative, data-rich `Demo` tenant used for product demonstrations. It is
built by a deterministic TypeScript generator and applied through a
transactional, identity-checked applicator — never a SQL dump — so it stays
correct as the schema evolves and can be safely regenerated at any time.

## Login

- URL: your local app, salon slug `demo`
- Email: `demo@demo.com`
- Password: `demo123456`

The password is hashed through the same production `hashPassword` helper used
for real accounts, so it verifies through the normal login path.

## What it contains

Every module in `@esse-beauty/feature-flags` is enabled for the Demo salon,
with representative data across every tenant-facing domain:

- Three locations, cabins/stations, staff roster, and a full service catalog
  with staff/resource compatibility.
- Several hundred fictional customers with tags, consents, and CRM history.
- A rolling calendar: history back to a year before the anchor date and
  confirmed/pending appointments up to twelve months ahead, with notes,
  reschedule requests, reminders, and reviews.
- Loyalty tiers, rewards, redemptions, and a points ledger.
- Campaign templates and campaigns (no live dispatch — outbox/webhook tables
  are intentionally left empty).
- Sales, vouchers, and a warehouse ledger (suppliers, products, purchase and
  opening documents, stock counts, expenses, assets, cash movements) that all
  reconcile: sale totals match their line items, and product stock quantities
  match the sum of their movement history.

All customer/staff/supplier contact details use reserved `.invalid` email
domains and documentation-only phone ranges — nothing in the dataset can
reach a real inbox or phone number.

## Regeneration is safe by design

Running the seed again does not add duplicate data — it replaces only the
reserved Demo tenant:

1. It looks up the existing tenant by the reserved slug (`demo`) **and** the
   reserved owner email (`demo@demo.com`).
2. If neither exists, it creates a fresh tenant.
3. If both exist and point at the same salon, it deletes that salon (which
   cascades to all of its data) and rebuilds it from scratch.
4. If the slug and owner email are inconsistent in any way — the slug is
   taken by a salon with a different owner, the owner email belongs to a
   different salon, or either match is ambiguous — the seed **aborts without
   changing anything**.

All dates are computed relative to the anchor date at run time, so every
regeneration produces a fresh twelve-month calendar instead of retaining
stale fixed dates. Every other tenant in the database is left untouched;
this is covered by an automated test that seeds a sentinel tenant, applies
Demo twice, and asserts the sentinel is byte-for-byte unchanged.

## Usage

```bash
# Seed (or re-seed) the Demo tenant against the configured DATABASE_URL
pnpm demo:seed

# Preview without writing anything to the database
pnpm demo:seed -- --dry-run

# Pin the anchor date and PRNG seed (both default to "today" in Europe/Rome)
pnpm demo:seed -- --anchor 2026-09-02 --seed 20260902
```

Prerequisites:

- `DATABASE_URL` must be set (environment variable, or the repository's
  root `.env` file) and point at a migrated database.
- The target host must look like a local/dev database (`localhost`,
  `127.0.0.1`, or the `esse-beauty-db` container). Seeding any other host
  requires explicitly setting `ALLOW_DEMO_SEED_ANY_HOST=1`, as a guard rail
  against accidentally targeting production.

The command prints a per-table row count and validation report before
touching the database, and exits non-zero without writing anything if
validation finds an error (a dangling reference, a sale total that doesn't
match its items, a stock balance that doesn't reconcile, an overlapping
appointment, and so on).
