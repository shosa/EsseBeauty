# EsseBeauty Technical Guide

Guida tecnica per sviluppatori, manutentori, DevOps e futuri contributor.

---

## 1. System Overview

EsseBeauty è un monorepo TypeScript con sei microservizi Fastify, cinque app Next.js e un gateway Nginx opzionale. Lo stack dati è PostgreSQL 16 con Drizzle ORM e Redis 7 con BullMQ per code e scheduler.

Il sistema è multi-tenant: ogni salone è isolato nei dati e nelle impostazioni. La maggior parte delle route usa il path `/api/salons/:id/...` e verificano che `:id` coincida con il salone della sessione autenticata.

Dopo un refactoring, l'architettura è passata da un monolite a sei servizi backend e un'area legacy core (api) che contiene ancora le route non ancora smiste ai nuovi servizi.

---

## 2. Repository Structure

```
.
├── apps/
│   ├── admin/            Console platform (Next.js)
│   ├── api/              API legacy core + job hooks + demo seed
│   ├── booking/          Appuntamenti, slot, calendario, waitlist
│   ├── commerce/         Inventario, cassa, voucher, contabilità
│   ├── communications/   WhatsApp/email, promemoria, recensioni, outbox
│   ├── identity/         Auth staff, sessioni, permessi
│   ├── loyalty-marketing Fusione loyalty + marketing
│   ├── pwa/              Customer PWA pubblica
│   ├── staff-pwa/        Staff PWA
│   ├── web/              Dashboard salone + area platform
│   └── website/          Sito pubblico / marketing
├── packages/
│   ├── comms-contracts/  Contratti comunicazioni, email, review, push, outbox
│   ├── db/               Schema Drizzle, client, migrazioni
│   ├── domain-events/    Eventi cross-service (loyalty, campaign)
│   ├── feature-flags/    Moduli salone: server, react, keys
│   ├── loyalty-contracts/ Contratti loyalty (redemption, engine)
│   ├── queue-client/     BullMQ: queue names, redis connection
│   ├── server-shared/    Auth session, password, provider creds, voucher, excel
│   ├── shared/           Permessi, slot, utilities dominio
│   └── ui/               Design system condiviso
├── scripts/
│   ├── dev.ps1           Avvio locale coordinato
│   ├── dev-gateway.mjs   Gateway dev locale
│   └── db-clear.ps1
├── gateway/
│   └── nginx.conf        Smistamento API per Docker
├── deploy/
│   └── nginx/
│       ├── essebeauty-systemwide.conf
│       └── snippets/
├── compose.yaml
├── DOCKER.md
├── README.md
├── TECH.md
└── .env.example
```

---

## 3. Applications

### 3.1 Backend services

| Servizio | Porta dev | Dir | Responsabilità |
|----------|-----------|-----|----------------|
| api | 3011 (locale dietro gateway) | `apps/api` | Core legacy: auth staff, clienti, servizi, settings, shell, report, onboarding, public routes, platform, enterprise, job hooks |
| communications | 3003 | `apps/communications` | WhatsApp/email, promemoria, recensioni, outbox, webhook, push customer |
| loyalty-marketing | 3006 | `apps/loyalty-marketing` | Fedeltà, premi, tier, redemption, campagne email/WhatsApp/app, campaign status |
| booking | 3007 | `apps/booking` | Appuntamenti, slot, calendar events, waitlist, staff availability requests |
| commerce | 3008 | `apps/commerce` | Inventario avanzato, cassa/POS, vendite, voucher, contabilità, loyalty redemption in vendita |
| identity | 3009 | `apps/identity` | Login/logout staff, sessioni, password recovery, utenti, permessi |

### 3.2 Frontend apps

| App | Porta dev | Pubblico |
|-----|-----------|----------|
| web | 3000 | Dashboard salone + area platform |
| pwa | 3002 | Customer PWA pubblica |
| staff-pwa | 3003 | Staff |
| admin | 3004 | Platform / console multi-tenant |
| website | 3005 | Sito pubblico / marketing |

---

## 4. Backend Services

### 4.1 api (legacy core)

Entry: `apps/api/src/index.ts`, `apps/api/src/app.ts`.

Plugin globali: cookie, CORS con credenziali, helmet, rate limit, healthcheck.

Route principali ancora qui:

- auth staff: `/api/auth/*`
- clienti: `/api/salons/:id/customers*`
- servizi: `/api/salons/:id/services*`
- staff: `/api/salons/:id/staff*`
- settings: `/api/salons/:id/settings`
- shell: search, notifications
- reports: staff, own, services, export
- platform: `/api/platform/*`
- onboarding: `/api/salons/:id/onboarding*`
- public: `/api/public/:slug*`, public customer auth, push subscriptions, messages, salon finder, scheduling resources
- enterprise: modulo enterprise opzionale

Job hooks attivi in api:

- `apps/api/src/jobs/audit-log.ts`
- `apps/api/src/jobs/staff-request-notifications.ts`
- `apps/api/src/jobs/notifications.ts`

Env richieste (vedi sezione 17). Non ha code proprie; usa le code cross-service tramite `@esse-beauty/queue-client` e `@esse-beauty/domain-events` dove necessario.

### 4.2 communications

Route:

- reminders settings e lista
- reviews: public submit/resolve, reply, publish, invitations
- review-invitations
- webhook WhatsApp
- communications outbox

Code proprietarie:

- `REMINDERS`
- `REVIEWS`
- `COMMUNICATIONS`

Worker e scheduler:

- `apps/communications/src/jobs/reminders.ts` — worker reminder + scan scheduler ogni 5 min
- `apps/communications/src/jobs/reviews.ts` — worker review delivery + recovery scheduler ogni 5 min
- `apps/communications/src/jobs/communications.ts` — worker outbox WhatsApp + recovery scheduler ogni 60 min

