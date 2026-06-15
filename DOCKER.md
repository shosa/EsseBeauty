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

Le impostazioni predefinite permettono di avviare lo stack senza un file ambiente:

```powershell
npm run docker:up
```

Per usare credenziali reali:

```powershell
Copy-Item .env.docker.example .env.docker
docker compose --env-file .env.docker up -d --build
```

Le variabili `NEXT_PUBLIC_*` vengono incorporate durante la build. Dopo averle
modificate è quindi necessario ricostruire `web` e `pwa`.

## Comandi

```powershell
npm run docker:logs
npm run docker:down
npm run docker:reset
```

`docker:reset` elimina anche i volumi PostgreSQL e Redis. Usarlo solo quando si
vuole ricreare completamente i dati locali.

## Connessioni

Dal computer host:

```text
PostgreSQL: localhost:5432
Redis:      localhost:6379
```

Da un container dello stack:

```text
PostgreSQL: db:5432
Redis:      redis:6379
```

La stringa di connessione interna usata da API e migrazioni è:

```text
postgresql://postgres:postgres@db:5432/esse_beauty
```

## Stato

```powershell
docker compose ps
docker compose logs migrate
docker compose logs api
```

L'API viene avviata solo dopo il completamento delle migrazioni e dopo che
PostgreSQL e Redis risultano healthy.
