# ESSEBEAUTY.md

Compendio tecnico e funzionale di EsseBeauty per agenti software.

Questo documento descrive architettura, struttura del repository, dominio applicativo, moduli, database, API, UI, flussi principali e convenzioni operative. Usarlo come contesto iniziale prima di modificare il progetto.

## 1. Identità del prodotto

EsseBeauty è una piattaforma gestionale multi-salone per attività beauty.

Il software copre:

- gestione saloni e configurazione centrale;
- dashboard gestionale per titolari e staff;
- prenotazioni, calendario, clienti, servizi e collaboratori;
- moduli opzionali attivabili per salone;
- portale pubblico/PWA per clienti finali;
- automazioni operative come promemoria, recensioni, lista d'attesa, marketing, fedeltà, inventario e report.

La separazione concettuale principale è:

- **Platform / gestione centrale**: amministrazione dei saloni, moduli inclusi, accesso titolare.
- **Web dashboard salone**: uso quotidiano da parte del salone.
- **PWA pubblica**: prenotazione e consultazione lato cliente.
- **API**: Fastify, autenticazione locale, logica dominio, job e integrazioni.
- **DB**: PostgreSQL via Drizzle ORM.

## 2. Stack tecnico

### Runtime e linguaggi

- Monorepo TypeScript.
- Node.js `>=22`.
- Package manager: `pnpm@10.12.1`.
- Build orchestration: Turbo.

### Frontend

- `Next.js 15`.
- `React 19`.
- `Tailwind CSS 4`.
- Shared UI package in `packages/ui`.
- Dashboard web in `apps/web`.
- PWA pubblica in `apps/pwa`.

### Backend

- `Fastify 5`.
- `Drizzle ORM`.
- `postgres` driver.
- `BullMQ` + Redis per job.
- Cookie auth.
- `@fastify/cors`, `@fastify/cookie`, `@fastify/helmet`, `@fastify/rate-limit`.

### Database e infrastruttura locale

- PostgreSQL 16.
- Redis 7.
- Docker Compose disponibile.

Container previsti:

- `esse-beauty-db`: PostgreSQL, raggiungibile internamente come `db:5432`.
- `esse-beauty-redis`: Redis, raggiungibile internamente come `redis:6379`.
- `esse-beauty-migrate`: applica migrazioni Drizzle.
- `esse-beauty-api`: API Fastify su `3001`.
- `esse-beauty-web`: dashboard su `3000`.
- `esse-beauty-pwa`: PWA su `3002`.

## 3. Struttura repository

```text
.
├─ apps/
│  ├─ api/          Fastify API, route dominio, auth, jobs
│  ├─ web/          Dashboard salone + area platform Next.js
│  └─ pwa/          Portale pubblico/PWA clienti
├─ packages/
│  ├─ db/           Drizzle schema, db client, migrazioni
│  ├─ feature-flags/ Moduli attivabili per salone
│  ├─ shared/       Permessi, ruoli, utilities condivise
│  └─ ui/           Componenti UI condivisi e design tokens
├─ scripts/
│  └─ dev.ps1       Avvio locale coordinato
├─ compose.yaml     Stack Docker
├─ DOCKER.md        Note operative Docker
├─ package.json     Script root
└─ pnpm-workspace.yaml
```

## 4. Workspace package

### `apps/api`

API HTTP principale.

Entry principali:

- `apps/api/src/index.ts`: boot server.
- `apps/api/src/app.ts`: crea app Fastify, plugin, route, healthcheck.
- `apps/api/src/env.ts`: variabili ambiente richieste.
- `apps/api/src/middleware/auth.ts`: autenticazione sessione salone.
- `apps/api/src/routes/**`: route dominio.
- `apps/api/src/jobs/**`: job asincroni e hook evento.

Script:

- `pnpm --filter @esse-beauty/api dev`
- `pnpm --filter @esse-beauty/api typecheck`
- `pnpm --filter @esse-beauty/api test`
- `pnpm --filter @esse-beauty/api build`

### `apps/web`

Dashboard gestionale salone e area platform centrale.

Route principali:

- `app/login/page.tsx`: login/bootstrap salone.
- `app/platform/page.tsx`: configurazione centrale saloni.
- `app/(dashboard)/page.tsx`: dashboard salone.
- `app/(dashboard)/calendar/**`: calendario e appuntamenti.
- `app/(dashboard)/clients/**`: clienti.
- `app/(dashboard)/services/**`: servizi.
- `app/(dashboard)/staff/**`: staff.
- `app/(dashboard)/settings/**`: impostazioni.
- `app/(dashboard)/reviews/page.tsx`: recensioni.
- `app/(dashboard)/waitlist/page.tsx`: lista d'attesa.
- `app/(dashboard)/marketing/**`: campagne.
- `app/(dashboard)/inventory/**`: magazzino.
- `app/(dashboard)/reports/page.tsx`: performance staff.

Componenti shell:

- `app/(dashboard)/_components/DashboardShell.tsx`: sidebar, mobile nav, command palette, notification drawer, quick create.
- `app/(dashboard)/_components/Icons.tsx`: icone SVG condivise.
- `lib/auth-context.tsx`: sessione, salone, utente e permessi lato client.

Script:

- `pnpm --filter @esse-beauty/web dev`
- `pnpm --filter @esse-beauty/web typecheck`
- `pnpm --filter @esse-beauty/web test`
- `pnpm --filter @esse-beauty/web build`

### `apps/pwa`

Portale pubblico per clienti finali.

Route:

- `/`: pagina base.
- `/[slug]`: landing pubblica salone.
- `/[slug]/book`: prenotazione pubblica.
- `/[slug]/appointments`: appuntamenti cliente.
- `/[slug]/loyalty`: fedeltà pubblica cliente.
- `/review/[appointmentId]`: invio recensione post appuntamento.

Script:

- `pnpm --filter @esse-beauty/pwa dev`
- `pnpm --filter @esse-beauty/pwa typecheck`
- `pnpm --filter @esse-beauty/pwa build`

### `packages/db`

Schema database e connessione Drizzle.

File principali:

- `packages/db/schema.ts`: schema completo.
- `packages/db/drizzle.config.ts`: configurazione Drizzle.

Script:

- `pnpm --filter @esse-beauty/db db:generate`
- `pnpm --filter @esse-beauty/db db:migrate`
- `pnpm --filter @esse-beauty/db build`

### `packages/feature-flags`

Gestione moduli salone.

File principali:

- `keys.ts`: elenco moduli.
- `server.ts`: helper server `isModuleEnabled`, `requireModule`, cache moduli.
- `react.tsx`: `ModuleProvider`, `useModuleEnabled`, `useModules`.

### `packages/shared`

Ruoli, permessi e utilities condivise.

File principali:

- `permissions.ts`: ruoli, permessi, default per ruolo, cache permessi.
- `utils/slots.ts`: logica disponibilità slot.

### `packages/ui`

Design system condiviso.

File principale:

- `packages/ui/index.tsx`

Contiene:

- `designTokens`;
- `Button`;
- `AppPage`;
- `PageHeader`;
- `SectionCard`;
- `StatGrid`, `StatCard`;
- `StatusBadge`;
- `Badge`;
- `Switch`;
- `FormField`;
- `SaveToast`;
- `Dialog`, `ConfirmDialog`, `Drawer`;
- `DataTable`;
- `ScheduleEditor`;
- `Breadcrumbs`;
- skeleton e empty states.

## 5. Avvio locale

### Avvio dev manuale

Da root:

```powershell
pnpm run dev
```

Lo script `scripts/dev.ps1` avvia:

- API su `http://localhost:3001`;
- web su `http://localhost:3000`;
- PWA su `http://localhost:3002`.

### Variabili ambiente essenziali

API:

- `DATABASE_URL`
- `API_CORS_ORIGIN`
- `API_HOST` opzionale, default `0.0.0.0`
- `PORT` opzionale, default `3001`

Frontend:

- `NEXT_PUBLIC_API_URL`

Docker:

- host interno PostgreSQL: `db`
- host interno Redis: `redis`
- stringa tipica container: `postgresql://postgres:postgres@db:5432/esse_beauty`

## 6. Autenticazione

Il progetto usa autenticazione locale, non Supabase.

### Dashboard salone

Entità:

- `users`
- `user_credentials`
- `auth_sessions`
- `password_reset_tokens`
- `login_activity`

Cookie/sessioni:

- Sessione applicativa gestita dall'API.
- `apps/api/src/middleware/auth.ts` valida sessione e popola `request.user` e `request.salonId`.

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

Lato web:

- `apps/web/lib/auth-context.tsx` carica `GET /api/auth/me`.
- Espone `user`, `salon`, `permissions`, `hasPermission()`.