Env richieste: `REVIEW_TOKEN_SECRET` obbligatorio, più `META_*`, `PROVIDER_CREDENTIAL_*`, `PUSH_VAPID_*`, `PWA_URL` opzionali.

### 4.3 loyalty-marketing

Route:

- loyalty: settings, rewards, customers, points
- campaigns: list, create, update, send, detail
- campaign-templates

Code proprietarie:

- `LOYALTY_AWARDS`
- `LOYALTY_BIRTHDAYS`
- `CAMPAIGNS`
- `CAMPAIGN_STATUS_REFRESH`

Worker e scheduler:

- `apps/loyalty-marketing/src/jobs/loyalty-events.ts` — worker award review/sale + expiry
- `apps/loyalty-marketing/src/jobs/loyalty-birthdays.ts` — scheduler birthday rewards
- `apps/loyalty-marketing/src/jobs/marketing.ts` — worker campagne
- `apps/loyalty-marketing/src/jobs/campaign-status.ts` — refresh status campagna

Env: come le comuni, senza segreti obbligatori specifici oltre a `DATABASE_URL`, `REDIS_URL`, `API_CORS_ORIGIN`.

### 4.4 booking

Route:

- appuntamenti/list, create, detail, update, delete
- slots pubblici e privati
- calendar-events
- waitlist: create, list, update, delete
- waitlist-summary
- staff availability requests

Code proprietaria:

- `APPOINTMENT_FOLLOWUPS`

Worker e scheduler:

- `apps/booking/src/jobs/appointment-events.ts` — worker waitlist rematch, hook su transizione appointment
- `apps/booking/src/jobs/appointment-followups.ts` — gestione code followup

Env: `DATABASE_URL`, `REDIS_URL`, `API_CORS_ORIGIN`, più `PWA_URL`, `PUSH_VAPID_*` opzionali.

### 4.5 commerce

Route:

- inventory: products, movements, documents, counts, suppliers, reorder requests, expenses, assets, reporting
- pos-catalog, pos-checkout, pos-customers
- sales: list, create, update, void
- vouchers: issue, redeem
- accounting: export PDF/Excel

Code: non ha code proprie; invoca `domain-events` per loyalty award/expiry e comunicazioni tramite contratti.

Env: come le comuni.

### 4.6 identity

Route:

- `/api/auth/bootstrap/status`, `/api/auth/bootstrap`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- `/api/auth/change-password`, `/api/auth/invite`, `/api/auth/users`, `/api/auth/users/:id/permissions`, `/api/auth/users/:id`

Non ha code proprie.

Env: come le comuni.

---

## 5. Frontend Applications

Tutte le app frontend sono Next.js 15 + React 19 + Tailwind 4.

### 5.1 web

`apps/web`. Dashboard salone + area platform.

Route principali:

- `app/login/page.tsx`
- `app/platform/page.tsx`
- `app/(dashboard)/page.tsx`
- `app/(dashboard)/calendar/**`
- `app/(dashboard)/clients/**`
- `app/(dashboard)/services/**`
- `app/(dashboard)/staff/**`
- `app/(dashboard)/settings/**`
- `app/(dashboard)/reviews/page.tsx`
- `app/(dashboard)/waitlist/page.tsx`
- `app/(dashboard)/marketing/**`
- `app/(dashboard)/inventory/**`
- `app/(dashboard)/reports/page.tsx`

Shell: `DashboardShell`, command palette, notification drawer, quick create.
Shared UI: usa `@esse-beauty/ui`.

### 5.2 pwa

`apps/pwa`. Portale pubblico.

Route:

- `/`
- `/[slug]`
- `/[slug]/book`
- `/[slug]/appointments`
- `/[slug]/loyalty`
- `/review/[appointmentId]`

PWA: usa `next-pwa`.

### 5.3 staff-pwa

`apps/staff-pwa`. Interfaccia mobile per staff.

### 5.4 admin

`apps/admin`. Console platform / multi-tenant.

### 5.5 website

`apps/website`. Sito pubblico/marketing.

---

## 6. Request Routing

Il gateway Nginx (opzionale, profilo `gateway` in compose) smista le richieste `/api/**` in base al path:

- `/api/auth/**` → identity
- `/api/salons/[^/]+/(appointments|slots|calendar-events|waitlist-summary|waitlist)` → booking
- `/api/salons/[^/]+/(communications|reminders|reviews|review-invitations)` → communications
- `/api/salons/[^/]+/(loyalty|campaigns|campaign-templates)` → loyalty-marketing
- `/api/salons/[^/]+/(inventory|pos-catalog|pos-checkout|pos-customers|sales|vouchers|accounting)` → commerce
- `/api/salons/[^/]+/appointments/[^/]+/checkout` → commerce
- `/api/public/reviews/**`, `/api/webhooks/whatsapp/**` → communications
- tutto il resto → api

Il gateway locale in sviluppo usa `scripts/dev-gateway.mjs`. In produzione senza gateway Docker, si usa `deploy/nginx/essebeauty-systemwide.conf` con nginx sul sistema host.

---

## 7. Authentication & Authorization

### 7.1 Auth staff

Cookie sessione applicativa gestita dall'api. `apps/api/src/middleware/auth.ts` valida sessione e popola `request.user` e `request.salonId`.

Endpoint principali:

