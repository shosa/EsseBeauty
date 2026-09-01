# Customer Waitlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a useful salon waitlist and let PWA customers join it when their selected booking day is full.

**Architecture:** Extend the existing waitlist record with a time preference, harden its public and authenticated API contracts, then consume that contract in the PWA and dashboard. Keep slot release notification in the existing appointment event hook, adding explicit date, staff, and time-band matching.

**Tech Stack:** TypeScript, Next.js, React, Fastify, Drizzle ORM, PostgreSQL, Vitest

**Spec:** `docs/superpowers/specs/2026-09-01-customer-waitlist-design.md`

## Global Constraints

- Preserve all unrelated worktree changes.
- Supported time preferences are exactly `any`, `morning`, `afternoon`, and `evening`.
- Morning is before 12:00, afternoon is 12:00–17:59, and evening begins at 18:00 in the salon-facing local time.
- Joining the waitlist never creates or reserves an appointment.
- The PWA waitlist CTA is visible only when the salon waitlist module is enabled.
- Mobile waitlist management must not require horizontal scrolling.

---

### Task 1: Waitlist persistence contract

**Files:**
- Modify: `packages/db/schema.ts`
- Create: `packages/db/migrations/0037_waitlist_time_preference.sql`
- Modify: `packages/db/migrations/meta/_journal.json`
- Test: `apps/api/src/routes/waitlist/waitlist.postgres.test.ts`

**Interfaces:**
- Produces: `waitlistEntries.timePreference` with TypeScript union `"any" | "morning" | "afternoon" | "evening"`, database default `any`, and non-null storage.

- [ ] **Step 1: Write a failing persistence test**

Insert a waitlist entry without a time preference and assert the returned row contains `timePreference: "any"`; insert another with `evening` and assert it round-trips unchanged.

- [ ] **Step 2: Run the targeted test and confirm the missing-column failure**

Run: `pnpm --filter @esse-beauty/api test -- waitlist/waitlist.postgres.test.ts`

- [ ] **Step 3: Add the schema field and migration**

Add a text column named `time_preference`, backfill existing rows to `any`, apply a check constraint for the four supported values, set the default, and make it non-null. Append migration `0037` to the journal without changing the existing uncommitted `0036` entry.

- [ ] **Step 4: Run the persistence test and database type check**

Run: `pnpm --filter @esse-beauty/api test -- waitlist/waitlist.postgres.test.ts`

Run: `pnpm --filter @esse-beauty/db typecheck`

### Task 2: Public and administrative waitlist API

**Files:**
- Modify: `apps/api/src/routes/waitlist/index.ts`
- Modify: `apps/api/src/routes/public/index.ts`
- Test: `apps/api/src/routes/waitlist/waitlist.postgres.test.ts`

**Interfaces:**
- Consumes: `waitlistEntries.timePreference` from Task 1.
- Produces: public profile field `capabilities.waitlist: boolean`.
- Produces: public request body `{ service_id, staff_id?, requested_date, time_preference, customer }`.
- Produces: administrative rows containing ids, contact fields, service/staff display values, `time_preference`, `requested_date`, `status`, and `created_at`.

- [ ] **Step 1: Add failing API tests**

Cover valid creation; invalid/past date; foreign or inactive service; foreign/unqualified staff; missing required contact; invalid preference; duplicate active request; disabled module; cross-tenant mutations; date-range filtering; and legal/illegal status transitions.

- [ ] **Step 2: Run the tests and confirm current validation failures**

Run: `pnpm --filter @esse-beauty/api test -- waitlist/waitlist.postgres.test.ts`

- [ ] **Step 3: Implement boundary validation and customer reuse**

Parse and validate the request before writes. Resolve service and staff within the salon, apply PWA contact settings and booking horizon, find an existing customer by normalized phone or normalized lowercase email, and reject duplicate `waiting` or `notified` entries with HTTP 409 and `WAITLIST_DUPLICATE`.

- [ ] **Step 4: Harden management queries and transitions**

Validate query filters, compare date filters as salon-day ranges, enforce the URL salon id, return HTTP 400 for invalid transitions, and include all dashboard fields in list results.

- [ ] **Step 5: Expose waitlist capability in the public profile**

Resolve the module flag inside the existing public salon response and return `capabilities: { waitlist: boolean }` without exposing the module registry.

- [ ] **Step 6: Run API tests and type checking**

Run: `pnpm --filter @esse-beauty/api test -- waitlist/waitlist.postgres.test.ts`

Run: `pnpm --filter @esse-beauty/api typecheck`

### Task 3: Compatible-slot notification matching

**Files:**
- Modify: `apps/api/src/jobs/appointment-events.ts`
- Modify: `apps/api/src/jobs/appointment-events.postgres.test.ts`

**Interfaces:**
- Consumes: time preference values and existing appointment cancellation event.
- Produces: one notification for the oldest compatible `waiting` entry and a prefilled PWA booking URL.

- [ ] **Step 1: Add failing matching tests**