### Area platform centrale

Entità:

- `platform_admins`
- `platform_admin_sessions`

Cookie:

- `esse-platform-session`

Endpoint:

- `GET /api/platform/auth/bootstrap/status`
- `POST /api/platform/auth/bootstrap`
- `POST /api/platform/auth/login`
- `POST /api/platform/auth/logout`
- `GET /api/platform/auth/me`

La platform è separata dagli utenti salone. Serve per creare saloni, gestire moduli e configurare accesso titolare.

## 7. Ruoli e permessi

Ruoli applicativi:

- `owner`
- `manager`
- `receptionist`
- `employee`

Permessi:

- `calendar.view_own`
- `calendar.manage_own`
- `calendar.view_others`
- `calendar.manage_others`
- `calendar.delete`
- `clients.view`
- `clients.edit`
- `clients.block`
- `reports.view_own`
- `reports.view_all`
- `reports.export`
- `settings.salon`
- `settings.services`
- `settings.staff`
- `settings.users`
- `settings.modules`
- `reviews.reply`
- `marketing.send`
- `inventory.manage`
- `waitlist.manage`
- `loyalty.manage`

Default:

- `owner`: tutti i permessi.
- `manager`: quasi tutti, esclusi gestione utenti e moduli.
- `receptionist`: calendario, clienti, report personali.
- `employee`: calendario personale, clienti, report personali.

I permessi possono essere sovrascritti in `user_permissions`.

## 8. Moduli salone

I moduli sono feature flag persistenti per salone, in tabella `salon_modules`.

Chiavi:

- `reminders`
- `reviews`
- `waitlist`
- `loyalty`
- `marketing`
- `inventory`
- `staff_performance`

Implementazione:

- `packages/feature-flags/keys.ts`: definisce chiavi.
- `packages/feature-flags/server.ts`: enforcement API.
- `packages/feature-flags/react.tsx`: gating UI lato salone.

Gestione:

- La platform abilita/disabilita moduli.
- La dashboard salone mostra solo i moduli attivi in sidebar.
- La pagina `settings/modules` lato salone è informativa/read-only.

Endpoint:

- `GET /api/salons/:id/modules`: stato moduli del salone autenticato.
- `GET /api/platform/salons/:salonId/modules`: stato moduli da platform.
- `PATCH /api/platform/salons/:salonId/modules/:key`: abilita/disabilita modulo.

## 9. Database: schema dominio

Schema in `packages/db/schema.ts`.

### Tabelle core

- `salons`: saloni, slug pubblico, timezone, locale, piano, stato.
- `users`: utenti salone.
- `user_credentials`: password hash/salt e flag cambio password.
- `auth_sessions`: sessioni utenti salone.
- `platform_admins`: admin centrali.
- `platform_admin_sessions`: sessioni admin centrali.

### Permessi e sicurezza

- `user_permissions`: override permessi.
- `password_reset_tokens`: reset password.
- `login_activity`: audit accessi.

### Configurazione salone

- `salon_modules`: moduli attivi.
- `reminder_settings`: impostazioni promemoria.
- `loyalty_settings`: impostazioni punti fedeltà.
- `saved_views`: viste salvate.

### Staff e servizi

- `staff`: collaboratori.
- `services`: servizi.
- `service_staff`: associazione molti-a-molti servizi/collaboratori.
- `availability_blocks`: blocchi disponibilità staff.

### Clienti e appuntamenti

- `customers`: clienti.
- `customer_tags`: tag cliente.
- `appointments`: appuntamenti.
- `appointment_notes`: note appuntamento.

### Automazioni e comunicazioni

- `reminders`: promemoria SMS/email.
- `notifications`: notifiche in-app.
- `activity_log`: audit attività.

### Recensioni e lista d'attesa

- `reviews`: recensioni, una per appuntamento.
- `waitlist_entries`: richieste lista d'attesa.

### Fedeltà

- `loyalty_adjustment_reasons`
- `loyalty_tiers`
- `loyalty_rewards`
- `loyalty_reward_redemptions`
- `loyalty_points`

### Marketing

- `campaign_templates`
- `marketing_campaigns`
- `campaign_recipients`

### Inventario

- `inventory_products`
- `inventory_reorder_requests`
- `inventory_movements`

## 10. API: struttura e responsabilità

