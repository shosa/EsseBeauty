# Advertising Demo Salon Design

## Objective

Create a realistic, data-rich EsseBeauty salon named `Demo` that can be used as a public product demonstration. The demo must be installable on the configured database through a repeatable command and must continuously present useful historical, current, and future data.

## Chosen approach

Implement a deterministic TypeScript generator that uses the current Drizzle schema and the application's password-hashing behavior. A TypeScript generator is preferred over a SQL dump because it can safely build relative dates, enforce relational consistency, evolve with the schema, and produce the same scenario on every execution.

## Identity and access

- Salon name: `Demo`.
- Reserved salon slug: `demo`.
- Owner login: `demo@demo.com`.
- Owner password: `demo123456`.
- The account is active and immediately usable without a forced password change.
- All customer, staff, supplier, and communication identities are fictional. Generated email domains and telephone numbers must not identify real people.

## Regeneration semantics and safety

The seed is intentionally regenerative rather than additive. Each run replaces only the reserved Demo tenant, then reconstructs its data relative to the execution date.

- The script must never delete or mutate another salon.
- Before deletion, the existing record must match the reserved slug and expected demo owner identity. An inconsistent match aborts the run.
- Replacement happens in a database transaction so a failed generation cannot leave a partially rebuilt demo.
- Tenant-owned child records are removed through verified foreign-key cascades or explicit tenant-scoped deletion.
- Platform-wide catalog and plan records are reused and are not reset.
- The deterministic random seed produces reproducible identities, relationships, values, and distributions for a given date anchor.
- A dry-run or validation mode must allow safety and generated-volume checks without deleting data.

## Timeline

All dates derive from a single execution-date anchor in the `Europe/Rome` business timezone.

- Historical operational activity must be sufficient to populate dashboards and trends.
- Future appointments cover the next twelve months.
- Appointments reflect weekday opening patterns, seasonality, service duration, staff qualification, room requirements, cancellations, no-shows, rescheduling, and realistic free space.
- Historical appointments connect coherently to sales, payments, reminders, reviews, loyalty activity, package usage, and inventory consumption where supported by the model.
- Re-running the seed advances the scenario automatically; it must not retain stale fixed calendar dates.

## Demo breadth

The Demo salon activates every module available in the platform catalog and contains representative data for every tenant-facing domain supported by the current schema.

### Organization and configuration

- Multiple salon locations with distinct opening details.
- Cabins, treatment rooms, and other bookable resources per location.
- Complete salon, calendar, interface, branding, reminder, review, loyalty, data-exchange, and integration settings where safe.
- Closures, availability blocks, saved views, preferences, permissions, notifications, and activity history.

### Staff and service catalog

- A varied staff roster with owner, manager, receptionist, beautician, nail, massage, facial, and specialist profiles.
- Working schedules and representative availability requests.
- Service categories and a broad catalog with plausible prices, durations, descriptions, colors, and active states.
- Explicit service-to-staff and service-to-resource assignments that prevent impossible bookings.
- Service packages, customer purchases, balances, and usage history.

### Customers and engagement

- Several hundred fictional customers with varied recency, frequency, value, preferences, notes, tags, birthdays, and consent states.
- Customer tags, consent templates and records, communication consent, conversations, messages, and safe provider placeholders that do not contact external services.
- Waitlist entries, appointment notes, reschedule requests, reminders, review invitations, deliveries, and reviews.
- Loyalty settings, tiers, earning rules, rewards, points, adjustments, and redemptions.
- Campaign templates, campaigns, and recipient outcomes with no live dispatch.

### Commerce and warehouse

- Completed and open sales linked to services, products, packages, customers, and staff where applicable.
- Mixed payment methods, vouchers, voucher movements, and cash movements.
- Suppliers and an extensive product catalog with realistic categories, pricing, tax, reorder thresholds, and availability.
- Purchase and inventory documents, document lines, movements, counts, count lines, reorder requests, expenses, and assets.
- Stock balances and movement histories must reconcile according to the application's warehouse rules.

## Scale and presentation quality

The dataset should feel busy but remain practical for local regeneration and automated tests. Exact counts belong in a centralized scenario profile rather than being scattered through insertion logic. The profile must guarantee enough records to populate lists, filters, pagination, charts, alerts, low-stock states, high-value customer views, and calendar density without making the UI uniformly full or artificial.

Names, descriptions, prices, service mixes, and business events use coherent Italian salon language. Data distributions include ordinary cases and selected edge cases that demonstrate the product: inactive services, low-stock products, declined campaign recipients, cancelled appointments, expired or partially used packages, and pending operational requests.

## Implementation boundaries

- Keep generation logic separate from database application logic.
- Centralize deterministic random generation, date anchoring, IDs, and scenario volume configuration.
- Reuse domain behavior where it is essential for correctness, especially password hashing and stock/sale relationships.
- Do not call external communication, payment, webhook, or marketing providers.
- Add a root package command such as `pnpm demo:seed` and document prerequisites and safety behavior.
- The default command targets the configured `DATABASE_URL`; no credentials are committed.

## Verification and acceptance criteria

- Automated tests prove deterministic generation for a fixed date and seed.
- Automated tests prove that deletion is restricted to the exact Demo tenant identity.
- Automated tests validate foreign-key references, staff/service/resource compatibility, chronological ordering, monetary totals, stock reconciliation, and minimum domain volumes.
- A database integration test or validation command regenerates the demo twice and confirms idempotent final counts.
- The configured development database is seeded successfully.
- Login with `demo@demo.com` and `demo123456` succeeds through the same credential verification path as a normal user.
- Representative API or UI reads confirm that calendar, customers, services, staff, sales, warehouse, marketing, reviews, packages, loyalty, and dashboard views return populated data.
- After verification, changes are committed, merged into `main` if developed elsewhere, and pushed to the configured remote.
