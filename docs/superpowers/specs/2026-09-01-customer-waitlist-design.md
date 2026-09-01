# Customer Waitlist Design

## Objective

Turn the existing waitlist module into an operational queue and allow customers to request a place in it from the booking PWA when their selected day has no available slots.

## Customer flow

The customer selects a service, an optional staff preference, and a date through the existing booking flow. When the slots response contains no available times, the time step must explain that the day is full and offer a primary call to action labelled `Entra in lista d’attesa`.

The waitlist flow reuses the selected service, date, and optional staff member. The customer chooses one of four time preferences: `Qualsiasi orario`, `Mattina`, `Pomeriggio`, or `Sera`, then provides their name and at least one contact method. Existing PWA settings still determine whether email or phone is required. Submission creates a waitlist request, not an appointment, and ends on a dedicated confirmation state explaining that availability is not guaranteed and that the salon will contact the customer if a compatible slot opens.

The waitlist call to action is shown only when the waitlist module is enabled for the salon. The public salon profile will expose this capability without leaking administrative module details.

## Data model

Extend `waitlist_entries` with a non-null `time_preference` enum-like text value whose supported values are `any`, `morning`, `afternoon`, and `evening`. Existing rows are backfilled with `any`.

The existing fields remain authoritative for salon, service, optional staff, customer, requested date, status, and creation time. A waitlist request applies to the local calendar date represented by `requested_date`; matching compares by the salon day rather than exact timestamp equality.

## API behavior

`POST /api/public/:slug/waitlist` validates all input at the boundary:

- the salon exists, online booking is enabled, and the waitlist module is enabled;
- the requested date is valid, is not in the past, and respects the salon booking horizon;
- the service is active and belongs to the salon;
- an optional staff member belongs to the salon and can perform the service;
- the time preference is one of the supported values;
- the customer has a non-empty name and the contact fields satisfy salon PWA requirements;
- the same contact, service, date, staff preference, and active status do not already form a duplicate request.

The endpoint should reuse or update an existing salon customer when the normalized phone or normalized email identifies one, rather than creating duplicate customer records. It returns a small public response with request id, status, requested date, and time preference.

The administrative list endpoint returns identifiers and display fields required by the dashboard, supports status/date/service filters, and sorts actionable requests by requested date then creation time. Invalid filters and state transitions receive a 400 response. Mutation routes enforce the path salon id as well as authenticated tenant scope.

## Slot matching and notifications

When an appointment is cancelled or moved away, the existing hook looks for the first `waiting` entry matching the salon, service, local date, optional staff, and time preference. Time bands are:

- morning: before 12:00;
- afternoon: 12:00 through 17:59;
- evening: from 18:00;
- any: no time restriction.

Only one compatible waiting request is notified for a released slot. Successful delivery moves it to `notified`; failed delivery restores `waiting`. The notification links back to the booking flow prefilled with the service, date, and optional staff. A notification does not reserve the slot.

## Salon dashboard

`/waitlist` becomes an operational workspace with:

- summary counts for waiting, notified, booked, and expired requests;
- filters for status, date, and service;
- a responsive table on desktop and readable stacked records on narrow screens;
- customer name and direct contact links, requested service/date/time band, staff preference, current status, and request age;
- actions to notify, mark booked, expire, restore to waiting, and delete with confirmation;
- loading, empty, filtered-empty, success, and error feedback close to the affected content.

Actions are disabled while pending and state changes are announced through visible text, not color alone. Destructive deletion is visually distinct and requires confirmation.

## Accessibility and responsive behavior

All interactive controls have a minimum 44px target, visible keyboard focus, persistent labels, and meaningful disabled explanations. The empty-day message and waitlist CTA are grouped together. Mobile content must not require horizontal scrolling; desktop tabular alignment is preserved where it improves scanning.

## Testing

Add database-backed API coverage for public creation, validation, duplicate prevention, tenant isolation, filtering, transitions, and time-band matching. Add PWA component/source-level tests for the full-day CTA, waitlist form payload, module-disabled state, and confirmation. Add dashboard tests for summary/filter/action rendering and API error handling. Run relevant package tests, type checks, and lint/build checks available in the workspace.

## Non-goals

This version does not reserve released slots, create appointments automatically, rank customers by business value, or add a customer account page for managing requests.