Le route sono registrate in `apps/api/src/app.ts`.

Plugin globali:

- cookie;
- CORS con credenziali;
- helmet;
- rate limit;
- healthcheck.

### Convenzione tenant salone

La maggior parte delle route usa path:

```text
/api/salons/:id/...
```

L'autenticazione determina `request.salonId`. La route viene accettata solo se `:id` corrisponde al salone della sessione, tramite controlli middleware o route-specifici.

### Route core

#### Appuntamenti

- Lista appuntamenti per intervallo/staff/status.
- Slot disponibili per staff, servizio e data.
- Creazione manuale/walk-in.
- Dettaglio appuntamento.
- Aggiornamento stato, data, note.
- Eliminazione.

Path principali:

- `GET /api/salons/:id/appointments`
- `GET /api/salons/:id/slots`
- `POST /api/salons/:id/appointments`
- `GET /api/salons/:id/appointments/:appointmentId`
- `PATCH /api/salons/:id/appointments/:appointmentId`
- `DELETE /api/salons/:id/appointments/:appointmentId`

#### Clienti

Funzioni:

- ricerca e paginazione clienti;
- profilo cliente;
- creazione/modifica/eliminazione;
- blocco/sblocco;
- timeline o dati associati;
- integrazione loyalty.

Path principali:

- `GET /api/salons/:id/customers`
- `GET /api/salons/:id/customers/:customerId`
- `POST /api/salons/:id/customers`
- `PATCH /api/salons/:id/customers/:customerId`
- `DELETE /api/salons/:id/customers/:customerId`

#### Servizi

Funzioni:

- lista servizi;
- creazione;
- modifica;
- soft delete/disattivazione;
- riordino display.

Path principali:

- `GET /api/salons/:id/services`
- `POST /api/salons/:id/services`
- `PATCH /api/salons/:id/services/:serviceId`
- `DELETE /api/salons/:id/services/:serviceId`
- `PATCH /api/salons/:id/services/order`

#### Staff

Funzioni:

- lista collaboratori;
- creazione/modifica/disattivazione;
- blocchi disponibilità.

Path principali:

- `GET /api/salons/:id/staff`
- `POST /api/salons/:id/staff`
- `PATCH /api/salons/:id/staff/:staffId`
- `DELETE /api/salons/:id/staff/:staffId`
- `GET /api/salons/:id/staff/:staffId/availability-blocks`
- `POST /api/salons/:id/staff/:staffId/availability-blocks`
- `DELETE /api/salons/:id/staff/:staffId/availability-blocks/:blockId`

#### Settings salone

Funzioni:

- lettura e modifica impostazioni salone.

Path:

- `GET /api/salons/:id/settings`
- `PATCH /api/salons/:id/settings`

### Route moduli

#### Promemoria

Modulo: `reminders`.

Funzioni:

- impostazioni SMS/email;
- ore prima appuntamento;
- lista promemoria.

Path:

- `GET /api/salons/:id/reminders/settings`
- `PATCH /api/salons/:id/reminders/settings`
- `GET /api/salons/:id/reminders`

#### Recensioni

Modulo: `reviews`.

Funzioni:

- invio recensione pubblica su appuntamento;
- lista recensioni salone;
- risposta salone;
- pubblicazione/privata.

Path:

- `GET /api/reviews/:appointmentId`
- `POST /api/reviews/:appointmentId`
- `GET /api/salons/:id/reviews`
- `PATCH /api/salons/:id/reviews/:reviewId/reply`
- `PATCH /api/salons/:id/reviews/:reviewId/publish`

#### Lista d'attesa

Modulo: `waitlist`.

Funzioni:

- richiesta pubblica o interna;
- lista e filtri;
- cambio stato;
- eliminazione.

Path:

- `POST /api/salons/:id/waitlist`
- `GET /api/salons/:id/waitlist`
- `PATCH /api/salons/:id/waitlist/:entryId`
- `DELETE /api/salons/:id/waitlist/:entryId`

#### Fedeltà

Modulo: `loyalty`.

Funzioni:

- punti per appuntamento;
- premi;
- saldo cliente;
- movimenti punti;
- pagina pubblica loyalty.

Path:

- `GET /api/salons/:id/loyalty/settings`
- `PATCH /api/salons/:id/loyalty/settings`
- `GET /api/salons/:id/loyalty/rewards`
- `POST /api/salons/:id/loyalty/rewards`
- `PATCH /api/salons/:id/loyalty/rewards/:rewardId`
- `DELETE /api/salons/:id/loyalty/rewards/:rewardId`
- `GET /api/salons/:id/loyalty/customers/:customerId`
- `POST /api/salons/:id/loyalty/customers/:customerId/points`

#### Marketing

Modulo: `marketing`.

Funzioni:

- campagne email/SMS;
- segmenti target;
- bozze, pianificazione, invio;
- destinatari e statistiche.

Path:

- `GET /api/salons/:id/campaigns`
- `POST /api/salons/:id/campaigns`
- `PATCH /api/salons/:id/campaigns/:campaignId`
- `POST /api/salons/:id/campaigns/:campaignId/send`
- `GET /api/salons/:id/campaigns/:campaignId`

#### Inventario

Modulo: `inventory`.

Funzioni:

- prodotti;
- scorte;
- soglie;
- movimenti;
- richieste riordino.

Path:

- `GET /api/salons/:id/inventory`
- `POST /api/salons/:id/inventory`
- `PATCH /api/salons/:id/inventory/:productId`
- `DELETE /api/salons/:id/inventory/:productId`
- `POST /api/salons/:id/inventory/:productId/movements`
- `GET /api/salons/:id/inventory/:productId`

#### Report / performance staff

Modulo: `staff_performance`.

Funzioni:

- performance staff;
- report personali;
- servizi più richiesti;
- export CSV.

Path:

- `GET /api/salons/:id/reports/staff`
- `GET /api/salons/:id/reports/own`
- `GET /api/salons/:id/reports/services`
- `GET /api/salons/:id/reports/export`

### Shell API

Funzioni:

- ricerca globale `Ctrl+K`;
- notifiche;
- gestione notifiche lette/eliminate.

Path:

- `GET /api/salons/:id/search`
- `GET /api/salons/:id/notifications`
- `PATCH /api/salons/:id/notifications/:notificationId`
- `DELETE /api/salons/:id/notifications/:notificationId`

### Public API

Non richiede sessione salone.

Funzioni:

- recupero salone da slug;
- slot pubblici;
- prenotazione pubblica;
- appuntamenti cliente via email.

Path:

- `GET /api/public/:slug`
- `GET /api/public/:slug/slots`
- `POST /api/public/:slug/book`
- `GET /api/public/:slug/appointments`

### Platform API

Area centrale.

Funzioni:

- bootstrap/login admin centrale;
- lista saloni;
- creazione salone;
- modifica salone;
- creazione/aggiornamento accesso titolare;
- lettura e modifica moduli.

Path:

- `GET /api/platform/auth/bootstrap/status`
- `POST /api/platform/auth/bootstrap`
- `POST /api/platform/auth/login`
- `POST /api/platform/auth/logout`
- `GET /api/platform/auth/me`
- `GET /api/platform/salons`
- `POST /api/platform/salons`
- `PATCH /api/platform/salons/:salonId`
- `POST /api/platform/salons/:salonId/owner-access`
- `GET /api/platform/salons/:salonId/modules`
- `PATCH /api/platform/salons/:salonId/modules/:key`

## 11. Job e automazioni

Cartella: `apps/api/src/jobs`.

File:

- `queues.ts`: setup BullMQ/Redis.
- `appointment-events.ts`: hook su eventi appuntamento.
- `reminders.ts`: generazione/invio promemoria.
- `reviews.ts`: richieste recensione post appuntamento.
- `marketing.ts`: invio campagne.
- `notifications.ts`: notifiche interne.

I job devono rispettare:

- modulo attivo del salone;
- stato appuntamento/campagna;
- impostazioni salone;
- idempotenza dove necessario.

## 12. Frontend web: architettura UI

### Layout principale

`apps/web/app/(dashboard)/layout.tsx` monta la shell dashboard.

`DashboardShell` gestisce:

- sidebar desktop;
- bottom nav mobile;
- navigazione principale;
- moduli attivi;
- command palette;
- centro notifiche;
- quick create;
- logout.

### Design system

Usare preferibilmente componenti da `@esse-beauty/ui`.

Componenti raccomandati:

- pagina: `AppPage`;
- intestazione: `PageHeader`;
- card: `SectionCard`;
- KPI: `StatGrid`, `StatCard`;
- stato: `StatusBadge`;
- form: `FormField`;
- azioni: `Button`;
- stato vuoto: `EmptyState`;
- errori: `InlineError`;
- toast: `SaveToast`;
- modal: `Dialog`, `ConfirmDialog`, `Drawer`;
- tabelle generiche: `DataTable` quando adatto.