- `GET /api/auth/bootstrap/status`
- `POST /api/auth/bootstrap`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/change-password`
- `POST /api/auth/invite`
- `GET /api/auth/users`
- `PATCH /api/auth/users/:userId/permissions`
- `PATCH /api/auth/users/:userId`

### 7.2 Auth platform

Cookie `esse-platform-session`. Entità `platform_admins` e `platform_admin_sessions`.

Endpoint:

- `GET /api/platform/auth/bootstrap/status`
- `POST /api/platform/auth/bootstrap`
- `POST /api/platform/auth/login`
- `POST /api/platform/auth/logout`
- `GET /api/platform/auth/me`

### 7.3 Auth cliente pubblico

Gestito dall'api legacy. Cookie `esse-customer-session`. Entità `customers`, `customer_credentials`, `customer_sessions`, `customer_password_reset_tokens`.

Endpoint:

- `POST /api/public/:slug/customer-auth/register`
- `POST /api/public/:slug/customer-auth/login`
- `POST /api/public/:slug/customer-auth/logout`
- `POST /api/public/:slug/customer-auth/password-reset/request`
- `POST /api/public/:slug/customer-auth/password-reset/complete`
- `GET /api/public/:slug/customer-auth/me`

### 7.4 Ruoli e permessi

Ruoli: `owner`, `manager`, `receptionist`, `employee`.

Permessi (non esaustivi):

- `calendar.view_own`, `calendar.manage_own`, `calendar.view_others`, `calendar.manage_others`, `calendar.delete`
- `clients.view`, `clients.edit`, `clients.block`
- `reports.view_own`, `reports.view_all`, `reports.export`
- `settings.salon`, `settings.services`, `settings.staff`, `settings.users`, `settings.modules`
- `reviews.reply`
- `marketing.send`
- `inventory.manage`
- `waitlist.manage`
- `loyalty.manage`
- `communications.view`, `communications.reply`, `communications.manage_provider`

Default:

- `owner`: tutti i permessi
- `manager`: quasi tutti, esclusi users e modules
- `receptionist`: calendario, clienti, report propri, comunicazioni view/reply
- `employee`: calendario proprio, clienti, report propri

Override in `user_permissions`. Cache permessi per 30 secondi in `packages/shared/permissions.ts`.

---

## 8. Multi-Tenancy

Ogni salone ha un `salonId` e i dati operativi sono scoped per `salonId`. La maggior parte delle route usa `/api/salons/:id/...` e verifica che `:id` coincida con `request.salonId`.

La platform è separata: `platform_admins`, `platform_admin_sessions`, `platform_salon_status`, `platform_plans`, `platform_module_catalog`, `platform_audit_log`, `platform_email_settings`, `platform_system_templates`, `platform_impersonation_sessions`.

Moduli salone: `salon_modules` con chiavi:

- `reminders`
- `reviews`
- `waitlist`
- `loyalty`
- `marketing`
- `inventory`
- `staff_performance`

Il controllo avviene server-side con `requireModule(MODULE_KEYS.X)` e lato UI con `useModuleEnabled(MODULE_KEYS.X)`.

---

## 9. Database

Engine: PostgreSQL 16. ORM: Drizzle ORM con schema in `packages/db/schema.ts`.

Convenzioni:

- camelCase in TypeScript, snake_case in colonne
- timestamp con timezone: `timestamp("...\_", { withTimezone: true })`
- `created_at` automatico in `timestamps`
- `updated_at` con default now
- UUID primary key con `defaultRandom()`

Entità principali (non esaustivo):

- `salons`, `salon_modules`, `salon_locations`, `salon_resources`, `salon_settings`, `calendar_settings`, `data_exchange_settings`, `integration_settings`, `pwa_branding_settings`, `salon_closures`, `salon_special_openings`
- `platform_plans`, `platform_module_catalog`, `platform_admins`, `platform_admin_sessions`, `platform_audit_log`, `platform_impersonation_sessions`, `platform_system_templates`, `platform_email_settings`
- `users`, `user_credentials`, `auth_sessions`, `user_permissions`, `password_reset_tokens`, `login_activity`, `user_interface_preferences`, `saved_views`, `staff`, `staff_availability_requests`
- `service_categories`, `services`, `service_staff`, `service_resources`, `service_packages`, `service_package_items`, `customer_service_packages`, `customer_package_item_balances`, `service_package_usages`
- `customers`, `customer_credentials`, `customer_sessions`, `customer_password_reset_tokens`, `customer_tags`, `customer_consents`, `customer_push_subscriptions`, `customer_app_messages`, `appointments`, `appointment_notes`, `appointment_reschedule_requests`, `availability_blocks`
- `sales`, `sale_items`, `sale_payments`, `purchase_vouchers`, `purchase_voucher_movements`, `cash_movements`
- `loyalty_adjustment_reasons`, `loyalty_settings`, `loyalty_tiers`, `loyalty_rewards`, `loyalty_earning_rules`, `loyalty_reward_redemptions`, `loyalty_points`
- `campaign_templates`, `marketing_campaigns`, `campaign_recipients`
- `reminder_settings`, `reminders`, `review_invitations`, `review_request_settings`, `review_invitation_deliveries`, `reviews`, `review_invitation_deliveries`
- `communication_provider_accounts`, `communication_provider_secrets`, `communication_consents`, `communication_conversations`, `communication_messages`, `communication_outbox`, `communication_webhook_events`, `communication_user_state`
- `notifications`, `notification_preferences`, `activity_log`
- `inventory_suppliers`, `inventory_products`, `inventory_reorder_requests`, `inventory_documents`, `inventory_document_lines`, `inventory_movements`, `inventory_counts`, `inventory_count_lines`, `inventory_expenses`, `inventory_assets`
- `consent_templates`

Multi-tenancy: quasi tutte le tabelle hanno `salonId` con FK a `salons.id` e `onDelete: "cascade"`. Alcune tabelle sono globali (platform).

Enum rilevanti: `user_role`, `appointment_status`, `appointment_source`, `sale_status`, `sale_item_type`, `payment_method`, `reward_type`, `reminder_channel`, `reminder_status`, `review_delivery_channel`, `review_delivery_status`, `waitlist_status`, `campaign_channel`, `campaign_status`, `platform_salon_status`, `notification_priority`, `notification_channel`, `consent_signature_status`, `consent_delivery_channel`, `staff_request_status`, `communication_provider`, `communication_provider_status`, `communication_secret_kind`, `communication_channel`, `communication_consent_purpose`, `communication_consent_status`, `communication_conversation_status`, `communication_message_kind`, `communication_message_status`, `communication_outbox_status`, `whatsapp_template_approval_status`.

Indici: molti uniqui su coppie `salonId + ...`. Vedere schema per dettagli.

Cascade: `salonId` FK di solito `onDelete: "cascade"`. Eccezioni documentate nel schema (es. `customer_credentials` con `customerId` unique).

Tabelle outbox/eventi: `communication_outbox`, `communication_webhook_events`, `review_invitations`, `review_invitation_deliveries`.

Notification tables: `notifications`, `notification_preferences`.

Subscription push: `customer_push_subscriptions`.

Provider credentials: `communication_provider_accounts`, `communication_provider_secrets`, cifrati con `PROVIDER_CREDENTIAL_ENCRYPTION_KEY`.

Loyalty: `loyalty_points`, `loyalty_tiers`, `loyalty_rewards`, `loyalty_reward_redemptions`, `loyalty_earning_rules`, `loyalty_settings`, `loyalty_adjustment_reasons`.

Reviews: `reviews`, `review_invitations`, `review_request_settings`, `review_invitation_deliveries`.

Reminders: `reminders`, `reminder_settings`.

Appointments: `appointments`, `appointment_notes`, `appointment_reschedule_requests`, `availability_blocks`, `staff_availability_requests`, `salon_closures`, `salon_special_openings`.

Sales: `sales`, `sale_items`, `sale_payments`, `purchase_vouchers`, `purchase_voucher_movements`, `cash_movements`.

Inventory: `inventory_products`, `inventory_suppliers`, `inventory_documents`, `inventory_document_lines`, `inventory_movements`, `inventory_counts`, `inventory_count_lines`, `inventory_expenses`, `inventory_assets`, `inventory_reorder_requests`, `cash_movements`.

Diagramma ASCII semplificato delle relazioni principali:

```
salons 1──< salon_modules
salons 1──< users
users 1──1 user_credentials
users 1──< auth_sessions
users 1──< user_permissions
staff ──< users (userId nullable)
staff 1──< availability_blocks
services 1──< service_staff >── staff
services 1──< service_resources >── salon_resources
customers 1──< appointments
staff 1──< appointments
services 1──< appointments
appointments 1──< appointment_notes
appointments 1──< appointment_reschedule_requests
appointments 1──< sales
sales 1──< sale_items
sales 1──< sale_payments
purchase_vouchers 1──< purchase_voucher_movements
customers 1──< loyalty_points
customers 1──< loyalty_reward_redemptions
loyalty_rewards 1──< loyalty_reward_redemptions
marketing_campaigns 1──< campaign_recipients
campaign_templates 1──< marketing_campaigns
communication_provider_accounts 1──< communication_messages
communication_provider_accounts 1──< communication_conversations
communication_conversations 1──< communication_messages
communication_messages 1──1 communication_outbox
communication_provider_accounts 1──< communication_provider_secrets
communication_provider_accounts 1──< communication_webhook_events
customers 1──< customer_push_subscriptions
customers 1──< customer_app_messages
```

---

## 10. Background Jobs & Queues

Redis: Redis 7. Client BullMQ condiviso in `packages/queue-client`.

Code BullMQ:

| Nome | Servizio | Scopo |
|------|----------|-------|
| `APPOINTMENT_FOLLOWUPS` | booking | Waitlist rematch dopo cancellazione |
| `CAMPAIGNS` | loyalty-marketing | Invio batch campagne |
| `CAMPAIGN_STATUS_REFRESH` | loyalty-marketing | Refresh stato campagna dopo changes |
| `COMMUNICATIONS` | communications | Outbox WhatsApp delivery + recovery |
| `LOYALTY_AWARDS` | loyalty-marketing | Award punti per review, vendita; scadenza su voided |
| `LOYALTY_BIRTHDAYS` | loyalty-marketing | Reward compleanno |
| `REMINDERS` | communications | Invio promemoria + scan scheduler |
| `REVIEWS` | communications | Delivery richieste recensione + recovery |

Worker:

- `apps/booking/src/jobs/appointment-events.ts` — `startAppointmentFollowupWorker`
- `apps/loyalty-marketing/src/jobs/loyalty-events.ts` — `startLoyaltyAwardWorker`
- `apps/loyalty-marketing/src/jobs/loyalty-birthdays.ts` — scheduler birthday
- `apps/loyalty-marketing/src/jobs/marketing.ts` — `startMarketingWorker`
- `apps/loyalty-marketing/src/jobs/campaign-status.ts` — scheduler campaign status refresh
- `apps/communications/src/jobs/reminders.ts` — `startReminderWorker`, scan scheduler ogni 5 min
- `apps/communications/src/jobs/reviews.ts` — `startReviewWorker`, recovery scheduler ogni 5 min
- `apps/communications/src/jobs/communications.ts` — `startCommunicationWorker`, recovery scheduler ogni 60 min

Retry policies:

- APPOINTMENT_FOLLOWUPS: 5 tentativi, backoff esponenziale 30s, remove on complete 24h, remove on fail 7 giorni
- REMINDERS: job scheduler ogni 5 min, finestra di staleness 10 min
- REVIEWS: max 5 delivery attempts, recovery ogni 5 min
- COMMUNICATIONS: lease 5 min, retry delay 30s, max 5 tentativi, remove on complete 24h, remove on fail 7 giorni

Failed jobs: BullMQ mantiene job falliti fino a quando non vengono rimossi dai limiti remove on fail. Le tabelle outbox sono persistenti e le scan di recovery sono idempotenti.

---

## 11. Domain Events

Cross-service eventi in `packages/domain-events`:

- `loyalty-events.ts`: `scheduleReviewSubmittedLoyaltyAward`, `scheduleSaleCompletedLoyaltyAward`, `scheduleSaleVoidedLoyaltyExpiry` — inviati sulla coda `LOYALTY_AWARDS`
- `campaign-events.ts`: `scheduleCampaignStatusRefresh` — inviato sulla coda `CAMPAIGN_STATUS_REFRESH`

Producers:

- `apps/api` e `apps/commerce` schedulano loyalty events dopo write
- `apps/communications` schedula campaign status refresh dopo aggiornamenti outbox

Consumers:

- `apps/loyalty-marketing` consuma `LOYALTY_AWARDS`
- `apps/loyalty-marketing` consuma `CAMPAIGN_STATUS_REFRESH`

---

## 12. Communications

Canali:

- WhatsApp via Meta Cloud API
- Email via SMTP configurato da platform, Resend opzionale
- App push via Web Push VAPID
- Notifiche in-app

Provider registry: `createCommunicationProviderRegistry` in `@esse-beauty/comms-contracts`.

Outbox: `communication_outbox` è la fonte persistente per i messaggi WhatsApp. Il worker `COMMUNICATIONS` fa claim con lease, invia, aggiorna stato.

Review delivery: `review_invitations` e `review_invitation_deliveries` gestiscono richieste multi-canal (email, WhatsApp, app), con token hash firmati, lease, retry, exhaustion.

Promemoria: `reminders` e `reminder_settings`. Scan scheduler ogni 5 min.

Email: `sendEmailFromDb` e `sendEmail` in `@esse-beauty/comms-contracts`. Conf Mail di contatto per sito: `NEXT_PUBLIC_BUSINESS_EMAIL`.

Web Push: `customer_push_subscriptions`, VAPID keys in env, `customer_app_messages` per full content.

---

## 13. Booking Lifecycle

1. Richiesta pubblica: `POST /api/public/:slug/book`
2. Appuntamento creato con status `pending` o `confirmed` in base a `bookingDefaultStatus`
3. Notifiche online booking: `ensureOnlineBookingNotifications`
4. Conferma manuale o automatica
5. Promemoria: scheduled da `scheduleDueReminders` in communications
6. Checkout/completion: `POST /api/salons/:id/appointments/:appointmentId/checkout` in commerce
7. Dopo checkout: loyalty award, review request, sales chiusura
8. Cancellazione: PATCH status `cancelled`, hook `appointmentTransition`, waitlist rematch se modulo attivo
9. Ripartprogrammazione: `appointmentRescheduleRequests`

Nota: `APPOINTMENT_COMPLETION_REQUIRES_CHECKOUT` — la completion avviene solo tramite checkout. La transizione `cancelled` è l'unica gestita dal hook `appointmentTransition` in booking.

---

## 14. Loyalty & Marketing

Loyalty:

- `loyalty_settings`: points per appointment, scadenza, allow negative balance, redemption requires approval
- `loyalty_tiers`: min points, benefits
- `loyalty_rewards`: punti richiesti, tipo, discount, servizio/prodotto associato
- `loyalty_earning_rules`: action, punti
- `loyalty_points`: movimenti con delta, motivo, scadenza
- `loyalty_reward_redemptions`: redemption con status, idempotency key, approval

Marketing:

- `campaign_templates`: template con channel, content, variabili, stato approvazione WhatsApp
- `marketing_campaigns`: campaign con template, target segment, content, stato, pianificazione
- `campaign_recipients`: destinatari con stato, provider, errori

Campaign send: `POST /api/salons/:id/campaigns/:campaignId/send` accoda batch sulla coda `CAMPAIGNS`. Worker processa batch, invia email/WhatsApp/app, aggiorna stati.

Campaign status refresh: `CAMPAIGN_STATUS_REFRESH` ogni volta che un outbox WhatsApp o email cambia stato.

---

## 15. Commerce & Sales

Sales:

- `sales`: open, paid, void; subtotal, discount, total
- `sale_items`: service, product, custom
- `sale_payments`: cash, card, bank_transfer, voucher, other
- `purchase_vouchers`: codice, saldo, stato, movimento
- `cash_movements`: in/out, idempotency key

Checkout:

- `POST /api/salons/:id/appointments/:appointmentId/checkout` — completa appuntamento, crea sale, chiude, assegna loyalty, scatena review request
- `POST /api/salons/:id/pos-checkout` — checkout POS generico

Voucher:

- `issuePurchaseVoucher`, `redeemPurchaseVoucher` in `@esse-beauty/server-shared`
- Redemption loyalty può generare voucher

Excuses/void:

- `buildSaleVoidPlan`, `voidSale` in `apps/commerce/src/lib/sale-void.ts`
- Voided sale espira punti fedeltà

Inventory:

- Prodotti, movimenti, documenti, conteggi, spese, asset, riordini
- Accounting export PDF/Excel in `apps/commerce/src/lib/accounting-pdf.ts`

---

## 16. Storage / Search / Cache

- Cache: Redis per BullMQ e per permessi (30s)
- Search: nessuna search engine dedicata; le ricerche usano query SQL su PostgreSQL
- Storage oggetti: non c'è un servizio object storage nel compose attuale; attachment_url in inventory_documents è nullable e da interpretare come riferimento esterno
- Cache client: permessi in memoria con TTL; moduli con cache in `@esse-beauty/feature-flags`

---

## 17. Configuration

### 7.1 Env condivise tra tutti i backend

- `NODE_ENV`
- `PORT`
- `API_HOST`
- `API_CORS_ORIGIN`
- `DATABASE_URL`
- `REDIS_URL` (servizi con code)

### 7.2 Env per servizio

**api**

- `DATABASE_URL` (obbligatoria)
- `REDIS_URL`
- `API_CORS_ORIGIN`
- `PORT` default 3011 locale / 3001 container
- `COOKIE_SECURE`
- `PUSH_VAPID_PUBLIC_KEY` opzionale

**communications**

- `DATABASE_URL`
- `REDIS_URL`
- `API_CORS_ORIGIN`
- `PORT` default 3003
- `REVIEW_TOKEN_SECRET` (obbligatoria)
- `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` opzionali
- `PROVIDER_CREDENTIAL_ENCRYPTION_KEY`, `PROVIDER_CREDENTIAL_KEY_VERSION` opzionali
- `PWA_URL`, `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_PRIVATE_KEY`, `PUSH_VAPID_SUBJECT` opzionali

**loyalty-marketing**

- `DATABASE_URL`
- `REDIS_URL`
- `API_CORS_ORIGIN`
- `PORT` default 3006

**booking**

- `DATABASE_URL`
- `REDIS_URL`
- `API_CORS_ORIGIN`
- `PORT` default 3007
- `PWA_URL`, `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_PRIVATE_KEY`, `PUSH_VAPID_SUBJECT` opzionali

**commerce**

- `DATABASE_URL`
- `REDIS_URL`
- `API_CORS_ORIGIN`
- `PORT` default 3008

**identity**

- `DATABASE_URL`
- `API_CORS_ORIGIN`
- `PORT` default 3009

### 7.3 Env frontend

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_PWA_URL`
- `NEXT_PUBLIC_WEB_URL`
- `NEXT_PUBLIC_PLATFORM_URL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_BUSINESS_EMAIL`
- `API_INTERNAL_URL` (PWA)
- `REVIEW_SESSION_SECRET` (PWA, obbligatoria)

