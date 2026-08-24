# WhatsApp Communications Design

## Goal

Replace every active SMS workflow with the official WhatsApp Business Cloud API and add a durable, tenant-safe communication workspace available from the dashboard topbar.

## Architecture

Each salon owns a Meta provider account whose identifiers and encrypted access token are stored separately from public configuration. Outbound messages are persisted with an outbox before delivery; signed Meta webhooks persist inbound messages and delivery receipts idempotently. The dashboard consumes authenticated REST and SSE endpoints and mounts a route-stable chat drawer in `DashboardShell`.

WhatsApp Web is never embedded or automated. The drawer may expose an explicit external `wa.me`/WhatsApp Web link, while EsseBeauty remains authoritative only for messages exchanged through Cloud API.

## Security and tenancy

- Encrypt provider credentials with AES-256-GCM and tenant/account/provider identifiers as authenticated additional data.
- Never expose tokens, verification secrets, ciphertext, raw webhook bodies or Meta app secrets in DTOs, logs or audit diffs.
- Verify `X-Hub-Signature-256` against the raw request body before parsing webhook payloads.
- Resolve tenants through an opaque webhook key, then require WABA and phone-number IDs to match the stored account.
- Gate reads, replies and configuration with `communications.view`, `communications.reply` and `communications.manage_provider`.
- Preserve Task 8 password recovery as email-only.

## Data model

Migration `0030_whatsapp_communications.sql` follows Task 9 migration `0029`. It adds provider accounts/secrets, purpose-aware communication consents, conversations, messages, durable outbox, webhook event deduplication and per-user chat state. Historical `sms` values remain readable; new product writes use `whatsapp`.

## Provider and policy

The provider registry becomes tenant-aware and asynchronous. WhatsApp sends are either approved templates or free-form session replies within the 24-hour service window. Campaign preview excludes recipients without WhatsApp marketing consent. Provider readiness and errors remain truthful and recoverable.

## Product experience

Owners/managers configure Meta identifiers, encrypted access token, webhook verification and test connectivity in Settings. A topbar WhatsApp control opens an accessible responsive offcanvas containing conversation search, unread counts, stable selected thread/draft, paginated history, delivery states, composer, template picker and retry. SSE provides live updates with reconnect and polling fallback.

## Rollout

First deliver schema, credentials, provider, webhook and outbox; then conversation APIs and chat; then migrate reminders, reviews, waitlist and marketing from SMS. Remove Twilio only after scheduled/queued SMS work no longer exists. Tests use injected fake Meta adapters and signed fixtures—never live Meta calls.