Stile attuale:

- impronta “atelier gestionale”;
- superfici glass/cipria;
- gradienti cipria/champagne controllati;
- ombre morbide;
- focus ring visibile;
- input tattili e arrotondati;
- copy orientato a operazioni reali, non tecnologia interna.

Evitare:

- nuove pagine con `main` hardcoded e card locali se esiste componente condiviso;
- bottoni nativi senza `Button`, salvo casi minimi;
- testi tecnici rivolti all’utente come `slug`, `feature flag`, `webhook`, `schema`, `UUID`;
- messaggi inline che spostano layout quando una toast è più adatta.

## 13. Frontend web: pagine principali

### Platform

File:

- `apps/web/app/platform/page.tsx`

Responsabilità:

- login/bootstrap admin centrale;
- lista saloni;
- nessuna scheda salone aperta se non è selezionato un salone;
- scheda salone chiudibile con X;
- creazione salone;
- modifica dati salone;
- accesso titolare;
- gestione moduli.

Importante:

- il pannello `Moduli` usa ancora internamente lo stato `features`, ma il copy utente deve parlare di `Moduli`.
- non usare fallback automatico a `salons[0]` per `selectedSalon`.
- la sezione accesso titolare chiama `POST /api/platform/salons/:salonId/owner-access`.

### Dashboard

File:

- `apps/web/app/(dashboard)/page.tsx`

Mostra riepilogo operativo del salone e usa moduli/permessi per controllare cosa rendere visibile.

### Calendario

File:

- `calendar/page.tsx`
- `calendar/appointments/new/page.tsx`
- `calendar/appointments/[appointmentId]/page.tsx`

Responsabilità:

- vista appuntamenti;
- creazione appuntamento;
- dettaglio/modifica stato;
- gestione note/cancellazioni.

### Clienti

File:

- `clients/page.tsx`
- `clients/new/page.tsx`
- `clients/[customerId]/page.tsx`

Responsabilità:

- ricerca/scorrimento clienti;
- creazione;
- scheda cliente;
- blocco/sblocco;
- appuntamenti/loyalty collegati.

### Servizi

File:

- `services/page.tsx`
- `services/new/page.tsx`
- `services/[serviceId]/page.tsx`

Responsabilità:

- catalogo servizi;
- creazione/modifica;
- durata/prezzo;
- servizio attivo/disattivo;
- eventuale ordinamento.

### Staff

File:

- `staff/page.tsx`
- `staff/new/page.tsx`
- `staff/[staffId]/page.tsx`

Responsabilità:

- collaboratori;
- ruoli operativi;
- disponibilità e blocchi.

### Impostazioni

File:

- `settings/page.tsx`
- `settings/layout.tsx`
- `settings/users/**`
- `settings/modules/page.tsx`
- `settings/reminders/page.tsx`
- `settings/loyalty/**`

Responsabilità:

- dati salone;
- utenti e permessi;
- moduli inclusi;
- promemoria;
- programma fedeltà.

### Moduli dashboard

File:

- `reviews/page.tsx`
- `waitlist/page.tsx`
- `marketing/**`
- `inventory/**`
- `reports/page.tsx`

Queste viste devono usare lo stesso linguaggio UI di `AppPage`, `PageHeader`, `SectionCard`, `StatGrid`.

## 14. PWA pubblica

La PWA è in `apps/pwa`.

### Landing salone

Route:

- `/[slug]`

Carica dati pubblici da:

- `GET /api/public/:slug`

### Prenotazione

Route:

- `/[slug]/book`

Flusso:

1. cliente seleziona servizio;
2. sceglie collaboratore preferito se previsto;
3. seleziona slot disponibile;
4. inserisce dati cliente;
5. crea appuntamento via public API.

### Appuntamenti cliente

Route:

- `/[slug]/appointments`

Permette consultazione tramite email cliente.

### Loyalty cliente

Route:

- `/[slug]/loyalty`

Mostra stato fedeltà se modulo attivo.

### Recensione

Route:

- `/review/[appointmentId]`

Usa endpoint recensioni pubblici.

## 15. Convenzioni API e dati

### Naming