### 7.4 Env Docker

Vedere `compose.yaml` e `.env.example`. Non mettere password nei valori letterali nel document.

---

## 18. Local Development

### 18.1 Prerequisites

- Node.js >= 22
- pnpm 10.12.1 (corepack)
- PostgreSQL 16 e Redis 7, oppure Docker Compose
- PowerShell per `scripts/dev.ps1` (su Linux/Windows)

### 18.2 Install

```bash
pnpm install
```

### 18.3 Env

Copia `.env.example` in `.env` e compila i segreti richiesti:

```bash
cp .env.example .env
```

Genera `REVIEW_TOKEN_SECRET` e `REVIEW_SESSION_SECRET`:

```bash
node -e "const {randomBytes}=require('node:crypto'); console.log('REVIEW_TOKEN_SECRET='+randomBytes(32).toString('hex')); console.log('REVIEW_SESSION_SECRET='+randomBytes(32).toString('hex'))"
```

Se usi WhatsApp, compila anche `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` e `PROVIDER_CREDENTIAL_ENCRYPTION_KEY`.

### 18.4 Database

Con Docker Compose:

```bash
docker compose up -d db redis
```

Oppure usa PostgreSQL e Redis locali e imposta `DATABASE_URL` e `REDIS_URL` in `.env`.

