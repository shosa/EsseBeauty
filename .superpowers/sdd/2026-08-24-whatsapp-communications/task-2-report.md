# Task 2 report — Cloud API, signed webhook and durable outbox

Base: `d4c5812`

## Delivered

- Added the official Meta WhatsApp Cloud API adapter with template and 24-hour session payloads, normalized phone destinations and safe provider error codes.
- Added tenant-aware credential resolution using the encrypted access-token contract from Task 1; no provider response body or credential is surfaced in errors.
- Added `GET|POST /api/webhooks/whatsapp/:webhookKey` with tenant verification challenges, constant-time `X-Hub-Signature-256` validation against the raw body before JSON parsing, WABA/phone ownership checks and redacted webhook-event persistence.
- Added idempotent inbound-message persistence and monotonic delivery receipt handling.
- Added transactional message/outbox creation with per-account idempotency, durable queue wake-up recovery, claim leases, bounded attempts and terminal exhaustion.
- Added the BullMQ communications queue, worker, recovery scheduler and clean API worker lifecycle integration.
- Preserved existing email/SMS registry behavior for the later controlled Task 4 migration; password recovery remains email-only.

## TDD evidence

- RED: the focused provider, webhook and outbox suites failed because the three production modules did not exist.
- GREEN: the three new focused suites pass (`8/8`).

## Verification

- Focused WhatsApp provider/webhook/outbox suites: passed.
- Existing provider settings, communication registry and password recovery regressions: passed.
- API app bootstrap tests: passed.
- API typecheck and production build: passed.
- DB typecheck: passed.
- Tests use injected fake Graph responses; no live Meta call is made.

The local Redis container still emits the pre-existing `NOAUTH` diagnostic in password-recovery/app tests, while those suites pass.