- DB schema usa camelCase lato TypeScript e snake_case lato colonne.
- API spesso risponde con snake_case per payload storici o pubblici.
- Frontend definisce interfacce locali con nomi coerenti al JSON ricevuto.

### Autorizzazione

Per nuove route salone:

1. autenticare con `authenticate`;
2. verificare tenant `:id` contro `request.salonId`;
3. verificare permessi con `requirePermission(...)` se azione sensibile;
4. verificare modulo con `requireModule(...)` se fa parte di un modulo opzionale.

### Moduli

Non usare default in memoria o fallback di processo per simulare schema mancante.

Se una feature richiede persistenza:

- aggiornare `packages/db/schema.ts`;
- creare migrazione Drizzle;
- usare il DB come source of truth.

### Errori

Gli errori API usano `{ error: "CODE" }`.

Lato UI, mappare codici tecnici a messaggi utente leggibili.

## 16. Migrazioni e database

Comandi:

```powershell
pnpm --filter @esse-beauty/db db:generate
pnpm --filter @esse-beauty/db db:migrate
```

Quando cambiare schema:

- nuove tabelle;
- nuove colonne persistenti;
- vincoli univoci;
- indici necessari;
- relazioni necessarie per acceptance criteria.

Non risolvere requisiti dati con:

- stato in memoria;
- default process-level;
- workaround frontend;
- JSON temporanei fuori schema se serve struttura queryable.

## 17. Testing e validazione

Script root:

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

Script mirati:

- `pnpm --filter @esse-beauty/api typecheck`
- `pnpm --filter @esse-beauty/api test`
- `pnpm --filter @esse-beauty/web typecheck`
- `pnpm --filter @esse-beauty/web test`
- `pnpm --filter @esse-beauty/web build`
- `pnpm --filter @esse-beauty/pwa typecheck`
- `pnpm --filter @esse-beauty/pwa build`
- `pnpm --filter @esse-beauty/ui build`

Nota operativa recente:

- durante sezioni intensive di UI, non lanciare build/test completi a ogni micro-modifica;
- usare typecheck mirati quando si toccano API/types/import;
- fare validazione più ampia a fine blocco.

## 18. Test esistenti importanti

Esempi:

- API:
  - `apps/api/src/app.test.ts`
  - `apps/api/src/middleware/auth.test.ts`
  - `apps/api/src/routes/appointments/index.test.ts`
  - `apps/api/src/routes/shell/index.test.ts`
  - `apps/api/src/platform-contract.test.ts`
- Web:
  - `apps/web/ui-polish-regression.test.ts`
  - `apps/web/ui-contract.test.ts`
  - `apps/web/middleware.test.ts`
  - `apps/web/shell-config.test.ts`
- Shared:
  - `packages/feature-flags/server.test.ts`
  - `packages/shared/utils/slots.test.ts`
  - `packages/db/schema-contract.test.ts`

`ui-polish-regression.test.ts` contiene guard utili contro regressioni UI e vecchi pattern modali.

## 19. Design e copy guidelines

### Linguaggio utente

Usare parole operative:

- “Moduli”, non “feature flag”.
- “Pagina prenotazioni”, non “slug” se rivolto all’utente.
- “Accesso titolare”, non “user credential”.
- “Piano del salone”, non “tier platform”.

### Stato e feedback

- Per conferme brevi usare `SaveToast`.
- Il colore della toast deve seguire l’esito:
  - `success`: verde;
  - `error`: rosso;
  - `warning`: ambra;
  - `info`: blu.
- Evitare messaggi inline che cambiano altezza/layout della pagina quando non necessario.

### UI

Preferire:

- `AppPage`;
- `PageHeader`;
- `SectionCard`;
- `StatGrid`;
- `StatusBadge`;
- `Button`;
- `FormField`;
- `EmptyState`.

Evitare:

- wrapper locali `main className="min-h-screen bg..."`;
- header hardcoded duplicati;
- tabelle non stilate;
- card bianche senza bordi/ombre coerenti;
- icone generiche per moduli quando esistono icone tematiche.

## 20. Note su branch e stato attuale

Il repository ha avuto modifiche recenti su:

- area platform;
- moduli;
- design system;
- pagine modulo dashboard;
- accesso titolare platform;
- schema e migrazioni precedenti.

Prima di interventi importanti:

```powershell
git status --short
```

Non creare commit o branch salvo richiesta esplicita.