### 18.5 Migrazioni

```bash
pnpm --filter @esse-beauty/db db:migrate
```

Per generare nuove migrazioni:

```bash
pnpm --filter @esse-beauty/db db:generate
```

### 18.6 Seed demo

```bash
pnpm demo:seed
```

Oppure:

```bash
pnpm --filter @esse-beauty/api demo:seed
```

Lo script è `apps/api/scripts/seed-demo.ts`. Il demo deterministico è in `apps/api/src/demo`.

### 18.7 Start

Con script coordinato:

```bash
pnpm dev
```

Lo script `scripts/dev.ps1`:

1. Carica `.env`
2. Normalizza `DATABASE_URL` e `REDIS_URL`
3. Prepara pnpm workspace
4. Configura CORS per LAN
5. Controlla porte
6. Build shared packages
7. Applica migrazioni
8. Avvia backend services come job PowerShell (api, communications, loyalty-marketing, booking, commerce, identity) + dev gateway
9. Avvia frontend in parallelo (web, pwa, staff-pwa, admin)

Ports attese in locale:

- 3000 web
- 3001 gateway
- 3002 pwa
- 3003 staff-pwa
- 3004 admin
- 3006 loyalty-marketing
- 3007 booking
- 3008 commerce
- 3009 identity
- 3011 api
- 3013 communications

