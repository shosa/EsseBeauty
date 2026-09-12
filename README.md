# EsseBeauty

Piattaforma gestionale multi-salone per attività beauty e benessere.

---

## Cos'è EsseBeauty

EsseBeauty è una piattaforma software completa che unisce **gestione operativa dei saloni**, **esperienza cliente**, **marketing e fedeltà**, **commerciale e cassa**, **inventario** e **automatizzazioni comunicative** in un'unica architettura multi-tenant.

Il prodotto è pensato per:

- titolari e manager di centri estetici, beauty salon, studio di estetica
- staff di sala (receptionist, operatori, collaboratori)
- clienti finali che prenotano e gestiscono il proprio percorso tramite PWA pubblica

Offre un'esperienza cohesive da **dashboard gestionale** a **PWA cliente**, con backend modulare, automazioni intelligenti e interfaccia moderna.

---

## Cosa risolve

**Per il titolare / manager**

- Gestione centralizzata di più saloni da un'area platform
- Configurazione moduli a livello di singolo salone
- Panoramica persone, vendite, attività e stato servizi
- Gestione piani, accesso titolare e audit log centralizzato

**Per il salone operativo**

- Agenda condivisa, slot, staff, servizi, clienti e note
- Prenotazioni online pubbliche con gestione conflitti e risorse
- Lista d'attesa con notifica automatica quando si libera uno slot
- Cassa e vendita completa, voucher, chiusure, reportistica
- Inventario pezzi, movimenti, scadenze, riordini, contabilità base
- Promemoria WhatsApp/email/app per appuntamenti
- Recensioni con invio automatico, raccolta e pubblicazione
- Programma fedeltà punti, premi e redemption
- Campagne marketing segmentate via email, WhatsApp e app
- Permessi granulari per ruolo e override per utente

**Per il cliente finale**

- Landing page del salone con prenotazione online
- Selezione servizi, operatore, slot
- Gestione account cliente (email/telefono)
- Consultazione appuntamenti, cancellazioni e riprogrammazioni
- Fedeltà e premi visibili nella PWA
- Invio recensione post appuntamento

---

## Product Highlights

<table>
  <tr>
    <th>Area</th>
    <th>Cosa offre</th>
  </tr>
  <tr>
    <td>Smart Booking</td>
    <td>Prenotazione online pubblica, ricerca slot, multi-servizio, preferenza staff, risorse, calendario operativo, lista d'attesa, cancellazioni e riprogrammazioni.</td>
  </tr>
  <tr>
    <td>Customer CRM</td>
    <td>Anagrafica cliente, storico, note, tag, consensi marketing, blocchi, merget hint, fedeltà integrata.</td>
  </tr>
  <tr>
    <td>Staff Workspace</td>
    <td>Profili operatori, ruoli, permessi, agenda personale, blocchi disponibilità, richieste disponibilità.</td>
  </tr>
  <tr>
    <td>Sales &amp; Checkout</td>
    <td>Cassa, vendita servizi e prodotti, pagamenti multipli, vouchers, ridenzioni fedeltà in vendita, void, chiusure, export contabilità.</td>
  </tr>
  <tr>
    <td>Loyalty</td>
    <td>Punti per appuntamento e vendita, premi, tier, earning rules, scadenza, redemption con approvazione, vouchers generati da premi.</td>
  </tr>
  <tr>
    <td>Inventory</td>
    <td>Prodotti, stock, soglie, movimenti, documenti, fornitori, conteggi, spese, asset, riordini.</td>
  </tr>
  <tr>
    <td>Communications</td>
    <td>WhatsApp (Meta Cloud API), email, promemoria, recensioni, outbox, webhook, gestione provider per salone.</td>
  </tr>
  <tr>
    <td>Reviews</td>
    <td>Richiesta automatica post appuntamento, delivery multi-canal, raccolta, risposta staff, pubblicazione.</td>
  </tr>
  <tr>
    <td>Marketing</td>
    <td>Campagne email, WhatsApp e app, segmentazione, pianificazione, stato di invio, templating.</td>
  </tr>
  <tr>
    <td>Customer PWA</td>
    <td>Landing salone, prenotazione, appuntamenti, fedeltà, recensioni, account cliente, push.</td>
  </tr>
  <tr>
    <td>Staff PWA</td>
    <td>Interfaccia mobile per staff, accesso al contesto salone.</td>
  </tr>
  <tr>
    <td>Platform Admin</td>
    <td>Multi-tenant, creazione saloni, piani, moduli, accesso titolare, audit, email platform, stato servizi.</td>
  </tr>
  <tr>
    <td>SaaS &amp; Moduli</td>
    <td>Feature flag persistenti per salone, catalogo moduli, enforced su API e UI, abilitazione da platform.</td>
  </tr>
</table>

---

## Customer Experience

Il cliente scopre il salone, consulta servizi e orari, sceglie un trattamento,
aggiusta il momento e pu&ograve; indicare l'operatore preferito.
La prenotazione viene confermata e il cliente riceve promemoria prima dell'appuntamento.
Dopo il trattamento, pu&ograve; lasciare una recensione e accumulare punti fedelt&agrave;.
Tutto questo &egrave; disponibile dalla PWA pubblica senza obbligo di scaricare un'app.

---

## Salon Operations

Il team di sala gestisce l'agenda in tempo reale, crea e modifica appuntamenti,
assegna risorse e staff, gestisce clienti e note, chiude le vendite,
gestisce voucher e scontrini, tiene traccia di stock e movimenti,
e lancia campagne promozionali segmentate.
I permessi e i moduli limitano ci&ograve; che ogni ruolo vede e fa.