## 21. Punti di attenzione per agenti

### Non rompere multi-tenant

Ogni dato salone deve essere filtrato per `salonId`.

Le route `/api/salons/:id/...` non devono permettere accesso cross-salon.

### Non bypassare moduli

Se una funzione appartiene a un modulo opzionale, controllare:

- API: `requireModule(MODULE_KEYS.X)`;
- UI: `useModuleEnabled(MODULE_KEYS.X)`.

### Non bypassare permessi

Controllare permessi sia lato API che lato UI quando l'azione è sensibile.

### Non usare Supabase

L'autenticazione e i dati sono locali su PostgreSQL.

Supabase non è la source of truth del progetto.

### Non introdurre stato fittizio

Per requisiti persistenti modificare schema/migrazioni/API.

### Curare encoding

Alcuni file mostrano accenti corrotti storici (`Ã`, `â€œ`).

Quando si tocca copy, preferire testo UTF-8 corretto o, se il file è già problematico e serve minimizzare rischio, testo senza accenti.

### Link e bottoni

Evitare `button` annidati dentro `a`.

Per CTA link:

- usare `Link` stilato direttamente;
- oppure refactorare `Button` per supportare `asChild` solo se richiesto.

## 22. Mappa funzionale sintetica

### Core gestionale

- Dashboard: panoramica salone.
- Calendario: appuntamenti, slot, stati.
- Clienti: anagrafica e storico.
- Servizi: catalogo.
- Staff: collaboratori e disponibilità.
- Impostazioni: salone, utenti, permessi, moduli.

### Moduli opzionali

- Promemoria: SMS/email pre-appuntamento.
- Recensioni: feedback post appuntamento, risposta, pubblicazione.
- Lista d'attesa: richieste quando non ci sono slot.
- Fedeltà: punti, premi, movimenti.
- Marketing: campagne email/SMS e destinatari.
- Inventario: prodotti, scorte, movimenti.
- Performance staff: report e export.

### Platform

- Admin centrale separato.
- Creazione saloni.
- Stato salone.
- Moduli inclusi.
- Accesso titolare.
- Configurazione applicativo.

### PWA clienti

- Landing salone.
- Prenotazione.
- Consultazione appuntamenti.
- Loyalty pubblica.
- Recensione.

## 23. File da consultare spesso

Per schema:

- `packages/db/schema.ts`

Per moduli:

- `packages/feature-flags/keys.ts`
- `packages/feature-flags/server.ts`
- `packages/feature-flags/react.tsx`

Per permessi:

- `packages/shared/permissions.ts`

Per API:

- `apps/api/src/app.ts`
- `apps/api/src/routes/**/index.ts`
- `apps/api/src/middleware/auth.ts`

Per UI:

- `packages/ui/index.tsx`
- `apps/web/app/globals.css`
- `apps/web/app/(dashboard)/_components/DashboardShell.tsx`
- `apps/web/app/(dashboard)/_components/Icons.tsx`

Per platform:

- `apps/web/app/platform/page.tsx`
- `apps/api/src/routes/platform/index.ts`

Per PWA:

- `apps/pwa/app/[slug]/page.tsx`
- `apps/pwa/app/[slug]/book/page.tsx`
- `apps/api/src/routes/public/index.ts`

## 24. Checklist modifica feature

Quando si aggiunge o cambia una funzione:

1. Identificare se è core o modulo.
2. Se serve persistenza, aggiornare schema e migrazione.
3. Aggiornare route API.
4. Aggiungere controllo tenant.
5. Aggiungere controllo permessi.
6. Aggiungere controllo modulo se necessario.
7. Aggiornare UI usando design system.
8. Aggiornare PWA se la funzione è pubblica.
9. Aggiornare test mirati o contract test.
10. Eseguire typecheck mirato.
11. Eseguire test/build più ampi a fine blocco.

## 25. Comandi rapidi

```powershell
pnpm install
pnpm run dev
pnpm --filter @esse-beauty/api dev
pnpm --filter @esse-beauty/web dev
pnpm --filter @esse-beauty/pwa dev
pnpm --filter @esse-beauty/api typecheck
pnpm --filter @esse-beauty/web typecheck
pnpm --filter @esse-beauty/pwa typecheck
pnpm --filter @esse-beauty/db db:generate
pnpm --filter @esse-beauty/db db:migrate
docker compose up -d --build
docker compose logs -f
docker compose down
```

