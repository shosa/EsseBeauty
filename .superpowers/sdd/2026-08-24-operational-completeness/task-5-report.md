# Task 5 Report: Secure review invitations and review management

## Outcome

Implemented and committed secure, durable review invitations and complete public/dashboard review workflows.

- Commit: `04c2412 feat: secure and complete review workflows`
- Migration: `0024_secure_review_invitations.sql` (next after `0023`)
- Public API: `GET/POST /api/public/reviews/token/:token`
- Legacy appointment-ID public access now returns `404`.
- Raw review tokens are generated only inside the delivery worker, passed to the email/SMS sender, and never stored in PostgreSQL or BullMQ payloads.
- Appointment completion creates one durable invitation before queueing. Database uniqueness and stable BullMQ job IDs make repeated/concurrent events idempotent.
- Public submission locks the invitation row and atomically inserts the review plus `consumed_at`, so concurrent submissions produce one `201` and one `409 TOKEN_CONSUMED`.
- Dashboard reply/publication mutations validate response status, retain dialog/form state on failure, and render a visible error.
- PWA review route is token-based, network-only, `no-store`, and covered by a route-level `Referrer-Policy: no-referrer`.

## Migration and schema

`review_invitations` contains:

- UUID primary key, tenant (`salon_id`) and unique `appointment_id`.
- Nullable SHA-256 `token_hash` with a 64-character lowercase hexadecimal check and unique index.
- Delivery channel (`email`/`sms`) and status (`pending`, `processing`, `sent`, `failed`, `skipped`).
- `expires_at`, `consumed_at`, `revoked_at`, `delivered_at`, and `last_delivery_attempt_at`.
- Durable `delivery_attempts`, sanitized `delivery_failure`, timestamps, and a non-negative attempts constraint.

The migration was applied successfully to the configured PostgreSQL test database with Drizzle.

## API DTOs and lifecycle responses

Successful public resolve returns only:

```json
{
  "salon_name": "Review PostgreSQL Test",
  "service_name": "Trattamento viso",
  "starts_at": "2026-08-24T08:00:00.000Z"
}
```

It never returns appointment/customer IDs, customer identity, invitation state, or token hashes. Successful submission returns only `{ "submitted": true }`.

Stable token errors:

- `404 { "error": "TOKEN_INVALID" }`
- `410 { "error": "TOKEN_EXPIRED" }`
- `409 { "error": "TOKEN_CONSUMED" }`
- `410 { "error": "TOKEN_REVOKED" }`

Malformed comments return `400 INVALID_REQUEST` with field errors without consuming the invitation. Ratings outside integer range 1-5 return `400 INVALID_RATING`.

Authenticated review list/reply routes require `reviews.reply`; publication requires `settings.salon`. All mutations also reject a path salon that differs from the authenticated tenant.

## TDD evidence

### Initial RED

Command:

```powershell
corepack pnpm --filter @esse-beauty/api exec vitest run src/routes/reviews/review-flow.test.ts src/jobs/appointment-events.test.ts
```

Result: 2 files failed, 7 tests failed for the intended missing behavior:

- Legacy appointment UUID returned `200` with appointment/customer details instead of `404`.
- Durable invitation helper was absent.
- Checkout completion detection was absent.
- Token lifecycle/concurrency routes were absent.
- Raw review bearer token appeared in Fastify request logs.

### API/PostgreSQL GREEN

The same command passed: 2 files, 7 tests. A later DTO regression was added and observed RED (`500`, `.trim is not a function`) before validation changed it to the expected `400`; the final review flow now has 6 PostgreSQL/API tests.

### UI RED/GREEN

Web and PWA tests first failed because the new behavior/controller modules did not exist. After implementation:

- Web: 3 tests passed (failure-state retention, success-only close, surfaced API errors).
- PWA: 3 review tests passed (encoded token path/no-referrer, form retention, distinct lifecycle messages).
- Existing consent signing suite: 8 tests passed after adding the review header/cache policy alongside consent policy.

### Delivery idempotency RED/GREEN

The real PostgreSQL delivery test initially showed a duplicate job invoked the provider twice. After adding the persisted `delivered_at` guard, the same job can run twice while producing one provider call, one attempt, and one stored hash.

## Final verification

Fresh verification before commit:

```powershell
corepack pnpm --filter @esse-beauty/api exec vitest run src/routes/reviews src/jobs/reviews* src/jobs/appointment-events.test.ts
corepack pnpm --filter @esse-beauty/web exec vitest run reviews-flow.test.ts
corepack pnpm --filter @esse-beauty/pwa exec vitest run review-submission.test.ts consent-signing.test.ts
corepack pnpm --filter @esse-beauty/api typecheck
corepack pnpm --filter @esse-beauty/db typecheck
corepack pnpm --filter @esse-beauty/web typecheck
corepack pnpm --filter @esse-beauty/pwa typecheck
git diff --check
```