### 18.8 Frontend solo

```bash
pnpm --filter @esse-beauty/web dev
pnpm --filter @esse-beauty/pwa dev
pnpm --filter @esse-beauty/staff-pwa dev
pnpm --filter @esse-beauty/admin dev
```

### 18.9 Troubleshooting avvio

- Se le porte sono occupate: uccidi i processi sulla porta o usa porte diverse
- Se le migrazioni falliscono: controlla `DATABASE_URL` e che PostgreSQL sia accessibile
- Se Redis non è accessibile: i worker BullMQ falliranno
- Se `REVIEW_TOKEN_SECRET` manca: communications non avvia

---

## 19. Database Migrations

Tool: Drizzle Kit.

Comandi:

```bash
pnpm --filter @esse-beauty/db db:generate
pnpm --filter @esse-beauty/db db:migrate
```

In Docker, il servizio `migrate` esegue `packages/db/scripts/ensure-database.mjs` e poi `db:migrate`. Questo evita problemi con volumi già esistenti.

---

## 20. Demo / Seed

Demo deterministico in `apps/api/src/demo`. Build scenario con `build-demo-scenario.ts`, applica con `apply-demo-scenario.ts`. Test di validazione in `validate-demo-scenario.ts`.

Lo script `demo:seed` esegue `apps/api/scripts/seed-demo.ts` con `tsx`.

