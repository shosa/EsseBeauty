# Esse Beauty con Docker

Lo stack comprende:

- `esse-beauty-db`: PostgreSQL 16, raggiungibile dagli altri container come `db:5432`
- `esse-beauty-redis`: Redis 7 per BullMQ
- `esse-beauty-migrate`: applica le migrazioni Drizzle e termina
- `esse-beauty-api`: Fastify su `http://localhost:3001`
- `esse-beauty-web`: dashboard Next.js su `http://localhost:3000`
- `esse-beauty-pwa`: portale clienti su `http://localhost:3002`

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

Le variabili `NEXT_PUBLIC_*` vengono incorporate durante la build. Dopo averle
modificate è quindi necessario ricostruire `web` e `pwa`.

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
postgresql://postgres:postgres@db:5432/esse_beauty
```

## Stato

```powershell
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs migrate
docker compose --env-file .env.docker logs api
```

L'API viene avviata solo dopo il completamento delle migrazioni e dopo che
PostgreSQL e Redis risultano healthy.
