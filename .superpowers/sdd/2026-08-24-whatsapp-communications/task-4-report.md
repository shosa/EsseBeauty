# Task 4 report — Replace active SMS product flows

## Result

Active product delivery now uses tenant-scoped WhatsApp template messages through `enqueueCommunication`. Historical SMS channel rows remain represented by their original enum values and are not re-labelled or replayed as WhatsApp.

## Files changed

- Database: `packages/db/migrations/0032_whatsapp_product_flows.sql`, migration journal, and schema additions for active reminder settings and WhatsApp template campaign data.
- API: reminders, reviews, waitlist appointment events, marketing delivery/routes, notification helper removal, reminder routes, and active consent types.
- Web: reminder, marketing, document-consent, and permission-facing active copy/types.
- Tests: focused source/UI contract, PostgreSQL reminder/review delivery, and marketing consent/template cases.

## TDD evidence

- RED: `corepack pnpm --filter @esse-beauty/api exec vitest run src/jobs/whatsapp-product-flows.test.ts; corepack pnpm --filter @esse-beauty/web exec vitest run whatsapp-product-flows.test.ts`
  failed because migrated job sources did not contain `enqueueCommunication` and active UI still contained SMS.
- GREEN: the same contracts now pass. Focused behavior tests verify a reminder enqueue, WhatsApp review fallback, WhatsApp marketing consent exclusion, and an approved-template campaign over 160 characters.

## Verification commands and results

- Applied `0032_whatsapp_product_flows` locally with `corepack pnpm --filter @esse-beauty/db db:migrate`.
- `corepack pnpm --filter @esse-beauty/db build` — passed.
- `corepack pnpm --filter @esse-beauty/api typecheck` — passed.
- `corepack pnpm --filter @esse-beauty/web typecheck` — passed.
- Focused API Vitest suite — 4 files, 19 tests passed.
- Web Vitest suite — 23 files, 111 tests passed.

## Commit

- `4d2a81d6bda436b814abc55c9b1c5432939b5260` — `feat: replace SMS workflows with WhatsApp`

## Self-review

- All new automated WhatsApp sends are `kind: "template"` and retain source IDs plus stable idempotency keys.
- Marketing eligibility requires an explicit granted WhatsApp marketing consent; phone presence alone is insufficient.
- Existing historical SMS campaign jobs return without any delivery write or channel conversion.
- Password recovery was not changed and remains email-only.
- Only Task 4 files were staged for the implementation commit; unrelated chat-worktree edits remain untouched.

## Concerns

- The local Redis endpoint requires authentication and emitted `NOAUTH` during a route test's non-blocking outbox wake attempt. The durable enqueue contract catches that wake failure, so the focused test suite still passed; configure the test Redis credential for clean stderr.
- Template names/locales are stored and required for new WhatsApp campaign drafts. Deployment must ensure the named templates are approved in the tenant's Meta account before scheduling.
