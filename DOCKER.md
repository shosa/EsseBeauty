# Esse Beauty con Docker

Lo stack comprende:

- `esse-beauty-db`: PostgreSQL 16, raggiungibile dagli altri container come `db:5432`
- `esse-beauty-redis`: Redis 7 per BullMQ
- `esse-beauty-migrate`: applica le migrazioni Drizzle e termina
- `esse-beauty-api`: Fastify su `http://localhost:3001`
- `esse-beauty-web`: dashboard Next.js su `http://localhost:3000`
- `esse-beauty-pwa`: portale clienti su `http://localhost:3002`
- `esse-beauty-staff-pwa`: portale staff su `http://localhost:3003`
- `esse-beauty-platform`: console multi-tenant su `http://localhost:3004`

L'autenticazione è locale: password hashate e sessioni revocabili sono salvate
in PostgreSQL. Al primo avvio aprire `http://localhost:3000/login` per creare
il salone e l'account owner.

## Avvio

Creare prima il file ambiente Docker:

```powershell
Copy-Item .env.docker.example .env.docker
```

Generare due segreti distinti con il generatore crittografico di Node.js:

```powershell
node -e "const {randomBytes}=require('node:crypto'); console.log('REVIEW_TOKEN_SECRET='+randomBytes(32).toString('hex')); console.log('REVIEW_SESSION_SECRET='+randomBytes(32).toString('hex'))"
```

Copiare le due righe prodotte nei campi omonimi di `.env.docker`. Non
riutilizzare lo stesso valore e non aggiungere `.env.docker` al versionamento.
I campi sono volutamente vuoti nel template: l'interpolazione `:?` in
`compose.yaml` interrompe l'avvio se uno dei segreti manca.

Avviare quindi lo stack con il percorso documentato, che legge `.env.docker`:

```powershell
corepack pnpm docker:up
```

In alternativa, usando Docker Compose direttamente:

```powershell
docker compose --env-file .env.docker up -d --build
```

Le variabili `NEXT_PUBLIC_*` vengono incorporate durante la build. Dopo averle
modificate è quindi necessario ricostruire `web`, `pwa`, `staff-pwa` e `platform`.

Se `API_CORS_ORIGIN` è impostata esplicitamente sulla VPS, deve includere anche
l'origine pubblica della PWA staff e di Platform, per esempio
`http://IP_VPS:3003` e `http://IP_VPS:3004`.

## Variabili ambiente

Usare `.env.example` per lo sviluppo locale avviato sul computer host e
`.env.docker.example` per Docker Compose. Non riutilizzare un file per l'altro:
dal computer host PostgreSQL è `localhost:5432`, mentre dai container è
`db:5432`.

Valori minimi da controllare prima di una produzione HTTPS:

```text
POSTGRES_DB=esse_beauty
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<password lunga e unica, diversa dal template>
POSTGRES_MAINTENANCE_DB=postgres
COOKIE_SECURE=true
API_CORS_ORIGIN=https://dashboard.example.com,https://app.example.com,https://staff.example.com,https://platform.example.com
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_PWA_URL=https://app.example.com
PWA_URL=https://app.example.com
REVIEW_TOKEN_SECRET=<32+ caratteri casuali>
REVIEW_SESSION_SECRET=<32+ caratteri casuali diversi>
PROVIDER_CREDENTIAL_ENCRYPTION_KEY=<32 byte in base64>
```

Generare la chiave di cifratura provider con:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

`NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_PWA_URL` sono variabili di build per le app
Next.js: dopo ogni modifica bisogna ricostruire le immagini frontend.

## Migrazioni e database

Il servizio `migrate` esegue prima `packages/db/scripts/ensure-database.mjs` e
poi `pnpm --filter @esse-beauty/db db:migrate`.

Questo evita il problema tipico dei volumi PostgreSQL gia inizializzati: la
variabile `POSTGRES_DB` crea il database solo al primo bootstrap del volume. Se
il volume esiste gia e il database applicativo manca, PostgreSQL puo risultare
healthy ma Drizzle fallisce con `database "esse_beauty" does not exist`.

Il preflight usa `DATABASE_URL` per capire il database applicativo e si collega
prima a `POSTGRES_MAINTENANCE_DB`, poi a `postgres`, poi a `template1`. Se il
database applicativo non esiste, lo crea prima di applicare le migrazioni.

Diagnosi rapida in produzione:

```bash
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs migrate
docker compose --env-file .env.docker exec db sh -lc 'psql -U "$POSTGRES_USER" -d postgres -c "\l"'
docker compose --env-file .env.docker exec db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select count(*) from drizzle.__drizzle_migrations;"'
```

Se `migrate` termina con codice diverso da `0`, non forzare l'avvio dell'API:
leggere prima i log del container `esse-beauty-migrate`.

## Comandi

```powershell
corepack pnpm docker:logs
corepack pnpm docker:down
corepack pnpm docker:reset
```

`docker:reset` elimina anche i volumi PostgreSQL e Redis. Usarlo solo quando si
vuole ricreare completamente i dati locali.

## Connessioni

Dal computer host:

```text
PostgreSQL: localhost:5432
Redis:      localhost:6380
```

Da un container dello stack:

```text
PostgreSQL: db:5432
Redis:      redis:6379
API:        api:3001 (`API_INTERNAL_URL`, solo per chiamate server-side)
```

La stringa di connessione interna usata da API e migrazioni è:

```text
postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@db:5432/<POSTGRES_DB>
```

## Stato

```powershell
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs migrate
docker compose --env-file .env.docker logs api
docker compose --env-file .env.docker logs staff-pwa
docker compose --env-file .env.docker logs platform
```

L'API viene avviata solo dopo il completamento delle migrazioni e dopo che
PostgreSQL e Redis risultano healthy.
