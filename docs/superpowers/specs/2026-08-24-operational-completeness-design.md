# Operational Completeness Design

**Date:** 2026-08-24
**Status:** Approved in conversation
**Scope:** EsseBeauty web dashboard, customer PWA, staff PWA, API, workers, database, security and automated verification.

## Objective

Turn every exposed EsseBeauty workflow into an honest, persistent and testable operation. A control must either perform the promised operation and report its durable result, or explain precisely which external configuration or permission is missing. The application must not present decorative controls, fake success states, broken links or database-only features as completed functionality.

## Delivery Strategy

Work proceeds in independently releasable vertical slices. Each slice includes database changes, API validation and authorization, user interface, failure states, behavioral tests and a focused commit. Existing route URLs and salon data remain compatible. Provider-dependent operations fail closed when credentials are unavailable.

The delivery order is:

1. Security and correctness foundation.
2. Documents and consents.
3. Reviews and review invitations.
4. Email/SMS communications.
5. Password recovery and login activity.
6. Saved views, loyalty tiers, campaign templates and inventory reorders.
7. Integration, import/export and notification settings.
8. Shell cleanup, end-to-end verification and dependency hardening.

## Cross-Cutting Contracts

### Runtime validation

Every mutating endpoint and authentication endpoint receives a runtime schema. Invalid input returns a stable `400` response with an application error code and field details; it never reaches a database query or produces an incidental `500`. Dates, UUIDs, emails, phone numbers, enums, amounts and lengths are validated centrally.

### Tenant and permission isolation

Every read and mutation is scoped by `salonId` and, where applicable, by the target user or role. Navigation definitions declare required permissions in addition to module keys. Rail, launcher, context tabs, quick actions and global search omit destinations the current user cannot access. Direct requests remain protected by the API.

### Honest asynchronous state

Queued work uses durable states: `draft`, `scheduled`, `queued`, `processing`, `completed`, `partial`, `failed` and `cancelled` where applicable. A campaign is never marked sent when jobs were only enqueued. Workers update recipient-level results and then aggregate the parent status. Retries are bounded and errors are retained for operators.

### External providers

Resend provides email and Twilio provides SMS. Provider configuration is checked without exposing secrets. The UI shows configured, incomplete or unavailable status and supports a test delivery. Missing credentials prevent real sending and return `PROVIDER_NOT_CONFIGURED`; they do not produce a success message. Development tests use injected provider adapters, never live deliveries.

### Auditability

Sensitive events record actor, salon, entity, outcome and timestamp: consent signing/revocation, review publication/reply, campaign scheduling/cancellation, password reset and integration-setting changes. Audit records never contain raw passwords, session tokens, provider secrets or full signature images.

## Security and Correctness Foundation

- Global search routes services to `/settings/services/:serviceId` and staff to `/settings/staff/:staffId`.
- Home notifications without a destination render as tasks, not `#` links.
- Notification read/archive mutations apply the same user-or-role visibility predicate as notification listing.
- Public review and consent actions use random, hashed, expiring, purpose-specific tokens. Raw tokens exist only in outbound URLs.
- The public review payload omits unnecessary customer personal data.
- API request bodies receive runtime schemas, starting with auth, platform, appointments, sales, documents, reviews and marketing.
- Direct runtime dependencies are upgraded to patched compatible releases. The old `next-pwa` dependency chain is replaced or isolated if it cannot be upgraded safely.

## Documents and Consents

### Template lifecycle

Owners can create, preview, activate and archive consent templates. A signed template version is immutable. Editing a used template creates the next version and preserves prior text. A template may be required for selected services.

### Assignment lifecycle

From a customer or appointment, an authorized user selects a template and creates a pending consent request. The request records customer, optional appointment, immutable template version, expiry and delivery channel. The customer receives a secure link or the operator may open an in-person signing surface.

### Signing lifecycle

The customer sees salon identity, document title, exact version and complete text, then provides explicit acceptance and a typed or drawn signature. The server records acceptance timestamp, signer name, signature representation, document hash and request metadata. The result becomes visible on both customer and appointment detail pages. Authorized users can revoke a consent with a reason; revocation never deletes the original evidence.

### Document operations

The dashboard supports template filtering, version history, service requirements, pending/signed/expired/revoked status and re-send. It corrects all mojibake and uses Italian copy. Export produces a printable record containing the accepted text and evidence; generated content contains no invented legal certification.

## Reviews

### Invitation

Completing an eligible appointment enqueues one review invitation. The invitation has a hashed token, expiry, channel, delivery status and attempt count. Duplicate appointment events remain idempotent.

### Submission