Results:

- API requested suite: 2 files, 8 tests passed.
- Web review suite: 1 file, 3 tests passed.
- PWA behavior suites: 2 files, 11 tests passed.
- API, DB, web, and PWA typechecks: all passed.
- `git diff --check`: passed (only Git line-ending notices).

PowerShell/Vitest did not expand `src/jobs/reviews*` to the delivery test, so it was also run explicitly:

```powershell
corepack pnpm --filter @esse-beauty/api exec vitest run src/jobs/reviews-delivery.postgres.test.ts
```

Result: 1 PostgreSQL test passed.

## Files

- `packages/db/migrations/0024_secure_review_invitations.sql`
- `packages/db/migrations/meta/_journal.json`
- `packages/db/schema.ts`
- `apps/api/src/app.ts`
- `apps/api/src/jobs/appointment-events.ts`
- `apps/api/src/jobs/appointment-events.test.ts`
- `apps/api/src/jobs/reviews.ts`
- `apps/api/src/jobs/reviews-delivery.postgres.test.ts`
- `apps/api/src/routes/reviews/index.ts`
- `apps/api/src/routes/reviews/review-flow.test.ts`
- `apps/pwa/app/review/[token]/page.tsx` (replaces `[appointmentId]`)
- `apps/pwa/app/review/review-submission.ts`
- `apps/pwa/review-submission.test.ts`
- `apps/pwa/lib/cache-policy.mjs`
- `apps/pwa/next.config.mjs`
- `apps/pwa/consent-signing.test.ts`
- `apps/web/app/(dashboard)/reviews/page.tsx`
- `apps/web/app/(dashboard)/reviews/reviews-controller.ts`
- `apps/web/reviews-flow.test.ts`

## Self-review and concerns

No blocking self-review findings.

- Invitation persistence occurs before queue insertion. If Redis is unavailable, the durable row remains `pending`, making replay/repair possible, but no separate pending-invitation sweeper is added in this task.
- Provider delivery and the final `sent` database update cannot be one transaction. If a provider accepts a message but times out before confirming it, a retry can rotate the token. Task 6 should preserve these status/attempt semantics and use provider idempotency keys where available.
- Task 6 may extract email/SMS adapters, but it must keep raw tokens out of job payloads/logs/storage and retain the sanitized `REVIEW_DELIVERY_FAILED` boundary.

## Fix round 1/5 (2026-08-24)

### Outcome

All Important and Minor review findings were addressed.

- Migration `0025_review_delivery_recovery.sql` adds a durable delivery claim UUID, lease expiry, and recovery index.
- Delivery now claims the invitation under `FOR UPDATE`, records a five-minute lease, and conditionally finalizes by claim ID. A concurrent worker cannot invoke the provider while that claim is active.
- Review bearers are stable HMAC-derived tokens for the invitation/expiry. Provider retries therefore reuse the same still-valid URL instead of rotating the stored hash.
- BullMQ delivery jobs have five attempts, exponential 30-second backoff, bounded retention, and stable attempt-generation job IDs.
- Queue insertion failure leaves the invitation durable and eligible for a startup plus five-minute scheduled recovery scan. Repeated successful completion calls safely attempt the same invitation/job identity.
- Invitations without a usable destination become `skipped` without hashing a token or incrementing attempts.
- SMS construction preserves the complete review URL and shortens human copy first so the message remains at most 160 characters; construction/provider failures never set `sent`.
- Dashboard review lists now distinguish loading, error/retry, ready-empty, and populated states. Mutation success is committed before refresh, so a refresh failure cannot relabel a successful save; failed saves preserve dialog/form state.
- PWA ingress exchanges `/review/:token` for an encrypted, ten-minute, HttpOnly, SameSite-strict cookie and redirects to token-free `/review`. Continued browser requests use `/review/session`; the server proxy alone reconstructs the API token path. Ingress and proxy responses are private/no-store and no-referrer, and successful submission clears the cookie.
- PWA navigation clears the previous summary and reducer state before loading the current invitation.
- A real Fastify/PostgreSQL completion-hook test covers repeated checkout publication into one invitation/job identity. Authenticated API coverage now verifies both the `reviews.reply` permission and tenant boundary.

### RED evidence

Delivery/recovery tests were written first. The initial PostgreSQL delivery run had four intended failures:

