# Restyling scheda Staff (`/staff/:staffId`)

## Obiettivo

Allineare la scheda di dettaglio collaboratore (`apps/web/app/(dashboard)/settings/staff/[staffId]/page.tsx`, montata anche su `/staff/:staffId`) al pattern visivo già introdotto nella scheda cliente (`apps/web/app/(dashboard)/clients/[customerId]/page.tsx`): header hero, stat strip, tab orizzontali. Solo restyling di markup/interazione — nessuna modifica a schema, API o logica di business esistente, salvo il wiring di un'azione già disponibile altrove (disattiva/riattiva collaboratore).

## Struttura pagina

### Hero header

Card `rounded-2xl border border-[#e8dfe4] bg-white p-6 shadow-[0_10px_30px_rgb(45_29_39_/_0.055)]`, stessa forma dell'header cliente:

- avatar circolare con iniziali del collaboratore, sfondo `member.color` (colore reale assegnato, non palette hash come per i clienti);
- titolo: nome collaboratore;
- riga secondaria: email accesso App Staff (o "Accesso non configurato") · sede assegnata (o "Sede non assegnata");
- azione a destra: bottone "Disattiva collaboratore" / "Riattiva collaboratore", che riusa `staffStatusAction` e `ConfirmDialog` già presenti in `settings/staff/page.tsx` — stesso testo di conferma, stessa richiesta `PATCH /api/salons/:id/staff/:staffId` con `{ active }`. Richiede di aggiungere `active` all'interfaccia `Member` caricata in questa pagina (già restituito dall'endpoint `GET /api/salons/:id/staff`, solo non tipizzato/estratto oggi).

### Stat strip

Griglia a 4 celle come nel cliente (`grid grid-cols-2 md:grid-cols-4`):

1. Servizi abilitati (count su `services.filter(enabled)`)
2. Giorni lavorativi/settimana (count giorni con almeno una fascia in `member.workingHours`)
3. Stato accesso App Staff (badge testuale "Attivo"/"Non configurato" derivato da `access.active`/`access.user_id`)
4. Sede (nome sede corrente o "Non assegnata")

### Tab orizzontali

Stessa interazione/stile del cliente (`nav` con pillole, bordo attivo `#792f59`, badge conteggio dove sensato):

- **Profilo** (icona `UserRound`) — nome, colore, biografia
- **Accesso App Staff** (icona `Smartphone`) — form email/password/attivo esistente
- **Sede & Servizi** (icona `MapPinned`) — selezione sede + accordion competenze esistente
- **Orari** (icona `CalendarClock`) — "Carica orari salone" + `ScheduleEditor`

Nessun badge di conteggio sulla tab "Accesso" o "Orari" (non hanno un valore naturale come "appuntamenti" per i clienti); la tab "Sede & Servizi" può mostrare il conteggio servizi abilitati.

### Contenuto tab

Ogni blocco esistente (oggi `SectionCard`) diventa un `article.rounded-2xl.border-[#e8dfe4].bg-white.p-5.shadow-sm`, stesso pattern tipografico del cliente (`h2` con icona `size-4 text-[#792f59]`, sottotitolo `text-xs text-stone-500`). Ogni tab mantiene il proprio `SaveActionButton` indipendente (profilo, accesso, competenze restano tre submit/patch distinti con validazioni diverse — niente salvataggio cumulativo unico).

## Fuori scope

- Nessuna modifica a route API, schema DB, permessi o moduli.
- Nessuna modifica al comportamento di `settings/staff/page.tsx` (lista) oltre a un eventuale riuso del helper `staffStatusAction` già esportato.
- Nessuna introduzione di nuovi campi persistenti.

## Verifica

- `pnpm --filter @esse-beauty/web typecheck`
- Verifica manuale nel browser: apertura scheda, cambio tab, salvataggio profilo, salvataggio accesso, salvataggio sede/competenze, salvataggio orari, disattivazione/riattivazione collaboratore, redirect coerente da `/staff` e `/settings/staff`.
