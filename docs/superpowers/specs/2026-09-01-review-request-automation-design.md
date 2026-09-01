# Review Request Automation Design

## Objective

Make salon reviews genuinely collectible by turning the existing secure review invitation infrastructure into a configurable, observable workflow. Salons can automatically request a review after a completed appointment, choose one or more delivery channels, and manually send or resend requests from `/reviews`.

## Existing foundation

The implementation must reuse the current signed, purpose-scoped public tokens, durable `review_invitations`, `/review` PWA page, delivery queue, retry protection, and appointment-completion hook. Appointment identifiers must never be used as public credentials or exposed as guessable review URLs.

## Salon configuration

Each salon has one review-request policy containing:

- `automaticEnabled`: whether completing an appointment schedules a request;
- `delayPreset`: exactly one of `immediate`, `one_hour`, `three_hours`, `next_day`, or `two_days`;
- `channels`: a non-empty set containing `email`, `whatsapp`, or both;
- `updatedAt` and the user responsible for the last change.

Preset semantics are:

- `immediate`: eligible for delivery as soon as completion is persisted;
- `one_hour`: completion time plus 60 minutes;
- `three_hours`: completion time plus 180 minutes;
- `next_day`: 10:00 on the following calendar day in the salon timezone;
- `two_days`: 10:00 two calendar days later in the salon timezone.

The configuration UI must explain when a selected channel cannot currently deliver. Email requires an email address on the customer; WhatsApp requires a phone number, transactional consent where required by the existing communication policy, and a ready salon provider. Saving WhatsApp as a desired channel is allowed even if the provider is not ready, but the UI displays the blocking state and deliveries remain visibly skipped rather than silently disappearing.

## Invitation and delivery model

One logical invitation remains unique per appointment. An invitation owns one delivery record per requested channel and delivery generation. Each delivery records channel, scheduled time, status, attempt count, delivered time, failure reason, and generation.

Supported delivery states are `scheduled`, `queued`, `processing`, `delivered`, `failed`, `skipped`, and `exhausted`. Email and WhatsApp progress independently: one channel can succeed while the other fails. The logical invitation is considered contacted when at least one selected channel is delivered.

The raw review token is generated only at delivery time and is never stored in plaintext, logged, placed in queue payloads, or returned by authenticated management APIs. Both channels in the same generation lead to the same logical invitation and token identity while remaining independently traceable. Submitting the review consumes the invitation, and all later channel attempts for it become ineligible.

## Automatic workflow

When an appointment transitions to `completed`, the appointment event hook reads the salon policy. If automation is enabled, it creates or repairs the unique invitation, creates the selected per-channel delivery records, calculates their schedule from the persisted completion transition time, and enqueues delayed jobs using stable idempotency keys.

Repeated completion events, worker restarts, or queue-add failures must not produce duplicate invitations or duplicate deliveries. Recovery scans durable scheduled or failed deliveries and re-enqueues only eligible records.

Appointments completed while automation is disabled are not retroactively scheduled when it is later enabled. They remain available for manual sending.

## Manual send and resend

`/reviews` lists completed appointments relevant to review collection, including appointments never contacted, scheduled, partially delivered, delivered, failed, or already reviewed.

For an appointment never contacted, `Invia ora` opens a dialog showing the customer, appointment, and channel choices. The salon can select any currently configured policy channels for which the customer has a usable contact. Confirming creates or repairs the invitation and queues the selected channels immediately.

For an appointment already contacted, `Reinvia` requires explicit confirmation and displays the last delivery time, channels, and outcomes. Confirming increments the delivery generation and queues new channel deliveries. Reusing the same appointment never creates a second logical invitation or a second review. Resend is unavailable after the invitation has been consumed by a submitted review.

## Management API

Authenticated endpoints under `/api/salons/:id/reviews` provide:

- GET and PATCH for the salon request policy;
- a paginated collection queue filtered by collection state, date range, service, and channel;
- POST send-now for a completed appointment and selected channels;
- POST resend for an existing unconsumed invitation and selected channels;
- the existing moderation operations for received reviews.

All routes enforce authenticated salon scope, review-management permission, module enablement, legal channel values, completed appointment eligibility, and customer ownership. Duplicate requests return the current resource rather than scheduling duplicate work. APIs return safe public/management fields only and never raw tokens.

## `/reviews` workspace

The page has two clear areas:

1. `Raccolta recensioni`: configuration card for automatic requests, five delay presets, Email and WhatsApp multi-select controls, provider/contact guidance, save feedback, and the operational request queue.
2. `Recensioni ricevute`: the existing moderation list and publication workflow.

The request queue shows appointment date, customer, service, selected channels, scheduled time, channel-level outcomes, and most recent attempt. Actions are `Invia ora` or `Reinvia` as applicable. Manual actions use confirmation dialogs and disable while pending. Filters and empty states distinguish no completed appointments, no matches, and no requests yet.

On narrow screens, records use stacked cards; desktop uses a scannable table. Controls have at least 44px targets, visible labels and focus, and status meaning is communicated with text rather than color alone.

## Public review experience

The existing `/review` PWA route remains the sole public entry point. It resolves the token, displays salon, treatment, and appointment context without sensitive internal data, accepts the rating and optional comment, and consumes the invitation atomically with review creation. Expired, revoked, consumed, malformed, and wrong-purpose tokens receive distinct actionable states without revealing whether arbitrary appointment identifiers exist.

## Error handling and observability

Configuration and manual-send errors are presented adjacent to the affected area. Channel failures retain a safe reason code such as `missing_contact`, `provider_not_ready`, `consent_missing`, `provider_failure`, or `attempts_exhausted`. No provider secret or raw error payload reaches the browser.

Delivery operations use stable idempotency keys containing invitation, channel, generation, and attempt. Activity records capture configuration changes, manual sends, resends, and review receipt. Existing recovery and retry ceilings remain authoritative.

## Testing

Add database-backed coverage for policy isolation, preset calculation including salon-local next-day behavior, automatic enable/disable, multi-channel delivery independence, idempotent completion events, manual send, confirmed resend, consumed-invitation rejection, missing contacts, provider readiness, recovery, and raw-token secrecy.

Add dashboard contract/component coverage for policy controls, disabled-channel guidance, queue states, confirmations, channel-level outcomes, responsive records, and received-review separation. Preserve and run existing public token, delivery, review ingress, moderation, and appointment completion tests.

## Non-goals

This version does not post automatically to Google or other third-party review platforms, generate AI responses, send recurring campaigns to historical customers, allow anonymous review links, or expose raw tokens to salon operators.
