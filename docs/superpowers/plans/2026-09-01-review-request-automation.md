# Review Request Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let salons configure and operate automatic or manual multi-channel review requests for completed appointments.

**Architecture:** Extend the durable review invitation pipeline with salon policy and per-channel delivery records. Appointment completion, manual send, resend, recovery, and the `/reviews` workspace all consume the same idempotent scheduling service; the public token flow remains unchanged and secret-safe.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM, PostgreSQL, BullMQ, Next.js, React, Vitest

**Spec:** `docs/superpowers/specs/2026-09-01-review-request-automation-design.md`

## Global Constraints

- Preserve all unrelated worktree changes and never stage them with this feature.
- Public URLs use the existing purpose-scoped review tokens; appointment ids are never credentials.
- Delay presets are exactly `immediate`, `one_hour`, `three_hours`, `next_day`, and `two_days`.
- Channels are an explicit non-empty subset of `email` and `whatsapp`; both may be scheduled simultaneously.
- One logical invitation remains unique per appointment.
- Raw review tokens never enter database plaintext, logs, management responses, or queue payloads.

---

### Task 1: Persist review policy and channel deliveries

**Files:**
- Modify: `packages/db/schema.ts`
- Create: `packages/db/migrations/0038_review_request_automation.sql`
- Modify: `packages/db/migrations/meta/_journal.json`
- Create: `apps/api/src/jobs/review-policy.test.ts`

**Interfaces:**
- Produces: `ReviewDelayPreset = "immediate" | "one_hour" | "three_hours" | "next_day" | "two_days"`.
- Produces: salon policy fields `automaticEnabled`, `delayPreset`, `channels`, `updatedByUserId`, `updatedAt`.
- Produces: delivery identity `(invitationId, channel, generation)` and channel-level delivery state.

- [ ] **Step 1: Write failing schema and preset tests**

Assert schema exports policy/delivery tables, channel-generation uniqueness, and a pure `scheduledReviewTime(completedAt, preset, timezone)` contract with exact preset outputs.

- [ ] **Step 2: Run the tests and confirm missing contracts fail**

Run: `pnpm --filter @esse-beauty/api test -- review-policy.test.ts`

- [ ] **Step 3: Add schema and migration**

Create tenant-owned `review_request_settings` and `review_invitation_deliveries`. Backfill every salon lazily through defaults rather than inserting rows for all tenants. Use database checks for presets, channels, states, generation, and attempts.

- [ ] **Step 4: Implement and verify preset calculation**

Export `scheduledReviewTime(completedAt: Date, preset: ReviewDelayPreset, timezone: string): Date`. Calendar-day presets resolve 10:00 in the salon timezone; elapsed-hour presets add milliseconds.

- [ ] **Step 5: Run tests and database build**

Run: `pnpm --filter @esse-beauty/api test -- review-policy.test.ts`

Run: `pnpm --filter @esse-beauty/db build`

### Task 2: Unify automatic scheduling and multi-channel delivery

**Files:**
- Modify: `apps/api/src/jobs/reviews.ts`
- Modify: `apps/api/src/jobs/appointment-events.ts`
- Modify: `apps/api/src/jobs/reviews-delivery.postgres.test.ts`
- Modify: `apps/api/src/jobs/reviews-recovery.postgres.test.ts`
- Modify: `apps/api/src/jobs/appointment-events.postgres.test.ts`

**Interfaces:**
- Produces: `scheduleReviewRequest(db, appointmentId, input, queue)` where input contains `channels`, `scheduledAt`, and optional `resend`.
- Produces: stable job id `review-<invitation>-<channel>-<generation>-<attempt>`.
- Consumes: salon policy from Task 1.

- [ ] **Step 1: Add failing database-backed scheduling tests**

Cover automatic disabled, both channels scheduled, one channel missing contact, repeated completion idempotency, independent delivery success/failure, and no plaintext token in durable data.

- [ ] **Step 2: Run focused delivery and appointment tests**

Run: `pnpm --filter @esse-beauty/api test -- reviews-delivery.postgres.test.ts reviews-recovery.postgres.test.ts appointment-events.postgres.test.ts`

- [ ] **Step 3: Implement the idempotent scheduling service**

Keep `ensureReviewInvitation` as the logical invitation boundary. Insert one per-channel delivery per generation with conflict protection and enqueue at `scheduledAt` using the stable job id.

- [ ] **Step 4: Update delivery and recovery workers**

Claim, send, fail, retry, exhaust, or skip individual delivery rows. Generate the raw token only after a channel claim and preserve existing secure email and WhatsApp boundaries.

- [ ] **Step 5: Apply salon policy in the completion hook**

Read policy after a persisted transition to `completed`; do nothing when disabled; otherwise calculate schedule and call the shared scheduling service.

- [ ] **Step 6: Run focused tests and API typecheck**

Run: `pnpm --filter @esse-beauty/api test -- reviews-delivery.postgres.test.ts reviews-recovery.postgres.test.ts appointment-events.postgres.test.ts`