Create entries across different services, dates, staff preferences, and time bands. Cancel one appointment and assert only the oldest compatible request becomes `notified`; also assert a failed send restores `waiting`.

- [ ] **Step 2: Run the focused job test and observe incompatible matching**

Run: `pnpm --filter @esse-beauty/api test -- appointment-events.postgres.test.ts`

- [ ] **Step 3: Implement time-band and prefilled-link matching**

Filter by released slot local hour, matching date range, service, and nullable staff preference; order by creation time and limit to one. Build the link with `serviceId`, `date`, and optional `staffId` query parameters.

- [ ] **Step 4: Run the focused test suite**

Run: `pnpm --filter @esse-beauty/api test -- appointment-events.postgres.test.ts`

### Task 4: Customer PWA waitlist flow

**Files:**
- Modify: `apps/pwa/app/[slug]/book/page.tsx`
- Create: `apps/pwa/waitlist-booking.test.ts`

**Interfaces:**
- Consumes: public profile `capabilities.waitlist` and public waitlist POST contract.
- Produces: full-day callout, preference/contact form, and waitlist confirmation state.

- [ ] **Step 1: Write failing PWA tests**

Assert that no available slots plus enabled capability renders `Entra in lista d’attesa`; disabled capability omits it; preference selection and contact data produce the documented POST payload; success renders a non-booking confirmation; API errors remain actionable.

- [ ] **Step 2: Run the PWA test and confirm the flow is absent**

Run: `pnpm --filter @esse-beauty/pwa test -- waitlist-booking.test.ts`

- [ ] **Step 3: Add waitlist-specific state and full-day callout**

Distinguish `slots.length === 0` from an array containing unavailable slots, show the explanatory callout adjacent to the grid, and make the primary CTA at least 44px high.

- [ ] **Step 4: Add the preference and contact form**

Reuse selected service/date/staff, render four labelled preference choices, enforce existing contact requirements, submit to `/api/public/:slug/waitlist`, prevent double submission, and show field/API feedback near the form.

- [ ] **Step 5: Add the dedicated confirmation state**

Explain that the request is in the queue, availability is not guaranteed, and the salon will use the supplied contact. Provide a link back to the salon home.

- [ ] **Step 6: Run tests and type checking**

Run: `pnpm --filter @esse-beauty/pwa test -- waitlist-booking.test.ts`

Run: `pnpm --filter @esse-beauty/pwa typecheck`

### Task 5: Operational waitlist dashboard

**Files:**
- Modify: `apps/web/app/(dashboard)/waitlist/page.tsx`
- Create: `apps/web/waitlist-page.test.ts`

**Interfaces:**
- Consumes: administrative list, PATCH, and DELETE contracts from Task 2.
- Produces: responsive waitlist queue with summary, filters, contacts, statuses, and guarded actions.

- [ ] **Step 1: Write failing dashboard tests**

Assert summary counts, filtering controls, mail/phone links, time preference labels, responsive record markup, transition actions, confirmation before deletion, pending disabled state, empty states, and visible request errors.

- [ ] **Step 2: Run the web test and confirm the operational UI is absent**

Run: `pnpm --filter @esse-beauty/web test -- waitlist-page.test.ts`

- [ ] **Step 3: Implement reliable loading and feedback**

Replace the unchecked fetch chain with explicit loading/error states and response validation. Keep the previous list during mutations, disable only the affected row, and show success/error feedback near the workspace.

- [ ] **Step 4: Add summaries and server-backed filters**

Render status counters and controls for status/date/service; update the query string passed to the list endpoint and distinguish a globally empty queue from filters with no results.

- [ ] **Step 5: Build responsive operational records**

Use a desktop table at wide breakpoints and stacked semantic records on narrow screens. Show customer contacts, requested date/time band, staff, age, and status with text labels independent of color.

- [ ] **Step 6: Add guarded workflow actions**

Offer only legal next states, confirm deletion, use at least 44px controls, and reload or update local state only after successful responses.

- [ ] **Step 7: Run tests and type checking**

Run: `pnpm --filter @esse-beauty/web test -- waitlist-page.test.ts`

Run: `pnpm --filter @esse-beauty/web typecheck`

### Task 6: Integrated verification

**Files:**
- Verify all files changed in Tasks 1–5.

**Interfaces:**
- Consumes: completed database, API, matching, PWA, and dashboard work.
- Produces: evidence that the end-to-end feature is releasable.

- [ ] **Step 1: Run all focused tests together**

Run: `pnpm --filter @esse-beauty/api test -- waitlist/waitlist.postgres.test.ts appointment-events.postgres.test.ts`

Run: `pnpm --filter @esse-beauty/pwa test -- waitlist-booking.test.ts`

Run: `pnpm --filter @esse-beauty/web test -- waitlist-page.test.ts`

- [ ] **Step 2: Run workspace validation**

Run: `pnpm typecheck`

Run: `pnpm lint`

- [ ] **Step 3: Inspect the final diff**

Run: `git diff --check`

Run: `git status --short`

Confirm that unrelated pre-existing changes are not included in the waitlist implementation commit.
