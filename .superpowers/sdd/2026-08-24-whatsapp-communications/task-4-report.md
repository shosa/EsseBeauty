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

## Fix round 1/5

### Changes

- Added migration `0033_whatsapp_product_flow_hardening.sql`: queued product states, WhatsApp template approval provenance/status, and skipped campaign-recipient status.
- Review links are now persisted only as `__review_url__`; the raw deterministic bearer token is generated in memory by the outbox worker immediately before Meta delivery and only its hash is stored on the invitation.
- Reminder/review/campaign product state remains queued after outbox enqueue. The outbox updates source product records only after provider acceptance or terminal failure.
- Marketing rechecks granted WhatsApp marketing consent and approved template status immediately before each recipient enqueue; revocations are skipped truthfully.
- Marketing test sends require a customer-bound WhatsApp marketing consent plus an approved, active template. Direct arbitrary WhatsApp campaign template input is rejected.
- Waitlist enqueue accepts an injected boundary; UI distinguishes missing WhatsApp consent from missing phone.

### RED/GREEN evidence

- RED: `corepack pnpm --filter @esse-beauty/api exec vitest run src/jobs/reminders-delivery.postgres.test.ts src/jobs/reviews-delivery.postgres.test.ts src/routes/marketing/campaign-lifecycle.test.ts` initially failed on immediate `sent` state, persisted raw review URL, and arbitrary WhatsApp template creation.
- GREEN: `corepack pnpm --filter @esse-beauty/api exec vitest run src/jobs/communications.test.ts src/jobs/reminders-delivery.postgres.test.ts src/jobs/reviews-delivery.postgres.test.ts src/routes/marketing/campaign-lifecycle.test.ts` passes after the hardening changes (route test: 12 tests passed).
- `corepack pnpm --filter @esse-beauty/api typecheck` and `corepack pnpm --filter @esse-beauty/web typecheck` pass.

### Fix-round concerns

- Redis is still unauthenticated in the local test environment, producing non-blocking `NOAUTH` stderr when a route constructs the durable queue. No live Meta calls were made.

### Fix round 1 completion — waitlist behavioural coverage

- Added `apps/api/src/jobs/appointment-events.postgres.test.ts`, a route-level PostgreSQL test that cancels a confirmed appointment, waits for the injected durable-enqueue boundary, and asserts the resulting WhatsApp template's full payload, stable `waitlist-notification-{entryId}` idempotency key, `waitlist_entry` source ID/type, destination, and truthful `notified` waitlist state.
- Included the previously uncommitted reminder assertion in `apps/api/src/jobs/reminders-delivery.postgres.test.ts`: delivery is `queued` after outbox acceptance, not provider-sent.

### Waitlist RED/GREEN evidence

- RED: `corepack pnpm --filter @esse-beauty/api exec vitest run src/jobs/appointment-events.postgres.test.ts` with the dependency boundary deliberately bypassed failed as required: `expected [] to deeply equal [ ObjectContaining{…} ]`. This demonstrates the test observes the injected enqueue operation rather than merely inspecting source text.
- GREEN: `corepack pnpm --filter @esse-beauty/api exec vitest run src/jobs/appointment-events.postgres.test.ts` — 1 file, 2 tests passed.

### Final focused verification

- `corepack pnpm --filter @esse-beauty/db build` — passed.
- `corepack pnpm --filter @esse-beauty/api typecheck` — passed.
- `corepack pnpm --filter @esse-beauty/web typecheck` — passed.
- `corepack pnpm --filter @esse-beauty/api exec vitest run src/jobs/communications.test.ts src/jobs/reminders-delivery.postgres.test.ts src/jobs/reviews-delivery.postgres.test.ts src/jobs/appointment-events.postgres.test.ts src/routes/marketing/campaign-lifecycle.test.ts src/jobs/whatsapp-product-flows.test.ts` — 6 files, 25 tests passed. Covering files: `communications.test.ts`, `reminders-delivery.postgres.test.ts`, `reviews-delivery.postgres.test.ts`, `appointment-events.postgres.test.ts`, `campaign-lifecycle.test.ts`, and `whatsapp-product-flows.test.ts`.
- `corepack pnpm --filter @esse-beauty/web exec vitest run whatsapp-product-flows.test.ts` — 1 file, 1 test passed.

