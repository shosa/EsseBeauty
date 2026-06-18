# EsseBeauty Unified Web App UI

## Obiettivo

Trasformare la web app in un ambiente gestionale completo e armonioso: molte funzioni e informazioni, ma organizzate con una gerarchia stabile, una navigazione continua e collegamenti operativi evidenti tra dashboard, agenda, clienti, staff, moduli e impostazioni.

## Direzione visiva

La direzione approvata è **Connected Workspace**.

- Sidebar scura e stabile come ancora dell’applicazione.
- Barra superiore continua con contesto, ricerca, creazione rapida e notifiche.
- Superficie pagina neutra e uniforme, senza ricreare uno sfondo diverso in ogni schermata.
- Colore mulberry usato per orientamento e azioni, non come decorazione onnipresente.
- Card meno gonfie, con bordi e ombre più sobri.
- Tipografia display riservata ai titoli principali; testi operativi in sans serif.
- Densità media: compatta nelle tabelle, più ariosa nei riepiloghi e nei form.

## Architettura dell’interfaccia

### Shell globale

La shell possiede lo sfondo, la larghezza del contenuto, la navigazione e le azioni globali. Le singole pagine non devono più simulare una seconda applicazione interna.

La sidebar è organizzata per aree:

1. Oggi: dashboard e agenda.
2. Relazioni: clienti e staff.
3. Operatività: lista d’attesa e moduli attivi.
4. Sistema: impostazioni.

La topbar mostra:

- breadcrumb e nome della sezione;
- ricerca globale;
- creazione rapida contestuale;
- campanella con badge;
- eventuali azioni urgenti.

### Struttura standard delle pagine

Ogni pagina usa la stessa sequenza:

1. breadcrumb compatto;
2. intestazione semplice con titolo, descrizione, stato e azione primaria;
3. eventuale fascia KPI;
4. contenuto principale;
5. pannello secondario o azioni correlate, solo quando utile.

Il grande riquadro decorativo `PageHeader` viene sostituito da un’intestazione integrata nella superficie della pagina.

### Componenti condivisi

I componenti UI devono diventare la fonte unica per:

- layout pagina e larghezza;
- header e breadcrumb;
- pannelli, KPI e toolbar;
- tabelle, filtri e stati vuoti;
- form e azioni;
- badge e notifiche;
- skeleton, errori e feedback.

Le pagine non devono definire copie locali di card statistiche, skeleton o superfici.

## Collegamenti funzionali

La dashboard diventa il punto di ingresso operativo, non una semplice collezione di numeri.

- Le richieste staff aprono la coda di revisione.
- Le prenotazioni online aprono il dettaglio appuntamento.
- Scorte, recensioni e lista d’attesa portano direttamente al lavoro da completare.
- Agenda, cliente, servizio e collaboratore si collegano reciprocamente tramite link contestuali.
- Le notifiche e la sezione “Da fare” condividono la stessa fonte dati.
- Le azioni rapide cambiano in base alla sezione corrente.

## Pagine prioritarie

### Dashboard

- KPI essenziali nella prima riga.
- Agenda di oggi come contenuto principale.
- Coda “Da fare” con richieste staff, prenotazioni online e alert moduli.
- Stato team e moduli in secondo piano.

### Calendario

- Toolbar e filtri integrati nell’header.
- Legenda, navigazione temporale e azioni nello stesso asse.
- Dettagli appuntamento con collegamenti a cliente, servizio e staff.

### Clienti, staff, servizi e inventario

- Pattern lista coerente.
- Ricerca, filtri e creazione nella stessa toolbar.
- Righe meno decorative e più leggibili.
- Dettagli con riepilogo, contenuto e azioni laterali coerenti.

### Impostazioni

- Navigazione interna visivamente collegata alla shell.
- Nessun doppio menu concorrente.
- Gruppi comprensibili: salone, team e accessi, operatività, comunicazioni, moduli.
- Badge richieste staff visibile nel punto corretto senza duplicare il conteggio ovunque.

## Responsive

- Desktop: sidebar fissa, topbar continua e contenuto fino a `max-w-7xl`.
- Tablet: sidebar compressa e pannelli a due colonne.
- Mobile: topbar essenziale, navigazione drawer e azione primaria sempre raggiungibile.
- Tabelle complesse diventano liste strutturate, non semplici tabelle tagliate.

## Migrazione

La revisione avviene dal sistema condiviso verso le pagine:

1. token, shell e primitive;
2. dashboard;
3. calendario;
4. liste principali;
5. dettagli e form;
6. impostazioni;
7. rifinitura responsive e accessibilità.

Le funzionalità e le API esistenti restano invariate. Non sono previste riscritture indiscriminate della logica dati.

## Verifica

- Test contrattuali sulle primitive e sulla struttura delle pagine.
- Typecheck di UI e web app.
- Controllo visivo desktop e mobile delle sezioni principali.
- Verifica di ricerca, navigazione, notifiche, badge e azioni rapide.
- Nessuna regressione nei flussi CRUD esistenti.