The public PWA resolves only a valid token, displays minimal appointment context, accepts one rating from 1 to 5 and an optional bounded comment, and consumes the token after submission. Expired, consumed and revoked tokens have distinct responses.

### Management and publication

The dashboard loads reviews with explicit loading/error states, supports reply, publish/private state and filtering, and reports mutation failures without closing dialogs. Publication requires the appropriate permission. Public salon pages show only published reviews and never expose private replies or customer identifiers beyond an approved display name.

## Communications

### Campaign authoring

Campaigns support email or SMS, reusable templates, validated segment rules, sender preview and recipient preview before confirmation. Invalid or missing destinations are excluded with visible counts. SMS length is calculated using the same normalization used by the provider adapter.

### Scheduling and sending

Sending creates recipient rows and queued batches transactionally. Scheduled campaigns can be cancelled before processing. Workers use injected provider adapters, bounded retry with backoff and idempotency keys. Recipient statuses include queued, sent, delivered when provider data is available, and failed with a sanitized reason.

### Monitoring

The campaign detail page shows provider readiness, recipient totals, queued/processed/sent/failed counts, last update, errors and retry of failed recipients. Parent status is derived from recipients. A test-send operation targets one explicitly entered destination and is kept separate from campaign statistics.

### Operational notifications

Reminder failures, low stock, pending reviews and waitlist matches create real in-app notifications from the owning domain event. The test that currently says integrations “will publish later” is replaced by behavioral coverage of actual publishers.

## Authentication and Access Operations

- “Password dimenticata” creates a short-lived, single-use hashed reset token and sends an email through the provider adapter.
- Reset completion revokes all existing sessions and records login activity.
- Login activity records success/failure, timestamp and minimal request metadata with a retention policy; it does not store passwords.
- Responses do not disclose whether an email address exists.
- Platform and salon-owner reset flows share validation rules but retain separate authorization boundaries.

## Remaining Product Capabilities

### Saved views

Users can save named filter/view state for list and calendar surfaces, set a default and delete their own views. State is validated per surface and scoped by user and salon.

### Loyalty tiers

Owners configure ordered, non-overlapping point thresholds with a name and benefits text. Customer loyalty summaries resolve the current tier and next threshold. Tier changes do not rewrite point history.

### Campaign templates

Users can create, edit, archive and apply email/SMS templates. Applying a template copies content into a campaign so later template edits do not alter scheduled work.

### Inventory reorder requests

Low-stock products can create a reorder request with quantity, supplier note and lifecycle `draft`, `ordered`, `received` or `cancelled`. Receiving creates an inventory movement in the same transaction and cannot be applied twice.

### Integrations, data exchange and notification preferences

Existing settings APIs receive complete dashboard surfaces. Integrations expose configuration metadata and status but never return stored secrets. Imports use preview, validation and explicit commit; exports are scoped and auditable. Notification preferences control channel/category/role and quiet hours and are enforced by workers.

## Shell and Accessibility

Legacy sidebar components and unused collapsed-navigation requests are removed from `DashboardShell`. Search, notifications and command palette live in focused components. Modal surfaces trap focus, restore focus to their trigger, close with Escape and prevent background interaction. All app destinations remain usable at desktop and mobile widths.

## Error Handling

- UI mutations check HTTP status and application error codes before changing local success state.
- Retryable provider or queue failures remain retryable; validation and permission failures do not retry.
- Transactions cover operations that create both parent and child records or mutate balances/status together.
- Unexpected errors receive a correlation ID in server logs while clients receive a stable generic error.
- Empty states distinguish no data, disabled module, missing permission and load failure.

## Testing and Acceptance

Each vertical slice follows red-green-refactor and includes:

- Pure tests for validators, tokens, status aggregation and provider adapters.
- Fastify injection tests exercising authorization, tenant isolation, invalid bodies and durable state.
- PostgreSQL/Redis integration tests for transactions, queues and idempotency.
- Browser end-to-end tests for owner and restricted employee roles.
- Provider contract tests with injected fakes; no live email/SMS during CI.
- Encoding scan across all user-facing source files.
- Route-link contract ensuring every generated internal href resolves to an application route.

Release acceptance requires all repository tests, typechecks and builds to pass; production dependency audit must contain no known high-severity issue in a runtime-reachable direct dependency. Visual verification covers Home, Agenda, Cassa, Clienti, Documenti, Recensioni, Marketing, Inventario and Impostazioni at 1440×900 and 390×844.

## Compatibility and Reversibility

Existing public dashboard routes and stored records remain valid. New columns are nullable or backfilled before becoming required. Migrations are forward-only and do not destroy user data. Each vertical slice ends in a focused commit on `codex/app-oriented-ui-implementation`, which remains separate from `main` until explicitly integrated.