### Final concerns

- The only remaining local concern is non-blocking Redis `NOAUTH` stderr during the marketing route test's best-effort outbox wake. It does not affect transactional persistence or the passing assertions; configure test Redis authentication to remove it.

## Fix round 2/5

### Changes

- Approved WhatsApp template contract edits (Meta name, locale, or variables) now clear approval status, source, and timestamp in the locked update transaction.
- WhatsApp campaign creation and test sends use an approved tenant `template_id`; Meta identifiers are server-resolved and parameter arrays must match the approved template variable count. The new-campaign UI selects approved templates and collects their declared parameters instead of allowing editable Meta identifiers.
- Campaign aggregation keeps campaigns processing while queued work remains, and the communications outbox refreshes the parent campaign after terminal provider acceptance/failure.
- Re-enqueueing a failed/exhausted durable message with its stable idempotency key reactivates its existing message/outbox pair; successful work remains idempotent and is never duplicated.

### TDD RED/GREEN evidence

- RED: `corepack pnpm --filter @esse-beauty/api exec vitest run src/routes/marketing/campaign-lifecycle.test.ts -t "clears WhatsApp approval"` failed because approval provenance remained approved after a contract edit; GREEN passed after the transactional invalidation.
- RED: `corepack pnpm --filter @esse-beauty/api exec vitest run src/routes/marketing/campaign-lifecycle.test.ts -t "creates WhatsApp campaigns"` returned `INVALID_REQUEST` rather than the required template-contract outcome; GREEN passed after approved-template selection/parameter validation.
- RED: `corepack pnpm --filter @esse-beauty/api exec vitest run src/routes/marketing/campaign-lifecycle.test.ts -t "does not make skipped"` returned `failed` for skipped plus queued work; GREEN passed after aggregation correction.
- RED: `corepack pnpm --filter @esse-beauty/api exec vitest run src/jobs/communications.test.ts -t "refreshes the parent campaign"` left the parent campaign `queued`; GREEN passed after outbox refresh.
- RED: `corepack pnpm --filter @esse-beauty/api exec vitest run src/jobs/communications.test.ts -t "reactivates an exhausted"` left the retried recipient queued; GREEN passed after durable outbox reactivation.
- RED: `corepack pnpm --filter @esse-beauty/web exec vitest run whatsapp-product-flows.test.ts -t "submits WhatsApp campaigns"` failed because the active UI used editable Meta name/locale; GREEN passed using `selectedTemplateId` and `template_id`.

### Focused verification

- `corepack pnpm --filter @esse-beauty/api exec vitest run src/routes/marketing/campaign-lifecycle.test.ts src/jobs/communications.test.ts` — 2 files, 21 tests passed.
- `corepack pnpm --filter @esse-beauty/web exec vitest run whatsapp-product-flows.test.ts` — 1 file, 2 tests passed.
- `corepack pnpm --filter @esse-beauty/api typecheck` — passed.
- `corepack pnpm --filter @esse-beauty/web typecheck` — passed.

### Concerns

- The known local Redis `NOAUTH` stderr remains non-blocking during a best-effort outbox wake in the marketing lifecycle test; no provider delivery assertion is affected.

## Fix round 3/5

- Scheduling and the marketing worker now require the campaign's stored approved WhatsApp template name and locale snapshot to exactly match the currently active approved tenant template. A mismatch fails truthfully with `WHATSAPP_TEMPLATE_SNAPSHOT_STALE`, requiring re-selection/recreation of the draft before delivery.
- RED: `corepack pnpm --filter @esse-beauty/api exec vitest run src/routes/marketing/campaign-lifecycle.test.ts -t "blocks an old WhatsApp draft"` returned `503` (provider readiness) for an edited-and-reapproved template instead of rejecting stale draft state.
- GREEN: the same command — 1 file, 1 test passed; it covers schedule rejection and worker enqueue suppression after edit → reapproval.
- `corepack pnpm --filter @esse-beauty/api typecheck` — passed.