---

## Communication Layer

Il sistema invia promemoria, richieste di recensione e campagne utilizzando
WhatsApp (Meta Cloud API), email e notifiche push alla PWA.
Le comunicazioni transitive passano attraverso un outbox persistente con
ritentativi, lease e recovery automatica, in modo che nessun lavoro soggetto
a fallimento venga perso se un processo va gi&agrave; in background o si interrompe.

---

## SaaS Architecture

EsseBeauty &egrave; multi-tenant: ogni salone &egrave; isolato nei dati e nelle impostazioni.
La platform amministra i saloni, i piani, il catalogo moduli e l'accesso titolare.
Al livello salone, i moduli sono feature flag persistenti che attivano o meno
interwhole funzionali (promemoria, recensioni, lista d'attesa, fedelt&agrave;,
marketing, inventario, performance staff).

I moduli sono:

- controllati a livello API con enforcing server-side
- controllati a livello UI con gating React
- gestibili da platform e visibili, in lettura, nella dashboard salone

---

## Applications

| App | Porta dev | Scopo | Pubblico |
|-----|-----------|-------|----------|
| Web dashboard | 3000 | Gestione salone + area platform | Staff, manager, owner |
| Customer PWA | 3002 | Prenotazione e servizi cliente | Clienti finali |
| Staff PWA | 3003 | Opera per lo staff | Operatori e receptionist |
| Platform admin | 3004 | Gestione multi-salone | Platform admin, owner |
| Website | 3005 | Sito pubblico / marketing | Visitatori |
| API (legacy core) | 3011 | Core route: auth, clients, services, settings, shell, reports, onboarding, public, platform | Frontend e servizi |
| Communications | 3013 | WhatsApp/email, promemoria, recensioni, outbox, webhook | Servizi backend e frontend |
| Loyalty &amp; Marketing | 3006 | Fedelt&agrave;, premi, campagne | Servizi backend e frontend |
| Booking | 3007 | Appuntamenti, slot, calendario, waitlist | Servizi backend e frontend |
| Commerce | 3008 | Inventario, cassa, voucher, contabilit&agrave; | Servizi backend e frontend |
| Identity | 3009 | Auth staff, sessioni, password, utenti, permessi | Servizi backend e frontend |
| Gateway (opzionale) | 3001 | Nginx di smistamento API | — |

In sviluppo locale, tutti gli URL pubblici passano di norma per il gateway locale
su `http://localhost:3001`.

---

## Technology

- **Runtime**: Node.js >= 22
- **Package manager**: pnpm 10.12.1
- **Build orchestration**: Turbo
- **Backend**: Fastify 5, multi-servizio
- **Frontend**: Next.js 15, React 19, Tailwind CSS 4
- **Shared UI**: Design system interno in `packages/ui`
- **Database**: PostgreSQL 16
- **ORM**: Drizzle ORM
- **Cache / code**: Redis 7 + BullMQ
- **Auth**: Cookie sessioni, password hashate, JWT-free
- **Push**: Web Push / VAPID
- **WhatsApp**: Meta Cloud API
- **Email**: SMTP configurabile da platform, Resend opzionale
- **Container / deploy**: Docker Compose, Nginx (opzionale)
- **Lingue**: TypeScript across il monorepo

---

## Architecture at a Glance

```
PWA cliente        Staff PWA        Web dashboard       Platform admin     Website
      \               \                  \                   \                \
       +----- gateway/nginx (opzionale, porta 3001) -----+
                                                       |
          +----------+-----------+-------------+--------+-----------+
          |          |           |             |        |           |
     api (legacy) communications loyalty-marketing booking commerce  identity
          |          |           |             |        |           |
          +----------+-----------+-------------+--------+-----------+
                                                       |
                                          PostgreSQL 16  +  Redis 7
```

Smistamento gateway (se attivo):

- `/api/auth/**` → identity
- `/api/salons/…/appointments|slots|calendar-events|waitlist*` → booking
- `/api/salons/…/communications|reminders|reviews|review-invitations*` → communications
- `/api/salons/…/loyalty|campaigns|campaign-templates*` → loyalty-marketing
- `/api/salons/…/inventory|pos-\*|sales|vouchers|accounting*` → commerce
- `/api/salons/…/appointments/…/checkout` → commerce
- tutto il resto → api (legacy core)

---

## Project Status

**Attivo inviluppo continuo.** Il prodotto &egrave; utilizzabile in locale con Docker
o processi nativi e include un demo seed deterministico per esercitare i flussi.

Alcune aree sono ancora in evoluzione e alcune pagine/route potrebbero non
essere ancora esposte in ogni frontend; il codice &egrave; articolato in modo da
rendere queste parti isolabili e progressivamente attivabili.

---

## Repository &amp; License

Questo repository &egrave; privato. Non &egrave; rilasciato come open source.
Vedi la licenza del repository per i termini di utilizzo.

---

## Codice verificato

Questo README &egrave; basato su:

- `compose.yaml`
- `gateway/nginx.conf`
- `apps/*/package.json`
- `packages/db/schema.ts`
- `packages/queue-client/queues.ts`
- `apps/*/src/jobs/*.ts`
- `apps/*/src/env.ts`
- `scripts/dev.ps1`
- `deploy/nginx/`

Non includiamo funzionalit&agrave; che non sono implementate nel codice.
Per dettagli operativi e di sviluppo, vedi [TECH.md](./TECH.md).