- two concurrent workers invoked the provider twice;
- a provider retry produced a different URL;
- a no-destination invitation minted a hash/incremented attempts;
- a long-service SMS was 215 characters and truncated the intended contract.

The new recovery suite initially failed two tests because `scheduleReviewInvitation`, `recoverReviewInvitations`, and recovery scheduler behavior did not exist. PWA tests initially failed because the session-path builder, reset transition, ingress middleware, and `/review/session` pass-through were absent. Web controller tests initially failed because explicit list state and post-mutation refresh separation were absent.

### GREEN evidence

Focused implementation runs:

```powershell
corepack pnpm --filter @esse-beauty/pwa exec vitest run review-ingress.test.ts review-submission.test.ts
corepack pnpm --filter @esse-beauty/api exec vitest run src/routes/reviews/review-flow.test.ts src/jobs/appointment-events.postgres.test.ts src/jobs/reviews-delivery.postgres.test.ts src/jobs/reviews-recovery.postgres.test.ts
corepack pnpm --filter @esse-beauty/web exec vitest run reviews-flow.test.ts
```

Results: PWA 2 files/6 tests passed; API 4 files/15 tests passed; web 1 file/5 tests passed. The API set includes real PostgreSQL concurrent delivery, stable provider retry, durable Redis-add recovery, repeated completion-hook scheduling, one-use public submission, minimal DTO, tenant, and permission assertions.

Fresh full affected verification before commit:

```powershell
corepack pnpm --filter @esse-beauty/api test
corepack pnpm --filter @esse-beauty/web exec vitest run reviews-flow.test.ts
corepack pnpm --filter @esse-beauty/pwa exec vitest run review-ingress.test.ts review-submission.test.ts consent-signing.test.ts
corepack pnpm --filter @esse-beauty/db typecheck
corepack pnpm --filter @esse-beauty/db build
corepack pnpm --filter @esse-beauty/api typecheck
corepack pnpm --filter @esse-beauty/api build
corepack pnpm --filter @esse-beauty/web typecheck
corepack pnpm --filter @esse-beauty/web build
corepack pnpm --filter @esse-beauty/pwa typecheck
corepack pnpm --filter @esse-beauty/pwa build
$env:DATABASE_URL = <workspace .env DATABASE_URL>; corepack pnpm --filter @esse-beauty/db db:migrate
$env:REVIEW_TOKEN_SECRET = <32+ chars>; $env:REVIEW_SESSION_SECRET = <32+ chars>; docker compose config --quiet
git diff --check
```

Results:

- API: 32 files, 88 tests passed.
- Web behavior: 1 file, 5 tests passed.
- PWA behavior/ingress/regression: 3 files, 14 tests passed.
- DB, API, web, and PWA typechecks passed.
- DB, API, web, and PWA production builds passed.
- Drizzle reported migrations applied successfully; Compose validation exited 0.
- `git diff --check` passed, with only Git's existing LF-to-CRLF notices.

### Fix-round files

- `packages/db/migrations/0025_review_delivery_recovery.sql`
- `packages/db/migrations/meta/_journal.json`
- `packages/db/schema.ts`
- `apps/api/src/env.ts`
- `apps/api/src/index.ts`
- `apps/api/src/jobs/reviews.ts`
- `apps/api/src/jobs/reviews-delivery.postgres.test.ts`
- `apps/api/src/jobs/reviews-recovery.postgres.test.ts`
- `apps/api/src/jobs/appointment-events.ts`
- `apps/api/src/jobs/appointment-events.postgres.test.ts`
- `apps/api/src/lib/public-tokens.ts`
- `apps/api/src/routes/reviews/review-flow.test.ts`
- `apps/web/app/(dashboard)/reviews/page.tsx`
- `apps/web/app/(dashboard)/reviews/reviews-controller.ts`
- `apps/web/reviews-flow.test.ts`
- `apps/pwa/middleware.ts`
- `apps/pwa/lib/review-session.ts`
- `apps/pwa/app/review/page.tsx`
- `apps/pwa/app/review/session/route.ts`
- `apps/pwa/app/review/review-submission.ts`
- `apps/pwa/review-ingress.test.ts`
- `apps/pwa/review-submission.test.ts`
- `.env.example`
- `compose.yaml`

### Self-review and remaining concern

No blocking finding remains. The lease prevents simultaneous active ownership in normal provider latency and stale workers cannot overwrite a newer claim. As with any lease-based external side effect, a provider call that remains unresolved beyond five minutes can be retried after lease expiry; Task 6 should preserve the stable token/claim semantics and add provider-native idempotency keys where supported.
