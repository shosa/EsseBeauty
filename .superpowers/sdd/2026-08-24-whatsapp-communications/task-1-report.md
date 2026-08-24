# Task 1 report — secure WhatsApp provider accounts

Base: `8f4b3c6`

## Delivered

- Added migration `0030_whatsapp_communications.sql` and journal entry after `0029`.
- Added tenant-scoped provider account/secret, purpose-aware consent, conversation, message, outbox, webhook-event and per-user chat-state schema.
- Added provider/message lifecycle enums, globally unique Meta identifiers, webhook dedupe, outbound idempotency and bounded non-negative outbox attempts.
- Added AES-256-GCM credential encryption with a random 96-bit IV, authentication tag, versioned key lookup and salon/account/provider AAD.
- Added `communications.view`, `communications.reply` and `communications.manage_provider`; receptionists can view/reply by default but cannot change provider credentials.
- Added masked GET and encrypted PUT routes at `/api/salons/:id/communications/provider`, with tenant checks and safe conflict/error DTOs.
- Added recursive audit redaction for access tokens, verification tokens, ciphertext and GCM tags.
- Added the functional dashboard page `/settings/communications` and its Settings navigation entry.
- Left password recovery on the existing email-only provider seam and did not modify loyalty behavior.

## TDD evidence

- RED: focused crypto suite failed because `provider-credentials.js` did not exist; settings suite returned route `404`.
- GREEN: `provider-credentials`, provider settings and audit-secret suites pass (`7/7`).

## Verification

- Migration `0030` applied successfully to the local PostgreSQL container.
- Focused WhatsApp plus password-recovery and loyalty regression tests: `16/16` passed.
- `@esse-beauty/db` typecheck: passed.
- `@esse-beauty/shared` typecheck: passed.
- `@esse-beauty/api` typecheck and build: passed.
- `@esse-beauty/web` typecheck and production build: passed; `/settings/communications` generated successfully.

The pre-existing password-recovery suite emitted Redis `NOAUTH` stderr from the local container configuration, but all three recovery tests passed and the process exited successfully.