Run: `pnpm --filter @esse-beauty/api typecheck`

### Task 3: Add review collection management APIs

**Files:**
- Modify: `apps/api/src/routes/reviews/index.ts`
- Create: `apps/api/src/routes/reviews/review-collection.postgres.test.ts`

**Interfaces:**
- Produces: GET/PATCH `/api/salons/:id/reviews/request-settings`.
- Produces: GET `/api/salons/:id/reviews/collection` with pagination and filters.
- Produces: POST `/api/salons/:id/reviews/collection/:appointmentId/send`.
- Produces: POST `/api/salons/:id/reviews/collection/:appointmentId/resend`.

- [ ] **Step 1: Write failing route tests**

Test tenant isolation, valid/invalid policies, completed-only eligibility, selected-channel contact validation, first manual send, confirmed resend, consumed invitation rejection, duplicate idempotency, and safe response fields.

- [ ] **Step 2: Run the new route suite**

Run: `pnpm --filter @esse-beauty/api test -- review-collection.postgres.test.ts`

- [ ] **Step 3: Implement settings routes**

GET returns defaults when no row exists. PATCH validates the complete policy, requires review-management permission, upserts one tenant row, and records the authenticated user.

- [ ] **Step 4: Implement collection query**

Return completed appointments joined to customer, service, invitation, review, and channel deliveries. Derive safe collection state and expose contact/channel availability without returning tokens.

- [ ] **Step 5: Implement manual send and resend**

Validate selected channels and eligibility, schedule immediately through `scheduleReviewRequest`, require `confirm: true` for resend, and reject consumed invitations.

- [ ] **Step 6: Run route tests and API typecheck**

Run: `pnpm --filter @esse-beauty/api test -- review-collection.postgres.test.ts review-flow.test.ts`

Run: `pnpm --filter @esse-beauty/api typecheck`

### Task 4: Build the `/reviews` collection workspace

**Files:**
- Modify: `apps/web/app/(dashboard)/reviews/page.tsx`
- Modify: `apps/web/app/(dashboard)/reviews/reviews-controller.ts`
- Create: `apps/web/review-collection.test.ts`

**Interfaces:**
- Consumes: request settings, collection list, send, and resend APIs from Task 3.
- Preserves: existing received-review moderation and reply behavior.

- [ ] **Step 1: Write failing UI contract tests**

Assert the page separates `Raccolta recensioni` from `Recensioni ricevute`, renders five presets, independent Email/WhatsApp controls, provider guidance, responsive queue records, `Invia ora`, and confirmed `Reinvia`.

- [ ] **Step 2: Run the web test and verify the collection UI is absent**

Run: `pnpm --filter @esse-beauty/web test -- review-collection.test.ts`

- [ ] **Step 3: Extend controller state boundaries**

Add typed settings and collection resources plus isolated mutation state. Keep existing moderation reducer behavior unchanged.

- [ ] **Step 4: Add configuration card**

Render automation switch, five single-choice presets, Email/WhatsApp multi-select, guidance and save feedback. Controls stay labelled, keyboard accessible, and at least 44px high.

- [ ] **Step 5: Add operational collection queue**

Render desktop table and mobile cards with appointment, contact, service, schedule, each channel outcome, and appropriate send/resend action. Use shared confirmation dialog for resend.

- [ ] **Step 6: Preserve received-review workspace**

Rename the existing feedback area to `Recensioni ricevute` and keep metrics, moderation, publication, reply, loading, empty, and failure states intact.

- [ ] **Step 7: Run tests and web typecheck**

Run: `pnpm --filter @esse-beauty/web test -- review-collection.test.ts reviews-flow.test.ts`

Run: `pnpm --filter @esse-beauty/web typecheck`

### Task 5: End-to-end security and regression verification

**Files:**
- Verify all files changed in Tasks 1–4.

**Interfaces:**
- Consumes: the complete review request workflow.
- Produces: evidence for release readiness or an explicit list of unrelated baseline failures.

- [ ] **Step 1: Run all focused review tests**

Run: `pnpm --filter @esse-beauty/api test -- public-tokens.test.ts review-flow.test.ts reviews-delivery.postgres.test.ts reviews-recovery.postgres.test.ts review-collection.postgres.test.ts appointment-events.postgres.test.ts`

Run: `pnpm --filter @esse-beauty/pwa test -- review-ingress.test.ts review-submission.test.ts`

Run: `pnpm --filter @esse-beauty/web test -- review-collection.test.ts reviews-flow.test.ts`

- [ ] **Step 2: Run package type checks**

Run: `pnpm --filter @esse-beauty/api typecheck`

Run: `pnpm --filter @esse-beauty/pwa typecheck`

Run: `pnpm --filter @esse-beauty/web typecheck`

- [ ] **Step 3: Run repository verification**

Run: `pnpm test`

Run: `git diff --check`

If unrelated baseline failures remain, record them exactly and do not claim the full suite is green.