---

## 21. Testing

Framework: Vitest.

Esecuzione:

```bash
pnpm test
pnpm --filter @esse-beauty/api test
pnpm --filter @esse-beauty/web test
pnpm --filter @esse-beauty/pwa test
pnpm --filter @esse-beauty/communications test
pnpm --filter @esse-beauty/booking test
pnpm --filter @esse-beauty/commerce test
pnpm --filter @esse-beauty/loyalty-marketing test
pnpm --filter @esse-beauty/identity test
pnpm --filter @esse-beauty/shared test
pnpm --filter @esse-beauty/feature-flags test
pnpm --filter @esse-beauty/db test
```

Test notabili:

- `apps/api/src/app.test.ts`
- `apps/api/src/middleware/auth.test.ts`
- `apps/api/src/routes/appointments/index.test.ts`
- `apps/api/src/routes/shell/index.test.ts`
- `apps/api/src/platform-contract.test.ts`
- `apps/web/ui-polish-regression.test.ts`
- `apps/web/ui-contract.test.ts`
- `apps/web/middleware.test.ts`
- `apps/web/shell-config.test.ts`
- `packages/feature-flags/server.test.ts`
- `packages/shared/utils/slots.test.ts`
- `packages/db/schema-contract.test.ts`
- `apps/booking/src/jobs/appointment-events.test.ts`
- `apps/communications/src/jobs/reviews.ts` (logica incluso in test)
- `apps/commerce/src/routes/sales/*test.ts`

 coverage: non esistono report di coverage automatici nel repo; i test sono su aree critiche (auth, appuntamenti, recensioni, campagne, checkout, loyalty).

---

## 22. Docker & Production

### 22.1 Compose

Vedere `compose.yaml`. Servizi:

- `db`: postgres:16-alpine
- `redis`: redis:7-alpine
- `migrate`: Dockerfile api, target migrator
- `api`, `communications`, `loyalty-marketing`, `booking`, `commerce`, `identity`: Dockerfile loro app, target runner
- `gateway`: nginx:1.27-alpine, profilo `gateway`
- `web`, `pwa`, `staff-pwa`, `admin`, `website`: Dockerfile Next.js standalone

### 22.2 Dockerfile

Tutti i backend usano multi-stage:

- builder: pnpm install, build filtro con `...` (app + dipendenze)
- migrator (solo api): ensure-database + db:migrate
- runner: dist + deploy folder, CMD node dist/index.js

Frontend Next.js usano standalone output.

### 22.3 Startup ordering

- `migrate` dipende da `db` healthy e termina con successo
- gli altri backend dipendono da `migrate` completed
- `gateway` dipende da tutti i backend healthy

### 22.4 Persistence

- `postgres_data`: volume nome `esse-beauty-postgres-data`
- `redis_data`: volume nome `esse-beauty-redis-data`

### 22.5 Healthcheck

- db: `pg_isready`
- redis: `redis-cli ping`
- backend: `fetch('/health')`
- gateway: `wget -q --spider http://127.0.0.1:3001/health`

### 22.6 Comandi

```bash
docker compose up -d --build
docker compose down
docker compose down -v
docker compose logs -f
docker compose ps
```

---

## 23. Health Checks

Endpoint `/health` su tutti i backend.

Nel compose, i healthcheck usano fetch a `http://127.0.0.1:PORT/health`.

Platform ha endpoint aggiuntivo `/api/platform/services/status` che checks health di tutti i servizi.

---

## 24. Logging & Debugging

### 24.1 Log file

In Docker:

```bash
docker compose logs -f api
docker compose logs -f communications
docker compose logs -f booking
docker compose logs -f commerce
docker compose logs -f loyalty-marketing
docker compose logs -f identity
docker compose logs -f gateway
docker compose logs -f web
docker compose logs -f pwa
docker compose logs -f staff-pwa
docker compose logs -f admin
docker compose logs -f website
docker compose logs -f db
docker compose logs -f redis
docker compose logs -f migrate
```

### 24.2 Queue inspection

BullMQ non ha UI included. Per debugging:

- Controllare log del servizio worker
- In Redis: usare redis-cli per ispezionare chiavi BullMQ se necessario
- Vedere tentativi falliti nei log

### 24.3 DB inspection

Con Docker:

```bash
docker compose exec db psql -U postgres -d esse_beauty
```

Query comuni:

```sql
SELECT * FROM salons;
SELECT * FROM salon_modules WHERE salon_id = '...';
SELECT * FROM appointments WHERE salon_id = '...' ORDER BY starts_at DESC;
SELECT * FROM communication_outbox WHERE status = 'pending';
SELECT * FROM review_invitations WHERE delivery_status = 'pending';
SELECT * FROM loyalty_points WHERE customer_id = '...';
```

Con PostgreSQL locale:

```bash
psql -h localhost -U postgres -d esse_beauty
```

---

## 25. Common Operational Tasks

### 25.1 Riavviare un servizio

```bash
docker compose restart api
```

### 25.2 Ricostruire un servizio

```bash
docker compose build api
docker compose up -d api
```

### 25.3 Applicare migrazioni

```bash
docker compose run --rm migrate
```

O localmente:

```bash
pnpm --filter @esse-beauty/db db:migrate
```

### 25.4 Ispezionare code

Vedere sezione 24.2.

### 25.5 Ispezionare health

```bash
docker compose ps
curl -f http://127.0.0.1:3001/health
curl -f http://127.0.0.1:3003/health
# e così via per ogni servizio
```

### 25.6 Ispezionare DB

Vedere sezione 24.3.

### 25.7 Ispezionare env in container

```bash
docker compose exec api env | grep -E '^(DATABASE_URL|REDIS_URL|REVIEW_TOKEN_SECRET|META|PROVIDER|CUSTOMER_PUSH)' | cut -d= -f1
```

Non mostrare valori segreti completi.

---

## 26. Troubleshooting

| Symptom | Likely area | First checks |
|---------|-------------|--------------|
| Push non arriva | PWA + VAPID + comms | Controllare `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_PRIVATE_KEY`, `customer_push_subscriptions`, log communications |
| Queue failed | Worker + Redis | Controllare log worker, Redis accessibilità, tentativi falliti, outbox status |
| Gateway 502 | Gateway + backend | `docker compose ps`, `docker compose logs gateway`, health backend, routing nginx |
| Migration failure | DB + script migrate | `docker compose logs migrate`, `ensure-database.mjs`, `DATABASE_URL`, `POSTGRES_DB`, volumi esistenti |
| Redis unavailable | Backend con code | Se Redis non è up, worker BullMQ falliscono; controllare `docker compose ps redis`, `REDIS_URL` |
| Provider not configured | WhatsApp/email | `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `PROVIDER_CREDENTIAL_ENCRYPTION_KEY`, stato provider in DB |
| Stale subscription | Platform + Web Push | Controllare `NEXT_PUBLIC_API_URL`, TTL sessione, `PUSH_VAPID_PUBLIC_KEY` coerente, `customer_push_subscriptions` |
| Module disabled | Feature flags | Controllare `salon_modules`, `requireModule` in API, `useModuleEnabled` in UI |
| CORS error | API + frontend | `API_CORS_ORIGIN` include origine frontend, `COOKIE_SECURE` coerente con HTTPS |

---

## 27. Architecture Considerations

### 27.1 Config drift

Le env sono condivise tra più servizi. Se una env è obbligatoria in un servizio ma manca, il servizio non avvia. In particolare:

- `REVIEW_TOKEN_SECRET` è obbligatoria in communications e usata anche in booking e altri dove serve review token
- `PUSH_VAPID_*` è condiviso tra communications e booking
- `META_*`, `PROVIDER_CREDENTIAL_*` sono opzionali ma necessari per WhatsApp

Documentare eventuali env aggiuntive in ogni servizio prima di aggiungerle.

### 27.2 Shared package coupling

I pacchetti condivisi (`@esse-beauty/db`, `@esse-beauty/shared`, `@esse-beauty/feature-flags`, `@esse-beauty/server-shared`, `@esse-beauty/comms-contracts`, `@esse-beauty/queue-client`, `@esse-beauty/domain-events`, `@esse-beauty/loyalty-contracts`) sono usati da tutti i servizi. Un cambio in uno di questi può richiedere rebuild e riavvio di tutti.

### 27.3 Service ownership

Alcune funzionalità sono ancora in api (legacy core) e altre sono state splittate. Il gateway smista in base al path. Se si aggiunge una nuova feature, decidere se rimane in api o va in un servizio specializzato e aggiornare gateway/nginx.conf di conseguenza.

### 27.4 In-process cross-domain helpers

Alcuni servizi usano helper cross-domain tramite pacchetti condivisi (es. `domain-events` per loyalty award, `comms-contracts` per outbox e review). Questo evita chiamate HTTP sincrone ma introduce dipendenze a livello di codice.

### 27.5 Env propagation

Le env devono essere presenti in tutti i servizi che le usano. In Docker Compose, ogni servizio dichiara le sue env esplicitamente. In sviluppo locale, il script `dev.ps1` passa le env a tutti i processi.

### 27.6 Migration/split risks

Il refactoring da monolite a microservizi ha introdotto:

- gateway con smistamento path-based
- code BullMQ cross-service
- env condivise tra servizi
- pacchetti condivisi con dipendenze cross-service

Testare sempre:

- che le route siano correttamente smistate
- che le env siano presenti in tutti i servizi
- che le code siano disponibili
- che le migrazioni funzionino

---

## 28. Contribution Workflow

Non c'è un CONTRIBUTING.md presente nel repo. In assenza di linee guida esplicite:

- Lavorare su branch feature
- Eseguire typecheck e test mirati per le aree modificate
- Eseguire build e test più ampi a fine blocco
- Non committare `.env` o segreti
- Non perturbare `.env.example` con valori reali

---

## 29. Security Notes

- Auth locale, non Supabase
- Password hashate con sale
- Sessioni revocabili
- Cookie secure in produzione
- CORS con credenziali, origin whitelist
- Rate limit: 1000/min per utente autenticato, 100/min per IP anonimo
- Helmet abilitato
- Provider credentials cifrati con `PROVIDER_CREDENTIAL_ENCRYPTION_KEY`
- Segreti: `REVIEW_TOKEN_SECRET`, `REVIEW_SESSION_SECRET`, `PROVIDER_CREDENTIAL_ENCRYPTION_KEY`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `PUSH_VAPID_PRIVATE_KEY`
- Non hardcodare segreti; usare env
- Non committare `.env`

---

## 30. Maintenance Checklist

Prima di upgrade o deploy:

- [ ] Deps: controllare `pnpm update` se necessario, testare
- [ ] Migrations: generare e testare migrazioni nuove, controllare rollback
- [ ] Env: verificare che tutte le env richieste siano presenti in tutti i servizi, specialmente segreti
- [ ] Compose: verificare che compose.yaml sia coerente con env e servizi
- [ ] Health: verificare healthcheck di tutti i servizi
- [ ] Code: verificare che le code BullMQ siano disponibili e i worker avviati
- [ ] Test: eseguire test mirati e più ampi
- [ ] Backup: verificare backup DB e Redis se in produzione
- [ ] Deploy: verificare che il deploy sia coerente con compose e con nginx se usato

---

*Questo documento è basato su codice verificato nel repository. Per funzionalità non ancora implementate o aree in evoluzione, le descrivo come tali.*
